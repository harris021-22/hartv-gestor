// app.js - Lógica Principal do IPTV Gestor Pro
// Gerenciamento completo de clientes, interface e integrações

document.addEventListener('DOMContentLoaded', () => {
  // Inicialização do App
  App.init();
});

const App = {
  clients: [],
  currentFilter: 'all',
  searchQuery: '',
  editingClientId: null,
  deferredInstallPrompt: null,

  // Inicialização
  init() {
    this.setupEventListeners();
    this.setupPWAInstall();
    this.setupServiceWorker();
    this.updateNotificationBadge();

    // Inicializar autenticação e multi-contas
    if (typeof AuthManager !== 'undefined') {
      AuthManager.onAuthStateChanged((user) => this.handleAuthState(user));
      AuthManager.init();
    } else {
      this.loadClients();
    }

    // Iniciar checagem de vencimento com NotificationManager
    NotificationManager.init(() => this.clients);
  },

  // Registrar Service Worker
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js?v=20')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  },

  // Capturar evento de instalação no Android
  setupPWAInstall() {
    const installBanner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installBanner) installBanner.style.display = 'flex';
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!this.deferredInstallPrompt) return;
        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;
        console.log('[PWA] Escolha do usuário:', outcome);
        this.deferredInstallPrompt = null;
        if (installBanner) installBanner.style.display = 'none';
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] Aplicativo instalado!');
      if (installBanner) installBanner.style.display = 'none';
      this.showToast('Aplicativo instalado com sucesso!', 'success');
    });
  },

  // Carregar lista de clientes do armazenamento local e ativar sincronização em tempo real na nuvem
  async loadClients() {
    this.clients = StorageManager.getClients();
    this.render();

    const user = typeof AuthManager !== 'undefined' ? AuthManager.getUser() : null;
    if (user && typeof DatabaseManager !== 'undefined' && DatabaseManager.isAvailable()) {
      this.startRealtimeCloudSync(user.uid);
    }
  },

  // Sincronização em tempo real bidirecional (celular <-> computador)
  startRealtimeCloudSync(userId) {
    if (!userId || typeof DatabaseManager === 'undefined' || !DatabaseManager.isAvailable()) return;

    this.updateCloudSyncBadge(true, this.clients.length);

    // 1. Escuta em tempo real para clientes (onSnapshot)
    DatabaseManager.subscribeToClients(userId, (cloudClients) => {
      this.handleRealtimeClientsUpdate(cloudClients, userId);
    });

    // 2. Escuta em tempo real para configurações (Pix, modelos de WhatsApp, etc.)
    DatabaseManager.subscribeToSettings(userId, (cloudSettings) => {
      if (cloudSettings) {
        const localSettings = StorageManager.getSettings();
        const merged = { ...localSettings, ...cloudSettings };
        const key = StorageManager.getSettingsKey();
        localStorage.setItem(key, JSON.stringify(merged));
      }
    });

    // 3. Checagem inicial: enviar para a nuvem clientes que estejam apenas no armazenamento local deste aparelho
    this.syncLocalToCloudIfNeeded(userId);
  },

  // Atualização instantânea recebida da nuvem
  handleRealtimeClientsUpdate(cloudClients, userId) {
    if (!Array.isArray(cloudClients)) return;

    // Se a nuvem tiver clientes, atualizar a lista local e a interface
    if (cloudClients.length > 0) {
      StorageManager.saveClients(cloudClients);
      this.clients = cloudClients;
      this.render();
      this.updateCloudSyncBadge(true, cloudClients.length);
    } else {
      // Se a nuvem estiver vazia mas localmente existirem clientes, sincronizar os locais para a nuvem
      const local = StorageManager.getClients();
      if (local.length > 0) {
        DatabaseManager.syncAllClients(userId, local);
      } else {
        this.clients = [];
        this.render();
      }
    }
  },

  // Enviar clientes locais para a nuvem se a nuvem ainda não tiver
  async syncLocalToCloudIfNeeded(userId) {
    const local = StorageManager.getClients();
    if (local.length === 0) return;

    try {
      const cloudClients = await DatabaseManager.fetchClients(userId);
      if (!cloudClients || cloudClients.length === 0) {
        console.log(`[App] Enviando ${local.length} cliente(s) locais para a nuvem...`);
        await DatabaseManager.syncAllClients(userId, local);
      } else {
        // Enviar clientes novos que estejam apenas localmente
        const cloudIds = new Set(cloudClients.map(c => c.id));
        const missing = local.filter(c => !cloudIds.has(c.id));
        if (missing.length > 0) {
          console.log(`[App] Sincronizando ${missing.length} cliente(s) novo(s) do aparelho para a nuvem...`);
          for (const c of missing) {
            await DatabaseManager.saveClient(userId, c);
          }
        }
      }
    } catch (e) {
      console.warn('[App] Erro na verificação de nuvem:', e);
    }
  },

  // Indicador visual de sincronização da nuvem
  updateCloudSyncBadge(isConnected, count = 0) {
    const badge = document.getElementById('cloudSyncStatus');
    const text = document.getElementById('cloudSyncText');
    if (!badge) return;

    if (isConnected) {
      badge.style.display = 'flex';
      badge.style.background = 'rgba(16, 185, 129, 0.12)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      badge.style.color = '#34d399';
      if (text) text.textContent = 'Nuvem Conectada';
      badge.title = `Sincronização em tempo real ativa. ${count} cliente(s) sincronizados.`;
    } else {
      badge.style.display = 'flex';
      badge.style.background = 'rgba(100, 116, 139, 0.12)';
      badge.style.borderColor = 'rgba(100, 116, 139, 0.25)';
      badge.style.color = '#94a3b8';
      if (text) text.textContent = 'Modo Local';
      badge.title = 'Armazenamento local (conecte sua conta para sincronização em tempo real).';
    }
  },

  // Configurar ouvintes de eventos da interface
  setupEventListeners() {
    // Busca
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        if (searchClear) {
          searchClear.classList.toggle('visible', this.searchQuery.length > 0);
        }
        this.renderListOnly();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        searchClear.classList.remove('visible');
        this.renderListOnly();
      });
    }

    // Filtros de Status (Chips)
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter || 'all';
        this.renderListOnly();
      });
    });

    // Botão Adicionar Cliente (FAB e Header)
    const btnAdd = document.getElementById('btnAddClient');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openClientModal());
    }

    // Botão de Backup (Exportar/Importar)
    const btnBackup = document.getElementById('btnBackup');
    if (btnBackup) {
      btnBackup.addEventListener('click', () => this.openBackupModal());
    }

    // Botão de Notificações / Permissão
    const btnNotify = document.getElementById('btnNotifications');
    if (btnNotify) {
      btnNotify.addEventListener('click', () => this.handleNotificationButton());
    }

    // Botão de Configurações
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.openSettingsModal());
    }

    // Formulário de Cliente
    const clientForm = document.getElementById('clientForm');
    if (clientForm) {
      clientForm.addEventListener('submit', (e) => this.handleSaveClient(e));
    }

    // Botões rápidos de data no modal
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.days, 10);
        this.setQuickExpirationDate(days);
      });
    });

    // Gerador de senha aleatória
    const btnGenPass = document.getElementById('btnGenPassword');
    if (btnGenPass) {
      btnGenPass.addEventListener('click', () => {
        const passInput = document.getElementById('clientPassword');
        if (passInput) {
          const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
          passInput.value = randomPass;
          this.showToast('Senha gerada: ' + randomPass, 'info');
        }
      });
    }

    // Abas do Modal de Backup
    document.querySelectorAll('.modal-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('tabExport').style.display = target === 'export' ? 'block' : 'none';
        document.getElementById('tabImport').style.display = target === 'import' ? 'block' : 'none';
      });
    });

    // Ações de Exportação
    const btnExportJson = document.getElementById('btnExportJson');
    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        const res = StorageManager.exportBackup();
        this.showToast(`Backup de ${res.total} cliente(s) exportado!`, 'success');
      });
    }

    const btnShareBackup = document.getElementById('btnShareBackup');
    if (btnShareBackup) {
      btnShareBackup.addEventListener('click', async () => {
        await StorageManager.shareBackup();
      });
    }

    // Ações de Importação
    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => this.handleFileImport(e));
    }

    const btnConfirmTextImport = document.getElementById('btnConfirmTextImport');
    if (btnConfirmTextImport) {
      btnConfirmTextImport.addEventListener('click', () => this.handleTextImport());
    }

    // Salvar Configurações
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Teste de Notificação
    const btnTestNotification = document.getElementById('btnTestNotification');
    if (btnTestNotification) {
      btnTestNotification.addEventListener('click', async () => {
        const ok = await NotificationManager.testNotification();
        if (ok) {
          this.showToast('Notificação de teste enviada!', 'success');
        }
      });
    }

    // Fechar modais ao clicar no overlay ou no botão fechar
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAllModals();
      });
    });

    // Eventos de Autenticação (Login / Logout)
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.onsubmit = (e) => this.handleLoginSubmit(e);
    }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }

    // Esqueci Minha Senha
    const btnOpenForgotPass = document.getElementById('btnOpenForgotPass');
    if (btnOpenForgotPass) {
      btnOpenForgotPass.addEventListener('click', () => {
        const modal = document.getElementById('forgotPasswordModal');
        const loginEmail = document.getElementById('loginEmail').value.trim();
        if (loginEmail) {
          document.getElementById('forgotEmail').value = loginEmail;
        }
        if (modal) modal.classList.add('open');
      });
    }

    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();
        const submitBtn = document.getElementById('btnForgotSubmit');
        try {
          if (submitBtn) submitBtn.disabled = true;
          await AuthManager.sendPasswordReset(email);
          this.closeAllModals();
          this.showToast(`Link de recuperação enviado para ${email}! Verifique seu e-mail.`, 'success');
          forgotPasswordForm.reset();
        } catch (err) {
          alert(err.message || 'Erro ao enviar link de recuperação.');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // Botão Rápido de Usuários no Header (Admin Master)
    const btnHeaderUsers = document.getElementById('btnHeaderUsers');
    if (btnHeaderUsers) {
      btnHeaderUsers.addEventListener('click', () => this.openManageAccountsModal());
    }

    // Botão de Gestão de Contas (Admin Master - legado/compatibilidade)
    const btnManageAccounts = document.getElementById('btnManageAccounts');
    if (btnManageAccounts) {
      btnManageAccounts.addEventListener('click', () => this.openManageAccountsModal());
    }

    // Controle do Menu Lateral Deslizante (Hambúrguer)
    const btnHamburger = document.getElementById('btnHamburger');
    if (btnHamburger) {
      btnHamburger.addEventListener('click', () => this.openDrawer());
    }

    const userProfileChip = document.getElementById('userProfileChip');
    if (userProfileChip) {
      userProfileChip.addEventListener('click', () => this.openDrawer());
    }

    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => this.closeDrawer());
    }

    const drawerOverlay = document.getElementById('drawerOverlay');
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) this.closeDrawer();
      });
    }

    // Ações dos Itens do Menu Drawer
    const drawerItemApprovals = document.getElementById('drawerItemApprovals');
    if (drawerItemApprovals) {
      drawerItemApprovals.addEventListener('click', () => {
        this.closeDrawer();
        const modal = document.getElementById('manageAccountsModal');
        if (modal) {
          modal.classList.add('open');
          this.renderAccountsList();
        }
      });
    }

    const drawerItemNotifications = document.getElementById('drawerItemNotifications');
    if (drawerItemNotifications) {
      drawerItemNotifications.addEventListener('click', () => {
        this.closeDrawer();
        this.handleNotificationButton();
      });
    }

    const drawerItemBackup = document.getElementById('drawerItemBackup');
    if (drawerItemBackup) {
      drawerItemBackup.addEventListener('click', () => {
        this.closeDrawer();
        this.openBackupModal();
      });
    }

    const drawerItemSettings = document.getElementById('drawerItemSettings');
    if (drawerItemSettings) {
      drawerItemSettings.addEventListener('click', () => {
        this.closeDrawer();
        this.openSettingsModal();
      });
    }

    const drawerItemCheckExp = document.getElementById('drawerItemCheckExp');
    if (drawerItemCheckExp) {
      drawerItemCheckExp.addEventListener('click', () => {
        this.closeDrawer();
        NotificationManager.checkExpirations(this.clients, true);
        this.showToast('Vencimentos verificados com sucesso!', 'info');
      });
    }

    const drawerBtnLogout = document.getElementById('drawerBtnLogout');
    if (drawerBtnLogout) {
      drawerBtnLogout.addEventListener('click', () => {
        this.closeDrawer();
        this.handleLogout();
      });
    }
  },

  // Abrir Menu Lateral Drawer
  openDrawer() {
    const drawer = document.getElementById('drawerOverlay');
    if (drawer) {
      drawer.style.display = 'block';
      void drawer.offsetWidth; // Forçar cálculo de layout para a transição suave
      drawer.classList.add('open');
    }
    if (typeof AuthManager !== 'undefined' && AuthManager.isAdmin()) {
      this.checkPendingAccounts();
    }
  },

  // Fechar Menu Lateral Drawer
  closeDrawer() {
    const drawer = document.getElementById('drawerOverlay');
    if (drawer) {
      drawer.classList.remove('open');
      setTimeout(() => {
        if (drawer && !drawer.classList.contains('open')) {
          drawer.style.display = 'none';
        }
      }, 300);
    }
  },

  // Gerenciamento do estado da autenticação (UI)
  handleAuthState(user) {
    const authScreen = document.getElementById('authScreen');
    const userChip = document.getElementById('userProfileChip');
    const userAvatarText = document.getElementById('userAvatarText');
    const userNameText = document.getElementById('userNameText');
    const btnManageAccounts = document.getElementById('btnManageAccounts');
    const btnHeaderUsers = document.getElementById('btnHeaderUsers');

    // Elementos do Menu Hambúrguer Drawer
    const drawerAvatar = document.getElementById('drawerAvatar');
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserEmail = document.getElementById('drawerUserEmail');
    const drawerUserBadge = document.getElementById('drawerUserBadge');
    const drawerItemApprovals = document.getElementById('drawerItemApprovals');
    const drawerBadge = document.getElementById('drawerBadge');

    if (!user) {
      // Usuário deslogado: exibir tela de login
      if (typeof DatabaseManager !== 'undefined') {
        DatabaseManager.unsubscribeAll();
      }
      this.updateCloudSyncBadge(false);

      if (authScreen) authScreen.style.display = 'flex';
      if (userChip) userChip.style.display = 'none';
      if (btnHeaderUsers) btnHeaderUsers.style.display = 'none';
      if (btnManageAccounts) btnManageAccounts.style.display = 'none';
      if (drawerItemApprovals) drawerItemApprovals.style.display = 'none';
      if (drawerBadge) drawerBadge.style.display = 'none';
      this.closeDrawer();
      this.clients = [];
      this.render();
    } else {
      // Usuário logado: esconder tela de login e mostrar app
      if (authScreen) authScreen.style.display = 'none';
      
      const name = user.displayName || user.email.split('@')[0];
      const initial = name.charAt(0).toUpperCase();

      if (userChip) {
        userChip.style.display = 'flex';
        if (userAvatarText) userAvatarText.textContent = initial;
        if (userNameText) userNameText.textContent = name;
      }

      // Preencher dados do usuário no menu Drawer
      if (drawerAvatar) drawerAvatar.textContent = initial;
      if (drawerUserName) drawerUserName.textContent = name;
      if (drawerUserEmail) drawerUserEmail.textContent = user.email;

      const isAdmin = AuthManager.isAdmin();
      if (drawerUserBadge) {
        drawerUserBadge.style.display = isAdmin ? 'inline-block' : 'none';
        drawerUserBadge.textContent = 'ADMIN MASTER 👑';
      }

      // Exibir botões de gestão apenas para o Administrador Master
      if (btnHeaderUsers) {
        btnHeaderUsers.style.display = isAdmin ? 'inline-flex' : 'none';
      }
      if (drawerItemApprovals) {
        drawerItemApprovals.style.display = isAdmin ? 'flex' : 'none';
      }
      if (btnManageAccounts) {
        btnManageAccounts.style.display = isAdmin ? 'flex' : 'none';
      }

      if (isAdmin) {
        this.checkPendingAccounts();
      } else {
        if (drawerBadge) drawerBadge.style.display = 'none';
      }

      // Carregar os clientes específicos desta conta
      this.loadClients();
    }
  },

  // Abrir Modal de Gestão de Usuários
  openManageAccountsModal() {
    const modal = document.getElementById('manageAccountsModal');
    if (modal) {
      modal.classList.add('open');
      this.renderAccountsList();
    }
  },

  // Checar quantas contas estão cadastradas e atualizar badges
  async checkPendingAccounts() {
    try {
      const accounts = await AuthManager.getAccountsList();
      const pendingCount = accounts.filter(a => a.status === 'pending').length;

      // Atualizar badge no header do total de usuários
      const headerUsersCountBadge = document.getElementById('headerUsersCountBadge');
      if (headerUsersCountBadge) {
        headerUsersCountBadge.textContent = accounts.length;
        headerUsersCountBadge.style.display = accounts.length > 0 ? 'inline-block' : 'none';
      }

      // Atualizar badge do botão legado (se existir)
      const pendingBadge = document.getElementById('pendingBadge');
      if (pendingBadge) {
        pendingBadge.style.display = pendingCount > 0 ? 'block' : 'none';
      }

      // Atualizar ponto indicador no botão hambúrguer do header
      const drawerBadge = document.getElementById('drawerBadge');
      if (drawerBadge) {
        drawerBadge.style.display = pendingCount > 0 ? 'block' : 'none';
      }

      // Atualizar badge numérica dentro do menu hambúrguer
      const drawerPendingCount = document.getElementById('drawerPendingCount');
      if (drawerPendingCount) {
        drawerPendingCount.textContent = pendingCount;
        drawerPendingCount.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
    } catch (e) {
      console.warn('Erro ao verificar contas:', e);
    }
  },

  lastCreatedUserData: null,

  // Gerar senha aleatória de 6 dígitos numéricos (ideal para TV boxes e celulares)
  generateRandomPassword() {
    const pass = Math.floor(100000 + Math.random() * 900000);
    const input = document.getElementById('adminNewUserPassword');
    if (input) input.value = pass;
  },

  generateRandomPasswordForChange() {
    const pass = Math.floor(100000 + Math.random() * 900000);
    const input = document.getElementById('changePassNewInput');
    if (input) input.value = pass;
  },

  // Criar novo usuário pelo painel do Admin Master
  async handleAdminCreateUser(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById('adminNewUserName');
    const loginInput = document.getElementById('adminNewUserLogin');
    const passInput = document.getElementById('adminNewUserPassword');
    const submitBtn = document.getElementById('btnAdminCreateUser');

    const name = nameInput ? nameInput.value.trim() : '';
    const login = loginInput ? loginInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!name || !login || !pass) {
      alert('Por favor, preencha todos os campos (Nome, Usuário/E-mail e Senha).');
      return;
    }

    if (pass.length < 6) {
      alert('A senha deve conter no mínimo 6 dígitos.');
      return;
    }

    const originalBtn = submitBtn ? submitBtn.innerHTML : '';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Criando e liberando conta...</span>';
      }

      const res = await AuthManager.createUserByAdmin(name, login, pass);

      const loginDisplay = res.loginDisplay || login;
      const appUrl = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://hartv-gestor.web.app';

      this.lastCreatedUserData = {
        name: name,
        login: loginDisplay,
        password: pass,
        url: appUrl
      };

      // Preencher caixa do modal de dados de acesso
      const summaryBox = document.getElementById('userCreatedSummaryBox');
      if (summaryBox) {
        summaryBox.textContent = `👤 Usuário: ${loginDisplay}\n🔑 Senha: ${pass}\n🌐 Painel: ${appUrl}`;
      }

      // Limpar formulário de criação
      if (nameInput) nameInput.value = '';
      if (loginInput) loginInput.value = '';
      if (passInput) passInput.value = '';

      // Abrir modal de dados criados
      const modal = document.getElementById('userCreatedModal');
      if (modal) modal.classList.add('open');

      this.showToast(`✅ Usuário "${loginDisplay}" criado e liberado com sucesso!`, 'success');
      await this.renderAccountsList();
    } catch (err) {
      alert('Erro ao criar usuário: ' + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtn || '<span>✨ Criar e Liberar Usuário</span>';
      }
    }
  },

  // Copiar dados do usuário recém-criado
  handleCopyCreatedUser() {
    if (!this.lastCreatedUserData) return;
    const { name, login, password, url } = this.lastCreatedUserData;
    const text = `*Seu Acesso ao HarTv Gestor* 🚀\n👤 *Usuário:* ${login}\n🔑 *Senha:* ${password}\n🌐 *Acesse por aqui:* ${url}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('📋 Dados de acesso copiados para a área de transferência!', 'success');
      }).catch(() => {
        prompt('Copie os dados abaixo (Ctrl+C):', text);
      });
    } else {
      prompt('Copie os dados abaixo (Ctrl+C):', text);
    }
  },

  // Enviar dados do usuário criado direto pelo WhatsApp
  handleSendCreatedUserWhatsApp() {
    if (!this.lastCreatedUserData) return;
    const { name, login, password, url } = this.lastCreatedUserData;
    const text = `Olá ${name}! Aqui está o seu acesso oficial ao painel do HarTv Gestor: 🚀\n\n👤 *Usuário:* ${login}\n🔑 *Senha:* ${password}\n🌐 *Link de Acesso:* ${url}\n\nQualquer dúvida, estou à disposição!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  },

  // Copiar credenciais de um usuário já existente na lista
  handleCopyUserCredentials(name, login, password) {
    const appUrl = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://hartv-gestor.web.app';
    let text = `*Seu Acesso ao HarTv Gestor* 🚀\n👤 *Usuário:* ${login}\n`;
    if (password) {
      text += `🔑 *Senha:* ${password}\n`;
    }
    text += `🌐 *Acesse por aqui:* ${appUrl}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('📋 Dados de acesso copiados!', 'success');
      }).catch(() => {
        prompt('Copie os dados abaixo (Ctrl+C):', text);
      });
    } else {
      prompt('Copie os dados abaixo (Ctrl+C):', text);
    }
  },

  // Abrir modal de alteração de senha
  openChangePasswordModal(uid, name, email, oldPass) {
    const modal = document.getElementById('changePasswordModal');
    if (!modal) return;
    document.getElementById('changePassUid').value = uid || '';
    document.getElementById('changePassEmail').value = email || '';
    document.getElementById('changePassOldPass').value = oldPass || '';
    document.getElementById('changePassUserName').textContent = `${name} (${email})`;
    this.generateRandomPasswordForChange();
    modal.classList.add('open');
  },

  // Salvar nova senha definida pelo Admin Master
  async handleSaveNewPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    const uid = document.getElementById('changePassUid').value;
    const email = document.getElementById('changePassEmail').value;
    const oldPass = document.getElementById('changePassOldPass').value;
    const newPass = document.getElementById('changePassNewInput').value.trim();
    const submitBtn = document.getElementById('btnSaveNewPass');

    if (!newPass || newPass.length < 6) {
      alert('A nova senha deve ter no mínimo 6 dígitos.');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Salvando...</span>';
      }
      await AuthManager.changeUserPasswordByAdmin(uid, email, newPass, oldPass);
      this.closeAllModals();
      this.showToast('✅ Nova senha salva com sucesso!', 'success');
      await this.renderAccountsList();
    } catch (err) {
      alert('Erro ao alterar senha: ' + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾 Salvar Nova Senha</span>';
      }
    }
  },

  // Renderizar Lista de Usuários no Painel Admin
  async renderAccountsList() {
    const container = document.getElementById('accountsListContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 15px;">Carregando usuários...</div>';

    try {
      const accounts = await AuthManager.getAccountsList();
      const currentUser = AuthManager.getUser();

      const purgeHeader = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <span style="font-size: 0.78rem; color: var(--text-muted);">Total de usuários: <strong>${accounts.length}</strong></span>
          <button class="btn btn-danger" style="font-size: 0.72rem; padding: 5px 10px;" onclick="App.handlePurgeOtherAccounts()">
            <span>🗑️ Limpar Outras Contas</span>
          </button>
        </div>
      `;

      if (accounts.length === 0) {
        container.innerHTML = purgeHeader + '<div style="text-align: center; color: var(--text-dim); padding: 20px;">Nenhum usuário cadastrado além de você.</div>';
        return;
      }

      container.innerHTML = purgeHeader + accounts.map(acc => {
        const isMaster = AuthManager.isMasterEmail(acc.email);
        const isCurrent = isMaster || (currentUser && currentUser.uid === acc.uid) || (currentUser && currentUser.email && currentUser.email.toLowerCase() === acc.email.toLowerCase());
        const status = acc.status || 'approved';
        let statusBadge = '<span class="status-pill approved">🟢 Ativo</span>';
        if (status === 'blocked') statusBadge = '<span class="status-pill blocked">🔴 Bloqueado</span>';

        const displayName = acc.displayName || 'Sem nome';
        const loginDisplay = acc.loginDisplay || acc.username || acc.email;
        const passDisplay = acc.plainPassword ? `<span style="font-size: 0.72rem; color: #a7f3d0; background: rgba(16, 185, 129, 0.12); padding: 2px 6px; border-radius: 4px; font-family: monospace;">🔑 ${this.escapeHtml(acc.plainPassword)}</span>` : '';

        return `
          <div class="account-item-card">
            <div class="account-info">
              <div class="account-name-row">
                <span class="account-name">${this.escapeHtml(displayName)}</span>
                ${isMaster ? '<span style="font-size: 0.65rem; background: rgba(139, 92, 246, 0.2); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-weight: 700;">ADMIN MASTER 👑</span>' : ''}
                ${isCurrent ? '<span style="font-size: 0.65rem; color: #38bdf8;">(Você)</span>' : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;">
                <span class="account-email">${this.escapeHtml(loginDisplay)}</span>
                ${passDisplay}
              </div>
              <div style="margin-top: 4px;">${statusBadge}</div>
            </div>

            <div class="account-actions-group" style="flex-wrap: wrap;">
              ${isMaster ? `
                <span style="font-size: 0.72rem; color: #c084fc; font-weight: 700; background: rgba(139, 92, 246, 0.15); padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(139, 92, 246, 0.35);">
                  👑 Conta Master
                </span>
              ` : `
                <button class="btn-acc-action btn-acc-approve" title="Copiar Usuário e Senha para enviar ao cliente" onclick="App.handleCopyUserCredentials('${this.escapeJs(displayName)}', '${this.escapeJs(loginDisplay)}', '${this.escapeJs(acc.plainPassword || '')}')">
                  <span>📋 Copiar</span>
                </button>
                <button class="btn-acc-action btn-secondary" title="Alterar Senha" onclick="App.openChangePasswordModal('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}', '${this.escapeJs(acc.plainPassword || '')}')" style="padding: 6px 8px; font-size: 0.72rem;">
                  <span>🔑 Senha</span>
                </button>
                ${status === 'blocked' ? `
                  <button class="btn-acc-action btn-acc-approve" title="Desbloquear acesso" onclick="App.handleApproveAccount('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}')">
                    <span>🟢 Liberar</span>
                  </button>
                ` : `
                  <button class="btn-acc-action btn-acc-block" title="Bloquear acesso temporariamente" onclick="App.handleBlockAccount('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}')">
                    <span>🚫 Bloquear</span>
                  </button>
                `}
                <button class="btn-acc-action btn-acc-delete" title="Excluir Usuário" onclick="App.handleDeleteAccount('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}')">
                  <span>🗑️</span>
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');

      this.checkPendingAccounts();
    } catch (e) {
      container.innerHTML = `<div style="color: var(--danger); padding: 10px;">Erro ao carregar usuários: ${e.message}</div>`;
    }
  },

  // Copiar regras do Firestore para área de transferência
  copyFirestoreRules() {
    const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /system_accounts/{document=**} {\n      allow read, write: if true;\n    }\n    match /users/{userId}/{document=**} {\n      allow read, write: if request.auth != null && request.auth.uid == userId;\n    }\n  }\n}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rules).then(() => {
        this.showToast('Regras copiadas! Cole no Console do Firebase e clique em Publicar.', 'success');
      }).catch(() => {
        prompt('Copie as regras abaixo (Ctrl+C):', rules);
      });
    } else {
      prompt('Copie as regras abaixo (Ctrl+C):', rules);
    }
  },

  // Liberar/Desbloquear usuário
  async handleApproveAccount(uid, name, email) {
    try {
      this.showToast(`Liberando acesso de "${name}"...`, 'info');
      await AuthManager.updateAccountStatus(uid, 'approved', email);
      this.showToast(`✅ Acesso de "${name}" liberado com sucesso!`, 'success');
      await this.renderAccountsList();
    } catch (err) {
      alert('Aviso: ' + (err.message || err));
      await this.renderAccountsList();
    }
  },

  // Bloquear usuário
  async handleBlockAccount(uid, name, email) {
    if (confirm(`Deseja realmente bloquear o acesso de "${name}"? O usuário não conseguirá entrar.`)) {
      try {
        await AuthManager.updateAccountStatus(uid, 'blocked', email);
        this.showToast(`Conta de "${name}" foi bloqueada.`, 'info');
        await this.renderAccountsList();
      } catch (err) {
        alert('Aviso: ' + (err.message || err));
        await this.renderAccountsList();
      }
    }
  },

  // Excluir conta
  async handleDeleteAccount(uid, name, email) {
    if (confirm(`Tem certeza que deseja excluir o usuário "${name}"?`)) {
      try {
        await AuthManager.deleteAccount(uid, email);
        this.showToast(`Usuário "${name}" excluído.`, 'info');
        await this.renderAccountsList();
      } catch (err) {
        alert('Aviso: ' + (err.message || err));
        await this.renderAccountsList();
      }
    }
  },

  // Excluir todas as outras contas exceto o Master
  async handlePurgeOtherAccounts() {
    if (confirm('Atenção: Deseja realmente excluir todos os outros usuários e deixar APENAS andrew.g.h.agh@gmail.com?')) {
      await AuthManager.purgeNonMasterAccounts();
      this.showToast('Outras contas excluídas!', 'success');
      this.renderAccountsList();
    }
  },

  // Submit de Login (Aceita tanto usuário curto quanto e-mail)
  async handleLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const loginInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const loginVal = loginInput ? loginInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';
    const submitBtn = document.getElementById('btnLoginSubmit');

    if (!loginVal || !pass) {
      alert('Por favor, informe seu usuário ou e-mail e sua senha.');
      return;
    }

    const originalText = submitBtn ? submitBtn.innerHTML : '';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Conectando...</span>';
      }
      const user = await AuthManager.login(loginVal, pass);
      this.showToast(`Bem-vindo, ${user.displayName || user.email}!`, 'success');
      const form = document.getElementById('formLogin');
      if (form) form.reset();
    } catch (err) {
      alert(err.message || 'Erro ao realizar login.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText || '<span>🚀 Entrar no Painel</span>';
      }
    }
  },

  // Sair da Conta (Logout)
  async handleLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
      this.closeDrawer();
      if (typeof DatabaseManager !== 'undefined') {
        DatabaseManager.unsubscribeAll();
      }
      this.updateCloudSyncBadge(false);
      await AuthManager.logout();
      this.showToast('Você saiu da sua conta.', 'info');
    }
  },

  // Cálculo de dias restantes e status
  getClientStatus(expirationDateStr) {
    if (!expirationDateStr) {
      return { status: 'ativo', label: 'Sem Data', class: 'ativo', daysLeft: 999 };
    }

    const parts = expirationDateStr.split('-');
    if (parts.length !== 3) {
      return { status: 'ativo', label: 'Indefinido', class: 'ativo', daysLeft: 999 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expDate = new Date(parts[0], parts[1] - 1, parts[2]);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const daysAgo = Math.abs(diffDays);
      return {
        status: 'vencido',
        label: daysAgo === 1 ? 'Venceu ontem' : `Vencido há ${daysAgo} dias`,
        class: 'vencido',
        daysLeft: diffDays
      };
    } else if (diffDays === 0) {
      return {
        status: 'hoje',
        label: 'Vence Hoje!',
        class: 'hoje',
        daysLeft: 0
      };
    } else if (diffDays <= 3) {
      return {
        status: 'vencendo',
        label: diffDays === 1 ? 'Vence amanhã' : `Faltam ${diffDays} dias`,
        class: 'vencendo',
        daysLeft: diffDays
      };
    } else {
      return {
        status: 'ativo',
        label: `Faltam ${diffDays} dias`,
        class: 'ativo',
        daysLeft: diffDays
      };
    }
  },

  // Formatar data para exibição brasileira (DD/MM/AAAA)
  formatDate(dateStr) {
    if (!dateStr) return '--/--/----';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  // Formatar moeda BRL
  formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  // Atualizar contadores do Dashboard
  updateDashboard() {
    let activeCount = 0;
    let warningCount = 0;
    let expiredCount = 0;
    let totalRevenue = 0;

    this.clients.forEach(client => {
      const statusInfo = this.getClientStatus(client.expiration);
      const price = parseFloat(client.price) || 0;

      if (statusInfo.status === 'vencido') {
        expiredCount++;
      } else if (statusInfo.status === 'hoje' || statusInfo.status === 'vencendo') {
        warningCount++;
        activeCount++;
        totalRevenue += price;
      } else {
        activeCount++;
        totalRevenue += price;
      }
    });

    const elTotal = document.getElementById('statTotal');
    const elActive = document.getElementById('statActive');
    const elWarning = document.getElementById('statWarning');
    const elExpired = document.getElementById('statExpired');
    const elRevenue = document.getElementById('statRevenue');

    if (elTotal) elTotal.textContent = this.clients.length;
    if (elActive) elActive.textContent = activeCount;
    if (elWarning) elWarning.textContent = warningCount;
    if (elExpired) elExpired.textContent = expiredCount;
    if (elRevenue) elRevenue.textContent = this.formatCurrency(totalRevenue);

    // Contadores nos Chips
    const countAll = document.getElementById('countAll');
    const countToday = document.getElementById('countToday');
    const countSoon = document.getElementById('countSoon');
    const countActive = document.getElementById('countActive');
    const countExpired = document.getElementById('countExpired');

    let todayCount = 0;
    let soonCount = 0;

    this.clients.forEach(c => {
      const s = this.getClientStatus(c.expiration);
      if (s.status === 'hoje') todayCount++;
      if (s.status === 'vencendo') soonCount++;
    });

    if (countAll) countAll.textContent = this.clients.length;
    if (countToday) countToday.textContent = todayCount;
    if (countSoon) countSoon.textContent = soonCount;
    if (countActive) countActive.textContent = activeCount;
    if (countExpired) countExpired.textContent = expiredCount;
  },

  // Filtrar e pesquisar clientes
  getFilteredClients() {
    return this.clients.filter(client => {
      const statusInfo = this.getClientStatus(client.expiration);

      // Filtro de Status
      if (this.currentFilter === 'today' && statusInfo.status !== 'hoje') return false;
      if (this.currentFilter === 'soon' && statusInfo.status !== 'vencendo') return false;
      if (this.currentFilter === 'active' && (statusInfo.status === 'vencido')) return false;
      if (this.currentFilter === 'expired' && statusInfo.status !== 'vencido') return false;

      // Filtro de Busca (Nome, Usuário, Servidor, App)
      if (this.searchQuery) {
        const name = (client.name || '').toLowerCase();
        const username = (client.username || '').toLowerCase();
        const mac = (client.mac || '').toLowerCase();
        const deviceKey = (client.deviceKey || client.key || '').toLowerCase();
        const server = (client.server || '').toLowerCase();
        const app = (client.app || '').toLowerCase();
        const whatsapp = (client.whatsapp || '').toLowerCase();

        return name.includes(this.searchQuery) ||
               username.includes(this.searchQuery) ||
               mac.includes(this.searchQuery) ||
               deviceKey.includes(this.searchQuery) ||
               server.includes(this.searchQuery) ||
               app.includes(this.searchQuery) ||
               whatsapp.includes(this.searchQuery);
      }

      return true;
    }).sort((a, b) => {
      // Ordenar por data de vencimento (os mais próximos do vencimento primeiro)
      if (!a.expiration) return 1;
      if (!b.expiration) return -1;
      return a.expiration.localeCompare(b.expiration);
    });
  },

  // Renderizar Lista de Clientes
  renderListOnly() {
    const listContainer = document.getElementById('clientList');
    if (!listContainer) return;

    const filtered = this.getFilteredClients();

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <h3>Nenhum cliente encontrado</h3>
          <p style="font-size: 0.85rem;">${this.clients.length === 0 ? 'Clique no botão abaixo para cadastrar seu primeiro cliente!' : 'Tente mudar o filtro ou termo de busca.'}</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(client => this.renderClientCard(client)).join('');
  },

  // Renderizar um Card de Cliente individual
  renderClientCard(client) {
    const statusInfo = this.getClientStatus(client.expiration);
    const formattedDate = this.formatDate(client.expiration);
    const formattedPrice = this.formatCurrency(client.price);

    return `
      <div class="client-card" data-id="${client.id}">
        <!-- Cabeçalho do Card -->
        <div class="card-header">
          <div class="client-name-group">
            <div class="client-name">
              ${this.escapeHtml(client.name)}
            </div>
            <div class="client-meta-info">
              ${client.server ? `<span class="tag-badge">🖥️ ${this.escapeHtml(client.server)}</span>` : ''}
              ${client.app ? `<span class="tag-badge">📱 ${this.escapeHtml(client.app)}</span>` : ''}
            </div>
          </div>
          <span class="status-badge ${statusInfo.class}">
            ● ${statusInfo.label}
          </span>
        </div>

        <!-- Credenciais e Conexão -->
        <div class="credentials-box">
          <div class="credential-item">
            <span class="cred-label">URL:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" title="${this.escapeHtml(client.url || '')}">${this.escapeHtml(client.url || 'Não informada')}</span>
              ${client.url ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.url)}', 'URL')" title="Copiar URL" aria-label="Copiar URL de conexão">📋</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">Usuário:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #38bdf8; font-weight: 600;">${this.escapeHtml(client.username || '---')}</span>
              ${client.username ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.username)}', 'Usuário')" title="Copiar Usuário" aria-label="Copiar usuário de acesso">📋</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">Senha:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" id="pwd-${client.id}" style="color: #a855f7; font-weight: 600;">••••••</span>
              <button class="copy-mini-btn" onclick="App.togglePassword('${client.id}', '${this.escapeJs(client.password || '')}')" title="Mostrar/Ocultar Senha" aria-label="Mostrar ou ocultar senha">👁️</button>
              ${client.password ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.password)}', 'Senha')" title="Copiar Senha" aria-label="Copiar senha">📋</button>` : ''}
            </div>
          </div>

          ${client.mac ? `
          <div class="credential-item">
            <span class="cred-label">MAC:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #fbbf24; font-weight: 600; font-family: monospace;">${this.escapeHtml(client.mac)}</span>
              <button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.mac)}', 'MAC')" title="Copiar MAC" aria-label="Copiar endereço MAC">📋</button>
            </div>
          </div>` : ''}

          ${(client.deviceKey || client.key) ? `
          <div class="credential-item">
            <span class="cred-label">Chave / Key:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #34d399; font-weight: 600;">${this.escapeHtml(client.deviceKey || client.key)}</span>
              <button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.deviceKey || client.key)}', 'Chave')" title="Copiar Chave" aria-label="Copiar chave do dispositivo">📋</button>
            </div>
          </div>` : ''}

          <div class="credential-item">
            <span class="cred-label">WhatsApp:</span>
            <div class="cred-value-wrap">
              <span class="cred-val">${this.escapeHtml(client.whatsapp || 'Não informado')}</span>
              ${client.whatsapp ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.whatsapp)}', 'WhatsApp')" title="Copiar WhatsApp" aria-label="Copiar número do WhatsApp">📋</button>` : ''}
            </div>
          </div>
        </div>

        <!-- Linha de Vencimento e Preço -->
        <div class="card-details-row">
          <div class="expiration-info">
            <span>📅 Vencimento:</span>
            <span class="exp-date">${formattedDate}</span>
          </div>
          <div class="price-tag">
            ${formattedPrice}
          </div>
        </div>

        <!-- Ações Rápidas -->
        <div class="card-actions">
          <button class="action-btn whatsapp-btn" onclick="App.openWhatsAppMenu('${client.id}')" aria-label="Abrir menu de WhatsApp para ${this.escapeHtml(client.name)}">
            <span>💬</span>
            <span>WhatsApp</span>
          </button>
          <button class="action-btn renew-btn" onclick="App.handleQuickRenew('${client.id}')" title="Adicionar 30 dias de sinal" aria-label="Renovar assinatura por mais 30 dias">
            <span>⚡</span>
            <span>+30 Dias</span>
          </button>
          <button class="action-btn" onclick="App.openClientModal('${client.id}')" aria-label="Editar dados de ${this.escapeHtml(client.name)}">
            <span>✏️</span>
            <span>Editar</span>
          </button>
          <button class="action-btn danger-action" onclick="App.handleDeleteClient('${client.id}', '${this.escapeJs(client.name)}')" aria-label="Excluir cliente ${this.escapeHtml(client.name)}">
            <span>🗑️</span>
            <span>Excluir</span>
          </button>
        </div>
      </div>
    `;
  },

  // Renderizar tudo
  render() {
    this.updateDashboard();
    this.renderListOnly();
  },

  // Alternar visualização da senha
  togglePassword(clientId, realPassword) {
    const el = document.getElementById(`pwd-${clientId}`);
    if (!el) return;
    if (el.textContent === '••••••') {
      el.textContent = realPassword || '---';
    } else {
      el.textContent = '••••••';
    }
  },

  // Copiar para área de transferência
  async copyToClipboard(text, label = 'Texto') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(`${label} copiado!`, 'info');
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast(`${label} copiado!`, 'info');
    }
  },

  // Renovação Rápida de +30 Dias
  handleQuickRenew(clientId) {
    const updated = StorageManager.renewClient(clientId, 30);
    if (updated) {
      this.loadClients();
      this.showToast(`Assinatura de ${updated.name} renovada por +30 dias!`, 'success');
      NotificationManager.notifyChange('🔄 Assinatura Renovada', `${updated.name} teve o vencimento estendido para ${this.formatDate(updated.expiration)}.`);
    }
  },

  // Excluir cliente
  handleDeleteClient(clientId, clientName) {
    if (confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?`)) {
      StorageManager.deleteClient(clientId);
      this.loadClients();
      this.showToast(`Cliente removido com sucesso.`, 'info');
      NotificationManager.notifyChange('🗑️ Cliente Excluído', `${clientName} foi removido do aplicativo.`);
    }
  },

  // Abertura do Modal de Cliente (Adicionar / Editar)
  openClientModal(clientId = null) {
    this.editingClientId = clientId;
    const modal = document.getElementById('clientModal');
    const form = document.getElementById('clientForm');
    const title = document.getElementById('modalClientTitle');
    const settings = StorageManager.getSettings();

    form.reset();

    if (clientId) {
      // Modo Edição
      const client = StorageManager.getClientById(clientId);
      if (!client) return;
      title.textContent = 'Editar Cliente';
      document.getElementById('clientId').value = client.id;
      document.getElementById('clientName').value = client.name || '';
      document.getElementById('clientExpiration').value = client.expiration || '';
      document.getElementById('clientUrl').value = client.url || '';
      document.getElementById('clientApp').value = client.app || '';
      document.getElementById('clientPrice').value = client.price || '';
      document.getElementById('clientUsername').value = client.username || '';
      document.getElementById('clientPassword').value = client.password || '';
      const macInput = document.getElementById('clientMac');
      const keyInput = document.getElementById('clientKey');
      if (macInput) macInput.value = client.mac || '';
      if (keyInput) keyInput.value = client.deviceKey || client.key || '';
      document.getElementById('clientServer').value = client.server || '';
      document.getElementById('clientWhatsapp').value = client.whatsapp || '';
      document.getElementById('clientNotes').value = client.notes || '';
    } else {
      // Modo Novo Cliente
      title.textContent = 'Novo Cliente IPTV';
      document.getElementById('clientId').value = '';
      
      const macInput = document.getElementById('clientMac');
      const keyInput = document.getElementById('clientKey');
      if (macInput) macInput.value = '';
      if (keyInput) keyInput.value = '';

      // Sugerir URL padrão das configurações
      if (settings.defaultUrl) {
        document.getElementById('clientUrl').value = settings.defaultUrl;
      }

      // Sugerir vencimento para 30 dias a partir de hoje
      this.setQuickExpirationDate(30);
    }

    modal.classList.add('open');
  },

  // Definir data rápida no input do formulário (+30d, +90d, etc.)
  setQuickExpirationDate(days) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const dateInput = document.getElementById('clientExpiration');
    if (dateInput) {
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
  },

  // Salvar Cliente (Submit do form)
  handleSaveClient(e) {
    e.preventDefault();

    const id = document.getElementById('clientId').value || null;
    const name = document.getElementById('clientName').value.trim();
    const expiration = document.getElementById('clientExpiration').value;
    const url = document.getElementById('clientUrl').value.trim();
    const app = document.getElementById('clientApp').value.trim();
    const price = parseFloat(document.getElementById('clientPrice').value) || 0;
    const username = document.getElementById('clientUsername').value.trim();
    const password = document.getElementById('clientPassword').value.trim();
    const mac = document.getElementById('clientMac') ? document.getElementById('clientMac').value.trim().toUpperCase() : '';
    const deviceKey = document.getElementById('clientKey') ? document.getElementById('clientKey').value.trim() : '';
    const server = document.getElementById('clientServer').value.trim();
    const whatsapp = document.getElementById('clientWhatsapp').value.trim();
    const notes = document.getElementById('clientNotes').value.trim();

    if (!name) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }

    const clientData = {
      id,
      name,
      expiration,
      url,
      app,
      price,
      username,
      password,
      mac,
      deviceKey,
      server,
      whatsapp,
      notes
    };

    StorageManager.saveClient(clientData);
    this.closeAllModals();
    this.loadClients();

    const actionText = id ? 'atualizado' : 'cadastrado';
    this.showToast(`Cliente "${name}" ${actionText} com sucesso!`, 'success');
    NotificationManager.notifyChange(`✅ Cliente ${actionText}`, `${name} foi salvo no sistema.`);
  },

  // Menu WhatsApp (Acesso ou Cobrança)
  openWhatsAppMenu(clientId) {
    const client = StorageManager.getClientById(clientId);
    if (!client) return;

    const modal = document.getElementById('whatsappModal');
    const title = document.getElementById('whatsappModalTitle');
    title.textContent = `Mensagem para ${client.name}`;

    const btnSendAccess = document.getElementById('btnSendAccess');
    const btnSendBilling = document.getElementById('btnSendBilling');
    const btnCopyAccess = document.getElementById('btnCopyAccess');
    const btnCopyBilling = document.getElementById('btnCopyBilling');

    const settings = StorageManager.getSettings();

    // Gerar mensagem de Acesso
    const accessText = this.formatTemplate(settings.accessMessage, client, settings);
    // Gerar mensagem de Cobrança
    const billingText = this.formatTemplate(settings.billingMessage, client, settings);

    // Configurar cliques
    btnSendAccess.onclick = () => this.dispatchWhatsApp(client.whatsapp, accessText);
    btnCopyAccess.onclick = () => this.copyToClipboard(accessText, 'Dados de acesso');

    btnSendBilling.onclick = () => this.dispatchWhatsApp(client.whatsapp, billingText);
    btnCopyBilling.onclick = () => this.copyToClipboard(billingText, 'Mensagem de cobrança');

    modal.classList.add('open');
  },

  // Formatar Template de mensagem substituindo variáveis
  formatTemplate(template, client, settings) {
    if (!template) return '';
    const mac = client.mac || '';
    const key = client.deviceKey || client.key || '';

    let text = template
      .replace(/{NOME}/g, client.name || '')
      .replace(/{APP}/g, client.app || 'IPTV')
      .replace(/{URL}/g, client.url || '')
      .replace(/{USUARIO}/g, client.username || '')
      .replace(/{SENHA}/g, client.password || '')
      .replace(/{MAC}/g, mac)
      .replace(/{CHAVE}/g, key)
      .replace(/{VENCIMENTO}/g, this.formatDate(client.expiration))
      .replace(/{VALOR}/g, (client.price || 0).toFixed(2).replace('.', ','))
      .replace(/{PIX}/g, settings.pixKey || '(21)964551053')
      .replace(/{TITULAR}/g, settings.pixName || 'Andrew Gibson Harris')
      .replace(/{BANCO}/g, settings.pixBank || 'Itaú');

    // Se o cliente tem MAC ou Chave e a mensagem de acesso não os possui explicitamente, anexar de forma elegante
    if (mac && !template.includes('{MAC}') && !text.includes(mac)) {
      text += `\n🆔 *MAC:* ${mac}`;
    }
    if (key && !template.includes('{CHAVE}') && !text.includes(key)) {
      text += `\n🔑 *Chave:* ${key}`;
    }

    return text;
  },

  // Abrir WhatsApp Web ou App
  dispatchWhatsApp(phone, message) {
    let cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone && !cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
      cleanPhone = '55' + cleanPhone;
    }

    const encoded = encodeURIComponent(message);
    let link = '';
    if (cleanPhone) {
      link = `https://wa.me/${cleanPhone}?text=${encoded}`;
    } else {
      link = `https://wa.me/?text=${encoded}`;
    }

    window.open(link, '_blank');
  },

  // Modal de Backup (Exportar / Importar)
  openBackupModal() {
    const modal = document.getElementById('backupModal');
    const totalSpan = document.getElementById('backupTotalCount');
    if (totalSpan) totalSpan.textContent = this.clients.length;
    modal.classList.add('open');
  },

  // Importar por Arquivo
  handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target.result;
      const res = StorageManager.importBackup(content, mode);
      if (res.success) {
        this.closeAllModals();
        this.loadClients();
        this.showToast(`Sucesso! ${res.importedCount} clientes importados. Total agora: ${res.totalCount}`, 'success');
        NotificationManager.notifyChange('📥 Backup Importado', `${res.importedCount} registros foram importados com sucesso.`);
      } else {
        alert('Erro ao importar arquivo: ' + res.error);
      }
    };

    reader.readAsText(file);
    e.target.value = ''; // reset
  },

  // Importar por Texto Colado
  handleTextImport() {
    const text = document.getElementById('importTextarea').value.trim();
    if (!text) {
      alert('Por favor, cole o código ou JSON de backup.');
      return;
    }

    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
    const res = StorageManager.importBackup(text, mode);

    if (res.success) {
      this.closeAllModals();
      this.loadClients();
      this.showToast(`Importação concluída: ${res.importedCount} cliente(s)!`, 'success');
      NotificationManager.notifyChange('📥 Backup Importado', `${res.importedCount} registros foram adicionados.`);
      document.getElementById('importTextarea').value = '';
    } else {
      alert('Erro na importação: ' + res.error);
    }
  },

  // Modal de Configurações
  openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const settings = StorageManager.getSettings();

    document.getElementById('settingPixKey').value = settings.pixKey || '(21)964551053';
    document.getElementById('settingPixName').value = settings.pixName || 'Andrew Gibson Harris';
    document.getElementById('settingPixBank').value = settings.pixBank || 'Itaú';
    document.getElementById('settingDefaultUrl').value = settings.defaultUrl || '';
    document.getElementById('settingNotifyDays').value = settings.notifyDaysBefore || 3;
    document.getElementById('settingBillingMsg').value = settings.billingMessage || '';
    document.getElementById('settingAccessMsg').value = settings.accessMessage || '';

    const perm = NotificationManager.getPermission();
    const permStatus = document.getElementById('notifPermissionStatus');
    if (permStatus) {
      if (perm === 'granted') {
        permStatus.innerHTML = '<span style="color: #10b981;">● Ativadas (Funcionando)</span>';
      } else if (perm === 'denied') {
        permStatus.innerHTML = '<span style="color: #ef4444;">● Bloqueadas no Navegador</span>';
      } else {
        permStatus.innerHTML = '<span style="color: #f59e0b;">● Não configuradas (Clique em Testar)</span>';
      }
    }

    modal.classList.add('open');
  },

  // Salvar Configurações
  handleSaveSettings(e) {
    e.preventDefault();
    const settings = {
      pixKey: document.getElementById('settingPixKey').value.trim(),
      pixName: document.getElementById('settingPixName').value.trim(),
      pixBank: document.getElementById('settingPixBank').value.trim(),
      defaultUrl: document.getElementById('settingDefaultUrl').value.trim(),
      notifyDaysBefore: parseInt(document.getElementById('settingNotifyDays').value, 10) || 3,
      billingMessage: document.getElementById('settingBillingMsg').value.trim(),
      accessMessage: document.getElementById('settingAccessMsg').value.trim()
    };

    StorageManager.saveSettings(settings);
    this.closeAllModals();
    this.showToast('Configurações salvas com sucesso!', 'success');
  },

  // Botão de Notificação no Header
  async handleNotificationButton() {
    const perm = NotificationManager.getPermission();
    if (perm !== 'granted') {
      const granted = await NotificationManager.requestPermission();
      if (granted) {
        this.showToast('Notificações ativadas no seu celular!', 'success');
        NotificationManager.testNotification();
        this.updateNotificationBadge();
      } else {
        alert('As notificações foram negadas ou bloqueadas. Você pode ativá-las nas configurações do seu navegador.');
      }
    } else {
      // Se já tiver permissão, faz um teste e checa vencimentos
      NotificationManager.checkExpirations(this.clients, true);
      this.showToast('Verificação de vencimentos realizada!', 'info');
    }
  },

  // Atualizar badge do botão de notificação
  updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const perm = NotificationManager.getPermission();
    badge.style.display = perm === 'granted' ? 'none' : 'block';
  },

  // Fechar todos os modais
  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    this.editingClientId = null;
  },

  // Toast Notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // Escapes para prevenir XSS
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  escapeJs(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }
};
