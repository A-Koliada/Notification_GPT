
// Update extension icon based on connection status
function updateExtensionIcon(isConnected) {
  const iconPrefix = isConnected ? 'icon' : 'iconoff';
  chrome.action.setIcon({
    path: {
      16: `images/${iconPrefix}-16.png`,
      32: `images/${iconPrefix}-32.png`,
      48: `images/${iconPrefix}-48.png`,
      128: `images/${iconPrefix}-128.png`
    }
  }).catch(err => console.error('[Background] Failed to update icon:', err));
}

// ============================================
// CREATIO NOTIFICATIONS — BACKGROUND SERVICE WORKER (MV3, type: "module")
// Версія 2.3.1 — жорстке приведення вкладки до тенанта, стабільний ContactId
// ============================================

import { errorHandler } from "/utils/error-handler.js";
import { dbManager } from "/storage/db-manager.js";
import { creatioAPI } from "/api/creatio-api.js";
import { DnAppUserManager } from "/api/dn-app-user-manager.js";
import { NotificationsManager } from "/api/notifications-manager.js";
import { SyncManager } from "/api/sync-manager.js";
import { OSNotifier } from "/notifiers/os-notifier.js";
import { WindowNotifier } from "/notifiers/window-notifier.js";

// ---------------------- Локальний логер ----------------------
const DEBUG = true;
function log(...a) { if (DEBUG) console.log("[Background]", ...a); }
function warn(...a) { if (DEBUG) console.warn("[Background]", ...a); }

// ---------------------- Глобальний стан ----------------------
const state = {
  creatioUrl: "",
  currentLanguage: "uk",
  contactId: null,
  dnAppUserId: null,
  isConnected: false,
  isInitialized: false,

  api: null,
  db: null,
  userManager: null,
  notificationsManager: null,
  syncManager: null,
  notifier: null,
  
  deliveryMode: 'system',
  notificationSettings: {},

  refreshIntervalSec: 60,
  bringToFrontIntervalId: null,
  openedNotifications: {}
};

// ============================================
// Boot
// ============================================
initializeExtension();

// ============================================
// AUTO-RECONNECT: Listen for Creatio tabs
// ============================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Перевіряємо чи це вкладка Creatio
  if (changeInfo.status === 'complete' && tab.url && state.creatioUrl) {
    const tabOrigin = new URL(tab.url).origin;
    const settingsOrigin = new URL(state.creatioUrl).origin;
    
    if (tabOrigin === settingsOrigin) {
      log("🔄 Creatio tab updated/loaded:", tabId);
      
      // Якщо extension не підключений - спробуємо підключитись
      if (!state.isConnected || !state.isInitialized) {
        log("📡 Auto-reconnecting to Creatio...");
        setTimeout(() => {
          initializeManagers().catch(err => 
            warn("⚠️ Auto-reconnect failed:", err?.message)
          );
        }, 2000); // Чекаємо 2 секунди щоб сторінка завантажилась
      }
    }
  }
});

// Також слухаємо створення нових вкладок
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && state.creatioUrl) {
    try {
      const tabOrigin = new URL(tab.url).origin;
      const settingsOrigin = new URL(state.creatioUrl).origin;
      
      if (tabOrigin === settingsOrigin) {
        log("🆕 New Creatio tab created:", tab.id);
      }
    } catch {}
  }
});

// Слухаємо коли користувач переключається на вкладку Creatio
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    
    if (tab.url && state.creatioUrl) {
      try {
        const tabOrigin = new URL(tab.url).origin;
        const settingsOrigin = new URL(state.creatioUrl).origin;
        
        if (tabOrigin === settingsOrigin) {
          log("👁️ Switched to Creatio tab:", tab.id);
          
          // Оновлюємо активність користувача
          if (state.userManager && state.isConnected) {
            state.userManager.registerOrUpdateUser({}).catch(() => {});
          }
          
          // Якщо не підключені - спробуємо
          if (!state.isConnected && state.isInitialized) {
            log("🔄 Re-checking connection...");
            setTimeout(() => {
              initializeManagers().catch(() => {});
            }, 1000);
          }
        }
      } catch {}
    }
  });
});

async function initializeExtension() {
  try {
    const s = await chrome.storage.sync.get({creatioUrl:''});
    if(!s.creatioUrl){ try{updateIcon(false);}catch(e){}; }

    log("🚀 Initializing extension v2.3.1");
    await loadSettings();
    await initializeDatabase();
    setupMessageListeners();
    setupAlarms();

    if (state.creatioUrl) {
      await initializeManagers();
    }

    state.isInitialized = true;
  } catch (e) {
    log("❌ Error during initialization:", e);
    safeHandleError(e, { phase: "initialization" });
  }
}

// ============================================
// DB
// ============================================
async function initializeDatabase() {
  try {
    log("💾 Initializing database...");
    state.db = dbManager;
    await state.db.init();
    log("✅ Database initialized");
  } catch (e) {
    log("❌ Database initialization failed:", e);
    safeHandleError(e, { phase: "database_init" });
    throw e;
  }
}

