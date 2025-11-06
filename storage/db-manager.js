// ============================================
// DATABASE MANAGER - IndexedDB для кешування
// ============================================

const DB_NAME = 'CreatioNotificationsDB';
const DB_VERSION = 1;

const dbManager = {
  db: null,
  contactId: null,
  dnAppUserId: null,

  // ============================================
  // INITIALIZATION
  // ============================================
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[DB] Error opening database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[DB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[DB] Upgrading database...');

        // Notifications store
        if (!db.objectStoreNames.contains('notifications')) {
          const notifStore = db.createObjectStore('notifications', { keyPath: 'Id' });
          notifStore.createIndex('CreatedOn', 'CreatedOn', { unique: false });
          notifStore.createIndex('DnIsRead', 'DnIsRead', { unique: false });
          notifStore.createIndex('DnDelete', 'DnDelete', { unique: false });
          console.log('[DB] Created notifications store');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
          console.log('[DB] Created settings store');
        }

        // Sync data store
        if (!db.objectStoreNames.contains('syncData')) {
          db.createObjectStore('syncData', { keyPath: 'id' });
          console.log('[DB] Created syncData store');
        }
      };
    });
  },

  // ============================================
  // NOTIFICATIONS OPERATIONS
  // ============================================
  async getAllNotifications() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notifications'], 'readonly');
      const store = transaction.objectStore('notifications');
      const request = store.getAll();

      request.onsuccess = () => {
        const notifications = request.result || [];
        // Filter out deleted
        const active = notifications.filter(n => !n.DnDelete);
        resolve(active);
      };

      request.onerror = () => {
        console.error('[DB] Error getting notifications:', request.error);
        reject(request.error);
      };
    });
  },

  async saveNotifications(notifications) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');

      // Clear existing and add new
      store.clear();

      notifications.forEach(notification => {
        store.put(notification);
      });

      transaction.oncomplete = () => {
        console.log(`[DB] Saved ${notifications.length} notifications`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[DB] Error saving notifications:', transaction.error);
        reject(transaction.error);
      };
    });
  },

  async updateNotification(notificationId, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      const request = store.get(notificationId);

      request.onsuccess = () => {
        const notification = request.result;
        if (notification) {
          Object.assign(notification, data);
          store.put(notification);
        }
      };

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  },

  async deleteNotification(notificationId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      
      store.delete(notificationId);

      transaction.oncomplete = () => {
        console.log(`[DB] Deleted notification: ${notificationId}`);
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  },

  async cleanupOldNotifications(beforeDate) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      const index = store.index('CreatedOn');
      const range = IDBKeyRange.upperBound(beforeDate);
      
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const notification = cursor.value;
          // Delete only read notifications
          if (notification.DnIsRead) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`[DB] Cleaned up ${deletedCount} old notifications`);
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  },

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================
  async setContactId(contactId) {
    this.contactId = contactId;
    return this.saveSetting('contactId', contactId);
  },

  async getContactId() {
    if (this.contactId) return this.contactId;
    const setting = await this.getSetting('contactId');
    this.contactId = setting?.value;
    return this.contactId;
  },

  async setDnAppUserId(userId) {
    this.dnAppUserId = userId;
    return this.saveSetting('dnAppUserId', userId);
  },

  async getDnAppUserId() {
    if (this.dnAppUserId) return this.dnAppUserId;
    const setting = await this.getSetting('dnAppUserId');
    this.dnAppUserId = setting?.value;
    return this.dnAppUserId;
  },

  async saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      store.put({ key, value, updatedAt: new Date().toISOString() });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  },

  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  // ============================================
  // SYNC DATA OPERATIONS
  // ============================================
  async setSyncData(data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncData'], 'readwrite');
      const store = transaction.objectStore('syncData');
      
      store.put({ 
        id: 'mainSync', 
        ...data, 
        updatedAt: new Date().toISOString() 
      });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  },

  async getSyncData() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncData'], 'readonly');
      const store = transaction.objectStore('syncData');
      const request = store.get('mainSync');

      request.onsuccess = () => {
        resolve(request.result || {});
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  },

  // ============================================
  // CLEANUP
  // ============================================
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DB] Database closed');
    }
  }
};

export { dbManager };