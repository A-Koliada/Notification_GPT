// ============================================
// I18N MANAGER
// Централізована система локалізації
// Version: 2.0.0
// ============================================

class I18nManager {
    constructor() {
      this.currentLanguage = 'en';
      this.defaultLanguage = 'en';
      this.translations = {};
      this.dateFormatters = {};
      this.numberFormatters = {};
      
      // Supported languages
      this.languages = {
        en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
        uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
        pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
        ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' }
      };
      
      this.init();
    }
    
    async init() {
      console.log('[I18n] 🌐 Initializing...');
      
      // Load saved language
      await this.loadLanguagePreference();
      
      // Load all translation files
      await this.loadTranslations();
      
      // Setup formatters
      this.setupFormatters();
      
      // Apply translations to current page
      this.translatePage();
      
      console.log('[I18n] ✅ Initialized with language:', this.currentLanguage);
    }
    
    // ============================================
    // LANGUAGE MANAGEMENT
    // ============================================
    async loadLanguagePreference() {
      return new Promise((resolve) => {
        chrome.storage.sync.get({ language: 'en' }, (items) => {
          this.currentLanguage = items.language;
          resolve();
        });
      });
    }
    
    async setLanguage(languageCode) {
      if (!this.languages[languageCode]) {
        console.warn('[I18n] Language not supported:', languageCode);
        return false;
      }
      
      this.currentLanguage = languageCode;
      
      // Save to storage
      await new Promise((resolve) => {
        chrome.storage.sync.set({ language: languageCode }, resolve);
      });
      
      // Notify background
      chrome.runtime.sendMessage({
        action: 'languageChanged',
        language: languageCode
      }).catch(() => {
        // Background might not be ready
      });
      
      // Update formatters
      this.setupFormatters();
      
      // Re-translate page
      this.translatePage();
      
      console.log('[I18n] Language changed to:', languageCode);
      return true;
    }
    
    getCurrentLanguage() {
      return this.currentLanguage;
    }
    
    getSupportedLanguages() {
      return this.languages;
    }
    
    // ============================================
    // TRANSLATIONS LOADING
    // ============================================
    async loadTranslations() {
      // Load all language files
      for (const lang of Object.keys(this.languages)) {
        try {
          const response = await fetch(`i18n/locales/${lang}.json`);
          this.translations[lang] = await response.json();
          console.log(`[I18n] ✅ Loaded ${lang} translations`);
        } catch (error) {
          console.warn(`[I18n] ⚠️ Failed to load ${lang}:`, error);
          
          // Use default for missing languages
          if (lang !== this.defaultLanguage) {
            this.translations[lang] = this.translations[this.defaultLanguage] || {};
          }
        }
      }
    }
    
    // ============================================
    // TRANSLATION METHODS
    // ============================================
    t(key, params = {}) {
      const translation = this.translations[this.currentLanguage];
      
      if (!translation) {
        console.warn('[I18n] No translations for:', this.currentLanguage);
        return key;
      }
      
      // Support nested keys: "common.save"
      let value = this.getNestedValue(translation, key);
      
      // Fallback to default language
      if (!value && this.currentLanguage !== this.defaultLanguage) {
        value = this.getNestedValue(this.translations[this.defaultLanguage], key);
      }
      
      // Fallback to key itself
      if (!value) {
        console.warn('[I18n] Missing translation:', key);
        return key;
      }
      
      // Replace parameters
      return this.interpolate(value, params);
    }
    
