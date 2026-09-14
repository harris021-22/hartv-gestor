// auth.js - Sistema de Autenticação, Recuperação de Senha e Aprovação Manual de Contas
// Master Admin exclusivo: andrew.g.h.agh@gmail.com
// Todas as outras contas obrigatoriamente solicitam acesso e necessitam de aprovação prévia.

const AuthManager = {
  CURRENT_USER_KEY: 'hartv_current_user_session',
  LOCAL_USERS_KEY: 'hartv_registered_accounts',
  currentUser: null,
  authListeners: [],

  // E-mail do Administrador Master Principal (ÚNICO E EXCLUSIVO QUE PODE SER ADMIN)
  MASTER_ADMIN_EMAILS: [
    'andrew.g.h.agh@gmail.com'
  ],

  isMasterEmail(email) {
    if (!email) return false;
    const clean = String(email).trim().toLowerCase();
    return clean === 'andrew.g.h.agh@gmail.com' || clean === 'admin' || clean === 'andrew';
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
          // Usuários comuns NUNCA podem ter role admin (apenas andrew.g.h.agh@gmail.com)
          this.currentUser = {
            ...parsed,
            role: 'user'
          };
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
          if (this.currentUser.status !== 'approved') {
            this.currentUser = null;
            localStorage.removeItem(this.CURRENT_USER_KEY);
          }
        }
      }

      // Excluir teste1 e sanitizar contas locais para deixar APENAS andrew.g.h.agh@gmail.com como admin
      const localAccs = this.getLocalAccounts();
      const cleanedAccs = localAccs.filter(acc => {
        const mail = String(acc.email || '').toLowerCase().trim();
        const usr = String(acc.username || '').toLowerCase().trim();
        const dName = String(acc.displayName || '').toLowerCase().trim();
        if (mail.includes('pepreto') || usr === '123456' || dName === 'teste1') return false;
        return true;
      });
      cleanedAccs.forEach(acc => {
        const mail = String(acc.email || '').toLowerCase().trim();
        if (mail !== 'andrew.g.h.agh@gmail.com') {
          acc.role = 'user';
        }
      });
      this.saveLocalAccounts(cleanedAccs);
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
              const check = await this.checkUserApprovalStatus(user.uid, user.email);
              status = check.status;
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

  // VERIFICAÇÃO DE STATUS DE ACESSO (ATIVO OU BLOQUEADO)
  async checkUserApprovalStatus(uid, email) {
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    if (this.isMasterEmail(cleanEmail)) {
      return { status: 'approved', role: 'admin' };
    }

    let foundStatus = null;

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      const db = firebase.firestore();

      // 1. Tentar por UID no Firestore
      if (uid && uid !== 'undefined' && uid !== 'null') {
        try {
          const docSnap = await db.collection('system_accounts').doc(String(uid)).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.status) {
              foundStatus = data.status;
            }
          }
        } catch (e) {
          console.warn('[Auth] Aviso ao buscar status por UID:', e);
        }
      }

      // 2. Tentar por Email como ID do documento
      if (!foundStatus && cleanEmail) {
        try {
          const docSnap = await db.collection('system_accounts').doc(cleanEmail).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.status) {
              foundStatus = data.status;
            }
          }
        } catch (e) {
          console.warn('[Auth] Aviso ao buscar status por email-doc:', e);
        }
      }

      // 3. Tentar por query onde email == cleanEmail
      if (!foundStatus && cleanEmail) {
        try {
          const qSnap = await db.collection('system_accounts').where('email', '==', cleanEmail).get();
          qSnap.forEach(d => {
            const data = d.data();
            if (data && data.status === 'blocked') {
              foundStatus = 'blocked';
            } else if (!foundStatus && data && data.status) {
              foundStatus = data.status;
            }
          });
        } catch (e) {
          console.warn('[Auth] Aviso ao buscar status por query email:', e);
        }
      }
    }

    // 4. Fallback no LocalStorage
    if (!foundStatus && cleanEmail) {
      const localAcc = this.getLocalAccounts().find(a => (a.email && a.email.toLowerCase() === cleanEmail) || (uid && a.uid === uid));
      if (localAcc && localAcc.status) {
        foundStatus = localAcc.status;
      }
    }

    // Regra: Somente se estiver explicitamente 'blocked', o usuário é impedido.
    // Como todo usuário agora é criado diretamente pelo Admin Master, o padrão é sempre liberado ('approved')!
    return {
      status: foundStatus === 'blocked' ? 'blocked' : 'approved',
      role: 'user'
    };
  },

  // CRIAÇÃO DIRETA DE USUÁRIO PELO ADMINISTRADOR MASTER
  async createUserByAdmin(displayName, loginInput, password) {
    if (!this.isAdmin()) {
      throw new Error('Apenas o Administrador Master pode criar novos usuários.');
    }

    const cleanName = String(displayName || '').trim();
    const rawLogin = String(loginInput || '').trim();
    const cleanPass = String(password || '').trim();

    if (!cleanName) {
      throw new Error('Por favor, informe o nome ou identificação do usuário.');
    }
    if (!rawLogin) {
      throw new Error('Por favor, informe o usuário ou e-mail de acesso.');
    }
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    // Normalizar usuário ou e-mail
    const isEmail = rawLogin.includes('@');
    let email = rawLogin.toLowerCase();
    let username = rawLogin.toLowerCase();

    if (!isEmail) {
      username = rawLogin.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
      if (!username) {
        throw new Error('Nome de usuário inválido. Use apenas letras, números e pontos.');
      }
      email = `${username}@hartv.app`;
    } else {
      username = rawLogin.split('@')[0].toLowerCase();
    }

    if (this.isMasterEmail(email) || username === 'admin' || username === 'andrew') {
      throw new Error('Não é permitido criar um usuário com os dados do Administrador Master.');
    }

    let uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    let cloudCreated = false;
    let firestoreSaved = false;

    // 1. Criar ou atualizar no Firebase Auth via REST API oficial (sem interferir na sessão ativa do Admin)
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && firebaseConfig.apiKey) {
      try {
        const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
        const resp = await fetch(restUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            password: cleanPass,
            returnSecureToken: true
          })
        });
        const data = await resp.json();

        if (resp.ok && data.localId) {
          uid = data.localId;
          cloudCreated = true;
          // Atualizar displayName se token disponível
          if (data.idToken) {
            fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken: data.idToken,
                displayName: cleanName
              })
            }).catch(() => {});
          }
        } else if (data.error && data.error.message === 'EMAIL_EXISTS') {
          console.log('[Auth] Usuário já existe no Firebase Auth. Atualizando senha via REST...');
          try {
            const signInResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email,
                password: cleanPass,
                returnSecureToken: true
              })
            });
            const signInData = await signInResp.json();
            if (signInResp.ok && signInData.localId) {
              uid = signInData.localId;
              cloudCreated = true;
            }
          } catch (e) {
            console.warn('[Auth] Aviso ao tentar signIn secundário:', e);
          }
        } else {
          console.warn('[Auth] Erro retornado pela API Firebase Auth:', data.error);
          throw new Error(this.translateFirebaseError(data.error || { message: 'Erro ao criar conta no Firebase' }));
        }
      } catch (restErr) {
        console.warn('[Auth] Falha no registro Firebase Auth:', restErr);
        if (restErr.message && !restErr.message.includes('fetch')) {
          throw restErr;
        }
      }
    }

    // 2. Salvar dados da conta no Firestore
    const accountData = {
      uid: uid,
      displayName: cleanName,
      username: username,
      email: email,
      loginDisplay: isEmail ? email : username,
      plainPassword: cleanPass, // Armazenada para o Admin poder reenviar ou copiar ao cliente
      status: 'approved',
      role: 'user',
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser ? this.currentUser.email : 'andrew.g.h.agh@gmail.com'
    };

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      const db = firebase.firestore();

      // A) Salvar na coleção gerenciada do Admin Master (100% de sucesso mesmo com regras padrão!)
      if (this.currentUser && this.currentUser.uid) {
        try {
          await db.collection('users').doc(this.currentUser.uid).collection('managed_users').doc(uid).set(accountData, { merge: true });
          firestoreSaved = true;
        } catch (e) {
          console.warn('[Auth] Aviso ao salvar em users/{admin}/managed_users:', e);
        }
      }

      // B) Salvar em system_accounts (caso as regras estejam publicadas)
      try {
        await db.collection('system_accounts').doc(uid).set(accountData, { merge: true });
        if (email) {
          await db.collection('system_accounts').doc(email).set(accountData, { merge: true });
        }
        if (username) {
          await db.collection('system_accounts').doc(username).set(accountData, { merge: true });
        }
        firestoreSaved = true;
      } catch (fsErr) {
        console.warn('[Auth] Aviso ao salvar em system_accounts:', fsErr);
      }
    }

    // 3. Salvar localmente em LocalStorage (redundância total e modo offline)
    const localAccountData = {
      ...accountData,
      passwordHash: this.simpleHash(cleanPass)
    };
    this.saveAccountLocally(localAccountData);

    return {
      success: true,
      user: localAccountData,
      plainPassword: cleanPass,
      loginDisplay: isEmail ? email : username,
      cloudCreated: cloudCreated,
      firestoreSaved: firestoreSaved
    };
  },

  // ALTERAR SENHA DE UM USUÁRIO PELO ADMINISTRADOR MASTER
  async changeUserPasswordByAdmin(uid, email, newPassword, oldPassword) {
    if (!this.isAdmin()) {
      throw new Error('Apenas o Administrador Master pode alterar a senha de usuários.');
    }
    const cleanPass = String(newPassword || '').trim();
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }
    const cleanEmail = String(email || '').trim().toLowerCase();

    // 1. Tentar atualizar no Firebase Auth via REST se possível
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && firebaseConfig.apiKey && cleanEmail) {
      try {
        if (oldPassword) {
          const sRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password: oldPassword, returnSecureToken: true })
          });
          const sData = await sRes.json();
          if (sRes.ok && sData.idToken) {
            await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: sData.idToken, password: cleanPass, returnSecureToken: true })
            });
            console.log('[Auth] Senha atualizada no Firebase Auth via REST.');
          }
        }
      } catch (e) {
        console.warn('[Auth] Erro ao atualizar senha no Firebase Auth via REST:', e);
      }

      // Atualizar no Firestore
      try {
        const db = firebase.firestore();
        const updateObj = {
          plainPassword: cleanPass,
          updatedAt: new Date().toISOString()
        };
        if (this.currentUser && this.currentUser.uid && uid) {
          await db.collection('users').doc(this.currentUser.uid).collection('managed_users').doc(String(uid)).set(updateObj, { merge: true });
        }
        if (uid) await db.collection('system_accounts').doc(String(uid)).set(updateObj, { merge: true });
        if (cleanEmail) await db.collection('system_accounts').doc(cleanEmail).set(updateObj, { merge: true });
      } catch (e) {
        console.warn('[Auth] Erro ao atualizar senha no Firestore:', e);
      }
    }

    // 2. Atualizar no LocalStorage
    const accounts = this.getLocalAccounts();
    accounts.forEach(a => {
      if ((uid && a.uid === uid) || (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail)) {
        a.passwordHash = this.simpleHash(cleanPass);
        a.plainPassword = cleanPass;
      }
    });
    this.saveLocalAccounts(accounts);

    return true;
  },

  // LOGIN (SUPORTA USUÁRIO, E-MAIL E RECOVERY EMAIL COM SINCRONIZAÇÃO AUTOMÁTICA)
  async login(loginInput, password) {
    const rawInput = String(loginInput || '').trim();
    const cleanPass = String(password || '').trim();

    if (!rawInput || !cleanPass) {
      throw new Error('Informe o usuário/e-mail e a senha.');
    }

    const isMasterAlias = rawInput.toLowerCase() === 'admin' || rawInput.toLowerCase() === 'andrew';
    const isEmail = rawInput.includes('@');
    const cleanLower = rawInput.toLowerCase();
    const cleanUsername = rawInput.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();

    // 1. Administrador Master
    if (isMasterAlias || this.isMasterEmail(cleanLower)) {
      const masterEmail = 'andrew.g.h.agh@gmail.com';
      if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
        try {
          const cred = await firebase.auth().signInWithEmailAndPassword(masterEmail, cleanPass);
          if (cred.user) {
            this.currentUser = {
              uid: cred.user.uid,
              email: cred.user.email,
              displayName: cred.user.displayName || 'Andrew Harris (Master)',
              status: 'approved',
              role: 'admin',
              isCloud: true
            };
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
            this.notifyListeners();
            return this.currentUser;
          }
        } catch (e) {
          console.warn('[Auth] Falha login master via Firebase:', e);
          const localAcc = this.getLocalAccounts().find(a => this.isMasterEmail(a.email));
          if (localAcc) {
            const passMatches = (localAcc.plainPassword && localAcc.plainPassword === cleanPass) ||
                                (localAcc.passwordHash && localAcc.passwordHash === this.simpleHash(cleanPass));
            if (passMatches) {
              this.currentUser = {
                uid: localAcc.uid || 'usr_master_agh',
                email: masterEmail,
                displayName: 'Andrew Harris (Master)',
                status: 'approved',
                role: 'admin',
                isCloud: false
              };
              localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
              this.notifyListeners();
              return this.currentUser;
            }
          }
          throw new Error('Senha do Administrador incorreta.');
        }
      }
    }

    // 2. Localizar a conta do usuário (no LocalStorage e no Firestore)
    let account = null;
    const localAccounts = this.getLocalAccounts();
    account = localAccounts.find(a => 
      (a.username && a.username.toLowerCase() === cleanUsername) ||
      (a.loginDisplay && a.loginDisplay.toLowerCase() === cleanUsername) ||
      (a.email && a.email.toLowerCase() === cleanLower) ||
      (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanLower)
    );

    // Se não encontrou no LocalStorage, buscar no Firestore system_accounts
    if (!account && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const db = firebase.firestore();
        if (cleanUsername) {
          const docSnap = await db.collection('system_accounts').doc(cleanUsername).get();
          if (docSnap.exists) account = { uid: docSnap.id, ...docSnap.data() };
        }
        if (!account && cleanLower) {
          const docSnap = await db.collection('system_accounts').doc(cleanLower).get();
          if (docSnap.exists) account = { uid: docSnap.id, ...docSnap.data() };
        }
        if (!account && cleanUsername) {
          const q = await db.collection('system_accounts').where('username', '==', cleanUsername).limit(1).get();
          q.forEach(d => { if (d.exists && !account) account = { uid: d.id, ...d.data() }; });
        }
        if (!account && cleanLower.includes('@')) {
          const q = await db.collection('system_accounts').where('recoveryEmail', '==', cleanLower).limit(1).get();
          q.forEach(d => { if (d.exists && !account) account = { uid: d.id, ...d.data() }; });
        }
      } catch (e) {
        console.warn('[Auth] Aviso ao buscar conta no Firestore:', e);
      }
    }

    // 3. Montar lista de e-mails candidatos para autenticar no Firebase Auth
    // Prioriza o recoveryEmail (pois foi onde a senha foi redefinida pelo link do Google!)
    const candidateEmails = [];
    if (account && account.recoveryEmail) candidateEmails.push(account.recoveryEmail.toLowerCase());
    if (account && account.email) candidateEmails.push(account.email.toLowerCase());
    if (isEmail) candidateEmails.push(cleanLower);
    if (cleanUsername) candidateEmails.push(`${cleanUsername}@hartv.app`);

    const uniqueEmails = [...new Set(candidateEmails.filter(e => e && e.includes('@')))];

    let firebaseUser = null;
    let lastFbError = null;

    // 4. Autenticar no Firebase Auth
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      for (const testEmail of uniqueEmails) {
        try {
          const cred = await firebase.auth().signInWithEmailAndPassword(testEmail, cleanPass);
          if (cred && cred.user) {
            firebaseUser = cred.user;
            break;
          }
        } catch (err) {
          lastFbError = err;
        }
      }

      if (firebaseUser) {
        const firebaseUid = firebaseUser.uid;

        // Migrar dados locais se a conta possuía um UID local diferente (ex: gerado localmente como usr_...)
        if (account?.uid && account.uid !== firebaseUid) {
          try {
            const oldClientsKey = `hartv_clients_${account.uid}`;
            const newClientsKey = `hartv_clients_${firebaseUid}`;
            const oldClients = localStorage.getItem(oldClientsKey);
            if (oldClients && !localStorage.getItem(newClientsKey)) {
              localStorage.setItem(newClientsKey, oldClients);
            }
            const oldSettingsKey = `hartv_settings_${account.uid}`;
            const newSettingsKey = `hartv_settings_${firebaseUid}`;
            const oldSettings = localStorage.getItem(oldSettingsKey);
            if (oldSettings && !localStorage.getItem(newSettingsKey)) {
              localStorage.setItem(newSettingsKey, oldSettings);
            }
          } catch (e) {
            console.warn('[Auth] Erro ao migrar cache local de clientes:', e);
          }
        }

        // O UID da sessão ativa DEVE ser o firebaseUid para cumprir a regra de segurança do Firestore
        // (match /users/{userId}/{document=**} { allow read, write: if request.auth.uid == userId; })
        const userUid = firebaseUid;

        const check = await this.checkUserApprovalStatus(userUid, firebaseUser.email);
        if (check.status === 'blocked') {
          await firebase.auth().signOut().catch(() => {});
          this.currentUser = null;
          localStorage.removeItem(this.CURRENT_USER_KEY);
          throw new Error('🚫 Sua conta foi desativada pelo administrador.');
        }

        // Sincronizar nova senha e UID no Firestore system_accounts
        const updatePassObj = {
          uid: firebaseUid,
          plainPassword: cleanPass,
          updatedAt: new Date().toISOString()
        };
        try {
          const db = firebase.firestore();
          if (account?.uid) await db.collection('system_accounts').doc(String(account.uid)).set(updatePassObj, { merge: true });
          if (account?.username) await db.collection('system_accounts').doc(account.username.toLowerCase()).set(updatePassObj, { merge: true });
          if (firebaseUser.email) await db.collection('system_accounts').doc(firebaseUser.email.toLowerCase()).set(updatePassObj, { merge: true });
          await db.collection('system_accounts').doc(firebaseUid).set(updatePassObj, { merge: true });
        } catch (e) {
          console.warn('[Auth] Aviso ao sincronizar nova senha no Firestore:', e);
        }

        // Sincronizar nova senha no LocalStorage
        const accounts = this.getLocalAccounts();
        let foundInLocal = false;
        accounts.forEach(a => {
          if ((account?.uid && a.uid === account.uid) || 
              (account?.username && a.username && a.username.toLowerCase() === account.username.toLowerCase()) ||
              (a.email && a.email.toLowerCase() === firebaseUser.email.toLowerCase()) ||
              (a.recoveryEmail && a.recoveryEmail.toLowerCase() === firebaseUser.email.toLowerCase())) {
            a.uid = firebaseUid;
            a.plainPassword = cleanPass;
            a.passwordHash = this.simpleHash(cleanPass);
            a.email = firebaseUser.email;
            foundInLocal = true;
          }
        });
        if (!foundInLocal && account) {
          accounts.push({
            ...account,
            uid: firebaseUid,
            plainPassword: cleanPass,
            passwordHash: this.simpleHash(cleanPass),
            email: firebaseUser.email
          });
        }
        this.saveLocalAccounts(accounts);

        this.currentUser = {
          uid: userUid,
          email: firebaseUser.email,
          displayName: account?.displayName || account?.username || rawInput,
          status: 'approved',
          role: 'user',
          isCloud: true
        };
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
        this.notifyListeners();
        return this.currentUser;
      }
    }

    // 5. Fallback Modo Local (caso Firebase offline ou conta salva localmente)
    if (account) {
      const passMatches = (account.plainPassword && account.plainPassword === cleanPass) ||
                          (account.passwordHash && account.passwordHash === this.simpleHash(cleanPass));
      if (passMatches) {
        if (account.status === 'blocked') {
          throw new Error('🚫 Sua conta foi desativada pelo administrador.');
        }

        this.currentUser = {
          uid: account.uid,
          email: account.email || account.recoveryEmail || `${cleanUsername}@hartv.app`,
          displayName: account.displayName || account.username || rawInput,
          status: 'approved',
          role: 'user',
          isCloud: false
        };
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
        this.notifyListeners();
        return this.currentUser;
      }
    }

    if (lastFbError) {
      throw new Error(this.translateFirebaseError(lastFbError));
    }
    throw new Error('Usuário ou senha incorretos.');
  },

  // Tradutor amigável de erros do Firebase Auth
  translateFirebaseError(error) {
    if (!error) return 'Ocorreu um erro na autenticação.';
    const msg = error.message || error.code || String(error);

    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('INVALID_PASSWORD')) {
      return 'Usuário ou senha incorretos.';
    }
    if (msg.includes('too-many-requests')) {
      return 'Muitas tentativas sem sucesso. Aguarde alguns minutos ou redefina sua senha.';
    }
    if (msg.includes('user-disabled')) {
      return 'Esta conta foi desativada pelo administrador.';
    }
    if (msg.includes('invalid-email')) {
      return 'Formato de e-mail inválido.';
    }
    if (msg.includes('network-request-failed')) {
      return 'Falha de conexão com a internet. Verifique sua rede.';
    }

    return error.message || 'Falha na autenticação. Tente novamente.';
  },

  // BUSCA DE CONTA PARA RECUPERAÇÃO (PROCURA POR USUÁRIO OU E-MAIL)
  async findAccountByLogin(loginInput) {
    const raw = String(loginInput || '').trim();
    if (!raw) return null;

    const isMasterAlias = raw.toLowerCase() === 'admin' || raw.toLowerCase() === 'andrew';
    const cleanLower = raw.toLowerCase();
    const cleanUsername = raw.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();

    // 1. Verificar se é o Administrador Master
    if (isMasterAlias || this.isMasterEmail(cleanLower)) {
      return {
        uid: 'usr_master_agh',
        displayName: 'Administrador Master',
        username: 'admin',
        email: 'andrew.g.h.agh@gmail.com',
        loginDisplay: 'admin',
        recoveryEmail: 'andrew.g.h.agh@gmail.com',
        isMaster: true
      };
    }

    // 2. Buscar no LocalStorage
    const localAccounts = this.getLocalAccounts();
    const localMatch = localAccounts.find(a => 
      (a.username && a.username.toLowerCase() === cleanUsername) ||
      (a.loginDisplay && a.loginDisplay.toLowerCase() === cleanUsername) ||
      (a.email && a.email.toLowerCase() === cleanLower) ||
      (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanLower)
    );

    let foundAccount = localMatch ? { ...localMatch } : null;

    // 3. Buscar no Firestore (system_accounts)
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const db = firebase.firestore();

        // Tentar buscar diretamente por doc id (username ou email)
        if (!foundAccount && cleanUsername) {
          const uDoc = await db.collection('system_accounts').doc(cleanUsername).get();
          if (uDoc.exists) {
            foundAccount = { uid: uDoc.id, ...uDoc.data() };
          }
        }

        if (!foundAccount && cleanLower) {
          const eDoc = await db.collection('system_accounts').doc(cleanLower).get();
          if (eDoc.exists) {
            foundAccount = { uid: eDoc.id, ...eDoc.data() };
          }
        }

        // Se ainda não achou, buscar por query de username ou loginDisplay
        if (!foundAccount && cleanUsername) {
          const q1 = await db.collection('system_accounts').where('username', '==', cleanUsername).limit(1).get();
          q1.forEach(d => {
            if (d.exists && !foundAccount) foundAccount = { uid: d.id, ...d.data() };
          });
        }

        if (!foundAccount && cleanLower.includes('@')) {
          const q2 = await db.collection('system_accounts').where('recoveryEmail', '==', cleanLower).limit(1).get();
          q2.forEach(d => {
            if (d.exists && !foundAccount) foundAccount = { uid: d.id, ...d.data() };
          });
        }
      } catch (err) {
        console.warn('[Auth] Aviso ao buscar conta no Firestore:', err);
      }
    }

    if (foundAccount) {
      // Normalizar e-mail de recuperação preferencial
      if (!foundAccount.recoveryEmail) {
        if (foundAccount.email && !foundAccount.email.endsWith('@hartv.app')) {
          foundAccount.recoveryEmail = foundAccount.email;
        }
      }
    }

    return foundAccount;
  },

  // SALVAR E-MAIL DE RECUPERAÇÃO VINCULADO PERMANENTEMENTE AO USUÁRIO
  async saveRecoveryEmail(account, recoveryEmail) {
    const cleanEmail = String(recoveryEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Por favor, informe um endereço de e-mail válido.');
    }

    const updateObj = {
      recoveryEmail: cleanEmail,
      updatedAt: new Date().toISOString()
    };

    // 1. Atualizar no Firestore
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const db = firebase.firestore();
        if (account.uid) {
          await db.collection('system_accounts').doc(String(account.uid)).set(updateObj, { merge: true });
        }
        if (account.email) {
          await db.collection('system_accounts').doc(account.email.toLowerCase()).set(updateObj, { merge: true });
        }
        if (account.username) {
          await db.collection('system_accounts').doc(account.username.toLowerCase()).set(updateObj, { merge: true });
        }
        // Criar/atualizar documento indexado pelo recoveryEmail apontando para a conta original
        const fullAccountRecord = {
          uid: account.uid || 'usr_' + Date.now(),
          username: account.username || account.loginDisplay || '',
          displayName: account.displayName || account.username || '',
          email: cleanEmail,
          recoveryEmail: cleanEmail,
          status: 'approved',
          role: 'user',
          updatedAt: new Date().toISOString()
        };
        await db.collection('system_accounts').doc(cleanEmail).set(fullAccountRecord, { merge: true });
      } catch (e) {
        console.warn('[Auth] Aviso ao salvar recoveryEmail no Firestore:', e);
      }
    }

    // 2. Atualizar no LocalStorage
    const accounts = this.getLocalAccounts();
    let updatedLocal = false;
    accounts.forEach(a => {
      const matchUid = account.uid && a.uid === account.uid;
      const matchUser = account.username && a.username && a.username.toLowerCase() === account.username.toLowerCase();
      const matchEmail = account.email && a.email && a.email.toLowerCase() === account.email.toLowerCase();
      if (matchUid || matchUser || matchEmail) {
        a.recoveryEmail = cleanEmail;
        if (!a.email || a.email.endsWith('@hartv.app')) {
          a.email = cleanEmail;
        }
        updatedLocal = true;
      }
    });

    if (updatedLocal) {
      this.saveLocalAccounts(accounts);
    }

    account.recoveryEmail = cleanEmail;
    return true;
  },

  // RECUPERAÇÃO DE SENHA OFICIAL SEGURA (GOOGLE / FIREBASE)
  async sendOfficialPasswordReset(loginInput, emailInput) {
    const rawLogin = String(loginInput || '').trim();
    const cleanEmail = String(emailInput || '').trim().toLowerCase();

    if (!rawLogin) {
      throw new Error('Por favor, informe seu usuário ou login.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Por favor, informe um e-mail válido para receber o link.');
    }

    // 1. Localizar a conta
    const account = await this.findAccountByLogin(rawLogin);
    if (!account && !rawLogin.includes('@')) {
      throw new Error(`Usuário "${rawLogin}" não foi encontrado no sistema. Verifique os dados ou contate o Administrador.`);
    }

    // 2. Salvar o e-mail de recuperação vinculado permanentemente ao usuário
    if (account) {
      await this.saveRecoveryEmail(account, cleanEmail);
    }

    // 3. Enviar link oficial de redefinição com segurança oficial do Google
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        firebase.auth().languageCode = 'pt';
      } catch (e) {}

      try {
        // Envio direto do link oficial de redefinição (200 OK sem disparar erro 400 no console)
        await firebase.auth().sendPasswordResetEmail(cleanEmail);
        console.log('[Auth] Link oficial do Google enviado com sucesso para:', cleanEmail);
        return {
          success: true,
          email: cleanEmail,
          account: account
        };
      } catch (fbErr) {
        // Se a conta ainda não existir no Firebase Auth (código auth/user-not-found), registrar sob demanda
        if (fbErr && (fbErr.code === 'auth/user-not-found' || (fbErr.message && fbErr.message.includes('user-not-found')))) {
          console.log('[Auth] Usuário não registrado no Firebase Auth. Criando registro auxiliar...');
          try {
            const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
            const resp = await fetch(restUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: cleanEmail,
                password: 'Tmp_' + Math.random().toString(36).substring(2, 10) + '!9X',
                returnSecureToken: false
              })
            });
            if (resp.ok) {
              await firebase.auth().sendPasswordResetEmail(cleanEmail);
              console.log('[Auth] Link oficial do Google enviado após criação para:', cleanEmail);
              return {
                success: true,
                email: cleanEmail,
                account: account
              };
            }
          } catch (createErr) {
            console.warn('[Auth] Falha no registro auxiliar:', createErr);
          }
        }
        console.warn('[Auth] Erro ao enviar reset email pelo Firebase:', fbErr);
        throw new Error(this.translateFirebaseError(fbErr));
      }
    }

    return {
      success: true,
      email: cleanEmail,
      account: account
    };
  },

  // Retrocompatibilidade
  async sendPasswordReset(email) {
    return this.sendOfficialPasswordReset(email, email);
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

  // LISTAR CONTAS PARA O ADMINISTRADOR MASTER GERENCIAR
  async getAccountsList() {
    const masterEmail = 'andrew.g.h.agh@gmail.com';
    let cloudList = [];

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      const db = firebase.firestore();
      const fbUser = firebase.auth ? firebase.auth().currentUser : null;

      // 1. Buscar em users/{admin.uid}/managed_users (requer usuário autenticado no Firebase Auth)
      if (fbUser && fbUser.uid) {
        try {
          const snap = await db.collection('users').doc(fbUser.uid).collection('managed_users').get();
          snap.forEach(doc => {
            if (doc.exists) {
              const d = doc.data() || {};
              cloudList.push({ uid: d.uid || doc.id, ...d });
            }
          });
        } catch (e) {
          if (e.code !== 'permission-denied') {
            console.warn('[Auth] Aviso ao buscar managed_users:', e);
          }
        }
      }

      // 2. Buscar em system_accounts (caso as regras estejam publicadas no Firebase Console)
      try {
        const snap = await db.collection('system_accounts').get();
        snap.forEach(doc => {
          if (doc.exists) {
            const data = doc.data() || {};
            cloudList.push({
              uid: data.uid || doc.id,
              docId: doc.id,
              ...data
            });
          }
        });
      } catch (e) {
        if (e.code !== 'permission-denied') {
          console.warn('Erro ao listar system_accounts no Firestore:', e);
        }
      }
    }

    const localList = this.getLocalAccounts();

    // Combinar contas da nuvem e contas locais sem duplicar por email ou username
    const map = new Map();
    localList.forEach(acc => {
      if (acc && acc.email) map.set(acc.email.toLowerCase(), acc);
      if (acc && acc.username) map.set(acc.username.toLowerCase(), acc);
    });
    cloudList.forEach(acc => {
      if (acc && (acc.email || acc.username)) {
        const key = (acc.email || acc.username).toLowerCase();
        const existing = map.get(key);
        let mergedStatus = acc.status || (existing && existing.status) || 'approved';
        if ((existing && existing.status === 'blocked') || acc.status === 'blocked') {
          mergedStatus = 'blocked';
        }

        const merged = {
          ...(existing || {}),
          ...acc,
          status: mergedStatus
        };
        if (acc.email) map.set(acc.email.toLowerCase(), merged);
        if (acc.username) map.set(acc.username.toLowerCase(), merged);
      }
    });

    // Remover duplicatas
    const uniqueMap = new Map();
    Array.from(map.values()).forEach(acc => {
      const idKey = acc.uid || acc.email || acc.username;
      if (idKey && !uniqueMap.has(idKey)) {
        uniqueMap.set(idKey, acc);
      }
    });

    const list = Array.from(uniqueMap.values());

    // Garantir que Andrew Harris esteja sempre presente na lista como ADMIN MASTER
    const masterUid = (this.currentUser && this.currentUser.uid) ? this.currentUser.uid : 'usr_master_agh';
    const hasMaster = list.some(a => a.email && a.email.toLowerCase() === masterEmail);
    if (!hasMaster) {
      list.unshift({
        uid: masterUid,
        displayName: 'Andrew Harris',
        email: masterEmail,
        loginDisplay: masterEmail,
        status: 'approved',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    }

    // Filtrar completamente qualquer resíduo de teste1 / pepreto018
    const cleanedList = list.filter(a => {
      const mail = String(a.email || '').toLowerCase().trim();
      const usr = String(a.username || '').toLowerCase().trim();
      const dName = String(a.displayName || '').toLowerCase().trim();
      if (mail.includes('pepreto') || usr === '123456' || dName === 'teste1') return false;
      return true;
    });

    // Blindagem definitiva: APENAS E EXCLUSIVAMENTE andrew.g.h.agh@gmail.com pode ter role admin
    cleanedList.forEach(a => {
      const emailLower = String(a.email || '').toLowerCase().trim();
      const userLower = String(a.username || '').toLowerCase().trim();
      const isMasterAcc = emailLower === masterEmail || userLower === 'admin' || userLower === 'andrew';
      if (isMasterAcc) {
        a.role = 'admin';
        a.status = 'approved';
        a.uid = masterUid;
      } else {
        a.role = 'user';
        if (a.uid === masterUid) {
          a.uid = a.docId || ('usr_' + (a.username || a.email || Date.now()));
        }
      }
    });

    return cleanedList;
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
  async updateAccountStatus(uid, newStatus, email) {
    if (!newStatus) return false;
    const cleanEmail = email ? String(email).trim().toLowerCase() : (uid && String(uid).includes('@') ? String(uid).trim().toLowerCase() : null);

    let firestoreError = null;

    // 1. Atualizar no Firestore com tripla redundância (doc UID, doc Email e query where email)
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      const db = firebase.firestore();
      try {
        const batch = db.batch();
        let ops = 0;

        // A) Atualizar por UID com set({ merge: true })
        if (uid && uid !== 'undefined' && uid !== 'null') {
          const docRef = db.collection('system_accounts').doc(String(uid));
          batch.set(docRef, { status: newStatus, email: cleanEmail || '', updatedAt: new Date().toISOString() }, { merge: true });
          ops++;
        }

        // B) Atualizar por Email como doc ID com set({ merge: true })
        if (cleanEmail) {
          const docRefEmail = db.collection('system_accounts').doc(cleanEmail);
          batch.set(docRefEmail, { status: newStatus, email: cleanEmail, updatedAt: new Date().toISOString() }, { merge: true });
          ops++;
        }

        // C) Atualizar todos os documentos onde email == cleanEmail
        if (cleanEmail) {
          try {
            const snap = await db.collection('system_accounts').where('email', '==', cleanEmail).get();
            snap.forEach(docSnap => {
              batch.set(docSnap.ref, { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
              ops++;
            });
          } catch (e) {
            console.warn('[Auth] Erro ao buscar por email no Firestore:', e);
          }
        }

        if (ops > 0) {
          await batch.commit();
          console.log(`[Auth] Status "${newStatus}" sincronizado no Firestore para uid=${uid}, email=${cleanEmail}`);
        }
      } catch (err) {
        console.error('[Auth] Erro no batch Firestore:', err);
        firestoreError = err;

        // Fallback individual direto se batch falhar
        try {
          if (uid && uid !== 'undefined' && uid !== 'null') {
            await db.collection('system_accounts').doc(String(uid)).set({ status: newStatus }, { merge: true });
          }
          if (cleanEmail) {
            await db.collection('system_accounts').doc(cleanEmail).set({ status: newStatus, email: cleanEmail }, { merge: true });
          }
          firestoreError = null;
        } catch (fbErr) {
          firestoreError = fbErr;
        }
      }
    }

    // 2. Atualizar localmente
    const accounts = this.getLocalAccounts();
    let updated = false;
    accounts.forEach(a => {
      const matchUid = uid && a.uid && String(a.uid) === String(uid);
      const matchEmail = cleanEmail && a.email && a.email.toLowerCase() === cleanEmail;
      if (matchUid || matchEmail) {
        a.status = newStatus;
        updated = true;
      }
    });

    if (!updated && cleanEmail) {
      accounts.push({
        uid: uid || 'usr_' + Date.now(),
        email: cleanEmail,
        status: newStatus,
        role: 'user',
        createdAt: new Date().toISOString()
      });
    }
    this.saveLocalAccounts(accounts);

    if (firestoreError) {
      console.warn('[Auth] Status gravado localmente, mas a sincronização no Firestore falhou:', firestoreError);
      return {
        success: true,
        localSaved: true,
        cloudSynced: false,
        firestoreError: firestoreError
      };
    }

    return {
      success: true,
      localSaved: true,
      cloudSynced: true
    };
  },

  // EXCLUIR UMA CONTA ESPECÍFICA
  async deleteAccount(uid, email) {
    if (!uid && !email) return false;
    const cleanEmail = email ? String(email).trim().toLowerCase() : (uid && String(uid).includes('@') ? String(uid).trim().toLowerCase() : null);

    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      const db = firebase.firestore();
      try {
        if (this.currentUser && this.currentUser.uid && uid) {
          await db.collection('users').doc(this.currentUser.uid).collection('managed_users').doc(String(uid)).delete().catch(() => {});
        }
        if (uid && uid !== 'undefined' && uid !== 'null') {
          await db.collection('system_accounts').doc(String(uid)).delete().catch(() => {});
        }
        if (cleanEmail) {
          await db.collection('system_accounts').doc(cleanEmail).delete().catch(() => {});
          const qSnap = await db.collection('system_accounts').where('email', '==', cleanEmail).get();
          qSnap.forEach(d => d.ref.delete().catch(() => {}));
        }
      } catch (e) {
        console.warn('Erro ao deletar no Firestore:', e);
      }
    }

    const accounts = this.getLocalAccounts();
    const filtered = accounts.filter(a => {
      if (uid && a.uid && String(a.uid) === String(uid)) return false;
      if (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail) return false;
      return true;
    });
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
        return 'Este e-mail já possui cadastro. Se você já solicitou, aguarde a liberação do administrador (andrew.g.h.agh@gmail.com) ou tente fazer login.';
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
