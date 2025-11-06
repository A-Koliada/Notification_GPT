// ============================================
// KEYBOARD SHORTCUTS MODULE
// Add this to popup.js
// Version: 2.0.0
// ============================================

class KeyboardShortcuts {
    constructor() {
      this.shortcuts = {
        // Navigation
        'ArrowDown': () => this.navigateDown(),
        'ArrowUp': () => this.navigateUp(),
        'Enter': () => this.openSelected(),
        'Escape': () => this.clearSelection(),
        
        // Actions
        'r': () => this.markSelectedAsRead(),
        'Delete': () => this.deleteSelected(),
        'Backspace': () => this.deleteSelected(),
        
        // Tabs
        '1': () => this.switchTab('all'),
        '2': () => this.switchTab('unread'),
        '3': () => this.switchTab('visa'),
        
        // Search
        '/': (e) => this.focusSearch(e),
        'f': (e) => this.focusSearch(e),
        
        // Other
        's': () => this.triggerSync(),
        'a': () => this.markAllAsRead(),
        '?': () => this.showHelp()
      };
      
      this.selectedIndex = -1;
      this.isSearchFocused = false;
      
      this.init();
    }
    
    init() {
      document.addEventListener('keydown', (e) => this.handleKeyDown(e));
      
      // Track search focus
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('focus', () => {
          this.isSearchFocused = true;
        });
        searchInput.addEventListener('blur', () => {
          this.isSearchFocused = false;
        });
      }
      
