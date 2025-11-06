// ============================================
// Window Notifier - Mini-window notifications
// ============================================

export class WindowNotifier {
  constructor(onAction) {
    this.onAction = onAction; // callback: (notificationId, action, data) => {}
    this.activeWindows = new Map(); // windowId -> notification data
    this.windowByNotification = new Map();
    this.cascadeOffset = 0;
    this._setupListeners();
  }

  _log(...args) {
    console.log("[WindowNotifier]", ...args);
  }

  _setupListeners() {
    // Слухаємо повідомлення від notification.html
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "notification-action") {
        const { windowId, action, data } = message;
        this._log("Action received:", action, windowId);
        
        this.onAction(windowId, action, data);
        
        // Закриваємо вікно
        if (windowId) {
          this.close(windowId);
        }
        
        sendResponse({ success: true });
        return true;
      }
    });

    // Слухаємо закриття вікон
    chrome.windows.onRemoved.addListener((windowId) => {
      if (this.activeWindows.has(windowId)) {
        this._log("Window closed:", windowId);
        const data = this.activeWindows.get(windowId);
        this.activeWindows.delete(windowId);
        if (data?.id) {
          this.windowByNotification.delete(data.id);
        }
        this._adjustCascade();
      }
    });
  }

  /**
   * Показує Mini-window notification
   * @param {Object} notification - об'єкт нотифікації з БД
   * @param {Object} options - налаштування (autoClose, position, cascade)
   */
  async show(notification, options = {}) {
    const {
      autoClose = 10,
      position = { right: 20, top: 20 },
      cascade = true
    } = options;

    // Розрахунок позиції з каскадом
    const baseTop = Number.isFinite(position.top) ? position.top : 20;
    let top = baseTop;
    
    if (cascade) {
      top += this.cascadeOffset;
      this.cascadeOffset += 30; // Зсув для наступного вікна
      
      if (this.cascadeOffset > 300) {
        this.cascadeOffset = 0;
      }
    }

    const notificationData = {
      id: notification.id || notification.Id,
      title: notification.title || notification.DnTitle,
      message: notification.message || notification.DnMessage,
      sourceUrl: notification.sourceUrl || notification.DnSourceUrl,
      typeId: notification.typeId || notification.DnNotificationTypeId,
      visaStatusId: notification.visaStatusId || notification.DnVisaStatusId,
      priority: notification.priority || notification.DnPriority || 0,
      createdOn: notification.createdOn || notification.CreatedOn,
      isVisa: this._isVisaType(notification.typeId || notification.DnNotificationTypeId),
      autoClose: autoClose
    };

    const dimensions = this._calculateWindowSize(notificationData, options);

    // Розрахунок left (від правого краю екрану)
    const screenGlobal = typeof globalThis !== 'undefined' ? globalThis.screen : null;
    const screenWidth = screenGlobal?.availWidth || 1920;
    const rightOffset = Number.isFinite(position.right) ? position.right : 20;
    const left = screenWidth - dimensions.width - rightOffset;

    // Закриваємо попереднє вікно для цієї нотифікації якщо є
    for (const [existingWindowId, data] of Array.from(this.activeWindows.entries())) {
      if (data.id === notificationData.id) {
        await this.close(existingWindowId);
      }
    }

    try {
      const window = await chrome.windows.create({
        url: chrome.runtime.getURL("ui/notification.html"),
        type: "popup",
        width: dimensions.width,
        height: dimensions.height,
        left: left,
        top: top,
        focused: false
      });

      this._log("Mini-window created:", window.id);

      // Зберігаємо дані
      this.activeWindows.set(window.id, notificationData);
      this.windowByNotification.set(notificationData.id, window.id);

      // Відправляємо дані у вікно після його створення
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: "notification-data",
          windowId: window.id,
          data: notificationData
        }).catch(() => {
          // Вікно може бути вже закрите
        });
      }, 100);

      return window.id;
    } catch (err) {
      console.error("[WindowNotifier] Failed to create window:", err);
      throw err;
    }
  }

  /**
   * Закриває вікно нотифікації
   */
  async close(windowId) {
    try {
      await chrome.windows.remove(windowId);
      this.activeWindows.delete(windowId);
      for (const [notifId, winId] of Array.from(this.windowByNotification.entries())) {
        if (winId === windowId) {
          this.windowByNotification.delete(notifId);
        }
      }
      this._adjustCascade();
    } catch (err) {
      // Вікно вже закрите
    }
  }

  /**
   * Закриває всі активні вікна
   */
  async closeAll() {
    const windowIds = Array.from(this.activeWindows.keys());
    for (const id of windowIds) {
      await this.close(id);
    }
    this.cascadeOffset = 0;
  }

  /**
   * Коригує зсув каскаду після закриття вікна
   */
  _adjustCascade() {
    const count = this.activeWindows.size;
    if (count === 0) {
      this.cascadeOffset = 0;
    } else if (this.cascadeOffset > count * 30) {
      this.cascadeOffset = count * 30;
    }
  }

  async bringToFront() {
    for (const windowId of this.activeWindows.keys()) {
      try {
        await chrome.windows.update(windowId, { focused: true });
      } catch (err) {
        this.activeWindows.delete(windowId);
      }
    }
  }

  /**
   * Перевіряє чи це Visa тип
   */
  _isVisaType(typeId) {
    // Visa TypeId з вашого довідника
    return typeId === 'ead36165-7815-45d1-9805-1faa47de504a';
  }

  _calculateWindowSize(notification) {
    const baseWidth = 360;
    const baseHeight = this._isVisaType(notification.typeId) ? 280 : 220;
    const titleLength = (notification.title || '').length;
    const rawMessage = (notification.message || '').replace(/\s+/g, ' ').trim();
    const messageLength = rawMessage.length;
    const extraWidth = Math.min(160, Math.floor(Math.max(titleLength, messageLength) / 35) * 20);
    const lineBreaks = (notification.message || '').split(/\r?\n/).length - 1;
    const extraHeight = Math.min(200, Math.floor(messageLength / 80) * 18 + Math.max(0, lineBreaks) * 20);
    const visaExtra = notification.isVisa ? 60 : 0;

    const width = Math.max(baseWidth, baseWidth + extraWidth);
    const height = Math.max(220, baseHeight + extraHeight + visaExtra);

    return {
      width: Math.min(width, 520),
      height: Math.min(height, 520)
    };
  }
}

export default WindowNotifier;
