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

  // Sistema de Ícones Vetoriais SVG (Lucide)
  Icons: {
    eye(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    },
    eyeOff(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
    },
    copy(size = 14) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    },
    check(size = 14) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    },
    whatsapp(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" style="fill: currentColor; stroke: none;"><path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.44 1.27 4.89L2 22l5.25-1.28A9.97 9.97 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm0 18.25c-1.58 0-3.09-.43-4.39-1.19l-.32-.18-3.26.79.86-3.14-.2-.33A8.2 8.2 0 0 1 3.79 12c0-4.55 3.7-8.25 8.25-8.25s8.25 3.7 8.25 8.25-3.7 8.25-8.25 8.25zm4.51-6.2c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.15.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.23-.74-.65-1.23-1.46-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43-.15-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28z"/></svg>`;
    },
    calendar(size = 14) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
    },
    plus30(size = 15) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l.67-1.19"/></svg>`;
    },
    edit(size = 15) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    },
    trash(size = 15) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
    },
    sparkles(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>`;
    },
    server(size = 13) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>`;
    },
    smartphone(size = 13) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`;
    },
    users(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    },
    bell(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
    },
    database(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`;
    },
    settings(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    },
    logout(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`;
    },
    plus(size = 16) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`;
    },
    menu(size = 20) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`;
    },
    key(size = 14) {
      return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`;
    }
  },

  // Alternar visibilidade de input de senha em formulários
  toggleInputPassword(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    if (btnEl) {
      btnEl.innerHTML = isPass ? this.Icons.eye(16) : this.Icons.eyeOff(16);
      btnEl.title = isPass ? 'Ocultar Senha' : 'Ver Senha';
      btnEl.setAttribute('aria-label', isPass ? 'Ocultar senha' : 'Ver senha');
    }
  },

  // Inicialização
  init() {
    this.initTheme();
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
      navigator.serviceWorker.register('./sw.js?v=35')
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

    // Recuperação de Senha Integrada
    const btnOpenForgotPass = document.getElementById('btnOpenForgotPass');
    if (btnOpenForgotPass) {
      btnOpenForgotPass.addEventListener('click', () => this.showForgotView());
    }

    const formForgotPass = document.getElementById('formForgotPass');
    if (formForgotPass) {
      formForgotPass.onsubmit = (e) => this.handleForgotSubmit(e);
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

    const drawerItemTheme = document.getElementById('drawerItemTheme');
    if (drawerItemTheme) {
      drawerItemTheme.addEventListener('click', () => {
        this.closeDrawer();
        this.openThemeModal();
      });
    }

    const themeModal = document.getElementById('themeModal');
    if (themeModal) {
      themeModal.addEventListener('click', (e) => {
        if (e.target === themeModal) this.closeThemeModal();
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

  // Abrir Modal de Temas
  openThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) {
      this.updateThemeModalUI();
      modal.classList.add('open');
    }
  },

  // Fechar Modal de Temas
  closeThemeModal() {
    const modal = document.getElementById('themeModal');
    if (modal) {
      modal.classList.remove('open');
    }
  },

  // Aplicar tema selecionado
  applyTheme(themeKey, showToast = true) {
    const validThemes = ['midnight-indigo', 'cyber-cyan', 'mint-tech', 'stealth-onyx'];
    if (!validThemes.includes(themeKey)) {
      themeKey = 'midnight-indigo';
    }

    document.documentElement.setAttribute('data-theme', themeKey);
    localStorage.setItem('hartv_theme', themeKey);

    // Atualizar cor de tema na meta tag para navegadores e Android PWA
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const bgColors = {
        'midnight-indigo': '#090a0f',
        'cyber-cyan': '#0b0d11',
        'mint-tech': '#0c0f14',
        'stealth-onyx': '#09090b'
      };
      metaThemeColor.setAttribute('content', bgColors[themeKey] || '#090a0f');
    }

    // Atualizar badge no menu lateral drawer
    const themeLabels = {
      'midnight-indigo': 'Indigo Pro',
      'cyber-cyan': 'Cyber Cyan',
      'mint-tech': 'Mint Tech',
      'stealth-onyx': 'Stealth Onyx'
    };
    const drawerThemeBadge = document.getElementById('drawerThemeCurrentBadge');
    if (drawerThemeBadge) {
      drawerThemeBadge.textContent = themeLabels[themeKey] || 'Indigo Pro';
    }

    this.updateThemeModalUI();

    if (showToast) {
      this.showToast(`Paleta ${themeLabels[themeKey]} ativada!`, 'info');
    }
  },

  // Inicializar tema salvo no localStorage
  initTheme() {
    const savedTheme = localStorage.getItem('hartv_theme') || 'midnight-indigo';
    this.applyTheme(savedTheme, false);
  },

  // Atualizar visual dos cards dentro do modal de temas
  updateThemeModalUI() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'midnight-indigo';
    const cards = document.querySelectorAll('.theme-card-option');
    cards.forEach(card => {
      const key = card.getAttribute('data-theme-key');
      if (key === currentTheme) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
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

      // Garantir isolamento absoluto: assegurar que novo usuário inicie com lista vazia no LocalStorage
      if (res && res.user && res.user.uid) {
        localStorage.removeItem(`hartv_clients_${res.user.uid}`);
        localStorage.removeItem(`hartv_settings_${res.user.uid}`);
      }

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
        summaryBox.textContent = `Usuário: ${loginDisplay}\nSenha: ${pass}\nPainel: ${appUrl}`;
      }

      // Limpar formulário de criação
      if (nameInput) nameInput.value = '';
      if (loginInput) loginInput.value = '';
      if (passInput) passInput.value = '';

      // Abrir modal de dados criados
      const modal = document.getElementById('userCreatedModal');
      if (modal) modal.classList.add('open');

      this.showToast(`Usuário "${loginDisplay}" criado e liberado com sucesso!`, 'success');
      await this.renderAccountsList();
    } catch (err) {
      alert('Erro ao criar usuário: ' + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtn || '<span>Criar e Liberar Usuário</span>';
      }
    }
  },

  // Copiar dados do usuário recém-criado
  handleCopyCreatedUser() {
    if (!this.lastCreatedUserData) return;
    const { name, login, password, url } = this.lastCreatedUserData;
    const text = `*Seu Acesso ao HarTv Gestor*\n*Usuário:* ${login}\n*Senha:* ${password}\n*Acesse por aqui:* ${url}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Dados de acesso copiados para a área de transferência!', 'success');
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
    const text = `Olá ${name}! Aqui está o seu acesso oficial ao painel do HarTv Gestor:\n\n*Usuário:* ${login}\n*Senha:* ${password}\n*Link de Acesso:* ${url}\n\nQualquer dúvida, estou à disposição!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  },

  // Copiar credenciais de um usuário já existente na lista
  handleCopyUserCredentials(name, login, password) {
    const appUrl = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://hartv-gestor.web.app';
    let text = `*Seu Acesso ao HarTv Gestor*\n*Usuário:* ${login}\n`;
    if (password) {
      text += `*Senha:* ${password}\n`;
    }
    text += `*Acesse por aqui:* ${appUrl}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Dados de acesso copiados!', 'success');
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
        submitBtn.innerHTML = '<span>Salvando...</span>';
      }
      await AuthManager.changeUserPasswordByAdmin(uid, email, newPass, oldPass);
      this.closeAllModals();
      this.showToast('Nova senha salva com sucesso!', 'success');
      await this.renderAccountsList();
    } catch (err) {
      alert('Erro ao alterar senha: ' + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Salvar Nova Senha</span>';
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

      const validAccounts = accounts;

      const header = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <span style="font-size: 0.78rem; color: var(--text-muted);">Total de usuários: <strong>${validAccounts.length}</strong></span>
          <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;" onclick="App.renderAccountsList()">
            <span>Atualizar</span>
          </button>
        </div>
      `;

      if (validAccounts.length === 0) {
        container.innerHTML = header + '<div style="text-align: center; color: var(--text-dim); padding: 20px;">Nenhum usuário cadastrado além de você.</div>';
        return;
      }

      container.innerHTML = header + validAccounts.map(acc => {
        const masterEmail = 'andrew.g.h.agh@gmail.com';
        const accEmail = String(acc.email || '').toLowerCase().trim();
        // APENAS E EXCLUSIVAMENTE andrew.g.h.agh@gmail.com pode ser Master
        const isMaster = accEmail === masterEmail;

        // (Você) só aparece na conta que estiver efetivamente logada
        const isCurrent = currentUser && currentUser.email && currentUser.email.toLowerCase() === accEmail;

        const status = acc.status || 'approved';
        let statusBadge = '<span class="status-pill approved">Ativo</span>';
        if (status === 'blocked') statusBadge = '<span class="status-pill blocked">Bloqueado</span>';

        const displayName = acc.displayName || 'Sem nome';
        const loginDisplay = acc.loginDisplay || acc.username || acc.email;
        const passDisplay = acc.plainPassword 
          ? `<span style="font-size: 0.74rem; color: #a7f3d0; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 4px; font-family: monospace; display: inline-flex; align-items: center; gap: 5px;" title="Senha do Usuário">${this.Icons.key(12)} <strong>${this.escapeHtml(acc.plainPassword)}</strong></span>` 
          : (!isMaster ? '<span style="font-size: 0.72rem; color: #f87171; background: rgba(239, 68, 68, 0.12); padding: 2px 6px; border-radius: 4px;">(Senha não definida)</span>' : '');

        return `
          <div class="account-item-card">
            <div class="account-info">
              <div class="account-name-row">
                <span class="account-name">${this.escapeHtml(displayName)}</span>
                ${isMaster 
                  ? '<span style="font-size: 0.65rem; background: rgba(139, 92, 246, 0.2); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-weight: 700;">ADMIN MASTER</span>' 
                  : '<span style="font-size: 0.65rem; background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Usuário</span>'}
                ${isCurrent ? '<span style="font-size: 0.65rem; color: #38bdf8;">(Você)</span>' : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                <span style="font-size: 0.74rem; color: #cbd5e1;">👤 <strong>${this.escapeHtml(loginDisplay)}</strong></span>
                ${passDisplay}
                ${acc.recoveryEmail ? `<span style="font-size: 0.7rem; color: var(--text-dim);">(${this.escapeHtml(acc.recoveryEmail)})</span>` : ''}
              </div>
              <div style="margin-top: 4px;">${statusBadge}</div>
            </div>

            <div class="account-actions-group" style="flex-wrap: wrap;">
              ${isMaster ? `
                <span style="font-size: 0.72rem; color: #c084fc; font-weight: 700; background: rgba(139, 92, 246, 0.15); padding: 5px 12px; border-radius: 9999px; border: 1px solid rgba(139, 92, 246, 0.35);">
                  Conta Master
                </span>
              ` : `
                <button class="btn-acc-action btn-acc-approve" title="Copiar Usuário e Senha para enviar ao cliente" onclick="App.handleCopyUserCredentials('${this.escapeJs(displayName)}', '${this.escapeJs(loginDisplay)}', '${this.escapeJs(acc.plainPassword || '')}')">
                  ${this.Icons.copy(13)} <span>Copiar</span>
                </button>
                <button class="btn-acc-action btn-secondary" title="Alterar Senha" onclick="App.openChangePasswordModal('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}', '${this.escapeJs(acc.plainPassword || '')}')" style="padding: 6px 8px; font-size: 0.72rem;">
                  ${this.Icons.key(13)} <span>Senha</span>
                </button>
                ${status === 'blocked' ? `
                  <button class="btn-acc-action btn-acc-approve" title="Desbloquear acesso" onclick="App.handleApproveAccount('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}')">
                    <span>Liberar</span>
                  </button>
                ` : `
                  <button class="btn-acc-action btn-acc-block" title="Bloquear acesso temporariamente" onclick="App.handleBlockAccount('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email)}')">
                    <span>Bloquear</span>
                  </button>
                `}
                <button class="btn-acc-action btn-acc-delete" title="Excluir Usuário" onclick="App.handleDeleteAccount('${acc.uid}', '${this.escapeJs(displayName)}', '${this.escapeJs(acc.email || acc.recoveryEmail || '')}', '${this.escapeJs(acc.username || '')}')">
                  ${this.Icons.trash(13)}
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
  async handleDeleteAccount(uid, name, email, username) {
    if (confirm(`Tem certeza que deseja excluir permanentemente o usuário "${name}"? Ele não poderá mais acessar o sistema.`)) {
      try {
        await AuthManager.deleteAccount(uid, email, username);
        this.showToast(`Usuário "${name}" excluído com sucesso.`, 'info');
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

  // Alternar para tela de Recuperação de Senha (dentro do próprio card)
  // Mascarar visualmente o e-mail para privacidade e segurança (ex: pep***018@gmail.com)
  maskEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return email || '';
    const parts = email.trim().toLowerCase().split('@');
    const name = parts[0];
    const domain = parts[1];

    if (name.length <= 2) {
      return `${name[0]}***@${domain}`;
    } else if (name.length <= 5) {
      return `${name.slice(0, 2)}***@${domain}`;
    } else if (name.length <= 8) {
      return `${name.slice(0, 2)}***${name.slice(-2)}@${domain}`;
    } else {
      // Ex: pepreto018 -> pep***018@gmail.com
      return `${name.slice(0, 3)}***${name.slice(-3)}@${domain}`;
    }
  },

  showForgotView() {
    const loginView = document.getElementById('authLoginView');
    const forgotView = document.getElementById('authForgotView');
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabForgot = document.getElementById('tabAuthForgot');
    const loginEmailInput = document.getElementById('loginEmail');
    const forgotUserInput = document.getElementById('forgotUserInput');
    const resultBox = document.getElementById('forgotResultBox');
    const formForgot = document.getElementById('formForgotPass');
    const emailInput = document.getElementById('forgotEmailInput');

    if (tabLogin) tabLogin.classList.remove('active');
    if (tabForgot) tabForgot.classList.add('active');

    if (resultBox) resultBox.style.display = 'none';
    if (formForgot) formForgot.style.display = 'flex';

    if (loginView) loginView.style.display = 'none';
    if (forgotView) {
      forgotView.style.display = 'block';
      const typed = loginEmailInput ? loginEmailInput.value.trim() : '';
      if (forgotUserInput) {
        if (typed) {
          forgotUserInput.value = typed;
          this.handleForgotUserTyping(typed, true);
        } else {
          const lockedBox = document.getElementById('forgotLockedBox');
          const emailGroup = document.getElementById('forgotEmailGroup');
          if (lockedBox) lockedBox.style.display = 'none';
          if (emailGroup) emailGroup.style.display = 'block';
          if (emailInput) {
            delete emailInput.dataset.fullEmail;
            emailInput.value = '';
            emailInput.required = false;
          }
          setTimeout(() => { try { forgotUserInput.focus(); } catch (e) {} }, 100);
        }
      }
      try {
        const card = document.querySelector('.auth-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
    }
  },

  // Voltar para tela de Login tradicional
  showLoginView() {
    const loginView = document.getElementById('authLoginView');
    const forgotView = document.getElementById('authForgotView');
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabForgot = document.getElementById('tabAuthForgot');
    const loginEmailInput = document.getElementById('loginEmail');
    const forgotUserInput = document.getElementById('forgotUserInput');

    if (tabLogin) tabLogin.classList.add('active');
    if (tabForgot) tabForgot.classList.remove('active');

    if (forgotView) forgotView.style.display = 'none';
    if (loginView) {
      loginView.style.display = 'block';
      if (forgotUserInput && loginEmailInput && forgotUserInput.value.trim()) {
        loginEmailInput.value = forgotUserInput.value.trim();
      }
      try {
        const card = document.querySelector('.auth-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
    }
  },

  // Busca do usuário em tempo real ao digitar (Debounced com Mascaramento e Bloqueio Seguro)
  handleForgotUserTyping(value, immediate = false) {
    if (this._forgotSearchTimer) clearTimeout(this._forgotSearchTimer);

    const badge = document.getElementById('forgotLookupBadge');
    const lockedBox = document.getElementById('forgotLockedBox');
    const maskedDisplay = document.getElementById('forgotMaskedDisplay');
    const emailGroup = document.getElementById('forgotEmailGroup');
    const emailInput = document.getElementById('forgotEmailInput');
    const emailHelp = document.getElementById('forgotEmailHelp');
    const clean = String(value || '').trim();

    if (!clean || clean.length < 2) {
      if (badge) badge.textContent = '';
      if (lockedBox) lockedBox.style.display = 'none';
      if (emailGroup) emailGroup.style.display = 'block';
      if (emailInput) {
        delete emailInput.dataset.fullEmail;
        emailInput.value = '';
        emailInput.required = false;
      }
      if (emailHelp) {
        emailHelp.innerHTML = 'Este e-mail ficará salvo vinculado à sua conta para suas próximas recuperações.';
        emailHelp.style.color = 'var(--text-dim)';
      }
      return;
    }

    if (badge) {
      badge.textContent = 'Buscando conta...';
      badge.style.color = 'var(--text-dim)';
    }

    // Identificador único sequencial para eliminar condições de corrida em respostas fora de ordem
    const searchSeq = ++this._forgotSearchSeq || (this._forgotSearchSeq = 1);

    const executeSearch = async () => {
      try {
        const account = await AuthManager.findAccountByLogin(clean);

        // PROTEÇÃO CONTRA CONDIÇÃO DE CORRIDA:
        // Descartar resposta caso o usuário já tenha digitado outro valor no input ou uma busca mais nova tenha começado
        if (searchSeq !== this._forgotSearchSeq) return;
        const currentInput = document.getElementById('forgotUserInput');
        if (currentInput && currentInput.value.trim().toLowerCase() !== clean.toLowerCase()) return;

        if (account) {
          const savedEmail = account.recoveryEmail || (!account.email?.endsWith('@hartv.app') ? account.email : '');
          if (savedEmail && savedEmail.includes('@')) {
            // E-MAIL FIXO E IMUTÁVEL:
            // 1. Ocultar completamente o campo de digitação (impossível modificar ou inserir novo)
            // 2. Exibir exclusivamente o card protegido com e-mail mascarado (impossível ver completo)
            if (badge) {
              badge.textContent = '✓ Conta localizada';
              badge.style.color = '#34d399';
            }
            if (lockedBox) lockedBox.style.display = 'block';
            if (maskedDisplay) maskedDisplay.textContent = this.maskEmail(savedEmail);
            if (emailGroup) emailGroup.style.display = 'none';
            if (emailInput) {
              emailInput.dataset.fullEmail = savedEmail;
              emailInput.value = '';
              emailInput.required = false;
            }
          } else {
            // Conta localizada mas sem e-mail fixado: permitir digitação inicial
            if (badge) {
              badge.textContent = '✓ Conta localizada';
              badge.style.color = '#38bdf8';
            }
            if (lockedBox) lockedBox.style.display = 'none';
            if (emailGroup) emailGroup.style.display = 'block';
            if (emailInput) {
              delete emailInput.dataset.fullEmail;
              emailInput.required = true;
            }
            if (emailHelp) {
              emailHelp.innerHTML = '💡 <em>Primeira recuperação:</em> digite seu e-mail para vinculá-lo permanentemente à sua conta.';
              emailHelp.style.color = '#38bdf8';
            }
          }
        } else {
          if (badge) {
            badge.textContent = clean.includes('@') ? 'E-mail direto' : 'Usuário novo/não listado';
            badge.style.color = 'var(--text-muted)';
          }
          if (lockedBox) lockedBox.style.display = 'none';
          if (emailGroup) emailGroup.style.display = 'block';
          if (emailInput) {
            delete emailInput.dataset.fullEmail;
            emailInput.required = false;
          }
          if (emailHelp) {
            emailHelp.innerHTML = 'Este e-mail ficará salvo vinculado à sua conta para suas próximas recuperações.';
            emailHelp.style.color = 'var(--text-dim)';
          }
        }
      } catch (e) {
        if (searchSeq === this._forgotSearchSeq && badge) badge.textContent = '';
      }
    };

    if (immediate) {
      executeSearch();
    } else {
      this._forgotSearchTimer = setTimeout(executeSearch, 250);
    }
  },

  // Enviar link oficial de redefinição segura do Google
  async handleForgotSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const userInput = document.getElementById('forgotUserInput');
    const emailInput = document.getElementById('forgotEmailInput');
    const submitBtn = document.getElementById('btnForgotSubmit');
    const resultBox = document.getElementById('forgotResultBox');
    const sentNotice = document.getElementById('forgotSentEmailNotice');
    const formForgot = document.getElementById('formForgotPass');

    if (this._isSendingForgot) return;
    this._isSendingForgot = true;

    const userVal = userInput ? userInput.value.trim() : '';
    // Usar o e-mail real completo se estiver mascarado/fixo, ou o valor digitado
    const emailVal = (emailInput && emailInput.dataset && emailInput.dataset.fullEmail) 
      ? emailInput.dataset.fullEmail 
      : (emailInput ? emailInput.value.trim() : '');

    if (!userVal) {
      alert('Por favor, informe seu usuário ou login.');
      this._isSendingForgot = false;
      return;
    }

    const originalBtn = submitBtn ? submitBtn.innerHTML : '';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Enviando link oficial do Google...</span>';
      }

      const res = await AuthManager.sendOfficialPasswordReset(userVal, emailVal);
      const maskedTarget = this.maskEmail(res.email || emailVal);

      if (sentNotice) {
        sentNotice.textContent = `Enviado com sucesso para: ${maskedTarget}`;
      }

      // Ocultar formulário de envio e mostrar card de confirmação com destaque
      if (formForgot) formForgot.style.display = 'none';
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      this.showToast(`Link oficial do Google enviado para ${maskedTarget}!`, 'success');
    } catch (err) {
      alert(err.message || 'Erro ao enviar link de recuperação. Verifique os dados digitados.');
    } finally {
      this._isSendingForgot = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtn || '<span>Enviar Link Oficial do Google</span>';
      }
    }
  },
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
              ${client.server ? `<span class="tag-badge" style="display: inline-flex; align-items: center; gap: 4px;">${this.Icons.server(13)} ${this.escapeHtml(client.server)}</span>` : ''}
              ${client.app ? `<span class="tag-badge" style="display: inline-flex; align-items: center; gap: 4px;">${this.Icons.smartphone(13)} ${this.escapeHtml(client.app)}</span>` : ''}
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
              ${client.url ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.url)}', 'URL', this)" title="Copiar URL" aria-label="Copiar URL de conexão">${this.Icons.copy(14)}</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">Usuário:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #60a5fa; font-weight: 600;">${this.escapeHtml(client.username || '---')}</span>
              ${client.username ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.username)}', 'Usuário', this)" title="Copiar Usuário" aria-label="Copiar usuário de acesso">${this.Icons.copy(14)}</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">Senha:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" id="pwd-${client.id}" style="color: #93c5fd; font-weight: 600; letter-spacing: 0.08em;">••••••••</span>
              <button class="copy-mini-btn" id="pwd-btn-${client.id}" onclick="App.togglePassword('${client.id}', '${this.escapeJs(client.password || '')}', this)" title="Mostrar Senha" aria-label="Mostrar ou ocultar senha">${this.Icons.eyeOff(15)}</button>
              ${client.password ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.password)}', 'Senha', this)" title="Copiar Senha" aria-label="Copiar senha">${this.Icons.copy(14)}</button>` : ''}
            </div>
          </div>

          ${client.mac ? `
          <div class="credential-item">
            <span class="cred-label">MAC:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #fbbf24; font-weight: 600; font-family: monospace;">${this.escapeHtml(client.mac)}</span>
              <button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.mac)}', 'MAC', this)" title="Copiar MAC" aria-label="Copiar endereço MAC">${this.Icons.copy(14)}</button>
            </div>
          </div>` : ''}

          ${(client.deviceKey || client.key) ? `
          <div class="credential-item">
            <span class="cred-label">Chave / Key:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #34d399; font-weight: 600;">${this.escapeHtml(client.deviceKey || client.key)}</span>
              <button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.deviceKey || client.key)}', 'Chave', this)" title="Copiar Chave" aria-label="Copiar chave do dispositivo">${this.Icons.copy(14)}</button>
            </div>
          </div>` : ''}

          <div class="credential-item">
            <span class="cred-label">WhatsApp:</span>
            <div class="cred-value-wrap">
              <span class="cred-val">${this.escapeHtml(client.whatsapp || 'Não informado')}</span>
              ${client.whatsapp ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.whatsapp)}', 'WhatsApp', this)" title="Copiar WhatsApp" aria-label="Copiar número do WhatsApp">${this.Icons.copy(14)}</button>` : ''}
            </div>
          </div>
        </div>

        <!-- Linha de Vencimento e Preço -->
        <div class="card-details-row">
          <div class="expiration-info">
            <span style="display: inline-flex; align-items: center; gap: 4px;">${this.Icons.calendar(14)} Vencimento:</span>
            <span class="exp-date">${formattedDate}</span>
          </div>
          <div class="price-tag">
            ${formattedPrice}
          </div>
        </div>

        <!-- Ações Rápidas -->
        <div class="card-actions">
          <button class="action-btn whatsapp-btn" onclick="App.openWhatsAppMenu('${client.id}')" aria-label="Abrir menu de WhatsApp para ${this.escapeHtml(client.name)}">
            ${this.Icons.whatsapp(18)}
            <span>WhatsApp</span>
          </button>
          <button class="action-btn renew-btn" onclick="App.handleQuickRenew('${client.id}')" title="Adicionar 30 dias de sinal" aria-label="Renovar assinatura por mais 30 dias">
            ${this.Icons.plus30(17)}
            <span>+30 Dias</span>
          </button>
          <button class="action-btn" onclick="App.openClientModal('${client.id}')" aria-label="Editar dados de ${this.escapeHtml(client.name)}">
            ${this.Icons.edit(16)}
            <span>Editar</span>
          </button>
          <button class="action-btn danger-action" onclick="App.handleDeleteClient('${client.id}', '${this.escapeJs(client.name)}')" aria-label="Excluir cliente ${this.escapeHtml(client.name)}">
            ${this.Icons.trash(16)}
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
  togglePassword(clientId, realPassword, btnEl) {
    const el = document.getElementById(`pwd-${clientId}`);
    if (!el) return;
    const btn = btnEl || document.getElementById(`pwd-btn-${clientId}`);
    const isMasked = el.textContent === '••••••••' || el.textContent === '••••••';
    if (isMasked) {
      el.textContent = realPassword || '---';
      if (btn) {
        btn.innerHTML = this.Icons.eye(15);
        btn.title = 'Ocultar Senha';
        btn.setAttribute('aria-label', 'Ocultar senha');
      }
    } else {
      el.textContent = '••••••••';
      if (btn) {
        btn.innerHTML = this.Icons.eyeOff(15);
        btn.title = 'Mostrar Senha';
        btn.setAttribute('aria-label', 'Mostrar senha');
      }
    }
  },

  // Copiar para área de transferência com micro-interação visual
  async copyToClipboard(text, label = 'Texto', btnEl = null) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (btnEl) {
      const originalHtml = btnEl.innerHTML;
      btnEl.innerHTML = this.Icons.check(14);
      btnEl.classList.add('copied');
      setTimeout(() => {
        btnEl.innerHTML = originalHtml;
        btnEl.classList.remove('copied');
      }, 1500);
    }
    this.showToast(`${label} copiado!`, 'info');
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
