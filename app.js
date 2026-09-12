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
    this.loadClients();
    this.setupEventListeners();
    this.setupPWAInstall();
    this.setupServiceWorker();
    this.updateNotificationBadge();

    // Iniciar checagem de vencimento com NotificationManager
    NotificationManager.init(() => this.clients);
  },

  // Registrar Service Worker
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
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

  // Carregar lista de clientes do armazenamento local
  loadClients() {
    this.clients = StorageManager.getClients();
    this.render();
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
        const server = (client.server || '').toLowerCase();
        const app = (client.app || '').toLowerCase();
        const whatsapp = (client.whatsapp || '').toLowerCase();

        return name.includes(this.searchQuery) ||
               username.includes(this.searchQuery) ||
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
              ${client.url ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.url)}', 'URL')" title="Copiar URL">📋</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">Usuário:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" style="color: #38bdf8; font-weight: 600;">${this.escapeHtml(client.username || '---')}</span>
              ${client.username ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.username)}', 'Usuário')" title="Copiar Usuário">📋</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">Senha:</span>
            <div class="cred-value-wrap">
              <span class="cred-val" id="pwd-${client.id}" style="color: #a855f7; font-weight: 600;">••••••</span>
              <button class="copy-mini-btn" onclick="App.togglePassword('${client.id}', '${this.escapeJs(client.password || '')}')" title="Mostrar/Ocultar Senha">👁️</button>
              ${client.password ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.password)}', 'Senha')" title="Copiar Senha">📋</button>` : ''}
            </div>
          </div>

          <div class="credential-item">
            <span class="cred-label">WhatsApp:</span>
            <div class="cred-value-wrap">
              <span class="cred-val">${this.escapeHtml(client.whatsapp || 'Não informado')}</span>
              ${client.whatsapp ? `<button class="copy-mini-btn" onclick="App.copyToClipboard('${this.escapeJs(client.whatsapp)}', 'WhatsApp')" title="Copiar WhatsApp">📋</button>` : ''}
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
          <button class="action-btn whatsapp-btn" onclick="App.openWhatsAppMenu('${client.id}')">
            <span>💬</span>
            <span>WhatsApp</span>
          </button>
          <button class="action-btn renew-btn" onclick="App.handleQuickRenew('${client.id}')" title="Adicionar 30 dias de sinal">
            <span>⚡</span>
            <span>+30 Dias</span>
          </button>
          <button class="action-btn" onclick="App.openClientModal('${client.id}')">
            <span>✏️</span>
            <span>Editar</span>
          </button>
          <button class="action-btn danger-action" onclick="App.handleDeleteClient('${client.id}', '${this.escapeJs(client.name)}')">
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
      document.getElementById('clientServer').value = client.server || '';
      document.getElementById('clientWhatsapp').value = client.whatsapp || '';
      document.getElementById('clientNotes').value = client.notes || '';
    } else {
      // Modo Novo Cliente
      title.textContent = 'Novo Cliente IPTV';
      document.getElementById('clientId').value = '';
      
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
    return template
      .replace(/{NOME}/g, client.name || '')
      .replace(/{APP}/g, client.app || 'IPTV')
      .replace(/{URL}/g, client.url || '')
      .replace(/{USUARIO}/g, client.username || '')
      .replace(/{SENHA}/g, client.password || '')
      .replace(/{VENCIMENTO}/g, this.formatDate(client.expiration))
      .replace(/{VALOR}/g, (client.price || 0).toFixed(2).replace('.', ','))
      .replace(/{PIX}/g, settings.pixKey || '(21)964551053')
      .replace(/{TITULAR}/g, settings.pixName || 'Andrew Gibson Harris')
      .replace(/{BANCO}/g, settings.pixBank || 'Itaú');
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
