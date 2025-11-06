// ============================================
// Window Notifier - Mini-window notifications
// ============================================

export class WindowNotifier {
  constructor(onAction) {
    this.onAction = onAction; // callback: (notificationId, action, data) => {}
    this.activeWindows = new Map(); // windowId -> notification data
    this.cascadeOffset = 0;
    this.handledWindows = new Set();
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
          this.handledWindows.add(windowId);
          this.close(windowId);
        }

        sendResponse({ success: true });
        return true;
      }

      if (message.type === "notification-resize") {
        const { windowId, size } = message;
        if (windowId && size) {
          chrome.windows.update(windowId, {
            width: size.width ? Math.round(size.width) : undefined,
            height: size.height ? Math.round(size.height) : undefined
          }).catch(() => {});
        }
        sendResponse({ success: true });
        return true;
      }

      if (message.type === "notification-dismissed") {
        const { windowId } = message;
        const data = this.activeWindows.get(windowId);
        if (data) {
          this.onAction(windowId, 'dismiss', data);
        }
        sendResponse({ success: true });
        return true;
      }
    });

    // Слухаємо закриття вікон
    chrome.windows.onRemoved.addListener((windowId) => {
      if (this.activeWindows.has(windowId)) {
        this._log("Window closed:", windowId);
        if (!this.handledWindows.has(windowId)) {
          const data = this.activeWindows.get(windowId);
          if (data) {
            this.onAction(windowId, 'dismiss', data);
          }
        }
        this.activeWindows.delete(windowId);
        this.handledWindows.delete(windowId);
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
      width = 400,
      height = 250,
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

    const rightOffset = Number.isFinite(position.right) ? position.right : 20;
    let left;

    try {
      const lastFocused = await chrome.windows.getLastFocused({ populate: false });
      const anchorWindow = lastFocused || null;

      if (anchorWindow && Number.isFinite(anchorWindow.left) && Number.isFinite(anchorWindow.width)) {
        left = Math.max(0, Math.round(anchorWindow.left + anchorWindow.width - width - rightOffset));
      }

      if (left === undefined) {
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        const fallback = windows.find(Boolean);
        if (fallback && Number.isFinite(fallback.left) && Number.isFinite(fallback.width)) {
          left = Math.max(0, Math.round(fallback.left + fallback.width - width - rightOffset));
        }
      }
    } catch (err) {
      this._log('Unable to determine anchor window position:', err?.message || err);
    }

    if (!Number.isFinite(left) && Number.isFinite(position.left)) {
      left = Math.max(0, Math.round(position.left));
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

    try {
      const createOptions = {
        url: chrome.runtime.getURL("ui/notification.html"),
        type: "popup",
        width: Math.round(width),
        height: Math.round(height),
        focused: false
      };

      if (Number.isFinite(left)) {
        createOptions.left = left;
      }

      if (Number.isFinite(top)) {
        createOptions.top = Math.max(0, Math.round(top));
      }

      this._log("Creating mini-window with options:", createOptions);

      const window = await chrome.windows.create(createOptions);

      this._log("Mini-window created:", window.id);

      // Зберігаємо дані
      this.activeWindows.set(window.id, notificationData);

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
      this.handledWindows.delete(windowId);
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

  /**
   * Перевіряє чи це Visa тип
   */
  _isVisaType(typeId) {
    // Visa TypeId з вашого довідника
    return typeId === 'ead36165-7815-45d1-9805-1faa47de504a';
  }
}

export default WindowNotifier;
