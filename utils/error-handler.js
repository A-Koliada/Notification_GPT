// ============================================
// ERROR HANDLER - Обробка помилок розширення
// ============================================

const errorHandler = {
    /**
     * Обробити помилку та залогувати її
     * @param {Error} error - об'єкт помилки
     * @param {Object} context - контекст помилки
     */
    handle: function(error, context = {}) {
      const timestamp = new Date().toISOString();
      
      const errorInfo = {
        timestamp,
        message: error.message,
        stack: error.stack,
        context,
        type: error.name || 'Error'
      };
  
      // Логування в консоль
      console.error('❌ [Error Handler]', errorInfo);
  
      // Зберігання помилки в storage (опціонально)
      this.saveToStorage(errorInfo);
  
      // Показати notification користувачу (опціонально)
      if (context.showNotification) {
        this.showErrorNotification(error.message);
      }
  
      return errorInfo;
    },
  
    /**
     * Зберегти помилку в chrome.storage
     */
    saveToStorage: function(errorInfo) {
      try {
        chrome.storage.local.get({ errorLog: [] }, (result) => {
          const errorLog = result.errorLog || [];
          
          // Зберігаємо тільки останні 50 помилок
          errorLog.unshift(errorInfo);
          if (errorLog.length > 50) {
            errorLog.pop();
          }
  
          chrome.storage.local.set({ errorLog });
        });
      } catch (e) {
        console.error('Failed to save error to storage:', e);
      }
    },
  
    /**
     * Показати notification про помилку
     */
    showErrorNotification: function(message) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon-48.png',
          title: 'Помилка Creatio Notifications',
          message: message || 'Виникла непередбачена помилка',
          priority: 2
        });
      } catch (e) {
        console.error('Failed to show error notification:', e);
      }
    },
  
    /**
     * Отримати останні помилки з storage
     */
    getErrorLog: async function() {
      return new Promise((resolve) => {
        chrome.storage.local.get({ errorLog: [] }, (result) => {
          resolve(result.errorLog || []);
        });
      });
    },
  
    /**
     * Очистити лог помилок
     */
    clearErrorLog: function() {
      chrome.storage.local.set({ errorLog: [] });
    }
  };
  
  // ⬇️ ЕКСПОРТ (для ES6 модулів в Manifest V3)
  export { errorHandler };