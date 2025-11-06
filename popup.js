// Open Creatio login

// === Type resolver (DnNotificationType) ===
const TYPE_MAP = new Map([
  ["ead36165-7815-45d1-9805-1faa47de504a","Visa"],
  ["337065ba-e6e6-4086-b493-0f6de115bc7a","Reminder"],
  ["7e1bf266-2e6b-49a5-982b-4ae407f3ae26","System"],
  ["8ebcc160-7a78-444b-8904-0a78348a5141","Email"],
  ["ae6c7636-32fd-4548-91a7-1784a28e7f9e","Custom"],
  ["fa41b6a0-eafd-4bb9-a913-aa74000b46f6","ESN"]
]);

function resolveTypeName(n) {
  if (!n) return "Custom";
  const obj = n.Raw || n;

  const fromName = obj.DnNotificationTypeName || obj.NotificationTypeName || obj.TypeName || obj.typeName;
  if (fromName) return String(fromName);

  const t = obj.DnNotificationType || obj.Type || obj.type;
  if (t) {
    if (typeof t === 'string') {
      return t;
    }
    const nm = t.DnName || t.Name || t.name;
    if (nm) return String(nm);
    const idFromObj = String(t.Id || t.id || t.value || "").toLowerCase();
    if (TYPE_MAP.has(idFromObj)) return TYPE_MAP.get(idFromObj);
  }

  const idCandidates = [
    obj.DnNotificationTypeId,
    obj.NotificationTypeId,
    obj.TypeId,
    obj.typeId,
    (obj && obj.DnNotificationTypeId && obj.DnNotificationTypeId.value)
  ].filter(Boolean);

  for (const c of idCandidates) {
    const id = String(c).toLowerCase();
    if (TYPE_MAP.has(id)) return TYPE_MAP.get(id);
  }

  const text = `${obj.DnTitle || ""} ${obj.DnMessage || ""}`;
  if (/visa/i.test(text)) return "Visa";
  if (/reminder/i.test(text)) return "Reminder";
  if (/email/i.test(text)) return "Email";
  if (/\besn\b/i.test(text)) return "ESN";
  if (/system/i.test(text)) return "System";
  return "Custom";
}

async function openCreatioLogin() {
  try {
    const settings = await chrome.storage.sync.get('creatioUrl');
    if (settings.creatioUrl) {
      window.open(settings.creatioUrl, '_blank');
    } else {
      // Переключаємося на вкладку налаштувань
      const settingsTab = document.querySelector('[data-tab="settings"]');
      if (settingsTab) {
        settingsTab.click();
      }
    }
  } catch (error) {
    log('Error opening Creatio:', error);
  }
}function showNoUrlErrorState() {
  if (!elements.container) return;
  
  elements.container.innerHTML = `
    <div class="error-state no-url-error">
      <svg viewBox="0 0 24 24" fill="currentColor" style="width: 48px; height: 48px; margin-bottom: 15px; color: var(--warning-color);">
        <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
      </svg>
      <p class="error-message">${getTranslation('noUrlError')}</p>
      <p class="error-instruction">${getTranslation('noUrlInstruction')}</p>
      <button id="openSettingsBtn" class="primary-btn">${getTranslation('openSettings')}</button>
    </div>
  `;
  
  document.getElementById("openSettingsBtn")?.addEventListener('click', () => {
    const settingsTab = document.querySelector('[data-tab="settings"]');
    if (settingsTab) {
      settingsTab.click();
    }
  });
}

// Check connection status
async function checkConnectionStatus() {
  try {
    const settings = await chrome.storage.sync.get('creatioUrl');
    if (!settings.creatioUrl || !settings.creatioUrl.trim()) {
      state.isConnected = false;
      // Повідомляємо background script про відсутність підключення
      chrome.runtime.sendMessage({ 
        action: "updateAuthStatus", 
        authorized: false 
      }).catch(err => log('Error sending auth status:', err));
    } else {
      // Спробуємо зробити тестовий запит
      try {
        const response = await chrome.runtime.sendMessage({ action: "getNotifications" });
        state.isConnected = response?.success || false;
        
        // Повідомляємо background script про статус підключення
        chrome.runtime.sendMessage({ 
          action: "updateAuthStatus", 
          authorized: state.isConnected 
        }).catch(err => log('Error sending auth status:', err));
      } catch (error) {
        log('Connection check error:', error);
        state.isConnected = false;
        chrome.runtime.sendMessage({ 
          action: "updateAuthStatus", 
          authorized: false 
        }).catch(err => log('Error sending auth status:', err));
      }
    }
  } catch (error) {
    log('Connection status check failed:', error);
    state.isConnected = false;
    chrome.runtime.sendMessage({ 
      action: "updateAuthStatus", 
      authorized: false 
    }).catch(err => log('Error sending auth status:', err));
  }
  
  updateHeaderLogo();
}

