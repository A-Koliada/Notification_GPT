// ============================================
// ADVANCED SEARCH MODULE
// Add this to popup.js or load separately
// Version: 2.0.0
// ============================================

class AdvancedSearch {
    constructor() {
      this.filters = {
        dateRange: 'all', // all, today, week, month
        types: [], // empty = all
        status: 'all', // all, read, unread
        priority: 'all', // all, high, medium, low
        sortBy: 'date', // date, type, status
        sortOrder: 'desc' // asc, desc
      };
      
      this.savedSearches = [];
      this.init();
    }
    
    init() {
      this.loadSavedSearches();
      this.createUI();
      console.log('[AdvancedSearch] ✅ Initialized');
    }
    
    // ============================================
    // UI CREATION
    // ============================================
    createUI() {
      // Add advanced search button to popup
      const searchBox = document.querySelector('.search-box');
      if (!searchBox) return;
      
      const advancedBtn = document.createElement('button');
      advancedBtn.className = 'advanced-search-btn';
      advancedBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;">
          <path d="M14,12V19.88C14.04,20.18 13.94,20.5 13.71,20.71C13.32,21.1 12.69,21.1 12.3,20.71L10.29,18.7C10.06,18.47 9.96,18.16 10,17.87V12H9.97L4.21,4.62C3.87,4.19 3.95,3.56 4.38,3.22C4.57,3.08 4.78,3 5,3V3H19V3C19.22,3 19.43,3.08 19.62,3.22C20.05,3.56 20.13,4.19 19.79,4.62L14.03,12H14Z"/>
        </svg>
      `;
      advancedBtn.title = 'Advanced Search';
      advancedBtn.style.cssText = `
        position: absolute;
        right: 40px;
        top: 50%;
        transform: translateY(-50%);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        color: #718096;
        transition: all 0.2s;
      `;
      
      advancedBtn.addEventListener('mouseenter', () => {
        advancedBtn.style.background = '#f5f7fa';
        advancedBtn.style.color = '#1976d2';
      });
      
      advancedBtn.addEventListener('mouseleave', () => {
        advancedBtn.style.background = 'transparent';
        advancedBtn.style.color = '#718096';
      });
      
      advancedBtn.addEventListener('click', () => this.showAdvancedPanel());
      
      searchBox.appendChild(advancedBtn);
    }
    
    showAdvancedPanel() {
      // Create modal
      const modal = document.createElement('div');
      modal.className = 'advanced-search-modal';
      modal.innerHTML = `
        <div class="advanced-search-content">
          <div class="advanced-search-header">
            <h2>🔍 Advanced Search</h2>
            <button class="close-advanced-btn">
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          
          <div class="advanced-search-body">
            <!-- Date Range -->
            <div class="filter-group">
              <label class="filter-label">Date Range</label>
              <div class="filter-options">
                <button class="filter-option ${this.filters.dateRange === 'all' ? 'active' : ''}" data-filter="dateRange" data-value="all">All Time</button>
                <button class="filter-option ${this.filters.dateRange === 'today' ? 'active' : ''}" data-filter="dateRange" data-value="today">Today</button>
                <button class="filter-option ${this.filters.dateRange === 'week' ? 'active' : ''}" data-filter="dateRange" data-value="week">This Week</button>
                <button class="filter-option ${this.filters.dateRange === 'month' ? 'active' : ''}" data-filter="dateRange" data-value="month">This Month</button>
              </div>
            </div>
            
            <!-- Status -->
            <div class="filter-group">
              <label class="filter-label">Status</label>
              <div class="filter-options">
                <button class="filter-option ${this.filters.status === 'all' ? 'active' : ''}" data-filter="status" data-value="all">All</button>
                <button class="filter-option ${this.filters.status === 'unread' ? 'active' : ''}" data-filter="status" data-value="unread">Unread</button>
                <button class="filter-option ${this.filters.status === 'read' ? 'active' : ''}" data-filter="status" data-value="read">Read</button>
              </div>
            </div>
            
            <!-- Type -->
            <div class="filter-group">
              <label class="filter-label">Type</label>
              <div class="filter-checkboxes">
                <label class="filter-checkbox">
                  <input type="checkbox" value="Reminder" ${this.filters.types.includes('Reminder') ? 'checked' : ''}>
                  <span>Reminder</span>
                </label>
                <label class="filter-checkbox">
                  <input type="checkbox" value="Visa" ${this.filters.types.includes('Visa') ? 'checked' : ''}>
                  <span>Visa</span>
                </label>
                <label class="filter-checkbox">
                  <input type="checkbox" value="Email" ${this.filters.types.includes('Email') ? 'checked' : ''}>
                  <span>Email</span>
                </label>
                <label class="filter-checkbox">
                  <input type="checkbox" value="System" ${this.filters.types.includes('System') ? 'checked' : ''}>
                  <span>System</span>
                </label>
              </div>
            </div>
            
            <!-- Sort -->
            <div class="filter-group">
              <label class="filter-label">Sort By</label>
              <div class="filter-sort">
                <select class="sort-select" data-filter="sortBy">
                  <option value="date" ${this.filters.sortBy === 'date' ? 'selected' : ''}>Date</option>
                  <option value="type" ${this.filters.sortBy === 'type' ? 'selected' : ''}>Type</option>
                  <option value="status" ${this.filters.sortBy === 'status' ? 'selected' : ''}>Status</option>
                </select>
                <button class="sort-order-btn" data-filter="sortOrder">
                  <svg viewBox="0 0 24 24" style="transform: ${this.filters.sortOrder === 'desc' ? 'rotate(0deg)' : 'rotate(180deg)'}">
                    <path d="M7,10L12,15L17,10H7Z"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Saved Searches -->
            ${this.savedSearches.length > 0 ? `
              <div class="filter-group">
                <label class="filter-label">Saved Searches</label>
                <div class="saved-searches">
                  ${this.savedSearches.map((search, i) => `
                    <button class="saved-search-item" data-index="${i}">
                      <span>${search.name}</span>
                      <button class="delete-saved-search" data-index="${i}">×</button>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
          
          <div class="advanced-search-footer">
            <button class="btn-secondary" id="resetFiltersBtn">Reset</button>
            <button class="btn-secondary" id="saveSearchBtn">Save Search</button>
            <button class="btn-primary" id="applyFiltersBtn">Apply Filters</button>
          </div>
        </div>
      `;
      
      // Add styles
      this.injectStyles();
      
      // Add to body
      document.body.appendChild(modal);
      
      // Add event listeners
      this.setupModalListeners(modal);
    }
    
    setupModalListeners(modal) {
      // Close button
      modal.querySelector('.close-advanced-btn').addEventListener('click', () => {
        modal.remove();
      });
      
      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
      // Filter options
      modal.querySelectorAll('.filter-option').forEach(btn => {
        btn.addEventListener('click', () => {
          const filter = btn.dataset.filter;
          const value = btn.dataset.value;
          
          // Update active state
          modal.querySelectorAll(`[data-filter="${filter}"]`).forEach(b => {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          
          // Update filter
          this.filters[filter] = value;
        });
      });
      
      // Checkboxes
      modal.querySelectorAll('.filter-checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const type = checkbox.value;
          if (checkbox.checked) {
            if (!this.filters.types.includes(type)) {
              this.filters.types.push(type);
            }
          } else {
            this.filters.types = this.filters.types.filter(t => t !== type);
          }
        });
      });
      
      // Sort select
      modal.querySelector('[data-filter="sortBy"]').addEventListener('change', (e) => {
        this.filters.sortBy = e.target.value;
      });
      
      // Sort order
      modal.querySelector('[data-filter="sortOrder"]').addEventListener('click', (e) => {
        this.filters.sortOrder = this.filters.sortOrder === 'asc' ? 'desc' : 'asc';
        const svg = e.currentTarget.querySelector('svg');
        svg.style.transform = this.filters.sortOrder === 'desc' ? 'rotate(0deg)' : 'rotate(180deg)';
      });
      
      // Apply button
      modal.querySelector('#applyFiltersBtn').addEventListener('click', () => {
        this.applyFilters();
        modal.remove();
      });
      
      // Reset button
      modal.querySelector('#resetFiltersBtn').addEventListener('click', () => {
        this.resetFilters();
        modal.remove();
      });
      
      // Save search button
      modal.querySelector('#saveSearchBtn').addEventListener('click', () => {
        this.saveCurrentSearch();
      });
      
      // Saved searches
      modal.querySelectorAll('.saved-search-item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.dataset.index);
          this.loadSavedSearch(index);
          modal.remove();
        });
      });
      
      modal.querySelectorAll('.delete-saved-search').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index);
          this.deleteSavedSearch(index);
          modal.remove();
          this.showAdvancedPanel(); // Reopen to refresh
        });
      });
    }
    
    // ============================================
    // FILTER APPLICATION
    // ============================================
    applyFilters() {
      // Get current notifications from state
      const allNotifications = window.state?.notifications || [];
      
      let filtered = [...allNotifications];
      
      // Date Range
      if (this.filters.dateRange !== 'all') {
        const now = new Date();
        let cutoff;
        
        switch (this.filters.dateRange) {
          case 'today':
            cutoff = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            cutoff = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'month':
            cutoff = new Date(now.setMonth(now.getMonth() - 1));
            break;
        }
        
        filtered = filtered.filter(n => new Date(n.date) >= cutoff);
      }
      
      // Status
      if (this.filters.status !== 'all') {
        filtered = filtered.filter(n => {
          if (this.filters.status === 'read') return n.isRead;
          if (this.filters.status === 'unread') return !n.isRead;
          return true;
        });
      }
      
      // Type
      if (this.filters.types.length > 0) {
        filtered = filtered.filter(n => this.filters.types.includes(n.type));
      }
      
      // Sort
      filtered.sort((a, b) => {
        let aVal, bVal;
        
        switch (this.filters.sortBy) {
          case 'date':
            aVal = new Date(a.date);
            bVal = new Date(b.date);
            break;
          case 'type':
            aVal = a.type;
            bVal = b.type;
            break;
          case 'status':
            aVal = a.isRead ? 1 : 0;
            bVal = b.isRead ? 1 : 0;
            break;
        }
        
        if (this.filters.sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      // Update global state
      if (window.state) {
        window.state.filteredNotifications = filtered;
        
        // Trigger re-render if function exists
        if (typeof window.renderNotifications === 'function') {
          window.renderNotifications();
        }
      }
      
      // Show toast
      this.showToast('success', 'Filters Applied', `${filtered.length} notifications found`);
    }
    
    resetFilters() {
      this.filters = {
        dateRange: 'all',
        types: [],
        status: 'all',
        priority: 'all',
        sortBy: 'date',
        sortOrder: 'desc'
      };
      
      this.applyFilters();
      this.showToast('info', 'Filters Reset', 'All filters cleared');
    }
    
    // ============================================
    // SAVED SEARCHES
    // ============================================
    saveCurrentSearch() {
      const name = prompt('Enter a name for this search:');
      if (!name) return;
      
      this.savedSearches.push({
        name: name,
        filters: { ...this.filters }
      });
      
      this.saveSavedSearches();
      this.showToast('success', 'Saved', `Search "${name}" saved`);
    }
    
    loadSavedSearch(index) {
      const search = this.savedSearches[index];
      if (!search) return;
      
      this.filters = { ...search.filters };
      this.applyFilters();
      this.showToast('info', 'Loaded', `Applied search "${search.name}"`);
    }
    
    deleteSavedSearch(index) {
      const search = this.savedSearches[index];
      this.savedSearches.splice(index, 1);
      this.saveSavedSearches();
      this.showToast('info', 'Deleted', `Removed search "${search.name}"`);
    }
    
    loadSavedSearches() {
      const saved = localStorage.getItem('creatioSavedSearches');
      if (saved) {
        try {
          this.savedSearches = JSON.parse(saved);
        } catch (e) {
          this.savedSearches = [];
        }
      }
    }
    
    saveSavedSearches() {
      localStorage.setItem('creatioSavedSearches', JSON.stringify(this.savedSearches));
    }
    
    // ============================================
    // STYLES
    // ============================================
    injectStyles() {
      if (document.getElementById('advanced-search-styles')) return;
      
      const styles = document.createElement('style');
      styles.id = 'advanced-search-styles';
      styles.textContent = `
        .advanced-search-modal {
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
        
        .advanced-search-content {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .advanced-search-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .advanced-search-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
        }
        
        .close-advanced-btn {
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
        
        .close-advanced-btn:hover {
          background: #e2e8f0;
          transform: rotate(90deg);
        }
        
        .close-advanced-btn svg {
          width: 16px;
          height: 16px;
          fill: #4a5568;
        }
        
        .advanced-search-body {
          padding: 24px;
          max-height: calc(80vh - 140px);
          overflow-y: auto;
        }
        
        .filter-group {
          margin-bottom: 24px;
        }
        
        .filter-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        
        .filter-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .filter-option {
          padding: 8px 16px;
          background: #f5f7fa;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .filter-option:hover {
          background: #e8edf3;
          border-color: #cbd5e0;
        }
        
        .filter-option.active {
          background: #1976d2;
          border-color: #1976d2;
          color: white;
        }
        
        .filter-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f5f7fa;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .filter-checkbox:hover {
          background: #e8edf3;
        }
        
        .filter-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .filter-sort {
          display: flex;
          gap: 8px;
        }
        
        .sort-select {
          flex: 1;
          padding: 10px;
          background: #f5f7fa;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #1a202c;
          cursor: pointer;
        }
        
        .sort-order-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f7fa;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .sort-order-btn:hover {
          background: #e8edf3;
        }
        
        .sort-order-btn svg {
          width: 20px;
          height: 20px;
          fill: #4a5568;
          transition: transform 0.3s;
        }
        
        .saved-searches {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .saved-search-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          background: #f5f7fa;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .saved-search-item:hover {
          background: #e8edf3;
        }
        
        .delete-saved-search {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 50%;
          font-size: 20px;
          color: #e53935;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .delete-saved-search:hover {
          background: #ffebee;
        }
        
        .advanced-search-footer {
          display: flex;
          gap: 8px;
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
        }
        
        .advanced-search-footer .btn-primary,
        .advanced-search-footer .btn-secondary {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .advanced-search-footer .btn-primary {
          background: #1976d2;
          color: white;
        }
        
        .advanced-search-footer .btn-primary:hover {
          background: #1565c0;
        }
        
        .advanced-search-footer .btn-secondary {
          background: #f5f7fa;
          color: #4a5568;
        }
        
        .advanced-search-footer .btn-secondary:hover {
          background: #e8edf3;
        }
      `;
      
      document.head.appendChild(styles);
    }
    
    showToast(type, title, message) {
      // Use existing toast system if available
      if (typeof window.showToast === 'function') {
        window.showToast(type, title, message);
      } else {
        console.log(`[${type}] ${title}: ${message}`);
      }
    }
  }
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.advancedSearch = new AdvancedSearch();
    });
  } else {
    window.advancedSearch = new AdvancedSearch();
  }
  
  console.log('[AdvancedSearch] ✅ Module loaded');