// ============================================
// Settings
// ============================================
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      creatioUrl: "",
      language: "uk",
      syncInterval: 30,
      bringToFrontInterval: 0,
      enableNotifications: true
    }, (items) => {
      state.creatioUrl = normalizeBase(items.creatioUrl || "");
      state.currentLanguage = items.language || "uk";
      state.refreshIntervalSec = Number(items.syncInterval) || 60;

      log("🔧 Loaded Creatio URL:", state.creatioUrl || "(empty)");
      log("⚙️ Settings loaded:", { hasUrl: !!state.creatioUrl, language: state.currentLanguage, syncInterval: state.refreshIntervalSec });

      startBringToFrontInterval(items.bringToFrontInterval);
      resolve();
    });
  });
}

async function getUserSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      daysUntilDeactivation: 14,
      daysUntilDelete: 30,
      active: true,
      enableNotifications: true,
      reminder: true,
      visa: true,
      email: true,
      esn: true,
      system: true,
      showPopupNotifications: true
    }, resolve);
  });
}

async function getSyncInterval() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ syncInterval: 30 }, (items) => resolve(items.syncInterval));
  });
}

// ============================================
// Helpers
// ============================================
function normalizeBase(url) {
  if (!url) return "";
  return url.trim().replace(/\s+/g, "").replace(/\/+$/, "");
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function buildTenantDesiredUrl(base) {
  // ведемо на /0/ (shell сам довантажить модулі)
  const clean = base.replace(/\/+$/, "");
  return clean.endsWith("/0") ? clean + "/" : clean + "/0/";
}

async function queryTabsByPattern(origin) {
  return await new Promise((resolve) =>
    chrome.tabs.query({ url: `${origin}/*` }, (tabs) => resolve(tabs || []))
  );
}

async function sendMessageToTab(tabId, message) {
  return await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
      resolve(resp);
    });
  });
}

async function getCookieAny(url, name) {
  const u = new URL(url);
  const origins = [
    `${u.origin}/`,
    `${u.origin}/0`,
    `${u.origin}/0/`,
    `${u.origin}/Nui`,
    `${u.origin}/ServiceModel/`
  ];

  for (const testUrl of origins) {
    const one = await new Promise((resolve) => chrome.cookies.get({ url: testUrl, name }, (cookie) => resolve(cookie || null)));
    if (one) return one;
    try {
      // @ts-ignore partitioned (CHIPS)
      const part = await new Promise((resolve) => chrome.cookies.get({ url: testUrl, name, partitionKey: { topLevelSite: u.origin } }, (cookie) => resolve(cookie || null)));
      if (part) return part;
    } catch {}
  }

  const candidates = await new Promise((resolve) => chrome.cookies.getAll({ domain: u.hostname, name }, (cookies) => resolve(cookies || [])));
  if (candidates.length) {
    candidates.sort((a, b) => (b.path || "").length - (a.path || "").length);
    return candidates[0];
  }

  try {
    // @ts-ignore
    const partCandidates = await new Promise((resolve) => chrome.cookies.getAll({ domain: u.hostname, name, partitionKey: { topLevelSite: u.origin } }, (cookies) => resolve(cookies || [])));
    if (partCandidates.length) {
      partCandidates.sort((a, b) => (b.path || "").length - (a.path || "").length);
      return partCandidates[0];
    }
  } catch {}

  return null;
}

// --------- Головне: примусово переводимо вкладку на origin тенанта і чекаємо Terrasoft ---------
// ============================================
// Перевіряємо що є відкрита вкладка Creatio
// НЕ створюємо та НЕ активуємо вкладки автоматично
// ============================================