// Update header logo based on connection status
function updateHeaderLogo() {
  const headerLogo = document.querySelector('.header .logo');
  if (headerLogo) {
    if (state.isConnected) {
      headerLogo.src = 'images/icon-48.png';
    } else {
      headerLogo.src = 'images/iconoff-48.png';
    }
  }
}// Conditional logging
const isDebug = true;
function log(...args) {
  if (isDebug) console.log('[CreatioNotifier]', ...args);
}

// State management
const state = {
  notifications: [],
  currentLanguage: 'en',
  isLoading: false,
  currentTab: 'notifications',
  rating: 0,
  isConnected: false
};

// DOM Elements
const elements = {
  container: null,
  refreshBtn: null,
  settingsForm: null,
  markAllReadBtn: null,
  notificationsCount: null,
  feedbackForm: null,
  saveMessage: null,
  loadingSpinner: null
};

// Initialize DOM elements after content loads
function initializeElements() {
  elements.container = document.getElementById("notificationsList");
  elements.refreshBtn = document.getElementById("refreshBtn");
  elements.settingsForm = document.getElementById("settingsForm");
  elements.markAllReadBtn = document.getElementById("markAllReadBtn");
  elements.notificationsCount = document.getElementById("notificationsCount");
  elements.feedbackForm = document.getElementById("feedbackForm");
  elements.saveMessage = document.getElementById("saveMessage");
  elements.loadingSpinner = document.getElementById("loadingSpinner");
  
  log('DOM elements initialized:', {
    container: !!elements.container,
    refreshBtn: !!elements.refreshBtn,
    settingsForm: !!elements.settingsForm,
    markAllReadBtn: !!elements.markAllReadBtn,
    notificationsCount: !!elements.notificationsCount,
    feedbackForm: !!elements.feedbackForm,
    saveMessage: !!elements.saveMessage,
    loadingSpinner: !!elements.loadingSpinner
  });
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    log('DOM Content Loaded');
    
    // Initialize DOM elements first
    initializeElements();
    
    await initPopup();
    setupTabFunctionality();
    setupEventListeners();
    loadNotifications();
    
    log('Popup initialization complete');
  } catch (error) {
    log('Initialization error:', error);
    showErrorState();
  }
});

// Initialize popup
async function initPopup() {
  // Load language settings
  const { language = 'en' } = await chrome.storage.sync.get('language');
  state.currentLanguage = language;
  document.documentElement.setAttribute('data-current-language', state.currentLanguage);
  updateLanguageDisplay();
  
  // Apply translations
  updateLocalizedTexts();
  
  // Load settings for forms
  await loadSettingsToForm();
  
  // Check connection (status && update) header logo
  await checkConnectionStatus();
}

// Setup tab functionality
function setupTabFunctionality() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  log('Setting up tabs:', tabButtons.length, 'buttons,', tabContents.length, 'contents');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetTab = button.getAttribute('data-tab');
      log('Tab clicked:', targetTab);
      
      // Remove active class from all (buttons && contents)
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked (button && corresponding) content
      button.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
        state.currentTab = targetTab;
        
        log(`Successfully switched to tab: ${targetTab}`);
        
        // Load specific tab content if needed
        if (targetTab === 'notifications') {
          setTimeout(() => loadNotifications(), 100);
        }
      } else {
        log('Target content not found for tab:', targetTab);
      }
    });
  });
  
  // Set initial active tab
  const initialTab = document.querySelector('.tab-button.active');
  if (initialTab) {
    state.currentTab = initialTab.getAttribute('data-tab');
    log('Initial tab set to:', state.currentTab);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Refresh button
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => {
      log('Manual refresh triggered');
      loadNotifications();
    });
  }

  // Mark all as read
  if (elements.markAllReadBtn) {
    elements.markAllReadBtn.addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({ action: "markAllRead" });
        loadNotifications();
      } catch (error) {
        log('Error marking all as read:', error);
      }
    });
  }

  // Settings form
  if (elements.settingsForm) {
    elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
  }

  // Reset button - використовуємо getElementById замість elements
  const resetBtn = document.getElementById('resetDefaults');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetSettings);
  }

  // Feedback form
  if (elements.feedbackForm) {
    elements.feedbackForm.addEventListener('submit', handleFeedbackSubmit);
  }

  // Star rating
  setupStarRating();

  // Language change listener - додаємо обробку помилок
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === "languageChanged") {
        state.currentLanguage = message.language;
        document.documentElement.setAttribute('data-current-language', state.currentLanguage);
        updateLocalizedTexts();
        updateLanguageDisplay();
        log('Language changed to:', state.currentLanguage);
      }
    } catch (error) {
      log('Error handling runtime message:', error);
    }
    
    // Завжди відправляємо відповідь
    if (sendResponse) {
      sendResponse({ received: true });
    }
  });
}