      console.log('[Shortcuts] ✅ Initialized');
    }
    
    handleKeyDown(e) {
      // Don't trigger shortcuts when typing in input fields
      if (this.isSearchFocused && !['Escape', 'Enter'].includes(e.key)) {
        return;
      }
      
      // Check if shortcut exists
      const handler = this.shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    }
    
    // ============================================
    // NAVIGATION
    // ============================================
    navigateDown() {
      const cards = Array.from(document.querySelectorAll('.notification-card'));
      if (cards.length === 0) return;
      
      this.selectedIndex = Math.min(this.selectedIndex + 1, cards.length - 1);
      this.updateSelection(cards);
    }
    
    navigateUp() {
      const cards = Array.from(document.querySelectorAll('.notification-card'));
      if (cards.length === 0) return;
      
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelection(cards);
    }
    
    updateSelection(cards) {
      // Remove previous selection
      cards.forEach(card => card.classList.remove('keyboard-selected'));
      
      // Add new selection
      if (this.selectedIndex >= 0 && this.selectedIndex < cards.length) {
        const selected = cards[this.selectedIndex];
        selected.classList.add('keyboard-selected');
        selected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    
    clearSelection() {
      this.selectedIndex = -1;
      document.querySelectorAll('.notification-card').forEach(card => {
        card.classList.remove('keyboard-selected');
      });
      
      // Also clear search if focused
      const searchInput = document.getElementById('searchInput');
      if (this.isSearchFocused && searchInput) {
        searchInput.blur();
      }
    }
    
    openSelected() {
      const cards = Array.from(document.querySelectorAll('.notification-card'));
      if (this.selectedIndex >= 0 && this.selectedIndex < cards.length) {
        const selected = cards[this.selectedIndex];
        const openBtn = selected.querySelector('[data-action="open"]');
        if (openBtn) {
          openBtn.click();
        }
      }
    }
    
    // ============================================
    // ACTIONS
    // ============================================
    markSelectedAsRead() {
      const cards = Array.from(document.querySelectorAll('.notification-card'));
      if (this.selectedIndex >= 0 && this.selectedIndex < cards.length) {
        const selected = cards[this.selectedIndex];
        const markReadBtn = selected.querySelector('[data-action="markRead"]');
        if (markReadBtn) {
          markReadBtn.click();
        }
      }
    }
    
    deleteSelected() {
      const cards = Array.from(document.querySelectorAll('.notification-card'));
      if (this.selectedIndex >= 0 && this.selectedIndex < cards.length) {
        const selected = cards[this.selectedIndex];
        const deleteBtn = selected.querySelector('[data-action="delete"]');
        if (deleteBtn) {
          deleteBtn.click();
          // Adjust selection after delete
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        }
      }
    }
    
    markAllAsRead() {
      const markAllBtn = document.getElementById('markAllReadBtn');
      if (markAllBtn && !markAllBtn.disabled) {
        markAllBtn.click();
      }
    }
    
    // ============================================
    // TABS
    // ============================================
    switchTab(tabName) {
      const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
      if (tab) {
        tab.click();
        this.clearSelection();
      }
    }
    
    // ============================================
    // SEARCH
    // ============================================
    focusSearch(e) {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
      }
    }
    
    // ============================================
    // OTHER
    // ============================================
    triggerSync() {
      const syncBtn = document.getElementById('syncBtn');
      if (syncBtn) {
        syncBtn.click();
      }
    }
    
    showHelp() {
      const helpHtml = `
        <div class="shortcuts-help-overlay" id="shortcutsHelp">
          <div class="shortcuts-help-modal">
            <div class="shortcuts-help-header">
              <h2>⌨️ Keyboard Shortcuts</h2>
              <button class="close-help-btn" onclick="document.getElementById('shortcutsHelp').remove()">
                <svg viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div class="shortcuts-help-content">
              <div class="shortcut-section">
                <h3>Navigation</h3>
                <div class="shortcut-item">
                  <kbd>↓</kbd> <span>Navigate down</span>
                </div>
                <div class="shortcut-item">
                  <kbd>↑</kbd> <span>Navigate up</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Enter</kbd> <span>Open selected</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Esc</kbd> <span>Clear selection</span>
                </div>
              </div>
              
              <div class="shortcut-section">
                <h3>Actions</h3>
                <div class="shortcut-item">
                  <kbd>R</kbd> <span>Mark as read</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Del</kbd> <span>Delete</span>
                </div>
                <div class="shortcut-item">
                  <kbd>A</kbd> <span>Mark all as read</span>
                </div>
                <div class="shortcut-item">
                  <kbd>S</kbd> <span>Sync now</span>
                </div>
              </div>
              
              <div class="shortcut-section">
                <h3>Tabs</h3>
                <div class="shortcut-item">
                  <kbd>1</kbd> <span>All notifications</span>
                </div>
                <div class="shortcut-item">
                  <kbd>2</kbd> <span>Unread</span>
                </div>
                <div class="shortcut-item">
                  <kbd>3</kbd> <span>Visa</span>
                </div>
              </div>
              
              <div class="shortcut-section">
                <h3>Search</h3>
                <div class="shortcut-item">
                  <kbd>/</kbd> or <kbd>F</kbd> <span>Focus search</span>
                </div>
              </div>
              
              <div class="shortcut-section">
                <h3>Help</h3>
                <div class="shortcut-item">
                  <kbd>?</kbd> <span>Show this help</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Remove existing help if any
      const existing = document.getElementById('shortcutsHelp');
      if (existing) {
        existing.remove();
      }
      
      // Add to body
      document.body.insertAdjacentHTML('beforeend', helpHtml);
      
      // Add CSS dynamically
      if (!document.getElementById('shortcuts-help-styles')) {
        const styles = document.createElement('style');
        styles.id = 'shortcuts-help-styles';
        styles.textContent = `
          .shortcuts-help-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s;
          }
          
          .shortcuts-help-modal {
            background: white;
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          
          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
          
          .shortcuts-help-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .shortcuts-help-header h2 {
            font-size: 20px;
            font-weight: 600;
            color: #1a202c;
          }
          
          .close-help-btn {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fa;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .close-help-btn:hover {
            background: #e2e8f0;
            transform: rotate(90deg);
          }
          
          .close-help-btn svg {
            width: 16px;
            height: 16px;
            fill: #4a5568;
          }
          
          .shortcuts-help-content {
            padding: 24px;
            max-height: calc(80vh - 100px);
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
          }
          
          .shortcut-section h3 {
            font-size: 14px;
            font-weight: 600;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
          }
          
          .shortcut-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            font-size: 14px;
            color: #4a5568;
          }
          
          .shortcut-item kbd {
            min-width: 32px;
            padding: 4px 8px;
            background: #f5f7fa;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            font-weight: 600;
            color: #1a202c;
            text-align: center;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          
          .notification-card.keyboard-selected {
            outline: 3px solid #1976d2;
            outline-offset: -3px;
            background: #e3f2fd;
          }
        `;
        document.head.appendChild(styles);
      }
      
      // Close on overlay click
      document.getElementById('shortcutsHelp').addEventListener('click', (e) => {
        if (e.target.classList.contains('shortcuts-help-overlay')) {
          e.target.remove();
        }
      });
      
      // Close on Escape
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          document.getElementById('shortcutsHelp')?.remove();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.keyboardShortcuts = new KeyboardShortcuts();
    });
  } else {
    window.keyboardShortcuts = new KeyboardShortcuts();
  }
  
  console.log('[Shortcuts] ✅ Module loaded');