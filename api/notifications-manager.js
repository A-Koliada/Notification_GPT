// ============================================
// Notifications Manager
// ============================================

export class NotificationsManager {
    constructor(api, db) {
      this.api = api;
      this.db = db;
      this._cache = [];
      this.contactId = null;
    }
  
    _log(...a) { console.log("[NotificationsManager]", ...a); }
    _warn(...a) { console.warn("[NotificationsManager]", ...a); }
  
    async init(contactId) {
      this.contactId = contactId || (await this.api.getContactId());
      let cached = [];
      try {
        if (this.db?.getNotifications) {
          cached = await this.db.getNotifications();
        } else if (this.db?.getAllNotifications) {
          cached = await this.db.getAllNotifications();
        }
      } catch (e) {
        this._warn("Cache load failed:", e?.message || e);
      }
      this._cache = Array.isArray(cached) ? cached : [];
      this._log("Initialized for contact:", this.contactId);
      this._log("Loaded", this._cache.length, "notifications from cache");
    }
  
    getFromCache() {
      return this._cache.slice();
    }
  
    // ✅ ДОДАНО: кількість непрочитаних із кешу
    getUnreadCount() {
      const isRead = (n) =>
        n.DnIsRead === true || n.IsRead === true || n.Read === true ||
        (n.Raw && (n.Raw.DnIsRead === true || n.Raw.IsRead === true || n.Raw.Read === true));
      return (this._cache || []).reduce((acc, n) => acc + (isRead(n) ? 0 : 1), 0);
    }
  
    // ✅ ДОДАНО: уніфіковане збереження в кеш + БД
    async saveToCache(items) {
      try {
        const arr = Array.isArray(items) ? items : [];
        if (this.db?.saveNotifications) {
          await this.db.saveNotifications(arr);
        } else if (this.db?.setNotifications) {
          await this.db.setNotifications(arr);
        }
        this._cache = arr.slice();
        this._log("Cache updated:", this._cache.length, "items");
      } catch (e) {
        this._warn("Cache save failed:", e?.message || e);
      }
    }
  
    // Повний синк
    async fetchAll() {
      try {
        const list = await this.api.getNotifications({ onlyUnread: false, limit: 500 });
        await this.saveToCache(list);
        return list;
      } catch (e) {
        this._warn("Fetch error:", e);
        throw e;
      }
    }
  
    // Інкрементальний синк (із фолбеком на клієнтську фільтрацію)
    async fetchSince(sinceIso) {
      try {
        const opts = { onlyUnread: false, limit: 200 };
        let items;
  
        if (this.api && typeof this.api.getNotificationsSince === "function") {
          items = await this.api.getNotificationsSince(sinceIso, opts);
        } else {
          const all = await this.api.getNotifications(opts);
          const sinceTs = Date.parse(sinceIso || "") || 0;
          items = (all || []).filter(n => {
            const d = n.CreatedOn || n.SysCreatedOn ||
                      (n.Raw && (n.Raw.CreatedOn || n.Raw.SysCreatedOn)) || "";
            return (Date.parse(d) || 0) > sinceTs;
          });
        }
  
        await this.saveToCache(items || []);
        return items || [];
      } catch (e) {
        this._warn("Fetch since error:", e);
        throw e;
      }
    }
  
    // --- Дії над нотифікаціями ---
  
    async markAsRead(id) {
      if (!id) return;
      await this.api.setNotificationRead(id, true);
      // локально
      this._cache = (this._cache || []).map(n =>
        n.Id === id ? { ...n, IsRead: true, DnIsRead: true, Read: true } : n
      );
      await this.saveToCache(this._cache);
    }
  
    async markAllAsRead() {
      const count = await this.api.setAllNotificationsRead(this.contactId);
      this._cache = (this._cache || []).map(n => ({ ...n, IsRead: true, DnIsRead: true, Read: true }));
      await this.saveToCache(this._cache);
      return { count };
    }
  
    async deleteNotification(id) {
      if (!id) return;
      await this.api.deleteNotification(id);
      this._cache = (this._cache || []).filter(n => n.Id !== id);
      await this.saveToCache(this._cache);
    }
  
    async setVisaDecision(id, decision) {
      try {
        if (typeof this.api.setVisaDecision === "function") {
          await this.api.setVisaDecision(id, decision);
        } else {
          this._log("setVisaDecision skipped: API method not implemented");
        }
        // опційно оновлюємо кеш
      } catch (e) {
        this._warn("setVisaDecision failed:", e?.message || e);
        throw e;
      }
    }
  }
  
  export default NotificationsManager;
  