// Load notifications
async function loadNotifications() {
  if (state.currentTab !== 'notifications') return;
  
  try {
    setLoadingState(true);
    
    // Спочатку перевіряємо чи є URL
    const settings = await chrome.storage.sync.get('creatioUrl');
    if (!settings.creatioUrl || !settings.creatioUrl.trim()) {
      showNoUrlErrorState();
      state.isConnected = false;
      updateHeaderLogo();
      // Повідомляємо background script
      chrome.runtime.sendMessage({ 
        action: "updateAuthStatus", 
        authorized: false 
      }).catch(err => log('Error sending auth status:', err));
      return;
    }
    
    const response = await chrome.runtime.sendMessage({ action: "getNotifications" });
    if (response?.success) {
      state.notifications = response.notifications || [];
      state.isConnected = true;
      updateHeaderLogo();
      // Повідомляємо background script про успішне підключення
      chrome.runtime.sendMessage({ 
        action: "updateAuthStatus", 
        authorized: true 
      }).catch(err => log('Error sending auth status:', err));
      renderNotifications();
      updateNotificationsCount();
    } else {
      // Перевіряємо тип помилки
      if (response?.error && response.error.includes('401')) {
        state.isConnected = false;
        updateHeaderLogo();
        chrome.runtime.sendMessage({ 
          action: "updateAuthStatus", 
          authorized: false 
        }).catch(err => log('Error sending auth status:', err));
        showAuthErrorState();
      } else {
        state.isConnected = false;
        updateHeaderLogo();
        chrome.runtime.sendMessage({ 
          action: "updateAuthStatus", 
          authorized: false 
        }).catch(err => log('Error sending auth status:', err));
        throw new Error(response?.error || 'Unknown error');
      }
    }
  } catch (error) {
    log('Failed to load notifications:', error);
    state.isConnected = false;
    updateHeaderLogo();
    chrome.runtime.sendMessage({ 
      action: "updateAuthStatus", 
      authorized: false 
    }).catch(err => log('Error sending auth status:', err));
    
    // Перевіряємо чи це помилка авторизації
    if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
      showAuthErrorState();
    } else {
      showErrorState();
    }
  } finally {
    setLoadingState(false);
  }
}