    getNestedValue(obj, path) {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    interpolate(template, params) {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return params[key] !== undefined ? params[key] : match;
      });
    }
    
    // Alias for shorter syntax
    _(key, params) {
      return this.t(key, params);
    }
    
    // ============================================
    // PAGE TRANSLATION
    // ============================================
    translatePage() {
      // Translate elements with data-i18n attribute
      document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = this.t(key);
      });
      
      // Translate placeholders
      document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = this.t(key);
      });
      
      // Translate titles
      document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = this.t(key);
      });
      
      // Translate aria-labels
      document.querySelectorAll('[data-i18n-aria]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        element.setAttribute('aria-label', this.t(key));
      });
      
      // Update HTML lang attribute
      document.documentElement.lang = this.currentLanguage;
      
      console.log('[I18n] Page translated to:', this.currentLanguage);
    }
    
    // ============================================
    // DATE/TIME FORMATTING
    // ============================================
    setupFormatters() {
      // Date formatters
      this.dateFormatters = {
        short: new Intl.DateTimeFormat(this.currentLanguage, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        long: new Intl.DateTimeFormat(this.currentLanguage, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        }),
        time: new Intl.DateTimeFormat(this.currentLanguage, {
          hour: '2-digit',
          minute: '2-digit'
        }),
        datetime: new Intl.DateTimeFormat(this.currentLanguage, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      
      // Number formatters
      this.numberFormatters = {
        decimal: new Intl.NumberFormat(this.currentLanguage, {
          style: 'decimal'
        }),
        percent: new Intl.NumberFormat(this.currentLanguage, {
          style: 'percent'
        }),
        currency: new Intl.NumberFormat(this.currentLanguage, {
          style: 'currency',
          currency: this.getCurrencyForLocale()
        })
      };
    }
    
    formatDate(date, format = 'short') {
      const dateObj = date instanceof Date ? date : new Date(date);
      const formatter = this.dateFormatters[format];
      
      if (!formatter) {
        console.warn('[I18n] Unknown date format:', format);
        return dateObj.toLocaleDateString();
      }
      
      return formatter.format(dateObj);
    }
    
    formatRelativeTime(date) {
      const dateObj = date instanceof Date ? date : new Date(date);
      const now = new Date();
      const diff = now - dateObj;
      
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (seconds < 60) {
        return this.t('time.justNow');
      } else if (minutes < 60) {
        return this.t('time.minutesAgo', { count: minutes });
      } else if (hours < 24) {
        return this.t('time.hoursAgo', { count: hours });
      } else if (days < 7) {
        return this.t('time.daysAgo', { count: days });
      } else {
        return this.formatDate(dateObj, 'short');
      }
    }
    
    formatNumber(number, format = 'decimal') {
      const formatter = this.numberFormatters[format];
      
      if (!formatter) {
        console.warn('[I18n] Unknown number format:', format);
        return number.toString();
      }
      
      return formatter.format(number);
    }
    
    getCurrencyForLocale() {
      const currencies = {
        en: 'USD',
        uk: 'UAH',
        pl: 'PLN',
        ru: 'RUB'
      };
      
      return currencies[this.currentLanguage] || 'USD';
    }
    
    // ============================================
    // PLURALIZATION
    // ============================================
    plural(key, count, params = {}) {
      const rules = this.getPluralRules();
      const form = rules.select(count);
      
      const pluralKey = `${key}.${form}`;
      return this.t(pluralKey, { ...params, count });
    }
    
    getPluralRules() {
      return new Intl.PluralRules(this.currentLanguage);
    }
    
    // ============================================
    // LANGUAGE SWITCHER UI
    // ============================================
    createLanguageSwitcher(containerId) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('[I18n] Container not found:', containerId);
        return;
      }
      
      const switcher = document.createElement('div');
      switcher.className = 'language-switcher';
      
      switcher.innerHTML = `
        <select class="language-select" id="languageSelect">
          ${Object.entries(this.languages).map(([code, lang]) => `
            <option value="${code}" ${code === this.currentLanguage ? 'selected' : ''}>
              ${lang.flag} ${lang.nativeName}
            </option>
          `).join('')}
        </select>
      `;
      
      container.appendChild(switcher);
      
      // Event listener
      switcher.querySelector('#languageSelect').addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
      
      // Inject styles
      this.injectSwitcherStyles();
    }
    
    injectSwitcherStyles() {
      if (document.getElementById('language-switcher-styles')) return;
      
      const styles = document.createElement('style');
      styles.id = 'language-switcher-styles';
      styles.textContent = `
        .language-switcher {
          display: inline-block;
        }
        
        .language-select {
          padding: 8px 12px;
          background: var(--bg-secondary, #f5f7fa);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary, #1a202c);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .language-select:hover {
          background: var(--bg-tertiary, #e8edf3);
          border-color: var(--border-hover, #cbd5e0);
        }
        
        .language-select:focus {
          outline: none;
          border-color: var(--primary, #1976d2);
          box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
        }
      `;
      
      document.head.appendChild(styles);
    }
    
    // ============================================
    // UTILITIES
    // ============================================
    isRTL() {
      const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
      return rtlLanguages.includes(this.currentLanguage);
    }
    
    getDirection() {
      return this.isRTL() ? 'rtl' : 'ltr';
    }
    
    applyDirection() {
      document.documentElement.dir = this.getDirection();
    }
  }
  
  // Create singleton instance
  const i18n = new I18nManager();
  
  // Export for use in other modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = i18n;
  } else {
    window.i18n = i18n;
  }
  
  console.log('[I18n] ✅ Manager loaded');