async function ensureTenantTabOpenAndReady(options = {}) {
  const base = normalizeBase(state.creatioUrl);
  if (!base) throw new Error("Creatio URL не заданий у налаштуваннях.");

  const desiredOrigin = new URL(base).origin;
  
  // ✅ НОВИЙ параметр: чи потрібна перевірка Terrasoft
  const requireTerrasoft = options.requireTerrasoft !== false; // за замовчуванням true

  log("🔍 Looking for existing Creatio tab:", desiredOrigin);

  // Шукаємо існуючу вкладку з Creatio
  const tabs = await chrome.tabs.query({ url: `${desiredOrigin}/*` });
  
  if (tabs.length === 0) {
    log("❌ No Creatio tab found");
    throw new Error("CREATIO_NOT_OPEN: Будь ласка, відкрийте вкладку з Creatio");
  }
  
  // Беремо першу знайдену вкладку
  let tabId = tabs[0].id;
  log("✅ Found existing Creatio tab:", tabId, "- will use in background");
  
  // Перевіряємо стан вкладки
  let probe;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const origin = location.origin;
        const href = location.href;
        const isLogin = /\/Login/i.test(location.pathname) || /NuiLogin/i.test(href);
        const isStudioSelector = origin === "https://studio.creatio.com";
        const terrasoftReady = !!(window.Terrasoft && window.Terrasoft.SysValue);
        const contactId = terrasoftReady &&
          window.Terrasoft.SysValue.CURRENT_USER_CONTACT &&
          window.Terrasoft.SysValue.CURRENT_USER_CONTACT.value || null;
        return { origin, href, isLogin, isStudioSelector, terrasoftReady, contactId };
      }
    });
    probe = res?.result || {};
  } catch (e) {
    log("❌ Failed to check tab state:", e.message);
    throw new Error("CREATIO_NOT_READY: Не вдалося перевірити стан вкладки Creatio");
  }
  
  // Перевірки стану
  if (probe.isLogin) {
    log("⚠️ User on login page");
    throw new Error("AUTH_REQUIRED: Увійдіть в Creatio у відкритій вкладці");
  }
  
  if (probe.isStudioSelector) {
    log("⚠️ User on studio.creatio.com");
    throw new Error("WRONG_ORIGIN: Відкрийте ваш tenant environment замість studio.creatio.com");
  }
  
  if (probe.origin !== desiredOrigin) {
    log("⚠️ Wrong tenant:", probe.origin, "expected:", desiredOrigin);
    throw new Error(`WRONG_TENANT: Відкрита вкладка ${probe.origin}, очікується ${desiredOrigin}`);
  }
  
  // ✅ ВИПРАВЛЕНО: Перевірка Terrasoft тільки якщо потрібно
  if (requireTerrasoft && !probe.terrasoftReady) {
    log("⚠️ Terrasoft not ready yet");
    throw new Error("TERRASOFT_NOT_READY: Зачекайте поки Creatio повністю завантажиться");
  }
  
  if (!probe.terrasoftReady) {
    log("ℹ️ Terrasoft not ready, but continuing (OData works without it)");
  }
  
  log("✅ Creatio tab ready:", { tabId, origin: probe.origin, contactId: probe.contactId });
  
  return { 
    tabId, 
    origin: probe.origin, 
    isLogin: false, 
    terrasoftReady: probe.terrasoftReady, 
    contactId: probe.contactId || null 
  };
}

// ============================================
// ВИПРАВЛЕНА ФУНКЦІЯ ensureContentScript
// Замінити в background.js
// ============================================

async function ensureContentScript(tabId) {
  if (!tabId) return false;
  
  try {
    // Перевіряємо чи вже інжектований
    const testResp = await sendMessageToTab(tabId, { action: "ping" });
    if (testResp && testResp.pong) {
      log("✅ content.js already ready");
      return true;
    }
  } catch (e) {
    // Ігноруємо помилку - продовжуємо інжектувати
  }
  
  try {
    log("💉 Injecting content.js...");
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['/content.js']
    });
    
    // Чекаємо готовність з timeout
    for (let i = 0; i < 15; i++) {
      await wait(500);
      try {
        const resp = await sendMessageToTab(tabId, { action: "ping" });
        if (resp && resp.pong) {
          log("✅ content.js ready after", (i + 1) * 500, "ms");
          return true;
        }
      } catch (e) {
        // Продовжуємо чекати
      }
    }
    
    warn("⚠️ content.js не відповідає після 7.5 секунд");
    return false;
    
  } catch (e) {
    warn("❌ ensureContentScript failed:", e);
    return false;
  }
}

// Запити у Creatio через content.js (first-party cookies)

async function contentFetch(endpoint, options = {}) {
  const base = normalizeBase(state.creatioUrl);
  if (!base) throw new Error("Creatio URL не заданий у налаштуваннях.");

  // ✅ ВИПРАВЛЕНО: OData і REST API не потребують Terrasoft
  const { tabId, isLogin } = await ensureTenantTabOpenAndReady({ 
    requireTerrasoft: false 
  });
  
  // Перевірка: чи ми на login page?
  if (isLogin) {
    throw new Error("AUTH_REQUIRED: Creatio вимагає авторизації. Будь ласка, увійдіть в систему у відкритій вкладці.");
  }
  
  const ready = await ensureContentScript(tabId);
  if (!ready) throw new Error("Не вдалося інʼєктувати content.js (proxy)");

  const opts = Object.assign({ method: "GET", headers: {}, body: undefined }, options || {});
  const method = String(opts.method || "GET").toUpperCase();

  // КРИТИЧНО: Отримуємо CSRF ПЕРЕД формуванням headers
  const csrf = await getCsrfFromCookiesSW();
  
  const headers = Object.assign({ 
    "X-Requested-With": "XMLHttpRequest"
  }, opts.headers || {});
  
  // Додаємо CSRF на ВСІ запити
  if (csrf) {
    headers["BPMCSRF"] = csrf;
  }
  
  opts.headers = headers;

  // Логування для дебагу
  log("contentFetch:", { endpoint, method, hasCSRF: !!csrf, tabId });

  // кілька спроб з кращою обробкою помилок
  for (let i = 0; i < 3; i++) {
    const resp = await sendMessageToTab(tabId, { 
      action: "proxyFetch", 
      endpoint, 
      options: opts 
    });
    
    // Перевіряємо чи отримали відповідь
    if (resp && typeof resp === 'object') {
      // Спеціальні помилки з content.js
      if (resp.isLoginPage) {
        throw new Error("AUTH_REQUIRED: Користувач на сторінці логіну. Увійдіть в Creatio.");
      }
      
      if (resp.isStudioSelector) {
        throw new Error("WRONG_ORIGIN: Користувач на studio.creatio.com. Відкрийте ваш tenant environment.");
      }
      
      // Якщо є помилка fetch (мережева)
      if (resp.fetchFailed && resp.error) {
        log(`Attempt ${i + 1}/3: network error:`, resp.error);
        await wait(500);
        continue;
      }
      
      // Якщо є статус (навіть 0 або помилковий)
      if (typeof resp.status === "number" || resp.ok === true || resp.ok === false) {
        return resp;
      }
    }
    
    await wait(250);
  }
  
  throw new Error("Не вдалося звʼязатися з content.js після 3 спроб.");
}




