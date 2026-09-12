// auth.js - Sistema de Autenticação e Gestão de Múltiplas Contas
// Suporta Firebase Auth e Gerenciador Local Multi-Contas Blindado

const AuthManager = {
  CURRENT_USER_KEY: 'hartv_current_user_session',
  LOCAL_USERS_KEY: 'hartv_registered_accounts',
  currentUser: null,
  authListeners: [],

  // Inicialização do Auth
  async init() {
    // 1. Tentar restaurar sessão salva
    try {
      const savedSession = localStorage.getItem(this.CURRENT_USER_KEY);
      if (savedSession) {
        this.currentUser = JSON.parse(savedSession);
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
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            this.currentUser = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email.split('@')[0],
              isCloud: true
            };
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
          } else {
            // Se deslogou no Firebase
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

    // Notificar ouvintes do estado atual
    this.notifyListeners();
  },

  // Obter usuário logado atual
  getUser() {
    return this.currentUser;
  },

  // Verificar se está logado
  isLoggedIn() {
    return this.currentUser !== null;
  },

  // Registrar ouvinte de mudança de login/logout
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
      // Disparar imediatamente com o estado atual
      callback(this.currentUser);
    }
  },

  notifyListeners() {
    this.authListeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { console.error(e); }
    });
  },

  // CADASTRO DE NOVA CONTA
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
          this.currentUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cleanName,
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

    // MODO LOCAL MULTI-CONTAS
    const accounts = this.getLocalAccounts();
    const existing = accounts.find(a => a.email === cleanEmail);
    if (existing) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }

    // Gerar UID único para a conta
    const uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const newAccount = {
      uid,
      displayName: cleanName,
      email: cleanEmail,
      passwordHash: this.simpleHash(cleanPass),
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    this.saveLocalAccounts(accounts);

    this.currentUser = {
      uid: newAccount.uid,
      email: newAccount.email,
      displayName: newAccount.displayName,
      isCloud: false
    };

    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  },

  // LOGIN
  async login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanEmail || !cleanPass) {
      throw new Error('Informe o e-mail e a senha.');
    }

    // Se Firebase estiver configurado
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const cred = await firebase.auth().signInWithEmailAndPassword(cleanEmail, cleanPass);
        if (cred.user) {
          this.currentUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName || cred.user.email.split('@')[0],
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

    // MODO LOCAL MULTI-CONTAS
    const accounts = this.getLocalAccounts();
    const account = accounts.find(a => a.email === cleanEmail);

    if (!account) {
      throw new Error('Nenhuma conta encontrada com este e-mail.');
    }

    if (account.passwordHash !== this.simpleHash(cleanPass)) {
      throw new Error('Senha incorreta. Tente novamente.');
    }

    this.currentUser = {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      isCloud: false
    };

    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    this.notifyListeners();
    return this.currentUser;
  },

  // LOGOUT (Sair da conta)
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

  // Gerenciamento de contas locais seguras
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

  // Hash simples para senhas locais
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  },

  // Tradução amigável de erros do Firebase
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
