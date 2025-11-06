// ============================================
// EXPORT/IMPORT & QUICK ACTIONS
// Version: 2.0.0
// ============================================

class DataManager {
    constructor() {
      this.init();
    }
    
    init() {
      this.addExportImportUI();
      this.setupContextMenu();
      console.log('[DataManager] ✅ Initialized');
    }
    
    // ============================================
    // EXPORT/IMPORT UI
    // ============================================
    addExportImportUI() {
      // Add to popup footer or create separate button
      const footer = document.querySelector('.footer-actions');
      if (!footer) return;
      
      const exportBtn = document.createElement('button');
      exportBtn.className = 'footer-link';
      exportBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="icon-tiny">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,19L8,15H10.5V12H13.5V15H16L12,19Z"/>
        </svg>
        <span>Export</span>
      `;
      
      exportBtn.addEventListener('click', () => this.showExportMenu());
      footer.appendChild(exportBtn);
    }
    
    showExportMenu() {
      const menu = document.createElement('div');
      menu.className = 'export-menu-overlay';
      menu.innerHTML = `
        <div class="export-menu">
          <div class="export-menu-header">
            <h3>📤 Export / Import</h3>
            <button class="close-export-menu">×</button>
          </div>
          <div class="export-menu-body">
            <div class="export-section">
              <h4>Export Data</h4>
              <button class="export-option" data-action="exportSettings">
                <svg viewBox="0 0 24 24">
                  <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                </svg>
                <div>
                  <strong>Settings</strong>
                  <p>Export all extension settings</p>
                </div>
              </button>
              <button class="export-option" data-action="exportNotifications">
                <svg viewBox="0 0 24 24">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
                <div>
                  <strong>Notifications</strong>
                  <p>Export notification history</p>
                </div>
              </button>
              <button class="export-option" data-action="exportAll">
                <svg viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                <div>
                  <strong>Complete Backup</strong>
                  <p>Settings + Notifications + Stats</p>
                </div>
              </button>
            </div>
            
            <div class="import-section">
              <h4>Import Data</h4>
              <label class="import-option" for="importFile">
                <svg viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12,19L16,15H13.5V12H10.5V15H8L12,19Z"/>
                </svg>
                <div>
                  <strong>Import Backup</strong>
                  <p>Restore from file</p>
                </div>
                <input type="file" id="importFile" accept=".json" style="display: none;">
              </label>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(menu);
      this.injectExportStyles();
      
      // Event listeners
      menu.querySelector('.close-export-menu').addEventListener('click', () => {
        menu.remove();
      });
      
      menu.addEventListener('click', (e) => {
        if (e.target === menu) menu.remove();
      });
      
      menu.querySelectorAll('.export-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          this[action]();
          menu.remove();
        });
      });
      
      menu.querySelector('#importFile').addEventListener('change', (e) => {
        this.importData(e.target.files[0]);
        menu.remove();
      });
    }
    
    // ============================================
    // EXPORT FUNCTIONS
    // ============================================
    async exportSettings() {
      try {
        const settings = await this.getAllSettings();
        const data = {
          type: 'settings',
          version: '2.0.0',
          exportDate: new Date().toISOString(),
          data: settings
        };
        
        this.downloadJSON(data, `creatio-settings-${Date.now()}.json`);
        this.showToast('success', 'Exported', 'Settings exported successfully');
      } catch (error) {
        this.showToast('error', 'Export Failed', error.message);
      }
    }
    
    async exportNotifications() {
      try {
        const response = await this.sendMessage({ action: 'getNotifications' });
        
        const data = {
          type: 'notifications',
          version: '2.0.0',
          exportDate: new Date().toISOString(),
          count: response.notifications?.length || 0,
          data: response.notifications || []
        };
        
        this.downloadJSON(data, `creatio-notifications-${Date.now()}.json`);
        this.showToast('success', 'Exported', `${data.count} notifications exported`);
      } catch (error) {
        this.showToast('error', 'Export Failed', error.message);
      }
    }
    
    async exportAll() {
      try {
        const settings = await this.getAllSettings();
        const response = await this.sendMessage({ action: 'getNotifications' });
        const stats = await this.sendMessage({ action: 'getStatistics' });
        
        const data = {
          type: 'complete',
          version: '2.0.0',
          exportDate: new Date().toISOString(),
          settings: settings,
          notifications: response.notifications || [],
          statistics: stats.statistics || {}
        };
        
        this.downloadJSON(data, `creatio-backup-${Date.now()}.json`);
        this.showToast('success', 'Exported', 'Complete backup created');
      } catch (error) {
        this.showToast('error', 'Export Failed', error.message);
      }
    }
    
    // ============================================
    // IMPORT FUNCTIONS
    // ============================================
    async importData(file) {
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate
        if (!data.version || !data.type) {
          throw new Error('Invalid backup file format');
        }
        
        // Import based on type
        switch (data.type) {
          case 'settings':
            await this.importSettings(data.data);
            break;
          case 'notifications':
            await this.importNotifications(data.data);
            break;
          case 'complete':
            await this.importSettings(data.settings);
            await this.importNotifications(data.notifications);
            break;
          default:
            throw new Error('Unknown backup type');
        }
        
        this.showToast('success', 'Imported', 'Data restored successfully');
        
        // Reload extension
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } catch (error) {
        this.showToast('error', 'Import Failed', error.message);
      }
    }
    
    async importSettings(settings) {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            // Notify background
            chrome.runtime.sendMessage({
              action: 'settingsUpdated',
              settings: settings
            });
            resolve();
          }
        });
      });
    }
    
    async importNotifications(notifications) {
      // This would need to sync with server
      // For now, just log
      console.log('[DataManager] Would import', notifications.length, 'notifications');
      // In real implementation, would use API to create notifications
    }
    
    // ============================================
    // CONTEXT MENU (Right-click actions)
    // ============================================
    setupContextMenu() {
      // Add context menu on notification cards
      document.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.notification-card');
        if (!card) return;
        
        e.preventDefault();
        this.showContextMenu(e.pageX, e.pageY, card);
      });
    }
    
    showContextMenu(x, y, card) {
      // Remove existing menu
      document.querySelectorAll('.context-menu').forEach(m => m.remove());
      
      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      
      const notificationId = card.dataset.notificationId;
      const isUnread = card.classList.contains('unread');
      
      menu.innerHTML = `
        <div class="context-menu-item" data-action="open">
          <svg viewBox="0 0 24 24"><path d="M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3"/></svg>
          Open
        </div>
        ${isUnread ? `
          <div class="context-menu-item" data-action="markRead">
            <svg viewBox="0 0 24 24"><path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/></svg>
            Mark as Read
          </div>
        ` : ''}
        <div class="context-menu-item" data-action="copy">
          <svg viewBox="0 0 24 24"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>
          Copy Text
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="delete">
          <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
          Delete
        </div>
      `;
      
      document.body.appendChild(menu);
      this.injectContextMenuStyles();
      
      // Event listeners
      menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          this.handleContextAction(action, card);
          menu.remove();
        });
      });
      
      // Close on click outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      
      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 10);
    }
    
    handleContextAction(action, card) {
      switch (action) {
        case 'open':
          const openBtn = card.querySelector('[data-action="open"]');
          openBtn?.click();
          break;
        
        case 'markRead':
          const markBtn = card.querySelector('[data-action="markRead"]');
          markBtn?.click();
          break;
        
        case 'copy':
          const title = card.querySelector('.notification-title')?.textContent || '';
          const message = card.querySelector('.notification-message')?.textContent || '';
          navigator.clipboard.writeText(`${title}\n\n${message}`);
          this.showToast('success', 'Copied', 'Text copied to clipboard');
          break;
        
        case 'delete':
          const deleteBtn = card.querySelector('[data-action="delete"]');
          deleteBtn?.click();
          break;
      }
    }
    
    // ============================================
    // HELPERS
    // ============================================
    async getAllSettings() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(null, (items) => {
          resolve(items);
        });
      });
    }
    
    downloadJSON(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    sendMessage(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || {});
          }
        });
      });
    }
    
    showToast(type, title, message) {
      if (typeof window.showToast === 'function') {
        window.showToast(type, title, message);
      } else {
        console.log(`[${type}] ${title}: ${message}`);
      }
    }
    
    // ============================================
    // STYLES
    // ============================================
    injectExportStyles() {
      if (document.getElementById('export-menu-styles')) return;
      
      const styles = document.createElement('style');
      styles.id = 'export-menu-styles';
      styles.textContent = `
        .export-menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        
        .export-menu {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .export-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .export-menu-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
        }
        
        .close-export-menu {
          width: 32px;
          height: 32px;
          background: #f5f7fa;
          border: none;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .close-export-menu:hover {
          background: #e2e8f0;
          transform: rotate(90deg);
        }
        
        .export-menu-body {
          padding: 24px;
        }
        
        .export-section, .import-section {
          margin-bottom: 24px;
        }
        
        .export-section h4, .import-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        
        .export-option, .import-option {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          padding: 16px;
          background: #f5f7fa;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .export-option:hover, .import-option:hover {
          background: #e8edf3;
          border-color: #cbd5e0;
          transform: translateX(4px);
        }
        
        .export-option svg, .import-option svg {
          width: 24px;
          height: 24px;
          fill: #1976d2;
          flex-shrink: 0;
        }
        
        .export-option div, .import-option div {
          flex: 1;
          text-align: left;
        }
        
        .export-option strong, .import-option strong {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 2px;
        }
        
        .export-option p, .import-option p {
          font-size: 13px;
          color: #718096;
        }
      `;
      
      document.head.appendChild(styles);
    }
    
    injectContextMenuStyles() {
      if (document.getElementById('context-menu-styles')) return;
      
      const styles = document.createElement('style');
      styles.id = 'context-menu-styles';
      styles.textContent = `
        .context-menu {
          position: fixed;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          padding: 4px 0;
          z-index: 10000;
          min-width: 180px;
          animation: fadeIn 0.15s;
        }
        
        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          font-size: 14px;
          color: #1a202c;
          cursor: pointer;
          transition: background 0.15s;
        }
        
        .context-menu-item:hover {
          background: #f5f7fa;
        }
        
        .context-menu-item.danger {
          color: #e53935;
        }
        
        .context-menu-item.danger:hover {
          background: #ffebee;
        }
        
        .context-menu-item svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }
        
        .context-menu-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 4px 0;
        }
      `;
      
      document.head.appendChild(styles);
    }
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.dataManager = new DataManager();
    });
  } else {
    window.dataManager = new DataManager();
  }
  
  console.log('[DataManager] ✅ Module loaded');