// Cookie → ContactId
async function getContactIdFromCookieSW() {
  try {
    const base = normalizeBase(state.creatioUrl);
    if (!base) return null;
    const ck = await getCookieAny(base, "UserConnection");
    if (!ck?.value) return null;

    const raw = ck.value;

    // URI-JSON
    try {
      const dec = decodeURIComponent(raw);
      try { const obj = JSON.parse(dec); if (obj?.contactId) return obj.contactId; }
      catch {
        try { const obj2 = JSON.parse(atob(dec)); if (obj2?.contactId) return obj2.contactId; } catch {}
      }
    } catch {}

    // прямий JSON
    try { const obj = JSON.parse(raw); if (obj?.contactId) return obj.contactId; } catch {}

    // key=val;ContactId=GUID;
    const m = /(?:^|[;,&\s])ContactId=([0-9a-fA-F-]{36})/i.exec(raw);
    if (m) return m[1];

    // чистий GUID
    return /^[0-9a-fA-F-]{36}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

// Cookie → BPMCSRF
async function getCsrfFromCookiesSW() {
  try {
    const base = normalizeBase(state.creatioUrl);
    if (!base) return "";
    const ck = await getCookieAny(base, "BPMCSRF");
    return ck?.value || "";
  } catch {
    return "";
  }
}

// Витяг користувача з MAIN-world (без інлайн-скриптів)
async function getUserFromPageSW() {
  const base = normalizeBase(state.creatioUrl);
  if (!base) return { ok: false, contactId: null, error: "No base URL" };

  const { tabId, origin, isLogin, terrasoftReady, contactId } = await ensureTenantTabOpenAndReady();
  if (origin !== new URL(base).origin) {
    return { ok: false, contactId: null, error: "Foreign origin" };
  }
  if (isLogin) return { ok: false, contactId: null, error: "Login page" };
  if (terrasoftReady && contactId) return { ok: true, contactId, error: null };

  // додаткові 10 спроб
  for (let i = 0; i < 10; i++) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          const terrasoftReady = !!(window.Terrasoft && window.Terrasoft.SysValue);
          const contactId = terrasoftReady &&
            window.Terrasoft.SysValue.CURRENT_USER_CONTACT &&
            window.Terrasoft.SysValue.CURRENT_USER_CONTACT.value || null;
          const isLogin = /\/Login/i.test(location.pathname) || /NuiLogin/i.test(location.href);
          const origin = location.origin;
          return { terrasoftReady, contactId, isLogin, origin };
        }
      });
      const r = res?.result || {};
      if (r.origin !== new URL(base).origin) return { ok: false, contactId: null, error: "Foreign origin" };
      if (r.isLogin) return { ok: false, contactId: null, error: "Login page" };
      if (r.terrasoftReady && r.contactId) return { ok: true, contactId: r.contactId, error: null };
    } catch {}
    await wait(800);
  }

  return { ok: false, contactId: null, error: "Page context not ready" };
}

// Універсальна обробка помилок
function safeHandleError(err, ctx) {
  try { errorHandler?.handle?.(err, ctx || {}); } catch (_) {}
}

// ============================================
// MANAGERS
// ============================================
async function resolveContactIdOrAuth() {
  // 1) MAIN-world (UI) — примусово на тенант
  const fromPage = await getUserFromPageSW();
  if (fromPage?.ok && fromPage.contactId) {
    log("👤 Contact ID (page context):", fromPage.contactId);
    return fromPage.contactId;
  }
  if (fromPage?.error === "Login page") {
    throw new Error("AUTH_REQUIRED: Відкрий Creatio у вкладці та увійди в систему, потім натисни 'Sync now'.");
  }
  if (fromPage?.error === "Foreign origin") {
    // ми на studio.creatio.com → користувач має натиснути «Open environment» або ми вже намагаємось перенаправити
    throw new Error("AUTH_REQUIRED: Відкрий середовище саме на домені тенанта (113040-studio.creatio.com), потім натисни 'Sync now'.");
  }

  // 2) Cookie-фолбек
  const fromCookie = await getContactIdFromCookieSW();
  if (fromCookie) {
    log("👤 Contact ID (cookie):", fromCookie);
    return fromCookie;
  }

  // 3) Backend ping
  try {
    const ping = await contentFetch("/0/ServiceModel/SessionService.svc/GetCurrentUserInfo", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: {}
    });
    const data = ping?.data;
    const cid = data?.GetCurrentUserInfoResult?.contactId || data?.contactId || null;
    if (cid) return cid;
  } catch {}

  throw new Error("AUTH_REQUIRED: Відкрий Creatio у вкладці та увійди в систему, потім натисни 'Sync now'.");
}

