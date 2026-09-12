// database.js - Sincronização e Banco de Dados na Nuvem (Firebase Cloud Firestore)
// Garante que cada usuário acesse apenas os seus próprios clientes

const DatabaseManager = {
  db: null,

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
      return true;
    } catch (e) {
      console.error('[DB] Erro ao excluir cliente no Firestore:', e);
      return false;
    }
  },

  // Buscar todos os clientes do usuário na nuvem
  async fetchClients(userId) {
    if (!this.isAvailable() || !userId) return null;
    try {
      const snapshot = await this.db.collection('users').doc(userId).collection('clients').get();
      const list = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      return list;
    } catch (e) {
      console.error('[DB] Erro ao buscar clientes no Firestore:', e);
      return null;
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
