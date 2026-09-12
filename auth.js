// auth.js - Sistema de Autenticação, Recuperação de Senha e Aprovação Manual de Contas
// Master Admin exclusivo: andrew.g.h.agh@gmail.com
// Todas as outras contas obrigatoriamente solicitam acesso e necessitam de aprovação prévia.

const AuthManager = {
  CURRENT_USER_KEY: 'hartv_current_user_session',
  LOCAL_USERS_KEY: 'hartv_registered_accounts',
  currentUser: null,
  authListeners: [],

  // E-mail do Administrador Master Principal (ÚNICO QUE PODE SER ADMIN)
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
        const parsed = JSON.parse(savedSession);
        if (this.isMasterEmail(parsed.email)) {
          this.currentUser = {
            ...parsed,
            role: 'admin',
            status: 'approved'
          };
        } else {
          // Usuários comuns NUNCA podem ter role admin
          this.currentUser = {
            ...parsed,
            role: 'user'
          };
          if (this.currentUser.status !== 'approved') {
            this.currentUser = null;
            localStorage.removeItem(this.CURRENT_USER_KEY);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao ler sessão salva:', e);
      this.currentUser = null;
    }

    // 3. Se Firebase estiver configurado e disponível
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            const isMaster = this.isMasterEmail(user.email);
            let status = isMaster ? 'approved' : 'pending';
            let role = isMaster ? 'admin' : 'user';

            if (!isMaster) {
              const accountDoc = await this.getCloudAccountDoc(user.uid);
              status = accountDoc && accountDoc.status ? accountDoc.status : 'pending';
              role = 'user'; // Jamais permitir admin para terceiros

              // Se não estiver aprovado, desconectar imediatamente!
              if (status !== 'approved') {
                await firebase.auth().signOut().catch(() => {});
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

  // Retorna os dados do usuário logado
  getUser() {
    return this.currentUser;
  },

  isLoggedIn() {
    return this.currentUser !== null;
  },

  // EXCLUSIVAMENTE andrew.g.h.agh@gmail.com pode ser administrador
  isAdmin() {
    if (!this.currentUser) return false;
    return this.isMasterEmail(this.currentUser.email);
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

  // CADASTRO DE CONTAS (SOLICITAÇÃO DE ACESSO COM APROVAÇÃO MANUAL)
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

    const isMaster = this.isMasterEmail(cleanEmail);
    // REGRA DE OURO: Somente andrew.g.h.agh@gmail.com nasce como 'approved' e 'admin'.
    // TODAS as outras contas nascem estritamente como 'pending' e 'user'!
    const initialStatus = isMaster ? 'approved' : 'pending';
    const initialRole = isMaster ? 'admin' : 'user';

    // 1. Cadastro via Firebase Auth
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(cleanEmail, cleanPass);
        if (cred.user) {
          await cred.user.updateProfile({ displayName: cleanName });

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

          // Salvar localmente também para garantir redundância total e exibição imediata
          this.saveAccountLocally(accountData);

          // Se for usuário solicitante (não-master), desconectar imediatamente e bloquear entrada
          if (!isMaster) {
            await firebase.auth().signOut().catch(() => {});
            this.currentUser = null;
            localStorage.removeItem(this.CURRENT_USER_KEY);
            this.notifyListeners();
            throw new Error('⏳ Sua solicitação foi enviada com sucesso! O acesso está bloqueado até que o administrador (andrew.g.h.agh@gmail.com) aprove o seu cadastro.');
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

    // 2. Cadastro via Modo Local Multi-Contas
    const accounts = this.getLocalAccounts();
    const existing = accounts.find(a => a.email && a.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }

    const uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const newAccount = {
      uid,
      displayName: cleanName,
      email: cleanEmail,
      passwordHash: this.simpleHash(cleanPass),
      status: initialStatus,
      role: initialRole,
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    this.saveLocalAccounts(accounts);

    // Se for usuário solicitante (não-master), bloquear entrada imediatamente
    if (!isMaster) {
      this.currentUser = null;
      localStorage.removeItem(this.CURRENT_USER_KEY);
      this.notifyListeners();
      throw new Error('⏳ Sua solicitação foi enviada com sucesso! O acesso está bloqueado até que o administrador (andrew.g.h.agh@gmail.com) aprove o seu cadastro.');
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

    // 1. Login via Firebase Auth
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const cred = await firebase.auth().signInWithEmailAndPassword(cleanEmail, cleanPass);
        if (cred.user) {
          let status = isMaster ? 'approved' : 'pending';
          let role = isMaster ? 'admin' : 'user';

          if (!isMaster) {
            // Checar documento no Firestore
            const accountDoc = await this.getCloudAccountDoc(cred.user.uid);
            status = accountDoc && accountDoc.status ? accountDoc.status : 'pending';
            role = 'user'; // Jamais admin

            if (status !== 'approved') {
              await firebase.auth().signOut().catch(() => {});
              this.currentUser = null;
              localStorage.removeItem(this.CURRENT_USER_KEY);
              if (status === 'blocked') {
                throw new Error('🚫 Sua conta foi desativada pelo administrador.');
              }
              throw new Error('⏳ Sua solicitação ainda não foi aprovada pelo administrador (andrew.g.h.agh@gmail.com). Aguarde a liberação.');
            }
          }

          this.currentUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName || cred.user.email.split('@')[0],
            status: 'approved',
            role: isMaster ? 'admin' : 'user',
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

    // 2. Login no Modo Local
    const accounts = this.getLocalAccounts();
    const account = accounts.find(a => a.email && a.email.toLowerCase() === cleanEmail);

    if (!account) {
      throw new Error('Nenhuma conta encontrada com este e-mail.');
    }

    if (account.passwordHash !== this.simpleHash(cleanPass)) {
      throw new Error('Senha incorreta. Tente novamente.');
    }

    if (!isMaster) {
      if (account.status !== 'approved') {
        if (account.status === 'blocked') {
          throw new Error('🚫 Sua conta foi desativada pelo administrador.');
        }
        throw new Error('⏳ Sua solicitação ainda não foi aprovada pelo administrador (andrew.g.h.agh@gmail.com). Aguarde a liberação.');
      }
    }

    this.currentUser = {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      status: 'approved',
      role: isMaster ? 'admin' : 'user',
      isCloud: false
    };

    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  },

  // RECUPERAÇÃO DE SENHA
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

    const accounts = this.getLocalAccounts();
    const acc = accounts.find(a => a.email && a.email.toLowerCase() === cleanEmail);
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

  // LISTAR CONTAS PARA O ADMINISTRADOR MASTER APROVAR
  async getAccountsList() {
    const masterEmail = 'andrew.g.h.agh@gmail.com';
    let cloudList = [];

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const snap = await firebase.firestore().collection('system_accounts').get();
        snap.forEach(doc => {
          if (doc.exists) cloudList.push(doc.data());
        });
      } catch (e) {
        console.warn('Erro ao listar system_accounts no Firestore:', e);
      }
    }

    const localList = this.getLocalAccounts();

    // Combinar contas da nuvem e contas locais sem duplicar por email
    const map = new Map();
    localList.forEach(acc => {
      if (acc && acc.email) map.set(acc.email.toLowerCase(), acc);
    });
    cloudList.forEach(acc => {
      if (acc && acc.email) {
        const existing = map.get(acc.email.toLowerCase());
        map.set(acc.email.toLowerCase(), { ...(existing || {}), ...acc });
      }
    });

    const list = Array.from(map.values());

    // Garantir que Andrew Harris esteja sempre presente na lista como ADMIN MASTER
    const masterUid = (this.currentUser && this.currentUser.uid) ? this.currentUser.uid : 'usr_master_agh';
    const hasMaster = list.some(a => a.email && a.email.toLowerCase() === masterEmail);
    if (!hasMaster) {
      list.unshift({
        uid: masterUid,
        displayName: 'Andrew Harris',
        email: masterEmail,
        status: 'approved',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    }

    // Blindagem: APENAS Andrew Harris pode ter role: admin
    list.forEach(a => {
      if (a.email && a.email.toLowerCase() === masterEmail) {
        a.role = 'admin';
        a.status = 'approved';
        a.uid = masterUid;
      } else {
        a.role = 'user';
      }
    });

    return list;
  },

  // Salvar conta localmente com mesclagem
  saveAccountLocally(accountData) {
    if (!accountData || !accountData.email) return;
    const accounts = this.getLocalAccounts();
    const idx = accounts.findIndex(a => a.email && a.email.toLowerCase() === accountData.email.toLowerCase());
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], ...accountData };
    } else {
      accounts.push(accountData);
    }
    this.saveLocalAccounts(accounts);
  },

  // APROVAR OU BLOQUEAR CONTA
  async updateAccountStatus(uid, newStatus) {
    if (!uid || !newStatus) return false;

    // Atualizar no Firestore
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        await firebase.firestore().collection('system_accounts').doc(uid).update({ status: newStatus });
      } catch (e) {
        console.warn('Erro ao atualizar status no Firestore:', e);
      }
    }

    // Atualizar localmente
    const accounts = this.getLocalAccounts();
    const idx = accounts.findIndex(a => a.uid === uid || a.email === uid);
    if (idx !== -1) {
      accounts[idx].status = newStatus;
      this.saveLocalAccounts(accounts);
    }
    return true;
  },

  // EXCLUIR UMA CONTA ESPECÍFICA
  async deleteAccount(uid) {
    if (!uid) return false;

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        await firebase.firestore().collection('system_accounts').doc(uid).delete();
      } catch (e) {}
    }

    const accounts = this.getLocalAccounts();
    const filtered = accounts.filter(a => a.uid !== uid && a.email !== uid);
    this.saveLocalAccounts(filtered);
    return true;
  },

  // EXCLUIR TODAS AS OUTRAS CONTAS, DEIXANDO APENAS andrew.g.h.agh@gmail.com
  async purgeNonMasterAccounts() {
    const masterEmail = 'andrew.g.h.agh@gmail.com';

    // 1. Limpeza local
    const local = this.getLocalAccounts();
    const filtered = local.filter(a => a.email && a.email.toLowerCase() === masterEmail);
    if (filtered.length === 0) {
      filtered.push({
        uid: 'usr_master_agh',
        displayName: 'Andrew Harris',
        email: masterEmail,
        status: 'approved',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    } else {
      filtered[0].role = 'admin';
      filtered[0].status = 'approved';
    }
    this.saveLocalAccounts(filtered);

    // Se o usuário logado atualmente não for o master, desconectar
    if (this.currentUser && !this.isMasterEmail(this.currentUser.email)) {
      this.currentUser = null;
      localStorage.removeItem(this.CURRENT_USER_KEY);
      this.notifyListeners();
    }

    // 2. Limpeza na nuvem (Firestore system_accounts)
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const snap = await firebase.firestore().collection('system_accounts').get();
        const batch = firebase.firestore().batch();
        let deletedCount = 0;
        snap.forEach(doc => {
          const data = doc.data();
          if (data && data.email && data.email.toLowerCase() !== masterEmail) {
            batch.delete(doc.ref);
            deletedCount++;
          }
        });
        if (deletedCount > 0) {
          await batch.commit();
          console.log(`[Auth] ${deletedCount} conta(s) não-master foram excluídas.`);
        }
      } catch (e) {
        console.warn('Aviso na limpeza do Firestore:', e);
      }
    }

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
        return 'Este e-mail já foi solicitado ou está em uso.';
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