// ============================================
// INITIALIZE NOTIFIER
// ============================================

async function initializeNotifier() {
  try {
    // Отримуємо налаштування
    const settings = await chrome.storage.sync.get({
      deliveryMode: 'system',
      requireInteraction: false,
      repeatCount: 3,
      repeatInterval: 60,
      autoClose: 10,
      cascade: true,
      openUrlAfterVisa: true,
      enabledTypes: [
        'ead36165-7815-45d1-9805-1faa47de504a', // Visa
        '337065ba-e6e6-4086-b493-0f6de115bc7a', // Reminder
        '7e1bf266-2e6b-49a5-982b-4ae407f3ae26', // System
        '8ebcc160-7a78-444b-8904-0a78348a5141', // Email
        'ae6c7636-32fd-4548-91a7-1784a28e7f9e', // Custom
        'fa41b6a0-eafd-4bb9-a913-aa74000b46f6'  // ESN
      ],
      typeColors: {
        'ead36165-7815-45d1-9805-1faa47de504a': '#dc2626',
        '337065ba-e6e6-4086-b493-0f6de115bc7a': '#f59e0b',
        '7e1bf266-2e6b-49a5-982b-4ae407f3ae26': '#3b82f6',
        '8ebcc160-7a78-444b-8904-0a78348a5141': '#8b5cf6',
        'ae6c7636-32fd-4548-91a7-1784a28e7f9e': '#10b981',
        'fa41b6a0-eafd-4bb9-a913-aa74000b46f6': '#06b6d4'
      }
    });
    
    state.deliveryMode = settings.deliveryMode;
    state.notificationSettings = settings;
    
    log("⚙️ Notification settings:", settings.deliveryMode);
    
    // Callback для дій користувача
    const onAction = async (notificationId, action, data) => {
      log(`📢 Notification action: ${action} for ${data.id}`);
      
      try {
        switch (action) {
          case 'click':
            // Відкрити URL
            if (data.sourceUrl) {
              const fullUrl = state.creatioUrl + data.sourceUrl;
              await chrome.tabs.create({ url: fullUrl });
            }
            // Позначити як прочитано
            await state.notificationsManager?.markAsRead?.(data.id);
            break;
          
          case 'delete':
            await state.notificationsManager?.deleteNotification?.(data.id);
            break;
          
          case 'done':
            await state.notificationsManager?.markAsRead?.(data.id);
            break;
          
          case 'visa':
            await state.notificationsManager?.setVisaDecision?.(data.id, data.decision);
            // Відкрити URL якщо налаштовано
            if (settings.openUrlAfterVisa && data.sourceUrl) {
              const fullUrl = state.creatioUrl + data.sourceUrl;
              await chrome.tabs.create({ url: fullUrl });
            }
            break;
        }
        
        // Оновити дані після дії
        setTimeout(() => state.syncManager?.quickSync?.(), 500);
        
      } catch (err) {
        warn("❌ Notification action failed:", err);
      }
    };
    
    // Створюємо відповідний notifier
    if (settings.deliveryMode === 'system') {
      state.notifier = new OSNotifier(onAction);
      log("✅ OS Notifier initialized");
    } else {
      state.notifier = new WindowNotifier(onAction);
      log("✅ Window Notifier initialized");
    }
    
  } catch (err) {
    warn("❌ Failed to initialize notifier:", err);
  }
}

// ============================================
// ВИПРАВЛЕНА ФУНКЦІЯ initializeManagers
// Замінити в background.js (рядки 498-617)
// ============================================

