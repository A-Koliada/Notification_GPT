// ============================================
// Window Notifier - Mini-window notifications
// ============================================

export class WindowNotifier {
  constructor(onAction) {
    this.onAction = onAction; // callback: (notificationId, action, data) => {}
    this.activeWindows = new Map(); // windowId -> notification data
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
        this.activeWindows.delete(windowId);
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
    let top = position.top;
    
    if (cascade) {
      top += this.cascadeOffset;
      this.cascadeOffset += 30; // Зсув для наступного вікна
      
      if (this.cascadeOffset > 300) {
        this.cascadeOffset = 0;
      }
    }

    // Розрахунок left (від правого краю екрану)
    const screenWidth = window.screen.availWidth;
    const left = screenWidth - width - position.right;

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
      const window = await chrome.windows.create({
        url: chrome.runtime.getURL("ui/notification.html"),
        type: "popup",
        width: width,
        height: height,
        left: left,
        top: top,
        focused: false
      });

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