// Render notifications
function renderNotifications() {
  if (!elements.container) return;

  if (!state.notifications.length) {
    elements.container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <p data-i18n="noNotifications">${getTranslation('noNotifications')}</p>
      </div>
    `;
    return;
  }

  elements.container.innerHTML = state.notifications.map(notification => `
    <div class="notification-item" data-id="${notification.id}">
      <div class="notification-title">${escapeHtml(notification.title)}</div>
      <div class="notification-message">${escapeHtml(notification.message)}</div>
      <div class="notification-meta">
        <span class="notification-type">${escapeHtml(resolveTypeName(notification))}</span>
        <span class="notification-date">${formatDate(notification.date)}</span>
      </div>
    </div>
  `).join('');

  // Add event listeners to notification items
  document.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', handleNotificationClick);
  });
}

// Handle notification click
function handleNotificationClick(e) {
  const notificationId = e.currentTarget.getAttribute('data-id');
  const notification = state.notifications.find(n => n.id === notificationId);
  
  if (!notification) return;

  // Open URL if available
  if (notification.url) {
    window.open(notification.url, '_blank');
  }
  
  // Mark as read
  chrome.runtime.sendMessage({ 
    action: "markAsRead", 
    id: notification.id 
  }).then(() => {
    loadNotifications();
  }).catch(error => {
    log('Error marking as read:', error);
  });
}

// Load settings to form
async function loadSettingsToForm() {
  try {
    const settings = await chrome.storage.sync.get({
      creatioUrl: "",
      notificationTimeout: 0,
      bringToFrontInterval: 20,
      language: "en"
    });

    if (elements.settingsForm) {
      const form = elements.settingsForm;
      form.querySelector('#creatioUrl').value = settings.creatioUrl;
      form.querySelector('#notificationTimeout').value = settings.notificationTimeout;
      form.querySelector('#bringToFrontInterval').value = settings.bringToFrontInterval;
      form.querySelector('#language').value = settings.language;
    }

    log('Settings loaded to form:', settings);
  } catch (error) {
    log('Error loading settings:', error);
  }
}

// Handle settings submit
async function handleSettingsSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const settings = {
    creatioUrl: formData.get('creatioUrl').trim(),
    notificationTimeout: parseInt(formData.get('notificationTimeout')) || 0,
    bringToFrontInterval: Math.max(5, parseInt(formData.get('bringToFrontInterval')) || 20),
    language: formData.get('language')
  };
  
  const oldLanguage = state.currentLanguage;
  
  try {
    await chrome.storage.sync.set(settings);
    
    // Notify background script
    chrome.runtime.sendMessage({ 
      action: "settingsUpdated", 
      settings: settings 
    }).catch(err => log('Error sending settings update:', err));
    
    // Якщо мова змінилась, оновлюємо інтерфейс
    if (oldLanguage !== settings.language) {
      state.currentLanguage = settings.language;
      document.documentElement.setAttribute('data-current-language', state.currentLanguage);
      
      // Notify about language change
      chrome.runtime.sendMessage({
        action: "languageChanged",
        language: settings.language
      }).catch(err => log('Error sending language change:', err));
      
      // Оновлюємо всі тексти
      updateLocalizedTexts();
    }
    
    showSaveMessage();
    
    // Якщо змінився URL, перевіряємо підключення БЕЗ перезавантаження обробників
    if (settings.creatioUrl) {
      // Використовуємо setTimeout щоб не блокувати UI
      setTimeout(async () => {
        await checkConnectionStatus();
        // Якщо зараз на вкладці notifications, оновлюємо їх
        if (state.currentTab === 'notifications') {
          await loadNotifications();
        }
      }, 100);
    }
    
    log('Settings saved:', settings);
  } catch (error) {
    log('Error saving settings:', error);
  }
}

// Handle reset settings
async function handleResetSettings() {
  const defaultSettings = {
    creatioUrl: "",
    notificationTimeout: 0,
    bringToFrontInterval: 20,
    language: "en"
  };
  
  try {
    await chrome.storage.sync.set(defaultSettings);
    await loadSettingsToForm();
    
    chrome.runtime.sendMessage({ 
      action: "settingsUpdated", 
      settings: defaultSettings 
    });
    
    chrome.runtime.sendMessage({
      action: "languageChanged",
      language: defaultSettings.language
    });
    
    showSaveMessage(getTranslation('resetSuccess'));
    log('Settings reset to defaults');
  } catch (error) {
    log('Error resetting settings:', error);
  }
}

// Setup star rating
function setupStarRating() {
  const stars = document.querySelectorAll('.star');
  
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      state.rating = index + 1;
      updateStarRating();
    });
    
    star.addEventListener('mouseenter', () => {
      highlightStars(index + 1);
    });
  });
  
  document.querySelector('.star-rating')?.addEventListener('mouseleave', () => {
    updateStarRating();
  });
}

// Update star rating
function updateStarRating() {
  const stars = document.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < state.rating) {
      star.textContent = '★';
      star.classList.add('active');
    } else {
      star.textContent = '☆';
      star.classList.remove('active');
    }
  });
}

// Highlight stars on hover
function highlightStars(count) {
  const stars = document.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < count) {
      star.textContent = '★';
    } else {
      star.textContent = '☆';
    }
  });
}

// Handle feedback submit
async function handleFeedbackSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const feedback = {
    rating: state.rating,
    message: formData.get('feedbackMessage'),
    timestamp: new Date().toISOString(),
    version: '1.0.1'
  };
  
  // Here you can implement actual feedback sending
  // For now, just (log && show) success
  log('Feedback submitted:', feedback);
  
  // Reset form
  e.target.reset();
  state.rating = 0;
  updateStarRating();
  
  showSaveMessage(getTranslation('feedbackSent') || 'Feedback sent!');
}

// Helper functions
function setLoadingState(isLoading) {
  state.isLoading = isLoading;
  if (elements.loadingSpinner) {
    elements.loadingSpinner.style.display = isLoading ? 'flex' : 'none';
  }
}

function showErrorState() {
  if (!elements.container) return;
  
  elements.container.innerHTML = `
    <div class="error-state">
      <svg viewBox="0 0 24 24" fill="currentColor" style="width: 48px; height: 48px; margin-bottom: 15px; opacity: 0.5;">
        <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
      </svg>
      <p class="error-message" data-i18n="loadError">${getTranslation('loadError')}</p>
      <ul class="error-checklist">
        <li data-i18n="loadErrorChecklist1">${getTranslation('loadErrorChecklist1')}</li>
        <li data-i18n="loadErrorChecklist2">${getTranslation('loadErrorChecklist2')}</li>
        <li data-i18n="loadErrorChecklist3">${getTranslation('loadErrorChecklist3')}</li>
      </ul>
      <button id="retryBtn" class="retry-button" data-i18n="retryButton">${getTranslation('retryButton')}</button>
    </div>
  `;
  
  document.getElementById("retryBtn")?.addEventListener('click', loadNotifications);
}

function showAuthErrorState() {
  if (!elements.container) return;
  
  elements.container.innerHTML = `
    <div class="error-state auth-error">
      <svg viewBox="0 0 24 24" fill="currentColor" style="width: 48px; height: 48px; margin-bottom: 15px; color: var(--warning-color);">
        <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5C15.4,11.5 16,12.1 16,12.7V16.2C16,16.8 15.4,17.4 14.8,17.4H9.2C8.6,17.4 8,16.8 8,16.2V12.8C8,12.2 8.6,11.6 9.2,11.6V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,9.5V11.5H13.5V9.5C13.5,8.7 12.8,8.2 12,8.2Z"/>
      </svg>
      <p class="error-message">${getTranslation('authError')}</p>
      <p class="auth-instruction">${getTranslation('authInstruction')}</p>
      <div class="auth-actions">
        <button id="openCreatioBtn" class="auth-button primary-btn">${getTranslation('openCreatio')}</button>
        <button id="retryAuthBtn" class="auth-button retry-button">${getTranslation('retryButton')}</button>
      </div>
    </div>
  `;
  
  // Додаємо обробники подій
  document.getElementById("retryAuthBtn")?.addEventListener('click', loadNotifications);
  document.getElementById("openCreatioBtn")?.addEventListener('click', openCreatioLogin);
}

function updateNotificationsCount() {
  if (elements.notificationsCount) {
    elements.notificationsCount.textContent = state.notifications.length;
  }
}

function updateLanguageDisplay() {
  // Update any language-specific UI elements
}

function showSaveMessage(message = null) {
  if (!elements.saveMessage) return;
  
  const text = message || getTranslation('saveSuccess');
  elements.saveMessage.textContent = text;
  elements.saveMessage.style.display = 'block';
  
  setTimeout(() => {
    elements.saveMessage.classList.add('hide');
    setTimeout(() => {
      elements.saveMessage.style.display = 'none';
      elements.saveMessage.classList.remove('hide');
    }, 300);
  }, 2000);
}

// Localization functions
function getTranslation(key) {
  const langData = translations[state.currentLanguage] || translations.en;
  return key.split('.').reduce((obj, k) => obj?.[k], langData) || key;
}

function updateLocalizedTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = getTranslation(key);
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', getTranslation(key));
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', getTranslation(key));
  });
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleString(state.currentLanguage);
  } catch {
    return dateString;
  }
}

function getSchemaName(url) {
  if (!url) return '';
  
  const moduleMapping = {
    "Contacts_FormPage": "Contact",
    "Accounts_FormPage": "Account", 
    "Leads_FormPage": "Lead",
    "Opportunities_FormPage": "Opportunity",
    "Cases_FormPage": "Case",
    "Activities_FormPage": "Activity",
    "Orders_FormPage": "Order",
    "Contracts_FormPage": "Contract"
  };
  
  for (const [page, schema] of Object.entries(moduleMapping)) {
    if (url.includes(page)) {
      return schema;
    }
  }
  
  return '';
}

/*
*********************************
* A-Koliada 
* https://a-koliada.github.io/
*********************************
*/