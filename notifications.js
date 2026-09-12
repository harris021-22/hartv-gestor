// notifications.js - Gerenciador de Notificações no Android
// Sistema de alertas de vencimento e alterações

const NotificationManager = {
  LAST_CHECK_KEY: 'iptv_last_notification_check',

  // Verificar se o navegador/celular suporta notificações
  isSupported() {
    return 'Notification' in window;
  },

  // Obter permissão atual
  getPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'default', 'granted', 'denied'
  },

  // Solicitar permissão ao usuário
  async requestPermission() {
    if (!this.isSupported()) {
      alert('Seu navegador ou aparelho não suporta notificações nativas.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Erro ao pedir permissão de notificação:', error);
      return false;
    }
  },

  // Enviar uma notificação direta no Android
  async sendNotification(title, options = {}) {
    if (this.getPermission() !== 'granted') {
      console.log('Permissão de notificação não concedida.');
      return false;
    }

    const defaultOptions = {
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'iptv-alert-' + Date.now(),
      renotify: true,
      data: { url: './index.html' },
      ...options
    };

    // Tentar via Service Worker (Melhor para Android)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, defaultOptions);
          return true;
        }
      } catch (e) {
        console.warn('Falha via Service Worker, tentando fallback:', e);
      }
    }

    // Fallback para Notification direta
    try {
      new Notification(title, defaultOptions);
      return true;
    } catch (e) {
      console.error('Erro ao disparar notificação:', e);
      return false;
    }
  },

  // Disparar teste de notificação
  async testNotification() {
    const granted = this.getPermission() === 'granted' || await this.requestPermission();
    if (!granted) {
      alert('Por favor, autorize as notificações nas permissões do seu navegador.');
      return false;
    }

    return this.sendNotification('🔔 HarTv Gestor', {
      body: 'As notificações estão funcionando perfeitamente no seu celular!',
      icon: './icons/icon-192.png'
    });
  },

  // Notificar quando algo mudar (ex: cliente cadastrado, renovado ou importado)
  notifyChange(actionTitle, description) {
    if (this.getPermission() === 'granted') {
      this.sendNotification(actionTitle, {
        body: description,
        tag: 'iptv-change'
      });
    }
  },

  // Checar clientes e alertar vencimentos
  checkExpirations(clients, force = false) {
    if (this.getPermission() !== 'granted') return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const lastCheck = localStorage.getItem(this.LAST_CHECK_KEY);

    // Se já checou hoje e não for forçado, não repete para não incomodar
    if (!force && lastCheck === todayStr) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiringToday = [];
    const expiringSoon = [];
    const expiredList = [];

    clients.forEach(c => {
      if (!c.expiration) return;
      const parts = c.expiration.split('-');
      if (parts.length !== 3) return;

      const expDate = new Date(parts[0], parts[1] - 1, parts[2]);
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        expiringToday.push(c);
      } else if (diffDays > 0 && diffDays <= 3) {
        expiringSoon.push({ ...c, daysLeft: diffDays });
      } else if (diffDays < 0 && diffDays >= -2) {
        // Vencido recentemente (até 2 dias atrás)
        expiredList.push(c);
      }
    });

    // Notificação para clientes vencendo hoje
    if (expiringToday.length > 0) {
      const names = expiringToday.map(c => c.name).slice(0, 3).join(', ');
      const extra = expiringToday.length > 3 ? ` e mais ${expiringToday.length - 3}` : '';
      this.sendNotification(`⚠️ ${expiringToday.length} cliente(s) vencem HOJE!`, {
        body: `${names}${extra}. Clique para enviar cobrança no WhatsApp.`,
        tag: 'iptv-vencendo-hoje'
      });
    }

    // Notificação para clientes vencendo em breve (1 a 3 dias)
    if (expiringSoon.length > 0) {
      setTimeout(() => {
        this.sendNotification(`📅 ${expiringSoon.length} cliente(s) vencendo em breve!`, {
          body: `Lembre seus clientes de renovar para não interromper o sinal.`,
          tag: 'iptv-vencendo-breve'
        });
      }, 1500);
    }

    localStorage.setItem(this.LAST_CHECK_KEY, todayStr);
  },

  // Iniciar rotina de verificação
  init(clientsProvider) {
    // Checar ao abrir
    setTimeout(() => {
      if (typeof clientsProvider === 'function') {
        this.checkExpirations(clientsProvider());
      }
    }, 2000);

    // Checar quando a aba volta a ficar visível
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && typeof clientsProvider === 'function') {
        this.checkExpirations(clientsProvider());
      }
    });
  }
};
