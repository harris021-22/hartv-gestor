// auth.js - Sistema de Autenticação, Recuperação de Senha e Aprovação Manual de Contas
// Suporta Firebase Auth e Gerenciador Multi-Contas Blindado

const AuthManager = {
  CURRENT_USER_KEY: 'hartv_current_user_session',
  LOCAL_USERS_KEY: 'hartv_registered_accounts',
  currentUser: null,
  authListeners: [],

  // E-mail do Administrador Master Principal
  MASTER_ADMIN_EMAILS: [
    'andrew.g.h.agh@gmail.com'
  ],

  isMasterEmail(email) {
    if (!email) return false;
    return this.MASTER_ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
  },

  // Inicialização do Auth
  async init() {
    // 1. Tentar restaurar sessão salva
    try {
      const savedSession = localStorage.getItem(this.CURRENT_USER_KEY);
      if (savedSession) {
        this.currentUser = JSON.parse(savedSession);
        if (this.isMasterEmail(this.currentUser.email)) {
          this.currentUser.role = 'admin';
          this.currentUser.status = 'approved';
        }
      }
    } catch (e) {
      console.error('Erro ao ler sessão salva:', e);
      this.currentUser = null;
    }

    // 2. Se Firebase estiver configurado e disponível
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            const isMaster = this.isMasterEmail(user.email);
            let status = 'approved';
            let role = isMaster ? 'admin' : 'user';

            if (!isMaster) {
              const accountDoc = await this.getCloudAccountDoc(user.uid);
              status = accountDoc ? accountDoc.status : 'pending';
              role = accountDoc ? accountDoc.role : 'user';

              if (status === 'pending') {
                await firebase.auth().signOut();
                this.currentUser = null;
                localStorage.removeItem(this.CURRENT_USER_KEY);
                this.notifyListeners();
                return;
              }
            }

            this.currentUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email.split('@')[0],
              status: status,
              role: role,
              isCloud: true
            };
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
          } else {
            if (this.currentUser && this.currentUser.isCloud) {
              this.currentUser = null;
              localStorage.removeItem(this.CURRENT_USER_KEY);
            }
          }
          this.notifyListeners();
        });
        return;
      } catch (err) {
        console.warn('Aviso ao inicializar Firebase Auth:', err);
      }
    }

    this.notifyListeners();
  },

  getUser() {
    return this.currentUser;
  },

  isLoggedIn() {
    return this.currentUser !== null;
  },

  isAdmin() {
    if (!this.currentUser) return false;
    return this.isMasterEmail(this.currentUser.email) || this.currentUser.role === 'admin';
  },

  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
      callback(this.currentUser);
    }
  },

  notifyListeners() {
    this.authListeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { console.error(e); }
    });
  },

  // CADASTRO COM APROVAÇÃO MANUAL
  async register(displayName, email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const cleanName = String(displayName || '').trim() || cleanEmail.split('@')[0];

    if (!cleanEmail || !cleanPass) {
      throw new Error('Preencha o e-mail e a senha.');
    }
    if (cleanPass.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    // Se Firebase estiver configurado
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(cleanEmail, cleanPass);
        if (cred.user) {
          await cred.user.updateProfile({ displayName: cleanName });

          // Verificar se é o email do Master Admin ou primeira conta
          const isMaster = this.isMasterEmail(cleanEmail);
          const allAccs = await this.getAccountsList();
          const isFirstAccount = allAccs.length <= 1;
          const initialStatus = (isMaster || isFirstAccount) ? 'approved' : 'pending';
          const initialRole = (isMaster || isFirstAccount) ? 'admin' : 'user';

          // Salvar metadados da conta para aprovação
          const accountData = {
            uid: cred.user.uid,
            email: cleanEmail,
            displayName: cleanName,
            status: initialStatus,
            role: initialRole,
            createdAt: new Date().toISOString()
          };

          try {
            await firebase.firestore().collection('system_accounts').doc(cred.user.uid).set(accountData, { merge: true });
          } catch (e) {
            console.warn('Erro ao salvar em system_accounts:', e);
          }

          if (initialStatus === 'pending') {
            await firebase.auth().signOut();
            throw new Error('⏳ Sua conta foi cadastrada com sucesso! Ela está aguardando a aprovação manual do administrador para ser liberada.');
          }

          this.currentUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cleanName,
            status: initialStatus,
            role: initialRole,
            isCloud: true
          };
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
          this.notifyListeners();
          return this.currentUser;
        }
      } catch (fbErr) {
        throw new Error(this.translateFirebaseError(fbErr));
      }
    }

    // MODO LOCAL MULTI-CONTAS COM APROVAÇÃO MANUAL
    const accounts = this.getLocalAccounts();
    const existing = accounts.find(a => a.email === cleanEmail);
    if (existing) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }

    const isMaster = this.isMasterEmail(cleanEmail);
    const isFirst = accounts.length === 0;
    const uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const newAccount = {
      uid,
      displayName: cleanName,
      email: cleanEmail,
      passwordHash: this.simpleHash(cleanPass),
      status: (isMaster || isFirst) ? 'approved' : 'pending',
      role: (isMaster || isFirst) ? 'admin' : 'user',
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    this.saveLocalAccounts(accounts);

    if (newAccount.status === 'pending') {
      throw new Error('⏳ Sua conta foi cadastrada com sucesso! Ela está aguardando a aprovação manual do administrador para ser liberada.');
    }

    this.currentUser = {
      uid: newAccount.uid,
      email: newAccount.email,
      displayName: newAccount.displayName,
      status: newAccount.status,
      role: newAccount.role,
      isCloud: false
    };

    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  },

  // LOGIN COM VERIFICAÇÃO DE APROVAÇÃO
  async login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanEmail || !cleanPass) {
      throw new Error('Informe o e-mail e a senha.');
    }

    const isMaster = this.isMasterEmail(cleanEmail);

    // Se Firebase estiver configurado
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const cred = await firebase.auth().signInWithEmailAndPassword(cleanEmail, cleanPass);
        if (cred.user) {
          let status = 'approved';
          let role = isMaster ? 'admin' : 'user';

          if (!isMaster) {
            // Verificar status no Firestore
            const accountDoc = await this.getCloudAccountDoc(cred.user.uid);
            status = accountDoc ? accountDoc.status : 'pending';
            role = accountDoc ? accountDoc.role : 'user';

            if (status === 'pending') {
              await firebase.auth().signOut();
              throw new Error('⏳ Sua conta ainda aguarda aprovação manual do administrador para ser liberada.');
            }
            if (status === 'blocked') {
              await firebase.auth().signOut();
              throw new Error('🚫 Sua conta foi desativada pelo administrador.');
            }
          }

          this.currentUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName || cred.user.email.split('@')[0],
            status: status,
            role: role,
            isCloud: true
          };
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
          this.notifyListeners();
          return this.currentUser;
        }
      } catch (fbErr) {
        throw new Error(this.translateFirebaseError(fbErr));
      }
    }

    // MODO LOCAL
    const accounts = this.getLocalAccounts();
    const account = accounts.find(a => a.email === cleanEmail);

    if (!account) {
      throw new Error('Nenhuma conta encontrada com este e-mail.');
    }

    if (account.passwordHash !== this.simpleHash(cleanPass)) {
      throw new Error('Senha incorreta. Tente novamente.');
    }

    if (!isMaster) {
      if (account.status === 'pending') {
        throw new Error('⏳ Sua conta ainda aguarda aprovação manual do administrador para ser liberada.');
      }
      if (account.status === 'blocked') {
        throw new Error('🚫 Sua conta foi desativada pelo administrador.');
      }
    }

    this.currentUser = {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      status: 'approved',
      role: isMaster ? 'admin' : (account.role || 'user'),
      isCloud: false
    };

    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  },

  // RECUPERAÇÃO DE SENHA (Esqueci minha senha)
  async sendPasswordReset(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Por favor, informe seu e-mail de cadastro.');
    }

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        await firebase.auth().sendPasswordResetEmail(cleanEmail);
        return true;
      } catch (fbErr) {
        throw new Error(this.translateFirebaseError(fbErr));
      }
    }

    // Modo local: simulação de recuperação
    const accounts = this.getLocalAccounts();
    const acc = accounts.find(a => a.email === cleanEmail);
    if (!acc) {
      throw new Error('Nenhuma conta encontrada com este e-mail.');
    }
    return true;
  },

  // LOGOUT
  async logout() {
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        await firebase.auth().signOut();
      } catch (e) {
        console.warn('Erro ao deslogar no Firebase:', e);
      }
    }

    this.currentUser = null;
    localStorage.removeItem(this.CURRENT_USER_KEY);
    this.notifyListeners();
    return true;
  },

  // LISTAR CONTAS PARA O ADMINISTRADOR APROVAR
  async getAccountsList() {
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const snap = await firebase.firestore().collection('system_accounts').get();
        const list = [];
        snap.forEach(doc => list.push(doc.data()));
        if (list.length > 0) return list;
      } catch (e) {
        console.warn('Erro ao listar system_accounts no Firestore:', e);
      }
    }
    return this.getLocalAccounts();
  },

  // APROVAR OU BLOQUEAR CONTA
  async updateAccountStatus(uid, newStatus) {
    if (!uid || !newStatus) return false;

    // Atualizar no Firestore se disponível
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        await firebase.firestore().collection('system_accounts').doc(uid).update({ status: newStatus });
      } catch (e) {
        console.warn('Erro ao atualizar status no Firestore:', e);
      }
    }

    // Atualizar localmente
    const accounts = this.getLocalAccounts();
    const idx = accounts.findIndex(a => a.uid === uid);
    if (idx !== -1) {
      accounts[idx].status = newStatus;
      this.saveLocalAccounts(accounts);
    }
    return true;
  },

  // EXCLUIR CONTA
  async deleteAccount(uid) {
    if (!uid) return false;

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        await firebase.firestore().collection('system_accounts').doc(uid).delete();
      } catch (e) {}
    }

    const accounts = this.getLocalAccounts();
    const filtered = accounts.filter(a => a.uid !== uid);
    this.saveLocalAccounts(filtered);
    return true;
  },

  async getCloudAccountDoc(uid) {
    try {
      const doc = await firebase.firestore().collection('system_accounts').doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      return null;
    }
  },

  getLocalAccounts() {
    try {
      const data = localStorage.getItem(this.LOCAL_USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveLocalAccounts(accounts) {
    try {
      localStorage.setItem(this.LOCAL_USERS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.error('Erro ao salvar contas locais:', e);
    }
  },

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  },

  translateFirebaseError(error) {
    const code = error.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já está sendo utilizado por outra conta.';
      case 'auth/invalid-email':
        return 'O endereço de e-mail informado é inválido.';
      case 'auth/weak-password':
        return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'E-mail ou senha incorretos.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas sem sucesso. Aguarde alguns minutos e tente novamente.';
      default:
        return error.message || 'Ocorreu um erro na autenticação.';
    }
  }
};
