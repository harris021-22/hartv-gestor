// storage.js - Sistema de Armazenamento Local e Backup (Exportar/Importar)
// Sem necessidade de banco de dados na nuvem

const StorageManager = {
  LEGACY_CLIENTS_KEY: 'iptv_clients_data',
  LEGACY_SETTINGS_KEY: 'iptv_settings_data',

  // Obter chave de clientes isolada por usuário
  getClientsKey() {
    if (typeof AuthManager !== 'undefined' && AuthManager.getUser()) {
      return `hartv_clients_${AuthManager.getUser().uid}`;
    }
    return 'hartv_clients_guest';
  },

  // Obter chave de configurações isolada por usuário
  getSettingsKey() {
    if (typeof AuthManager !== 'undefined' && AuthManager.getUser()) {
      return `hartv_settings_${AuthManager.getUser().uid}`;
    }
    return 'hartv_settings_guest';
  },

  // Configurações padrão
  defaultSettings: {
    pixKey: '(21)964551053',
    pixName: 'Andrew Gibson Harris',
    pixBank: 'Itaú',
    defaultUrl: '',
    notifyDaysBefore: 3,
    billingMessage: 'Olá {NOME}, seu plano de IPTV vence em {VENCIMENTO}. Para renovar e não ficar sem sinal, segue a chave Pix: {PIX} ({TITULAR} - {BANCO}) no valor de R$ {VALOR}. Qualquer dúvida estou à disposição!',
    accessMessage: '🚀 *DADOS DE ACESSO IPTV*\n\n👤 *Cliente:* {NOME}\n📱 *Aplicativo:* {APP}\n🌐 *URL/DNS:* {URL}\n🔑 *Usuário:* {USUARIO}\n🔒 *Senha:* {SENHA}\n📅 *Vencimento:* {VENCIMENTO}\n\nBom entretenimento!'
  },

  // Obter configurações
  getSettings() {
    try {
      const key = this.getSettingsKey();
      let data = localStorage.getItem(key);
      
      // Fallback para legado se ainda não tiver na chave do usuário
      if (!data) {
        data = localStorage.getItem(this.LEGACY_SETTINGS_KEY);
      }

      if (!data) return { ...this.defaultSettings };
      const parsed = JSON.parse(data);
      return {
        ...this.defaultSettings,
        ...parsed,
        pixKey: parsed.pixKey || this.defaultSettings.pixKey,
        pixName: parsed.pixName || this.defaultSettings.pixName,
        pixBank: parsed.pixBank || this.defaultSettings.pixBank
      };
    } catch (e) {
      console.error('Erro ao ler configurações:', e);
      return { ...this.defaultSettings };
    }
  },

  // Salvar configurações
  saveSettings(settings) {
    try {
      const key = this.getSettingsKey();
      localStorage.setItem(key, JSON.stringify(settings));

      // Sincronizar configurações com a nuvem (Firestore)
      if (typeof DatabaseManager !== 'undefined' && typeof AuthManager !== 'undefined' && AuthManager.getUser()) {
        DatabaseManager.saveSettings(AuthManager.getUser().uid, settings);
      }

      return true;
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
      return false;
    }
  },

  // Obter todos os clientes (isolados pelo usuário ativo)
  getClients() {
    try {
      const key = this.getClientsKey();
      let data = localStorage.getItem(key);

      // Migração automática transparente dos clientes legados para o primeiro usuário logado
      if (!data && key !== 'hartv_clients_guest') {
        const legacyData = localStorage.getItem(this.LEGACY_CLIENTS_KEY);
        if (legacyData) {
          localStorage.setItem(key, legacyData);
          data = legacyData;
        }
      }

      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erro ao ler clientes do LocalStorage:', e);
      return [];
    }
  },

  // Salvar lista completa de clientes
  saveClients(clients) {
    try {
      const key = this.getClientsKey();
      localStorage.setItem(key, JSON.stringify(clients));
      return true;
    } catch (e) {
      console.error('Erro ao salvar clientes:', e);
      return false;
    }
  },

  // Adicionar ou Atualizar um cliente
  saveClient(client) {
    const clients = this.getClients();
    const now = new Date().toISOString();

    if (!client.id) {
      // Novo cliente
      client.id = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      client.createdAt = now;
      client.updatedAt = now;
      clients.unshift(client);
    } else {
      // Atualizar existente
      const index = clients.findIndex(c => c.id === client.id);
      if (index !== -1) {
        client.updatedAt = now;
        clients[index] = { ...clients[index], ...client };
      } else {
        client.updatedAt = now;
        clients.unshift(client);
      }
    }

    this.saveClients(clients);

    // Sincronizar com banco de dados na nuvem se disponível
    if (typeof DatabaseManager !== 'undefined' && typeof AuthManager !== 'undefined' && AuthManager.getUser()) {
      DatabaseManager.saveClient(AuthManager.getUser().uid, client);
    }

    return client;
  },

  // Excluir cliente por ID
  deleteClient(id) {
    const clients = this.getClients();
    const filtered = clients.filter(c => c.id !== id);
    this.saveClients(filtered);

    // Sincronizar exclusão com a nuvem
    if (typeof DatabaseManager !== 'undefined' && typeof AuthManager !== 'undefined' && AuthManager.getUser()) {
      DatabaseManager.deleteClient(AuthManager.getUser().uid, id);
    }

    return filtered.length !== clients.length;
  },

  // Obter cliente por ID
  getClientById(id) {
    const clients = this.getClients();
    return clients.find(c => c.id === id) || null;
  },

  // Renovar cliente por X dias (padrão 30 dias)
  renewClient(id, days = 30) {
    const client = this.getClientById(id);
    if (!client) return null;

    let baseDate = new Date();
    // Se a data de vencimento atual for no futuro, soma a partir dela
    if (client.expiration) {
      const expDate = new Date(client.expiration + 'T23:59:59');
      if (expDate > baseDate) {
        baseDate = expDate;
      }
    }

    baseDate.setDate(baseDate.getDate() + days);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    client.expiration = `${yyyy}-${mm}-${dd}`;
    client.updatedAt = new Date().toISOString();

    this.saveClient(client);
    return client;
  },

  // EXPORTAR DADOS (Download JSON e Web Share)
  exportBackup() {
    const clients = this.getClients();
    const settings = this.getSettings();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `iptv_backup_${timestamp.slice(0, 10)}.json`;

    const backupPayload = {
      app: 'HarTv Gestor',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalClients: clients.length,
      clients: clients,
      settings: settings
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);

    // Criar Blob para download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      jsonString,
      blob,
      total: clients.length
    };
  },

  // Compartilhar arquivo de backup diretamente (Android Web Share API)
  async shareBackup() {
    const clients = this.getClients();
    const settings = this.getSettings();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `hartv_backup_${dateStr}.json`;

    const backupPayload = {
      app: 'HarTv Gestor',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalClients: clients.length,
      clients: clients,
      settings: settings
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Backup HarTv Gestor',
          text: `Backup com ${clients.length} clientes IPTV em ${dateStr}`
        });
        return { success: true, method: 'share' };
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Erro no compartilhamento:', e);
        }
      }
    }

    // Se o compartilhamento nativo de arquivo não estiver disponível, faz o download padrão
    return this.exportBackup();
  },

  // IMPORTAR DADOS (Recebe string JSON ou objeto)
  importBackup(jsonString, mode = 'merge') {
    try {
      let parsed;
      if (typeof jsonString === 'string') {
        parsed = JSON.parse(jsonString);
      } else {
        parsed = jsonString;
      }

      // Validação básica do formato
      let clientsToImport = [];
      if (Array.isArray(parsed)) {
        clientsToImport = parsed;
      } else if (parsed && Array.isArray(parsed.clients)) {
        clientsToImport = parsed.clients;
        // Se houver configurações e for modo replace ou settings ainda vazias, importa também
        if (parsed.settings) {
          const currentSettings = this.getSettings();
          this.saveSettings({ ...currentSettings, ...parsed.settings });
        }
      } else {
        throw new Error('Arquivo de backup inválido ou em formato não reconhecido.');
      }

      // Sanitizar cada cliente
      const sanitized = clientsToImport.map(item => ({
        id: item.id || ('client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
        name: String(item.name || 'Cliente Sem Nome').trim(),
        expiration: String(item.expiration || '').trim(),
        url: String(item.url || '').trim(),
        app: String(item.app || '').trim(),
        price: Number(item.price) || 0,
        username: String(item.username || '').trim(),
        password: String(item.password || '').trim(),
        server: String(item.server || '').trim(),
        whatsapp: String(item.whatsapp || '').trim(),
        notes: String(item.notes || '').trim(),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      }));

      let finalCount = 0;

      if (mode === 'replace') {
        // Substituir tudo
        this.saveClients(sanitized);
        finalCount = sanitized.length;
      } else {
        // Mesclar (evitando duplicatas com mesmo username + servidor ou mesmo ID)
        const currentClients = this.getClients();
        const merged = [...currentClients];

        for (const newItem of sanitized) {
          const existingIndex = merged.findIndex(c => 
            (c.id && c.id === newItem.id) || 
            (c.username && newItem.username && c.username === newItem.username && c.server === newItem.server)
          );

          if (existingIndex !== -1) {
            // Atualiza o existente
            merged[existingIndex] = { ...merged[existingIndex], ...newItem };
          } else {
            // Adiciona como novo
            merged.push(newItem);
          }
        }

        this.saveClients(merged);
        finalCount = merged.length;
      }

      return {
        success: true,
        importedCount: sanitized.length,
        totalCount: finalCount,
        mode: mode
      };
    } catch (err) {
      console.error('Erro na importação:', err);
      return {
        success: false,
        error: err.message || 'Falha ao processar arquivo de backup'
      };
    }
  }
};
