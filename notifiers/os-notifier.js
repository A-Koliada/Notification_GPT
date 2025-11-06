// ============================================
// OS Notifier - System notifications (chrome.notifications)
// ============================================

export class OSNotifier {
  constructor(onAction) {
    this.onAction = onAction; // callback: (notificationId, action, data) => {}
    this.activeNotifications = new Map();
    this._setupListeners();
  }

  _log(...args) {
    console.log("[OSNotifier]", ...args);
  }

  _setupListeners() {
    // Клік по нотифікації
    chrome.notifications.onClicked.addListener((notificationId) => {
      this._log("Notification clicked:", notificationId);
      const data = this.activeNotifications.get(notificationId);
      if (data) {
        this.onAction(notificationId, "click", data);
        this.clear(notificationId);
      }
    });

    // Клік по кнопках
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      this._log("Button clicked:", notificationId, buttonIndex);
      const data = this.activeNotifications.get(notificationId);
      if (data) {
        const action = buttonIndex === 0 ? "delete" : "done";
        this.onAction(notificationId, action, data);
        this.clear(notificationId);
      }
    });

    // Закриття нотифікації
    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      this._log("Notification closed:", notificationId, "by user:", byUser);
      this.activeNotifications.delete(notificationId);
    });
  }

  /**
   * Показує System notification
   * @param {Object} notification - об'єкт нотифікації з БД
   * @param {Object} options - налаштування (requireInteraction)
   */
  
  async show(notification, options = {}) {
    const notificationId = `dn_${notification.id || notification.Id}`;

    this._log("📢 Attempting to show notification:", notificationId);

    // Check permissions first
    const permission = await chrome.permissions.contains({ permissions: ['notifications'] });
    this._log("🔐 Notification permission granted:", permission);
    
    if (!permission) {
      console.error("[OSNotifier] ❌ Notification permission not granted!");
      return;
    }

    
    // Truncate message to ~140 chars
    let message = notification.message || notification.DnMessage || "";
    if (message.length > 140) {
      message = message.substring(0, 137) + "...";
    }
    // Remove line breaks
    message = message.replace(/[\r\n]+/g, " ");

    const notificationOptions = {
      type: "basic",
      iconUrl: chrome.runtime.getURL("images/icon-128.png"),
      title: notification.title || notification.DnTitle || "Creatio Notification",
      message: message,
      priority: notification.priority || notification.DnPriority || 0,
      buttons: [
        { title: "🗑 Delete" },
        { title: "✔ Done" }
      ],
      requireInteraction: options.requireInteraction || false
    };

    // Store notification data
    this.activeNotifications.set(notificationId, {
      id: notification.id || notification.Id,
      sourceUrl: notification.sourceUrl || notification.DnSourceUrl,
      typeId: notification.typeId || notification.DnNotificationTypeId,
      raw: notification
    });

    try {
      await this.clear(notificationId).catch(() => {});
      await chrome.notifications.create(notificationId, notificationOptions);
      this._log("✅ System notification shown:", notificationId);

      // Перевірка чи нотифікація була створена
      const allNotifs = await chrome.notifications.getAll();
      this._log("📋 Active system notifications:", Object.keys(allNotifs).length);
      
    } catch (err) {
      console.error("[OSNotifier] ❌ Failed to show notification:", err);
      this._log("Error details:", err.message);
      throw err;
    }

    return notificationId;
  }

  /**
   * Очищує нотифікацію
   */
  async clear(notificationId) {
    try {
      await chrome.notifications.clear(notificationId);
      this.activeNotifications.delete(notificationId);
    } catch (err) {
      console.error("[OSNotifier] Failed to clear notification:", err);
    }
  }

  /**
   * Очищує всі активні нотифікації
   */
  async clearAll() {
    const ids = Array.from(this.activeNotifications.keys());
    for (const id of ids) {
      await this.clear(id);
    }
  }
}

export default OSNotifier;
