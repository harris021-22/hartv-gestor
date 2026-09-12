// database.js - Sincronização e Banco de Dados na Nuvem (Firebase Cloud Firestore)
// Garante sincronização em tempo real bidirecional (celular <-> PC)

const DatabaseManager = {
  db: null,
  unsubscribeClients: null,
  unsubscribeSettings: null,

  init() {
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.firestore();
        console.log('[DB] Conectado ao Firebase Firestore com sucesso.');
      } catch (e) {
        console.warn('[DB] Firebase Firestore não inicializado:', e);
      }
    }
  },

  isAvailable() {
    return this.db !== null;
  },

  // Salvar ou atualizar cliente na nuvem
  async saveClient(userId, client) {
    if (!this.isAvailable() || !userId || !client || !client.id) return false;
    try {
      await this.db.collection('users').doc(userId).collection('clients').doc(client.id).set(client, { merge: true });
      console.log(`[DB] Cliente "${client.name || client.id}" sincronizado na nuvem.`);
      return true;
    } catch (e) {
      console.error('[DB] Erro ao salvar cliente no Firestore:', e);
      return false;
    }
  },

  // Excluir cliente da nuvem
  async deleteClient(userId, clientId) {
    if (!this.isAvailable() || !userId || !clientId) return false;
    try {
      await this.db.collection('users').doc(userId).collection('clients').doc(clientId).delete();
      console.log(`[DB] Cliente "${clientId}" excluído da nuvem.`);
      return true;
    } catch (e) {
      console.error('[DB] Erro ao excluir cliente no Firestore:', e);
      return false;
    }
  },

  // Buscar todos os clientes do usuário na nuvem (uma vez)
  async fetchClients(userId) {
    if (!this.isAvailable() || !userId) return null;
    try {
      const snapshot = await this.db.collection('users').doc(userId).collection('clients').get();
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data) {
          list.push({ id: doc.id, ...data });
        }
      });
      return list;
    } catch (e) {
      console.error('[DB] Erro ao buscar clientes no Firestore:', e);
      return null;
    }
  },

  // Escuta em tempo real para sincronização instantânea (celular <-> PC)
  subscribeToClients(userId, callback) {
    if (!this.isAvailable() || !userId) return () => {};

    if (this.unsubscribeClients) {
      try { this.unsubscribeClients(); } catch(e) {}
      this.unsubscribeClients = null;
    }

    try {
      this.unsubscribeClients = this.db
        .collection('users')
        .doc(userId)
        .collection('clients')
        .onSnapshot((snapshot) => {
          const cloudClients = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data) {
              cloudClients.push({ id: doc.id, ...data });
            }
          });
          console.log(`[DB] Realtime sync: ${cloudClients.length} cliente(s) sincronizados da nuvem.`);
          if (typeof callback === 'function') {
            callback(cloudClients);
          }
        }, (error) => {
          console.warn('[DB] Erro no listener realtime de clientes:', error);
        });

      return this.unsubscribeClients;
    } catch (err) {
      console.warn('[DB] Erro ao iniciar subscribeToClients:', err);
      return () => {};
    }
  },

  // Salvar configurações na nuvem
  async saveSettings(userId, settings) {
    if (!this.isAvailable() || !userId || !settings) return false;
    try {
      await this.db.collection('users').doc(userId).collection('settings').doc('config').set(settings, { merge: true });
      return true;
    } catch (e) {
      console.warn('[DB] Erro ao salvar configurações no Firestore:', e);
      return false;
    }
  },

  // Escuta em tempo real para configurações (Pix, mensagens, etc.)
  subscribeToSettings(userId, callback) {
    if (!this.isAvailable() || !userId) return () => {};

    if (this.unsubscribeSettings) {
      try { this.unsubscribeSettings(); } catch(e) {}
      this.unsubscribeSettings = null;
    }

    try {
      this.unsubscribeSettings = this.db
        .collection('users')
        .doc(userId)
        .collection('settings')
        .doc('config')
        .onSnapshot((docSnap) => {
          if (docSnap.exists) {
            const data = docSnap.data();
            if (typeof callback === 'function') {
              callback(data);
            }
          }
        }, (error) => {
          console.warn('[DB] Erro no listener realtime de configurações:', error);
        });

      return this.unsubscribeSettings;
    } catch (err) {
      console.warn('[DB] Erro ao iniciar subscribeToSettings:', err);
      return () => {};
    }
  },

  // Parar escutas ativas (quando deslogar)
  unsubscribeAll() {
    if (this.unsubscribeClients) {
      try { this.unsubscribeClients(); } catch(e) {}
      this.unsubscribeClients = null;
    }
    if (this.unsubscribeSettings) {
      try { this.unsubscribeSettings(); } catch(e) {}
      this.unsubscribeSettings = null;
    }
  },

  // Sincronizar lote inteiro para a nuvem
  async syncAllClients(userId, clients) {
    if (!this.isAvailable() || !userId || !Array.isArray(clients)) return false;
    try {
      const batch = this.db.batch();
      clients.forEach(c => {
        if (c && c.id) {
          const docRef = this.db.collection('users').doc(userId).collection('clients').doc(c.id);
          batch.set(docRef, c, { merge: true });
        }
      });
      await batch.commit();
      console.log(`[DB] Lote de ${clients.length} clientes salvo no Firestore.`);
      return true;
    } catch (e) {
      console.error('[DB] Erro na sincronização em lote no Firestore:', e);
      return false;
    }
  }
};

// Inicializar na carga
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DatabaseManager.init());
} else {
  DatabaseManager.init();
}