async function initializeManagers() {
  try {
    const s = await chrome.storage.sync.get({creatioUrl:''});
    state.creatioUrl = s.creatioUrl || state.creatioUrl || '';
    if(!state.creatioUrl){ try{updateIcon(false);}catch(e){}; return; }

    log("🔧 Initializing managers...");
    
    // ✅ ВИПРАВЛЕНО: Не вимагаємо Terrasoft на початку ініціалізації
    // Спробуємо отримати ContactId, але якщо Terrasoft не готовий - продовжимо
    let tabId, pageContactId;
    try {
      const tabInfo = await ensureTenantTabOpenAndReady({ requireTerrasoft: false });
      tabId = tabInfo.tabId;
      pageContactId = tabInfo.contactId;
    } catch (e) {
      // Якщо не вдалося - не критично, спробуємо cookie
      warn("⚠️ Could not check tab state:", e.message);
    }
    
    log("👤 Contact ID (page context):", pageContactId || "(not found)");
    
    // Отримуємо ContactId
    let contactId = pageContactId;
    if (!contactId) {
      contactId = await getContactIdFromCookieSW();
      if (!contactId) {
        warn("⚠️ Could not get ContactId, will try API methods");
      }
    }

    if (contactId) {
      log("✅ Contact ID:", contactId);
      state.contactId = contactId;
    }

    // Ініціалізуємо API
    log("📡 Initializing API with URL:", state.creatioUrl);
    state.api = creatioAPI;
    const apiReady = await state.api.init(state.creatioUrl);
    if (!apiReady) {
      throw new Error("Failed to initialize CreatioAPI");
    }

    state.api.setTransport(contentFetch);

    // ВИПРАВЛЕННЯ: Встановлюємо ContactId ЗАВЖДИ якщо є
    if (contactId) {
      state.api.setKnownContactId(contactId);
      log("✅ Set known ContactId in API:", contactId);
    } else {
      warn("⚠️ No ContactId available, will try to get from API");
    }
    
    log("✅ API initialized");
    
    // ✅ НОВИЙ КОД: Переконуємось що content.js готовий
    log("🔌 Ensuring content script is ready...");
    const contentReady = await ensureContentScript(tabId);
    if (!contentReady) {
      warn("⚠️ Content script not fully ready, but continuing...");
    }
    
    // ✅ НОВИЙ КОД: Додаткова затримка для стабілізації
    await wait(1500);
    
    // Перевіряємо CSRF токен
    const csrf = await getCsrfFromCookiesSW();
    log("🔑 CSRF Token:", csrf ? "Present" : "Missing");
    
    // Ініціалізуємо DnAppUser Manager
    state.userManager = new DnAppUserManager(state.api);
    
    // ✅ НОВИЙ КОД: Обгортаємо в try-catch і не падаємо на помилці
    try {
      const userResult = await state.userManager.registerOrUpdateUser({});
      if (userResult?.Id) {
        state.dnAppUserId = userResult.Id;
        log("✅ User registered:", state.dnAppUserId);
      } else {
        log("⚠️ User registration returned:", userResult);
      }
    } catch (userError) {
      warn("⚠️ User registration failed (non-fatal):", userError?.message);
      // Продовжуємо роботу - це не критична помилка
    }
    
    // Ініціалізуємо Notifications Manager
    state.notificationsManager = new NotificationsManager(state.api, state.db, contactId || state.contactId);
    await state.notificationsManager.init();
    log("✅ Notifications Manager initialized");
    
    // 🔍 Run diagnostic if in debug mode
    if (DEBUG) {
      try {
        log("🔍 Running comprehensive diagnostic check...");
        const diagnostic = await state.api.diagnoseNotificationIssues();
        log("📊 Diagnostic results:", diagnostic);
        
        // Зберігаємо діагностику для майбутнього доступу
        state.lastDiagnostic = diagnostic;
        
        // Показуємо важливі помилки якщо є
        if (diagnostic.errors && diagnostic.errors.length > 0) {
          warn("⚠️ Diagnostic found issues:", diagnostic.errors);
        }
        
        // Перевіряємо чи є нотифікації для поточного користувача
        if (diagnostic.notificationsForCurrentUser === 0 && diagnostic.totalNotificationsInDB > 0) {
          warn("⚠️ Found notifications in DB but none for current user. Check DnContactId field.");
        }
      } catch (e) {
        warn("⚠️ Diagnostic failed (non-critical):", e);
      }
    }
    
    // Ініціалізуємо Sync Manager
    state.syncManager = new SyncManager(state.api, state.db, state.notificationsManager, state.userManager);
    
    // Перевіряємо що constructor виконався правильно
    if (!state.syncManager.syncStats || !state.syncManager.db || !state.syncManager.api) {
      warn("❌ SyncManager constructor did NOT execute properly!");
      warn("Properties check:", {
        hasSyncStats: !!state.syncManager.syncStats,
        hasDb: !!state.syncManager.db,
        hasApi: !!state.syncManager.api,
        hasNotificationsManager: !!state.syncManager.notificationsManager
      });
      throw new Error("SyncManager failed to initialize - constructor didn't execute");
    }
    
    log("✅ SyncManager properties verified:", {
      hasSyncStats: !!state.syncManager.syncStats,
      totalSyncs: state.syncManager.syncStats.totalSyncs,
      hasDb: !!state.syncManager.db,
      hasMethods: !!(state.syncManager.syncNow && state.syncManager.startAutoSync)
    });
    
    await state.syncManager.init({ syncInterval: state.refreshIntervalSec });
    log("✅ Sync Manager initialized");
    
    // Ініціалізуємо Notifier
    await initializeNotifier();
    log("✅ Notifier initialized");
    
    // Передаємо notifier в sync manager
    if (state.syncManager && state.notifier) {
      state.syncManager.notifier = state.notifier;
      state.syncManager.settings = state.notificationSettings;
      log("✅ Notifier attached to SyncManager");
    }
    
    state.isConnected = true;
    state.isInitialized = true; // ✅ ДОДАНО: позначаємо що extension повністю ініціалізовано
    log("✅ All managers initialized successfully");
    
    // Оновлюємо іконку розширення
    updateExtensionIcon(true);
    
  } catch (e) {
    // Обробка помилок (існуючий код)
    if (e.message?.includes("CREATIO_NOT_OPEN")) {
      warn("⚠️ Creatio не відкрито");
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
      chrome.action.setTitle({ title: "Відкрийте вкладку з Creatio" });
      state.isConnected = false;
      return;
    }
    
    if (e.message?.includes("AUTH_REQUIRED")) {
      warn("⚠️ Потрібна авторизація в Creatio");
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
      chrome.action.setTitle({ title: "Увійдіть в Creatio" });
      state.isConnected = false;
      return;
    }
    
    if (e.message?.includes("WRONG_ORIGIN")) {
      warn("⚠️ Користувач на studio.creatio.com");
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#FF6600" });
      chrome.action.setTitle({ title: "Відкрийте ваш tenant замість studio.creatio.com" });
      state.isConnected = false;
      return;
    }
    
    if (e.message?.includes("WRONG_TENANT")) {
      warn("⚠️ Неправильний tenant");
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#FF6600" });
      chrome.action.setTitle({ title: e.message.replace("WRONG_TENANT: ", "") });
      state.isConnected = false;
      return;
    }
    
    if (e.message?.includes("TERRASOFT_NOT_READY")) {
      warn("⚠️ Creatio ще не готовий");
      chrome.action.setBadgeText({ text: "..." });
      chrome.action.setBadgeBackgroundColor({ color: "#0000FF" });
      chrome.action.setTitle({ title: "Зачекайте поки Creatio завантажиться" });
      state.isConnected = false;
      return;
    }
    
    // Інші помилки
    log("❌ Error during managers initialization:", e);
    safeHandleError(e, { phase: "managers_init" });
    state.isConnected = false;
    chrome.action.setBadgeText({ text: "✗" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    chrome.action.setTitle({ title: "Помилка: " + e.message });
  }
}

// ============================================
// Messages
// ============================================
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        try {
          switch (message.action) {
        case "openOptions": {
          if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
          else chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
          sendResponse({ success: true }); return;
        }
  
            case "getNotifications": {
              // Оновлюємо активність користувача при відкритті popup
              if (state.userManager) {
                state.userManager.registerOrUpdateUser({}).catch(err => 
                  warn("⚠️ User activity update failed:", err?.message)
                );
              }
              
              const notifications = await (state.notificationsManager?.getFromCache?.() || Promise.resolve([]));
              const unreadCount = notifications.filter(n => !n.DnIsRead).length;
              updateBadge(unreadCount);
              sendResponse({
                success: true,
                notifications: processNotificationData(notifications),
                unreadCount,
                fromCache: true
              });
              return;
            }
  
            case "markAsRead": {
              await state.notificationsManager?.markAsRead?.(message.id);
              setTimeout(() => state.syncManager?.quickSync?.(), 400);
              sendResponse({ success: true });
              return;
            }
  
            case "markAllRead": {
              const result = await state.notificationsManager?.markAllAsRead?.();
              setTimeout(() => state.syncManager?.quickSync?.(), 400);
              sendResponse({ success: true, count: result?.count || 0 });
              return;
            }
  
            case "deleteNotification": {
              await state.notificationsManager?.deleteNotification?.(message.id);
              setTimeout(() => state.syncManager?.quickSync?.(), 400);
              sendResponse({ success: true });
              return;
            }
  
            case "updateVisaDecision": {
              await state.notificationsManager?.setVisaDecision?.(message.id, message.decision);
              setTimeout(() => state.syncManager?.quickSync?.(), 400);
              sendResponse({ success: true });
              return;
            }
  
            case "settingsUpdated": {
              await loadSettings();
              await initializeManagers();
              sendResponse({ success: true });
              return;
            }
  
            // Ручне оновлення активності користувача
            case "updateUserActivity": {
              if (!state.userManager) {
                sendResponse({ 
                  success: false, 
                  error: "User manager not initialized" 
                });
                return;
              }
              
              try {
                const result = await state.userManager.registerOrUpdateUser({});
                sendResponse({ 
                  success: true, 
                  userId: result?.Id,
                  updated: result?.updated || result?.created
                });
              } catch (e) {
                warn("❌ updateUserActivity error:", e);
                sendResponse({ 
                  success: false, 
                  error: e?.message || "Update failed" 
                });
              }
              return;
            }



            // 🔧 ДОДАНО: ручна синхронізація з попапа
            case "syncNow":
            case "sync_now": {
              // ✅ ПОКРАЩЕНА ПЕРЕВІРКА
              if (!state.syncManager) {
                log("⚠️ syncNow called but SyncManager not initialized yet");
                sendResponse({ 
                  success: false, 
                  error: "Extension is still initializing. Please wait a moment." 
                });
                return;
              }
              
              // Перевіряємо чи syncManager має всі необхідні методи
              if (!state.syncManager.syncNow || !state.syncManager.syncStats) {
                log("❌ syncNow: SyncManager not properly initialized (missing methods/properties)");
                warn("⚠️ This usually means the constructor didn't run. Reinitializing...");
                
                // Спробуємо переініціалізувати
                try {
                  await initializeManagers();
                  if (state.syncManager?.syncNow) {
                    const result = await state.syncManager.syncNow({ full: true, forced: true });
                    sendResponse({ success: true, ...result });
                    return;
                  }
                } catch (reinitError) {
                  log("❌ Reinitialization failed:", reinitError);
                }
                
                sendResponse({ 
                  success: false, 
                  error: "Extension initialization error. Please reload the extension." 
                });
                return;
              }
              
              if (!state.isInitialized) {
                log("⚠️ syncNow called but extension not fully initialized");
                sendResponse({ 
                  success: false, 
                  error: "Extension is still initializing. Please wait a moment." 
                });
                return;
              }
              
              try {
                const result = await state.syncManager.syncNow({ full: true, forced: true });
                sendResponse({ success: true, ...result });
              } catch (e) {
                log("❌ syncNow error:", e);
                sendResponse({ success: false, error: e?.message || "Sync failed" });
              }
              return;
            }
  
            // 🔧 ДОДАНО: швидка синхронізація
            case "quickSync": {
              state.syncManager?.quickSync?.();
              sendResponse({ success: true });
              return;
            }
  
            // Є і тест підключення, нехай лишається
            case "testApiConnection": {
              const r = await contentFetch("/0/odata/Contact?$top=1&$select=Id", { method: "GET" });
              sendResponse({ success: !!(r?.ok), status: r?.status || 0 });
              return;
            }
  
            // Прямий проксі (використовуй обережно)
            case "proxyFetchDirect": {
              const r = await contentFetch(message.endpoint, message.options || {});
              sendResponse(r);
              return;
            }
  
            default:
              sendResponse({ success: false, error: "Unknown action" });
              return;
          }
        } catch (e) {
          sendResponse({ success: false, error: e?.message || String(e) });
        }
      })();
      return true; // async
    });
  }
  

