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
    let email = rawLogin.toLowerCase();
    let username = rawLogin.toLowerCase();
    let isEmail = rawLogin.includes('@');

    if (!isEmail) {
      username = rawLogin.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
      if (!username) {
        throw new Error('Nome de usuário inválido. Use apenas letras, números e pontos.');
      }
      email = `${username}@hartv.app`;
    } else {
      username = rawLogin.split('@')[0].toLowerCase();
    }

    if (this.isMasterEmail(email)) {
      throw new Error('Não é permitido criar um usuário com o e-mail do Administrador Master.');
    }

    let uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    let cloudCreated = false;
    let firestoreSaved = false;

    // 1. Criar no Firebase Auth usando instância secundária (não desloga o Admin Master)
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      let secondaryApp = null;
      try {
        const tempAppName = 'SecAuth_' + Date.now();
        secondaryApp = firebase.initializeApp(firebaseConfig, tempAppName);
        const secondaryAuth = secondaryApp.auth();

        try {
          const cred = await secondaryAuth.createUserWithEmailAndPassword(email, cleanPass);
          if (cred.user) {
            uid = cred.user.uid;
            cloudCreated = true;
            try {
              await cred.user.updateProfile({ displayName: cleanName });
            } catch (e) {}
          }
        } catch (authErr) {
          if (authErr && (authErr.code === 'auth/email-already-in-use' || String(authErr).includes('email-already-in-use'))) {
            console.log('[Auth] Usuário já existia no Firebase Auth. Atualizando credenciais...');
            try {
              const existingCred = await secondaryAuth.signInWithEmailAndPassword(email, cleanPass);
              if (existingCred.user) {
                uid = existingCred.user.uid;
                cloudCreated = true;
              }
            } catch (signInErr) {
              console.warn('[Auth] Conta existente no Firebase com outra senha. Mantendo registro.');
            }
          } else {
            throw new Error(this.translateFirebaseError(authErr));
          }
        }
      } catch (err) {
        console.warn('[Auth] Erro ao registrar no Firebase Auth secundário:', err);
        throw err;
      } finally {
        if (secondaryApp) {
          try { await secondaryApp.delete(); } catch (e) {}
        }
      }

      // 2. Salvar documento em system_accounts no Firestore com status 'approved'
      try {
        const db = firebase.firestore();
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

        await db.collection('system_accounts').doc(uid).set(accountData, { merge: true });
        if (email) {
          await db.collection('system_accounts').doc(email).set(accountData, { merge: true });
        }
        firestoreSaved = true;
      } catch (fsErr) {
        console.warn('[Auth] Erro ao salvar dados no Firestore system_accounts:', fsErr);
      }
    }

    // 3. Salvar localmente em LocalStorage (redundância total e modo offline)
    const localAccountData = {
      uid: uid,
      displayName: cleanName,
      username: username,
      email: email,
      loginDisplay: isEmail ? email : username,
      passwordHash: this.simpleHash(cleanPass),
      plainPassword: cleanPass,
      status: 'approved',
      role: 'user',
      createdAt: new Date().toISOString()
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

    // 1. Tentar atualizar no Firebase Auth via app secundário
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase && cleanEmail) {
      if (oldPassword) {
        let secApp = null;
        try {
          secApp = firebase.initializeApp(firebaseConfig, 'SecPass_' + Date.now());
          const cred = await secApp.auth().signInWithEmailAndPassword(cleanEmail, oldPassword);
          if (cred.user) {
            await cred.user.updatePassword(cleanPass);
            console.log('[Auth] Senha atualizada no Firebase Auth com sucesso.');
          }
        } catch (e) {
          console.warn('[Auth] Não foi possível atualizar no Firebase via login secundário:', e);
        } finally {
          if (secApp) {
            try { await secApp.delete(); } catch(e) {}
          }
        }
      }

      // Atualizar no Firestore
      try {
        const db = firebase.firestore();
        const updateObj = {
          plainPassword: cleanPass,
          updatedAt: new Date().toISOString()
        };
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

  // LOGIN (SUPORTA TANTO USUÁRIO SIMPLES QUANTO E-MAIL)
  async login(loginInput, password) {
    const rawInput = String(loginInput || '').trim();
    const cleanPass = String(password || '').trim();

    if (!rawInput || !cleanPass) {
      throw new Error('Informe o usuário/e-mail e a senha.');
    }

    // Identificar e resolver usuário vs e-mail
    let cleanEmail = rawInput.toLowerCase();
    const isEmail = rawInput.includes('@');

    if (!isEmail) {
      const cleanUsername = rawInput.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
      // Buscar se existe conta com esse username salvo no LocalStorage
      const localAcc = this.getLocalAccounts().find(a => 
        (a.username && a.username.toLowerCase() === cleanUsername) ||
        (a.loginDisplay && a.loginDisplay.toLowerCase() === cleanUsername)
      );
      if (localAcc && localAcc.email) {
        cleanEmail = localAcc.email.toLowerCase();
      } else {
        cleanEmail = `${cleanUsername}@hartv.app`;
      }
    }

    const isMaster = this.isMasterEmail(cleanEmail);

    // 1. Login via Firebase Auth
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const cred = await firebase.auth().signInWithEmailAndPassword(cleanEmail, cleanPass);
        if (cred.user) {
          let status = 'approved';
          let role = isMaster ? 'admin' : 'user';

          if (!isMaster) {
            // Verificar apenas se a conta foi explicitamente bloqueada pelo administrador
            const check = await this.checkUserApprovalStatus(cred.user.uid, cleanEmail);
            if (check.status === 'blocked') {
              await firebase.auth().signOut().catch(() => {});
              this.currentUser = null;
              localStorage.removeItem(this.CURRENT_USER_KEY);
              throw new Error('🚫 Sua conta foi desativada pelo administrador.');
            }
            status = 'approved';

            // Sincronizar doc no Firestore
            try {
              await firebase.firestore().collection('system_accounts').doc(cred.user.uid).set({
                uid: cred.user.uid,
                email: cleanEmail,
                displayName: cred.user.displayName || rawInput,
                status: 'approved',
                role: 'user',
                lastLoginAt: new Date().toISOString()
              }, { merge: true });
            } catch (e) {}
          }

          this.currentUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName || rawInput,
            status: 'approved',
            role: isMaster ? 'admin' : 'user',
            isCloud: true
          };
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(this.currentUser));
          this.notifyListeners();
          return this.currentUser;
        }
      } catch (fbErr) {
        // Se erro no Firebase, verificar se existe localmente antes de desistir
        const accounts = this.getLocalAccounts();
        const account = accounts.find(a => 
          (a.email && a.email.toLowerCase() === cleanEmail) ||
          (a.username && a.username.toLowerCase() === rawInput.toLowerCase()) ||
          (a.loginDisplay && a.loginDisplay.toLowerCase() === rawInput.toLowerCase())
        );

        if (!account) {
          throw new Error(this.translateFirebaseError(fbErr));
        }
        // Se existe conta local, continua para o fluxo local abaixo
      }
    }

    // 2. Login no Modo Local (ou fallback)
    const accounts = this.getLocalAccounts();
    const account = accounts.find(a => 
      (a.email && a.email.toLowerCase() === cleanEmail) ||
      (a.username && a.username.toLowerCase() === rawInput.toLowerCase()) ||
      (a.loginDisplay && a.loginDisplay.toLowerCase() === rawInput.toLowerCase())
    );

    if (!account) {
      throw new Error('Nenhuma conta encontrada com este usuário/e-mail.');
    }

    if (account.passwordHash !== this.simpleHash(cleanPass)) {
      throw new Error('Senha incorreta. Tente novamente.');
    }

    if (!isMaster) {
      if (account.status === 'blocked') {
        throw new Error('🚫 Sua conta foi desativada pelo administrador.');
      }
    }

    this.currentUser = {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName || rawInput,
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
        const key = acc.email.toLowerCase();
        const existing = map.get(key);
        let mergedStatus = acc.status || (existing && existing.status) || 'pending';
        // Se uma das fontes indicar aprovado, prevalece o status aprovado
        if ((existing && existing.status === 'approved') || acc.status === 'approved') {
          mergedStatus = 'approved';
        } else if ((existing && existing.status === 'blocked') || acc.status === 'blocked') {
          mergedStatus = 'blocked';
        }

        map.set(key, {
          ...(existing || {}),
          ...acc,
          status: mergedStatus
        });
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
