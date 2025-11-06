// ============================================
// SYNC MANAGER (FIXED VERSION)
// Автоматична синхронізація сповіщень з Creatio
// ✅ ВИПРАВЛЕНО: Повідомлення зникають тільки при видаленні в Creatio
// ✅ ДОДАНО: Системні нотифікації для нових повідомлень
// ============================================

class SyncManager {
  async emitOsNotificationsForNew(notifications, baseUrl) {
    try {
      const ids = (notifications||[]).map(n => String(n.id || n.Id)).filter(Boolean);
      const seen = (await chrome.storage.local.get({ seenIds: [] })).seenIds || [];
      const seenSet = new Set(seen);
      const fresh = (notifications||[]).filter(n => {
        const id = String(n.id || n.Id || "");
        return id && !seenSet.has(id);
      });
      if (fresh.length) {
        for (const n of fresh) {
          try { showOSNotification(n, baseUrl); } catch(e) {}
        }
        const merged = Array.from(new Set(seen.concat(ids))).slice(-1000);
        await chrome.storage.local.set({ seenIds: merged });
      }
    } catch (e) { console.warn("[SyncManager] emitOsNotificationsForNew error:", e); }
  }

    constructor(creatioAPI, dbManager, notificationsManager, userManager = null) {
      this.api = creatioAPI;
      this.db = dbManager;
      this.notificationsManager = notificationsManager;
      this.userManager = userManager;
      
      this.syncInterval = 30;
      this.syncTimerId = null;
      this.isSyncing = false;
      this.lastSyncTime = null;
      this.lastSyncSuccess = false;
      this.syncStats = {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastError: null
      };
      
      // ✅ ДОДАНО: Кеш для відстеження попередніх повідомлень
      this.previousNotificationIds = new Set();
      
      console.log('[SyncManager] ✅ Constructor executed successfully');
    }
  
    // ============================================
    // INITIALIZATION
    // ============================================
    async init(options = {}) {
      if (options.syncInterval) {
        this.syncInterval = options.syncInterval;
      }

      console.log(`[SyncManager] Initialized with interval: ${this.syncInterval}s`);
      
      // Load last sync time from database
      const syncData = await this.db.getSyncData();
      this.lastSyncTime = syncData.lastSyncTime;
      
      // ✅ ДОДАНО: Завантажуємо попередні ID повідомлень
      const cachedNotifications = await this.notificationsManager.getFromCache();
      this.previousNotificationIds = new Set(
        (cachedNotifications || []).map(n => n.Id || n.id)
      );
      
      console.log('[SyncManager] Last sync time:', this.lastSyncTime);
      console.log('[SyncManager] Loaded', this.previousNotificationIds.size, 'previous notification IDs');
      
      // Start automatic sync
      this.startAutoSync();
    }
  
    // ============================================
    // AUTO SYNC
    // ============================================
    startAutoSync() {
      if (this.syncTimerId) {
        clearInterval(this.syncTimerId);
      }

      // Initial sync after 2 seconds
      setTimeout(() => {
        this.syncNow();
      }, 2000);

      // Periodic sync
      this.syncTimerId = setInterval(() => {
        this.syncNow();
      }, this.syncInterval * 1000);

      console.log(`[SyncManager] ✅ Auto-sync started (every ${this.syncInterval}s)`);
    }
  
    stopAutoSync() {
      if (this.syncTimerId) {
        clearInterval(this.syncTimerId);
        this.syncTimerId = null;
        console.log('[SyncManager] Auto-sync stopped');
      }
    }
  
    updateSyncInterval(newInterval) {
      this.syncInterval = newInterval;
      console.log(`[SyncManager] Sync interval updated to ${newInterval}s`);
      this.startAutoSync(); // Restart with new interval
    }
  