// ============================================
// Alarms / UI
// ============================================
function setupAlarms() {
  chrome.alarms.create("cleanup", { periodInMinutes: 24 * 60 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "cleanup") {
      state.syncManager?.cleanup?.().catch(err => log("❌ Cleanup error:", err));
    }
  });
}

function updateIcon(connected) {
  const iconPath = connected ? "images/iconon" : "images/iconoff";
  chrome.action.setIcon({
    path: {
      "16": `${iconPath}-16.png`,
      "32": `${iconPath}-32.png`,
      "48": `${iconPath}-48.png`,
      "128": `${iconPath}-128.png`
    }
  });
}

function updateBadge(count) {
  const text = count > 0 ? (count > 99 ? "99+" : String(count)) : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  chrome.action.setBadgeTextColor?.({ color: "#FFFFFF" });
}

function startBringToFrontInterval(intervalSeconds) {
  if (state.bringToFrontIntervalId) clearInterval(state.bringToFrontIntervalId);
  if (!intervalSeconds || intervalSeconds <= 0) return;
  state.bringToFrontIntervalId = setInterval(() => {
    Object.entries(state.openedNotifications).forEach(([id, winId]) => {
      chrome.windows.update(Number(winId), { focused: true }, () => {
        if (chrome.runtime.lastError) delete state.openedNotifications[id];
      });
    });
  }, intervalSeconds * 1000);
}

