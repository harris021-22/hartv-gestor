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

      // 1. Tentar por UID canônico no Firestore
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

      // 2.1 Tentar por Username como ID do documento
      if (!foundStatus && cleanEmail) {
        const usernamePart = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
        if (usernamePart) {
          try {
            const docSnap = await db.collection('system_accounts').doc(usernamePart).get();
            if (docSnap.exists) {
              const data = docSnap.data();
              if (data && data.status) {
                foundStatus = data.status;
              }
            }
          } catch (e) {}
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

      // 3.1 Tentar por query onde recoveryEmail == cleanEmail
      if (!foundStatus && cleanEmail) {
        try {
          const qSnap = await db.collection('system_accounts').where('recoveryEmail', '==', cleanEmail).get();
          qSnap.forEach(d => {
            const data = d.data();
            if (data && data.status === 'blocked') {
              foundStatus = 'blocked';
            } else if (!foundStatus && data && data.status) {
              foundStatus = data.status;
            }
          });
        } catch (e) {
          console.warn('[Auth] Aviso ao buscar status por recoveryEmail:', e);
        }
      }

      // 3.2 Tentar por query onde firebaseUid == uid
      if (!foundStatus && uid && uid !== 'undefined' && uid !== 'null') {
        try {
          const qUid = await db.collection('system_accounts').where('firebaseUid', '==', String(uid)).get();
          qUid.forEach(d => {
            const data = d.data();
            if (data && data.status === 'blocked') {
              foundStatus = 'blocked';
            } else if (!foundStatus && data && data.status) {
              foundStatus = data.status;
            }
          });
        } catch (e) {
          console.warn('[Auth] Aviso ao buscar status por firebaseUid:', e);
        }
      }
    }

    // 4. Fallback no LocalStorage
    if (!foundStatus && (cleanEmail || uid)) {
      const localAcc = this.getLocalAccounts().find(a => 
        (cleanEmail && (
          (a.email && a.email.toLowerCase() === cleanEmail) || 
          (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanEmail)
        )) || 
        (uid && (a.uid === uid || a.firebaseUid === uid || a.docId === uid))
      );
      if (localAcc && localAcc.status) {
        foundStatus = localAcc.status;
      }
    }

    // Regra estrita: Apenas contas que constem no painel do Master e estejam 'approved' são autorizadas!
    // Se a conta não existir (foi excluída pelo Master), o status é 'not_found' e o acesso é negado.
    if (!foundStatus) {
      return {
        status: 'not_found',
        role: 'user'
      };
    }

    return {
      status: foundStatus === 'approved' ? 'approved' : 'blocked',
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

      // B) Salvar em system_accounts (no UID canônico e também por username/email para redundância total)
      try {
        await db.collection('system_accounts').doc(uid).set(accountData, { merge: true });
        if (username) {
          await db.collection('system_accounts').doc(username).set(accountData, { merge: true });
        }
        if (email) {
          await db.collection('system_accounts').doc(email).set(accountData, { merge: true });
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

    // Localizar a conta de destino para obter emails vinculados e senhas anteriores
    const accounts = this.getLocalAccounts();
    const targetAcc = accounts.find(a => 
      (uid && (a.uid === uid || a.docId === uid)) ||
      (cleanEmail && ((a.email && a.email.toLowerCase() === cleanEmail) || (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanEmail)))
    );

    const candidateEmails = [...new Set([
      cleanEmail,
      targetAcc?.email?.toLowerCase(),
      targetAcc?.recoveryEmail?.toLowerCase(),
      targetAcc?.username ? `${targetAcc.username.toLowerCase()}@hartv.app` : null
    ].filter(e => e && e.includes('@')))];

    const candidateOldPasswords = [...new Set([
      oldPassword,
      targetAcc?.plainPassword,
      targetAcc?.previousPassword
    ].filter(p => p && String(p).trim()))];

    // 1. Atualizar no Firebase Auth via REST se possível para todos os e-mails da conta
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && firebaseConfig.apiKey) {
      for (const candEmail of candidateEmails) {
        for (const candOldPass of candidateOldPasswords) {
          try {
            const sRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: candEmail, password: candOldPass, returnSecureToken: true })
            });
            const sData = await sRes.json();
            if (sRes.ok && sData.idToken) {
              await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: sData.idToken, password: cleanPass, returnSecureToken: true })
              });
              console.log(`[Auth] Senha do Firebase Auth atualizada via REST para ${candEmail}.`);
              break; // Sucesso para este email, ir para o próximo
            }
          } catch (e) {
            console.warn(`[Auth] Aviso ao atualizar senha Firebase para ${candEmail}:`, e);
          }
        }
      }

      // 2. Atualizar no Firestore (apenas no documento canônico do UID)
      try {
        const db = firebase.firestore();
        const updateObj = {
          plainPassword: cleanPass,
          previousPassword: oldPassword || (targetAcc && targetAcc.plainPassword) || '',
          updatedAt: new Date().toISOString()
        };
        const canonicalUid = uid || targetAcc?.uid;
        if (this.currentUser && this.currentUser.uid && canonicalUid) {
          await db.collection('users').doc(this.currentUser.uid).collection('managed_users').doc(String(canonicalUid)).set(updateObj, { merge: true });
        }
        if (canonicalUid) {
          await db.collection('system_accounts').doc(String(canonicalUid)).set(updateObj, { merge: true });
        }
      } catch (e) {
        console.warn('[Auth] Erro ao atualizar senha no Firestore:', e);
      }
    }

    // 3. Atualizar no LocalStorage
    accounts.forEach(a => {
      const matchUid = (uid && (a.uid === uid || a.docId === uid)) || (targetAcc?.uid && a.uid === targetAcc.uid);
      const matchEmail = cleanEmail && ((a.email && a.email.toLowerCase() === cleanEmail) || (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanEmail));
      const matchUser = targetAcc && targetAcc.username && a.username && a.username.toLowerCase() === targetAcc.username.toLowerCase();
      if (matchUid || matchEmail || matchUser) {
        a.previousPassword = a.plainPassword || oldPassword || '';
        a.plainPassword = cleanPass;
        a.passwordHash = this.simpleHash(cleanPass);
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
    const emailPrefix = isEmail ? cleanLower.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '') : cleanUsername;

    account = localAccounts.find(a => 
      (a.username && a.username.toLowerCase() === cleanUsername) ||
      (emailPrefix && a.username && a.username.toLowerCase() === emailPrefix) ||
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
        if (!account && emailPrefix) {
          const q = await db.collection('system_accounts').where('username', '==', emailPrefix).limit(1).get();
          q.forEach(d => { if (d.exists && !account) account = { uid: d.id, ...d.data() }; });
        }
        if (!account && cleanLower.includes('@')) {
          const q1 = await db.collection('system_accounts').where('email', '==', cleanLower).limit(1).get();
          q1.forEach(d => { if (d.exists && !account) account = { uid: d.id, ...d.data() }; });
          if (!account) {
            const q2 = await db.collection('system_accounts').where('recoveryEmail', '==', cleanLower).limit(1).get();
            q2.forEach(d => { if (d.exists && !account) account = { uid: d.id, ...d.data() }; });
          }
        }
      } catch (e) {
        console.warn('[Auth] Aviso ao buscar conta no Firestore:', e);
      }
    }

    // REGRA DE OURO: Apenas contas cadastradas e ativas no painel do Master podem logar!
    // Se o usuário não existir no Firestore ou LocalStorage (foi excluído pelo Master), o acesso é sumariamente rejeitado.
    if (!account) {
      throw new Error('🚫 Acesso não autorizado. Este usuário não está cadastrado no painel do Administrador Master.');
    }

    if (account.status === 'blocked') {
      throw new Error('🚫 Sua conta foi desativada pelo Administrador Master.');
    }

    // 3. Montar lista de e-mails candidatos para autenticar no Firebase Auth pertencentes a ESTA conta
    const candidateEmails = [];
    if (account.recoveryEmail) candidateEmails.push(account.recoveryEmail.toLowerCase());
    if (account.email) candidateEmails.push(account.email.toLowerCase());
    if (account.username) candidateEmails.push(`${account.username.toLowerCase()}@hartv.app`);
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

      // Auto-recuperação/auto-sincronização: se a senha bate com a cadastrada no sistema mas o Firebase Auth falhou,
      // tentar autenticar com a senha anterior para atualizar automaticamente a senha na nuvem
      if (!firebaseUser && account && ((account.plainPassword && account.plainPassword === cleanPass) || (account.passwordHash && account.passwordHash === this.simpleHash(cleanPass)))) {
        const candidateOlds = [account.previousPassword, '123456', '1234567'].filter(Boolean);
        for (const testEmail of uniqueEmails) {
          for (const oldP of candidateOlds) {
            try {
              const cred = await firebase.auth().signInWithEmailAndPassword(testEmail, oldP);
              if (cred && cred.user) {
                await cred.user.updatePassword(cleanPass);
                firebaseUser = cred.user;
                console.log(`[Auth] Senha do Firebase Auth atualizada automaticamente via login para ${testEmail}!`);
                break;
              }
            } catch (syncErr) {}
          }
          if (firebaseUser) break;
        }
      }

      if (firebaseUser) {
        const firebaseUid = firebaseUser.uid;

        // Migrar dados locais se a conta possuía um UID local diferente
        if (account?.uid && account.uid !== firebaseUid) {
          try {
            const oldClientsKey = `hartv_clients_${account.uid}`;
            const newClientsKey = `hartv_clients_${firebaseUid}`;
            const oldClients = localStorage.getItem(oldClientsKey);
            if (oldClients && oldClients !== '[]' && oldClients !== '{}') {
              const currentNew = localStorage.getItem(newClientsKey);
              if (!currentNew || currentNew === '[]' || currentNew === '{}') {
                localStorage.setItem(newClientsKey, oldClients);
              }
            }
            const oldSettingsKey = `hartv_settings_${account.uid}`;
            const newSettingsKey = `hartv_settings_${firebaseUid}`;
            const oldSettings = localStorage.getItem(oldSettingsKey);
            if (oldSettings && oldSettings !== '{}') {
              const currentNewSettings = localStorage.getItem(newSettingsKey);
              if (!currentNewSettings || currentNewSettings === '{}') {
                localStorage.setItem(newSettingsKey, oldSettings);
              }
            }
          } catch (e) {
            console.warn('[Auth] Erro ao migrar cache local de clientes:', e);
          }
        }

        // O UID da sessão ativa DEVE ser o firebaseUid para cumprir a regra de segurança do Firestore
        const userUid = firebaseUid;

        let check = await this.checkUserApprovalStatus(userUid, firebaseUser.email);

        // Auto-reconciliação caso o UID tenha sido renovado pelo Google após recuperação
        if (check.status !== 'approved' && account && account.status === 'approved') {
          console.log('[Auth] Auto-reconciliando status aprovado com novo Firebase UID:', userUid);
          check = { status: 'approved', role: 'user' };
          try {
            const db = firebase.firestore();
            await db.collection('system_accounts').doc(userUid).set({
              ...account,
              uid: userUid,
              firebaseUid: userUid,
              recoveryEmail: firebaseUser.email || account.recoveryEmail || '',
              status: 'approved',
              role: 'user',
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch (e) {
            console.warn('[Auth] Aviso ao auto-reconciliar conta no Firestore:', e);
          }
        }

        if (check.status !== 'approved') {
          await firebase.auth().signOut().catch(() => {});
          this.currentUser = null;
          localStorage.removeItem(this.CURRENT_USER_KEY);
          throw new Error('🚫 Acesso não autorizado. Este usuário não consta como ativo no painel do Administrador Master.');
        }

        // Sincronizar nova senha e UID no Firestore system_accounts (apenas no documento canônico)
        const updatePassObj = {
          uid: firebaseUid,
          plainPassword: cleanPass,
          updatedAt: new Date().toISOString()
        };
        try {
          const db = firebase.firestore();
          await db.collection('system_accounts').doc(firebaseUid).set(updatePassObj, { merge: true });

          // Se o UID anterior no Firestore for diferente, migrar dados e limpar documento antigo para não duplicar
          if (account?.uid && account.uid !== firebaseUid) {
            try {
              const oldDocSnap = await db.collection('system_accounts').doc(String(account.uid)).get();
              if (oldDocSnap.exists) {
                const oldData = oldDocSnap.data() || {};
                await db.collection('system_accounts').doc(firebaseUid).set({ ...oldData, ...updatePassObj }, { merge: true });
                await db.collection('system_accounts').doc(String(account.uid)).delete();
              }
            } catch (migErr) {}
          }
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

    // 2. Buscar no LocalStorage (cache inicial)
    const localAccounts = this.getLocalAccounts();
    const localMatch = localAccounts.find(a => 
      (a.username && a.username.toLowerCase() === cleanUsername) ||
      (a.loginDisplay && a.loginDisplay.toLowerCase() === cleanUsername) ||
      (a.email && a.email.toLowerCase() === cleanLower) ||
      (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanLower)
    );

    let foundAccount = localMatch ? { ...localMatch } : null;

    // 3. Buscar no Firestore (system_accounts) - FONTE CANÔNICA DA VERDADE
    // Sempre consultar o Firestore se a conta não foi achada localmente ou se ela não tem recoveryEmail válido!
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const db = firebase.firestore();
        let cloudDoc = null;

        // A) Buscar por ID direto do documento
        if (cleanUsername) {
          const uDoc = await db.collection('system_accounts').doc(cleanUsername).get();
          if (uDoc.exists) cloudDoc = { uid: uDoc.id, ...uDoc.data() };
        }
        if (!cloudDoc && cleanLower) {
          const eDoc = await db.collection('system_accounts').doc(cleanLower).get();
          if (eDoc.exists) cloudDoc = { uid: eDoc.id, ...eDoc.data() };
        }

        // B) Buscar por username
        if (cleanUsername) {
          const q1 = await db.collection('system_accounts').where('username', '==', cleanUsername).get();
          q1.forEach(d => {
            if (d.exists) {
              const data = d.data();
              if (!cloudDoc || (data.recoveryEmail && !cloudDoc.recoveryEmail)) {
                cloudDoc = { uid: d.id, ...data };
              }
            }
          });
        }

        // C) Buscar por loginDisplay
        if (cleanUsername) {
          const qDisp = await db.collection('system_accounts').where('loginDisplay', '==', cleanUsername).get();
          qDisp.forEach(d => {
            if (d.exists) {
              const data = d.data();
              if (!cloudDoc || (data.recoveryEmail && !cloudDoc.recoveryEmail)) {
                cloudDoc = { uid: d.id, ...data };
              }
            }
          });
        }

        // D) Buscar com o texto original sem alteração de caracteres
        if (!cloudDoc && raw && raw !== cleanUsername) {
          const qRaw = await db.collection('system_accounts').where('username', '==', raw).get();
          qRaw.forEach(d => {
            if (d.exists) {
              const data = d.data();
              if (!cloudDoc || (data.recoveryEmail && !cloudDoc.recoveryEmail)) {
                cloudDoc = { uid: d.id, ...data };
              }
            }
          });
        }

        // E) Se a busca for por e-mail
        if (cleanLower.includes('@')) {
          const q2 = await db.collection('system_accounts').where('recoveryEmail', '==', cleanLower).get();
          q2.forEach(d => {
            if (d.exists && !cloudDoc) cloudDoc = { uid: d.id, ...d.data() };
          });
          const q3 = await db.collection('system_accounts').where('email', '==', cleanLower).get();
          q3.forEach(d => {
            if (d.exists && !cloudDoc) cloudDoc = { uid: d.id, ...d.data() };
          });
        }

        if (cloudDoc) {
          // Mesclar os dados garantindo prioridade absoluta aos campos da nuvem
          foundAccount = {
            ...(foundAccount || {}),
            ...cloudDoc,
            recoveryEmail: cloudDoc.recoveryEmail || foundAccount?.recoveryEmail || ''
          };

          // Sincronizar o recoveryEmail no LocalStorage imediatamente
          if (cloudDoc.recoveryEmail) {
            try {
              const accs = this.getLocalAccounts();
              let updated = false;
              accs.forEach(a => {
                const matchU = (a.username && a.username.toLowerCase() === cleanUsername) || 
                              (a.loginDisplay && a.loginDisplay.toLowerCase() === cleanUsername);
                const matchUid = a.uid && cloudDoc.uid && a.uid === cloudDoc.uid;
                if (matchU || matchUid) {
                  a.recoveryEmail = cloudDoc.recoveryEmail;
                  updated = true;
                }
              });
              if (updated) this.saveLocalAccounts(accs);
            } catch (e) {}
          }
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
  async saveRecoveryEmail(account, recoveryEmail, forceUpdate = false) {
    const cleanEmail = String(recoveryEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Por favor, informe um endereço de e-mail válido.');
    }

    // Regra de Proteção: Se a conta já possui e-mail de recuperação e não é forçado pelo Master, não alterar
    if (!forceUpdate && account.recoveryEmail && account.recoveryEmail.includes('@')) {
      console.log('[Auth] Conta já possui e-mail fixo cadastrado. Mantendo e-mail original:', account.recoveryEmail);
      return false;
    }

    const updateObj = {
      recoveryEmail: cleanEmail,
      updatedAt: new Date().toISOString()
    };

    // 1. Atualizar no Firestore (apenas no documento canônico da conta)
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        const db = firebase.firestore();
        if (account.uid) {
          await db.collection('system_accounts').doc(String(account.uid)).set(updateObj, { merge: true });
        }
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
    const cleanInputEmail = String(emailInput || '').trim().toLowerCase();

    if (!rawLogin) {
      throw new Error('Por favor, informe seu usuário ou login.');
    }

    // 1. Localizar a conta
    const account = await this.findAccountByLogin(rawLogin);
    if (!account && !rawLogin.includes('@')) {
      throw new Error(`Usuário "${rawLogin}" não foi encontrado no sistema. Verifique os dados ou contate o Administrador.`);
    }

    // 2. REGRA DE SEGURANÇA: Se o usuário já possui e-mail fixo, ele NÃO pode modificar
    const existingEmail = account?.recoveryEmail || (!account?.email?.endsWith('@hartv.app') ? account?.email : '');
    let targetEmail = '';

    if (existingEmail && existingEmail.includes('@')) {
      // E-mail fixo existente: ignora qualquer valor digitado e usa exclusivamente o e-mail cadastrado
      targetEmail = existingEmail.toLowerCase().trim();
      console.log('[Auth] Usuário possui e-mail fixo protegido. Destino fixo garantido:', targetEmail);
    } else {
      // Primeira recuperação: o e-mail informado será salvo de forma definitiva
      if (!cleanInputEmail || !cleanInputEmail.includes('@')) {
        throw new Error('Por favor, informe um e-mail válido para receber o link.');
      }
      targetEmail = cleanInputEmail;
      if (account) {
        await this.saveRecoveryEmail(account, targetEmail);
      }
    }

    // 3. Enviar link oficial de redefinição com segurança oficial do Google
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        firebase.auth().languageCode = 'pt';
      } catch (e) {}

      // 3.1 Garantir proativamente que o e-mail existe no Firebase Auth
      // (Com a proteção contra enumeração de e-mails do Google, o sendPasswordResetEmail
      // retorna 200 mesmo se o e-mail não existir, mas o Google descarta o envio silenciosamente).
      try {
        const restUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
        const resp = await fetch(restUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            password: 'Tmp_' + Math.random().toString(36).substring(2, 10) + '!9X',
          })
        });
        const signUpData = await resp.json();
        if (resp.ok && signUpData.localId) {
          const newAuthUid = signUpData.localId;
          console.log('[Auth] Conta de recuperação criada no Firebase Auth sob demanda para:', targetEmail, 'novo UID:', newAuthUid);

          // Sincronizar o novo UID no Firestore system_accounts com status approved imediato
          if (account) {
            try {
              const db = firebase.firestore();
              const updateData = {
                ...account,
                uid: newAuthUid,
                firebaseUid: newAuthUid,
                recoveryEmail: targetEmail,
                status: 'approved',
                role: 'user',
                updatedAt: new Date().toISOString()
              };
              await db.collection('system_accounts').doc(newAuthUid).set(updateData, { merge: true });

              if (account.uid && account.uid !== newAuthUid) {
                await db.collection('system_accounts').doc(String(account.uid)).set({
                  recoveryEmail: targetEmail,
                  firebaseUid: newAuthUid,
                  updatedAt: new Date().toISOString()
                }, { merge: true });
              }
            } catch (e) {
              console.warn('[Auth] Aviso ao salvar novo UID em system_accounts:', e);
            }

            // Atualizar no LocalStorage
            try {
              const accs = this.getLocalAccounts();
              accs.forEach(a => {
                if ((account.uid && a.uid === account.uid) || 
                    (account.username && a.username && a.username.toLowerCase() === account.username.toLowerCase())) {
                  a.recoveryEmail = targetEmail;
                  a.firebaseUid = newAuthUid;
                }
              });
              this.saveLocalAccounts(accs);
            } catch (e) {}

            // Migrar chaves de cache local exclusivamente para este usuário específico
            if (account.uid && account.uid !== newAuthUid) {
              try {
                const oldClientsKey = `hartv_clients_${account.uid}`;
                const newClientsKey = `hartv_clients_${newAuthUid}`;
                const oldClients = localStorage.getItem(oldClientsKey);
                if (oldClients && oldClients !== '[]' && oldClients !== '{}') {
                  localStorage.setItem(newClientsKey, oldClients);
                }
                const oldSettingsKey = `hartv_settings_${account.uid}`;
                const newSettingsKey = `hartv_settings_${newAuthUid}`;
                const oldSettings = localStorage.getItem(oldSettingsKey);
                if (oldSettings && oldSettings !== '{}') {
                  localStorage.setItem(newSettingsKey, oldSettings);
                }
              } catch (e) {}
            }
          }
        }
      } catch (ensureErr) {
        console.warn('[Auth] Aviso ao verificar/criar registro auxiliar:', ensureErr);
      }

      try {
        // Envio do link oficial de redefinição pelo Google Firebase Auth
        await firebase.auth().sendPasswordResetEmail(targetEmail);
        console.log('[Auth] Link oficial do Google enviado com sucesso para:', targetEmail);
        return {
          success: true,
          email: targetEmail,
          account: account
        };
      } catch (fbErr) {
        console.warn('[Auth] Erro ao enviar reset email pelo Firebase:', fbErr);
        throw new Error(this.translateFirebaseError(fbErr));
      }
    }

    return {
      success: true,
      email: targetEmail,
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
              // Auto-sincronizar com system_accounts para garantir acesso em qualquer dispositivo
              if (d.uid && d.status) {
                db.collection('system_accounts').doc(d.uid).set(d, { merge: true }).catch(() => {});
                if (d.username) db.collection('system_accounts').doc(d.username).set(d, { merge: true }).catch(() => {});
                if (d.email) db.collection('system_accounts').doc(d.email).set(d, { merge: true }).catch(() => {});
              }
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
    const rawList = [...cloudList, ...localList];
    const mergedGroups = [];

    for (const acc of rawList) {
      if (!acc) continue;
      const u = (acc.username || '').toLowerCase().trim();
      const e = (acc.email || '').toLowerCase().trim();
      const r = (acc.recoveryEmail || '').toLowerCase().trim();
      const uid = (acc.uid || '').trim();

      // Verificar se pertence a algum grupo já identificado
      let group = mergedGroups.find(g => {
        if (u && g.usernames.has(u)) return true;
        if (e && (g.emails.has(e) || g.recoveryEmails.has(e))) return true;
        if (r && (g.emails.has(r) || g.recoveryEmails.has(r))) return true;
        if (uid && g.uids.has(uid)) return true;
        return false;
      });

      if (!group) {
        group = {
          usernames: new Set(),
          emails: new Set(),
          recoveryEmails: new Set(),
          uids: new Set(),
          records: []
        };
        mergedGroups.push(group);
      }

      if (u) group.usernames.add(u);
      if (e) group.emails.add(e);
      if (r) group.recoveryEmails.add(r);
      if (uid) group.uids.add(uid);
      group.records.push(acc);
    }

    const list = mergedGroups.map(g => {
      let finalAcc = {};
      for (const r of g.records) {
        finalAcc = { ...finalAcc, ...r };
      }
      const username = Array.from(g.usernames)[0] || '';
      const recoveryEmail = Array.from(g.recoveryEmails)[0] || '';
      const email = Array.from(g.emails).find(em => em !== recoveryEmail) || Array.from(g.emails)[0] || (recoveryEmail || (username ? username + '@hartv.app' : ''));
      
      finalAcc.username = username;
      finalAcc.email = email;
      finalAcc.recoveryEmail = recoveryEmail;
      finalAcc.loginDisplay = username || email;
      finalAcc.uid = finalAcc.uid || Array.from(g.uids)[0] || ('usr_' + Date.now());
      return finalAcc;
    });

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

    // Blindagem definitiva: APENAS E EXCLUSIVAMENTE andrew.g.h.agh@gmail.com pode ter role admin
    list.forEach(a => {
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

  // EXCLUIR UMA CONTA ESPECÍFICA (FIREBASE AUTH, FIRESTORE E LOCALSTORAGE)
  async deleteAccount(uid, email, username) {
    if (!uid && !email && !username) return false;
    const cleanEmail = email ? String(email).trim().toLowerCase() : (uid && String(uid).includes('@') ? String(uid).trim().toLowerCase() : null);

    // 1. Localizar dados completos da conta antes de excluir para limpar credenciais
    const accounts = this.getLocalAccounts();
    const targetAcc = accounts.find(a => 
      (uid && (a.uid === uid || a.docId === uid)) ||
      (cleanEmail && ((a.email && a.email.toLowerCase() === cleanEmail) || (a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanEmail))) ||
      (username && a.username && a.username.toLowerCase() === String(username).toLowerCase().trim())
    );

    const targetUser = (username || targetAcc?.username || '').toLowerCase().trim();
    const targetPass = targetAcc?.plainPassword || '';
    const candidateEmails = [...new Set([
      cleanEmail,
      targetAcc?.email?.toLowerCase(),
      targetAcc?.recoveryEmail?.toLowerCase(),
      targetUser ? `${targetUser}@hartv.app` : null
    ].filter(e => e && e.includes('@')))];

    // 2. Excluir no Firebase Auth via REST API para revogar acesso permanentemente
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && firebaseConfig.apiKey && targetPass) {
      for (const candEmail of candidateEmails) {
        try {
          const sRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: candEmail, password: targetPass, returnSecureToken: true })
          });
          const sData = await sRes.json();
          if (sRes.ok && sData.idToken) {
            await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseConfig.apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: sData.idToken })
            });
            console.log(`[Auth] Usuário ${candEmail} excluído permanentemente do Firebase Auth.`);
          }
        } catch (e) {
          console.warn(`[Auth] Aviso ao excluir conta do Firebase Auth para ${candEmail}:`, e);
        }
      }
    }

    // 3. Excluir completamente no Firestore
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
        }
        if (targetUser) {
          await db.collection('system_accounts').doc(targetUser).delete().catch(() => {});
          const qUser = await db.collection('system_accounts').where('username', '==', targetUser).get();
          qUser.forEach(d => d.ref.delete().catch(() => {}));
        }
        for (const candEmail of candidateEmails) {
          const qSnap = await db.collection('system_accounts').where('email', '==', candEmail).get();
          qSnap.forEach(d => d.ref.delete().catch(() => {}));
          const qRec = await db.collection('system_accounts').where('recoveryEmail', '==', candEmail).get();
          qRec.forEach(d => d.ref.delete().catch(() => {}));
        }
      } catch (e) {
        console.warn('[Auth] Erro ao deletar no Firestore:', e);
      }
    }

    // 4. Excluir no LocalStorage
    const filtered = accounts.filter(a => {
      if (uid && a.uid && String(a.uid) === String(uid)) return false;
      if (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail) return false;
      if (cleanEmail && a.recoveryEmail && a.recoveryEmail.toLowerCase() === cleanEmail) return false;
      if (targetUser && a.username && a.username.toLowerCase() === targetUser) return false;
      return true;
    });
    this.saveLocalAccounts(filtered);

    // Limpar cache local do usuário excluído
    if (uid) {
      try {
        localStorage.removeItem(`hartv_clients_${uid}`);
        localStorage.removeItem(`hartv_settings_${uid}`);
      } catch (e) {}
    }
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

if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}