    // ============================================
    // ✅ НОВА ФУНКЦІЯ: Перевірка видалених повідомлень
    // ============================================
    async checkDeletedNotifications(currentNotifications) {
      const currentIds = new Set(
        (currentNotifications || []).map(n => n.Id || n.id)
      );
      
      const deletedIds = [];
      for (const prevId of this.previousNotificationIds) {
        if (!currentIds.has(prevId)) {
          deletedIds.push(prevId);
        }
      }
      
      if (deletedIds.length > 0) {
        console.log('[SyncManager] 🗑️ Detected', deletedIds.length, 'deleted notifications:', deletedIds);
        
        // Видаляємо їх з локального кешу
        const cached = await this.notificationsManager.getFromCache();
        const updatedCache = (cached || []).filter(
          n => !deletedIds.includes(n.Id || n.id)
        );
        
        await this.notificationsManager.saveToCache(updatedCache);
      }
      
      // Оновлюємо кеш попередніх ID
      this.previousNotificationIds = currentIds;
      
      return deletedIds;
    }
  
    // ============================================
    // ✅ НОВА ФУНКЦІЯ: Показ системних нотифікацій
    // ============================================
    async showSystemNotifications(newNotifications) {
      console.log('[SyncManager] 🔔 showSystemNotifications called with', (newNotifications || []).length, 'notifications');
      
      // Перевіряємо чи є notifier
      if (!this.notifier) {
        console.warn('[SyncManager] ⚠️ Notifier not initialized, skipping notifications');
        return;
      }
      
      console.log('[SyncManager] ✅ Notifier is available:', this.notifier.constructor.name);
      
      // Отримуємо налаштування
      const settings = this.settings || await new Promise(resolve => {
        chrome.storage.sync.get({
          showPopupNotifications: true,
          enableNotifications: true,
          enabledTypes: [
            'ead36165-7815-45d1-9805-1faa47de504a',
            '337065ba-e6e6-4086-b493-0f6de115bc7a',
            '7e1bf266-2e6b-49a5-982b-4ae407f3ae26',
            '8ebcc160-7a78-444b-8904-0a78348a5141',
            'ae6c7636-32fd-4548-91a7-1784a28e7f9e',
            'fa41b6a0-eafd-4bb9-a913-aa74000b46f6'
          ]
        }, resolve);
      });
      
      console.log('[SyncManager] 📋 Settings:', {
        showPopup: settings.showPopupNotifications,
        enabled: settings.enableNotifications,
        enabledTypesCount: settings.enabledTypes?.length
      });
      
      
      if (!settings.showPopupNotifications || !settings.enableNotifications) {
        console.log('[SyncManager] ⚠️ System notifications disabled in settings:', {
          showPopupNotifications: settings.showPopupNotifications,
          enableNotifications: settings.enableNotifications
        });
        return;
      }
      
      console.log('[SyncManager] ✅ Settings allow notifications, checking notifier...');
      
      if (!this.notifier) {
        console.error('[SyncManager] ❌ Notifier not initialized!');
        return;
      }
      
      console.log('[SyncManager] ✅ Notifier exists, showing notifications...');

      
      // Показуємо тільки непрочитані нові повідомлення
      const unreadNew = (newNotifications || []).filter(n => 
        !n.DnIsRead && !n.IsRead && !n.Read
      );
      
      console.log('[SyncManager] 📊 Filtered unread notifications:', unreadNew.length);
      
      if (unreadNew.length === 0) {
        console.log('[SyncManager] ℹ️ No unread notifications to show');
        return;
      }
      
      console.log('[SyncManager] 🔔 Showing', unreadNew.length, 'notification(s)');
      
      // Показуємо по одному повідомленню через notifier
      for (const notification of unreadNew.slice(0, 5)) { // Максимум 5 одночасно
        try {
          // Перевіряємо чи enabled для цього типу
          const typeId = notification.DnNotificationTypeId || notification.typeId;
          if (typeId && settings.enabledTypes && !settings.enabledTypes.includes(typeId)) {
            console.log('[SyncManager] ⏭️ Skipping notification - type disabled:', typeId);
            continue;
          }
          
          // Нормалізуємо дані
          const normalizedNotif = {
            id: notification.Id || notification.id,
            title: notification.DnTitle || notification.title || 'Нове повідомлення',
            message: notification.DnMessage || notification.message || '',
            sourceUrl: notification.DnSourceUrl || notification.sourceUrl || '',
            typeId: typeId,
            visaStatusId: notification.DnVisaStatusId || notification.visaStatusId,
            priority: notification.DnPriority || notification.priority || 0,
            createdOn: notification.CreatedOn || notification.createdOn
          };
          
          console.log('[SyncManager] 📤 Calling notifier.show for:', normalizedNotif.id);
          
          // Викликаємо notifier.show()
          await this.notifier.show(normalizedNotif, {
            requireInteraction: settings.requireInteraction || false,
            autoClose: settings.autoClose || 10,
            cascade: settings.cascade !== false
          });
          
          console.log('[SyncManager] ✅ Notification shown:', normalizedNotif.id);
          
        } catch (error) {
          console.error('[SyncManager] ❌ Failed to show notification:', error);
          console.error('[SyncManager] Error stack:', error.stack);
        }
        
        // Невелика затримка між показами
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  
    // ============================================
    // SYNC OPERATIONS (ПОКРАЩЕНО)
    // ============================================
    // ============================================
    async syncNow(options = {}) {
      if (this.isSyncing) {
        console.log('[SyncManager] Sync already in progress, skipping');
        return { skipped: true, reason: 'Already syncing' };
      }
    
      this.isSyncing = true;
      this.syncStats.totalSyncs++;
    
      try {
        console.log('[SyncManager] 🔄 Starting sync...');
        
        // Оновлюємо активність користувача
        if (options.updateUser !== false && this.userManager) {
          try {
            console.log('[SyncManager] 📝 Updating user activity...');
            await this.userManager.registerOrUpdateUser({});
            console.log('[SyncManager] ✅ User activity updated');
          } catch (userError) {
            console.warn('[SyncManager] ⚠️ User update failed (non-fatal):', userError?.message);
          }
        }
        
        const startTime = Date.now();
        let currentNotifications = [];
        let newNotifications = [];
    
        // ✅ ЗМІНЕНО: Завжди завантажуємо ВСІ повідомлення з Creatio
        // Це дозволяє відстежувати видалені повідомлення
        console.log('[SyncManager] Loading all notifications from Creatio...');
        currentNotifications = await this.notificationsManager.fetchAll();
        
        // ✅ ДОДАНО: Визначаємо нові повідомлення
        const cachedNotifications = await this.notificationsManager.getFromCache();
        const cachedIds = new Set((cachedNotifications || []).map(n => n.Id || n.id));
        
        newNotifications = (currentNotifications || []).filter(n => 
          !cachedIds.has(n.Id || n.id)
        );
        
        if (newNotifications.length > 0) {
          console.log('[SyncManager] 🆕 Found', newNotifications.length, 'new notification(s)');
          
          // ✅ ДОДАНО: Показуємо системні нотифікації для нових повідомлень
          await this.showSystemNotifications(newNotifications);
        }
        
        // ✅ ДОДАНО: Перевіряємо видалені повідомлення
        const deletedIds = await this.checkDeletedNotifications(currentNotifications);
        
        this.lastSyncTime = new Date().toISOString();
        await this.db.setSyncData({
          lastSyncTime: this.lastSyncTime,
          lastSyncSuccess: true,
          lastSyncDuration: Date.now() - startTime
        });
    
        const duration = Date.now() - startTime;
        
        this.lastSyncSuccess = true;
        this.syncStats.successfulSyncs++;
        this.syncStats.lastError = null;
    
        console.log(`[SyncManager] ✅ Sync completed in ${duration}ms:`);
        console.log(`  - Total: ${currentNotifications.length} notifications`);
        console.log(`  - New: ${newNotifications.length}`);
        try { const baseUrl = (await chrome.storage.sync.get({creatioUrl:''})).creatioUrl || ''; await this.emitOsNotificationsForNew(newNotifications, baseUrl); } catch(e) {}
        console.log(`  - Deleted: ${deletedIds.length}`);
    
        const unreadCount = this.notificationsManager.getUnreadCount();
        this.updateBadge(unreadCount);
    
        return {
          success: true,
          totalCount: currentNotifications.length,
          newCount: newNotifications.length,
          deletedCount: deletedIds.length,
          unreadCount: unreadCount,
          duration: duration,
          timestamp: this.lastSyncTime
        };
    
      } catch (error) {
        console.error('[SyncManager] ❌ Sync error:', error);
        
        this.lastSyncSuccess = false;
        this.syncStats.failedSyncs++;
        this.syncStats.lastError = error.message;
    
        await this.db.setSyncData({
          lastSyncTime: this.lastSyncTime,
          lastSyncSuccess: false,
          lastError: error.message,
          lastErrorTime: new Date().toISOString()
        });
    
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
    
      } finally {
        this.isSyncing = false;
      }
    }
  
    async quickSync() {
      // Quick sync without waiting - immediate execution
      console.log('[SyncManager] ⚡ Quick sync requested');
      return this.syncNow();
    }
  
    async forceSyncAll() {
      // Force full sync regardless of last sync time
      console.log('[SyncManager] 🔄 Force full sync');
      this.lastSyncTime = null;
      return this.syncNow();
    }
  
    // ============================================
    // BADGE UPDATE
    // ============================================
    updateBadge(count) {
      try {
        const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
        
        chrome.action.setBadgeText({ text });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        
        if (chrome.action.setBadgeTextColor) {
          chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
        }

        console.log(`[SyncManager] Badge updated: ${text || '(empty)'}`);
      } catch (error) {
        console.error('[SyncManager] Badge update error:', error);
      }
    }
  
    // ============================================
    // CLEANUP
    // ============================================
    async cleanup() {
      try {
        console.log('[SyncManager] 🧹 Running cleanup...');
        
        // Delete old read notifications (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const deletedCount = await this.db.cleanupOldNotifications(
          thirtyDaysAgo.toISOString()
        );
        
        console.log(`[SyncManager] ✅ Cleanup completed: ${deletedCount} old notifications removed`);
        
        return { success: true, deletedCount };
      } catch (error) {
        console.error('[SyncManager] ❌ Cleanup error:', error);
        return { success: false, error: error.message };
      }
    }
  
    // ============================================
    // STATISTICS & STATUS
    // ============================================
    async getStatistics() {
      const syncData = await this.db.getSyncData();
      
      return {
        // Runtime stats
        totalSyncs: this.syncStats.totalSyncs,
        successfulSyncs: this.syncStats.successfulSyncs,
        failedSyncs: this.syncStats.failedSyncs,
        lastError: this.syncStats.lastError,
        
        // Current state
        lastSyncTime: this.lastSyncTime,
        lastSyncSuccess: this.lastSyncSuccess,
        syncInterval: this.syncInterval,
        isSyncing: this.isSyncing,
        
        // Stored data from database
        storedData: syncData,
        
        // Calculated metrics
        successRate: this.syncStats.totalSyncs > 0 
          ? (this.syncStats.successfulSyncs / this.syncStats.totalSyncs * 100).toFixed(2) + '%'
          : 'N/A',
        
        // Next sync time estimate
        nextSyncEstimate: this.syncTimerId && !this.isSyncing
          ? new Date(Date.now() + this.syncInterval * 1000).toISOString()
          : null
      };
    }
  
    getStatus() {
      return {
        isRunning: !!this.syncTimerId,
        isSyncing: this.isSyncing,
        lastSync: this.lastSyncTime,
        lastSuccess: this.lastSyncSuccess,
        interval: this.syncInterval
      };
    }
  
    // ============================================
    // SHUTDOWN
    // ============================================
    shutdown() {
      console.log('[SyncManager] Shutting down...');
      this.stopAutoSync();
      console.log('[SyncManager] ✅ Shutdown complete');
    }
  }
  
  // ⬇️ ЕКСПОРТ (ES6 модуль)
  export { SyncManager };