// Нормалізація даних нотифікацій (для popup)
// ============================================
// NOTIFICATION TYPE MAPPING
// ============================================

const NOTIFICATION_TYPES = {
  'ead36165-7815-45d1-9805-1faa47de504a': 'Visa',
  '337065ba-e6e6-4086-b493-0f6de115bc7a': 'Reminder',
  '7e1bf266-2e6b-49a5-982b-4ae407f3ae26': 'System',
  '8ebcc160-7a78-444b-8904-0a78348a5141': 'Email',
  'ae6c7636-32fd-4548-91a7-1784a28e7f9e': 'Custom',
  'fa41b6a0-eafd-4bb9-a913-aa74000b46f6': 'ESN'
};

function getNotificationTypeName(typeId) {
  return NOTIFICATION_TYPES[typeId] || 'Custom';
}

// ============================================
// PROCESS NOTIFICATION DATA FOR POPUP
// ============================================

function processNotificationData(items) {
  return (items || []).map(item => ({
    id: item.Id,
    title: item.DnTitle || item.DnSubjectCaption || "Notification",
    message: item.DnMessage || item.DnDescription || "",
    date: item.CreatedOn || new Date().toISOString(),
    url: item.DnSourceUrl || "",
    // Use the fetched notification type name, fallback to ID lookup, then "Custom"
    type: item.DnNotificationType || getNotificationTypeName(item.DnNotificationTypeId) || "Custom",
    typeId: item.DnNotificationTypeId,
    isRead: !!item.DnIsRead,
    dataRead: item.DnDataRead || null,
    visaCanceled: !!item.DnVisaCanceled,
    visaNegative: !!item.DnVisaNegative,
    visaPositive: !!item.DnVisaPositive
  }));
}

// ============================================
// Lifecycle hooks
// ============================================
chrome.runtime.onInstalled.addListener(() => log("🚀 Extension installed/updated"));
chrome.runtime.onStartup.addListener(() => log("🔁 Runtime startup"));
chrome.runtime.onUpdateAvailable?.addListener((d) => log("🔄 Update available:", d.version));

function showOSNotification(title, message, url){
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "images/icon-128.png",
      title: title || "Creatio Notification",
      message: message || "",
      priority: 0
    }, (id)=>{
      if(url){
        chrome.notifications.onClicked.addListener((nid)=>{
          if(nid===id) chrome.tabs.create({url});
        });
      }
    });
  } catch(e){}
}
