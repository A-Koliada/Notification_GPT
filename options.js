// Conditional logging for debugging
const isDebug = true; // Set to false in production
function log(...args) {
  if (isDebug) console.log(...args);
}

document.addEventListener("DOMContentLoaded", function () {
  // Initialize UI translations
  initLocalization();
  
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  const form = document.getElementById("settingsForm");
  const resetBtn = document.getElementById("resetDefaults");
  const saveMessage = document.getElementById("saveMessage");

  // Check if elements exist
  if (!form) {
    log("❌ Error: #settingsForm not found in DOM");
    return;
  }
  if (!resetBtn) {
    log("❌ Error: #resetDefaults not found in DOM");
  }
  if (!saveMessage) {
    log("❌ Error: #saveMessage not found in DOM");
  }

  // Load saved settings
  chrome.storage.sync.get({
    creatioUrl: "",
    notificationTimeout: 0,
    bringToFrontInterval: 20,
    deliveryMode: "window",
    repeatCount: "3",
    language: "en" // Default language
  }, (items) => {
    log("🔧 Loaded settings:", items);
    document.getElementById("creatioUrl").value = items.creatioUrl;
    document.getElementById("notificationTimeout").value = items.notificationTimeout;
    document.getElementById("bringToFrontInterval").value = Math.max(0, items.bringToFrontInterval);
    document.getElementById("deliveryMode").value = items.deliveryMode || "window";
    document.getElementById("repeatCount").value = items.repeatCount || "3";
    document.getElementById("language").value = items.language;

    // Update UI language
    updateLocalizedTexts(items.language);
  });

  // Handle form submission
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const settings = {
      creatioUrl: document.getElementById("creatioUrl").value.trim(),
      notificationTimeout: parseInt(document.getElementById("notificationTimeout").value) || 0,
      bringToFrontInterval: Math.max(0, parseInt(document.getElementById("bringToFrontInterval").value) || 0),
      deliveryMode: document.getElementById("deliveryMode").value,
      repeatCount: document.getElementById("repeatCount").value,
      language: document.getElementById("language").value
    };

    settings.autoClose = settings.notificationTimeout;

    log("💾 Saving settings:", settings);
    chrome.storage.sync.set(settings, () => {
      // Notify background script about settings update
      chrome.runtime.sendMessage({ 
        action: "settingsUpdated", 
        settings: settings 
      });
      
      // Notify all parts of extension about language change
      chrome.runtime.sendMessage({
        action: "languageChanged",
        language: settings.language
      });
      
      log("✅ Settings saved and messages sent to background.js");
      showSaveMessage(settings.language);
    });
  });

  // Handle reset to defaults
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      const defaultSettings = {
        creatioUrl: "",
        notificationTimeout: 0,
        bringToFrontInterval: 20,
        deliveryMode: "window",
        repeatCount: "3",
        autoClose: 0,
        language: "en"
      };

      log("🔄 Resetting to default settings:", defaultSettings);
      chrome.storage.sync.set(defaultSettings, () => {
        document.getElementById("creatioUrl").value = defaultSettings.creatioUrl;
        document.getElementById("notificationTimeout").value = defaultSettings.notificationTimeout;
        document.getElementById("bringToFrontInterval").value = defaultSettings.bringToFrontInterval;
        document.getElementById("deliveryMode").value = defaultSettings.deliveryMode;
        document.getElementById("repeatCount").value = defaultSettings.repeatCount;
        document.getElementById("language").value = defaultSettings.language;

        // Update UI to default language
        updateLocalizedTexts(defaultSettings.language);
        
        chrome.runtime.sendMessage({ 
          action: "settingsUpdated", 
          settings: defaultSettings 
        });
        
        chrome.runtime.sendMessage({
          action: "languageChanged",
          language: defaultSettings.language
        });
        
        log("✅ Defaults restored and messages sent to background.js");
        showResetMessage(defaultSettings.language);
      });
    });
  }

  // Handle language change in real-time
  const languageSelect = document.getElementById("language");
  if (languageSelect) {
    languageSelect.addEventListener("change", function() {

      const newLanguage = this.value;
      updateLocalizedTexts(this.value);

      // Зберегти мову
      chrome.storage.sync.set({ language: newLanguage }, () => {
        // Відправити повідомлення про зміну мови
        chrome.runtime.sendMessage({
          action: "languageChanged",
          language: newLanguage
        });
        
        log("🌐 Language changed to:", newLanguage);
        
        // Показати повідомлення про успішне збереження
        showSaveMessage(newLanguage);
      });
    });
  }
});



// Initialize localization system
function initLocalization() {
  // Apply translations to all elements with data-i18n attribute
  updateLocalizedTexts();
  
  // Listen for language change messages from other parts of extension
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateLanguage") {
      updateLocalizedTexts(message.language);
    }
  });
}

// Update all localized texts in UI
function updateLocalizedTexts(lang) {
  if (!lang) {
    // Get current language from storage if not provided
    chrome.storage.sync.get({ language: "en" }, (items) => {
      applyTranslations(items.language);
    });
    return;
  }
  applyTranslations(lang);
}

// Apply translations for specific language
function applyTranslations(lang) {
  const currentLang = translations[lang] || translations.en;
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    let translation = getNestedTranslation(currentLang, key);
    
    if (translation !== undefined) {
      if (el.tagName === 'INPUT' && el.type === 'submit') {
        el.value = translation;
      } else {
        el.textContent = translation;
      }
    } else {
      log(`⚠️ Missing translation for key: ${key}`);
    }
  });
}

// Get nested translation (e.g., "languageOptions.en")
function getNestedTranslation(obj, key) {
  return key.split('.').reduce((o, k) => (o || {})[k], obj);
}

// Show save success message with localization
function showSaveMessage(lang) {
  const saveMessage = document.getElementById("saveMessage");
  if (!saveMessage) return;
  
  const message = translations[lang]?.saveSuccess || translations.en.saveSuccess;
  showStatusMessage(saveMessage, message);
}

// Show reset success message with localization
function showResetMessage(lang) {
  const saveMessage = document.getElementById("saveMessage");
  if (!saveMessage) return;
  
  const message = translations[lang]?.resetSuccess || translations.en.resetSuccess;
  showStatusMessage(saveMessage, message);
}

// Generic function to show status message
function showStatusMessage(element, message) {
  element.textContent = message;
  element.classList.add("show");
  
  setTimeout(() => {
    element.classList.add("hide");
    setTimeout(() => {
      element.classList.remove("show", "hide");
      window.close();
    }, 300);
  }, 1000);
}

/*
*********************************
* A-Koliada 
* https://a-koliada.github.io/
*********************************
*/