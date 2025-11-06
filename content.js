// ============================================
// CREATIO NOTIFICATIONS — CONTENT SCRIPT
// Версія 2.3.1 — proxyFetch, без інлайн-інʼєкцій (жодних CSP помилок)
// ============================================

(() => {
    const state = {
      creatioUrl: "",
      baseOrigin: "",
      isCreatioTab: false
    };
  
    // ---------------- Helpers ----------------
    function normalizeBase(u) {
      return (u || "").trim().replace(/\s+/g, "").replace(/\/+$/, "");
    }
  
    function setCreatioUrl(url) {
      state.creatioUrl = normalizeBase(url);
      try { state.baseOrigin = state.creatioUrl ? new URL(state.creatioUrl).origin : ""; }
      catch { state.baseOrigin = ""; }
      state.isCreatioTab = !!(state.baseOrigin && location.origin === state.baseOrigin);
    }
  
    function getCsrf() {
      const map = document.cookie.split(";")
        .map(s => s.trim()).filter(Boolean)
        .map(s => s.split("="))
        .reduce((a, [k, v]) => { if (k) a[k] = v; return a; }, {});
      return map["BPMCSRF"] || "";
    }
  
    // ---------------- Proxy fetch ----------------
    async function apiFetch(endpoint, options = {}) {
        // КРИТИЧНА ПЕРЕВІРКА #1: чи ми на Creatio tenant?
        if (!state.isCreatioTab) {
          console.warn("[content.js] ❌ Not a Creatio tab:", location.origin);
          return { 
            ok: false, 
            status: 0, 
            error: "This tab is not a configured Creatio tenant origin",
            origin: location.origin,
            expectedOrigin: state.baseOrigin
          };
        }
        
        // КРИТИЧНА ПЕРЕВІРКА #2: чи не login page?
        const isLoginPage = /\/Login/i.test(location.pathname) || /NuiLogin/i.test(location.href);
        if (isLoginPage) {
          console.warn("[content.js] ❌ On login page, cannot make authenticated requests");
          return { 
            ok: false, 
            status: 0, 
            error: "AUTH_REQUIRED: On login page. Please log in to Creatio first.",
            isLoginPage: true
          };
        }
        
        // КРИТИЧНА ПЕРЕВІРКА #3: чи не studio.creatio.com?
        if (location.hostname === 'studio.creatio.com') {
          console.warn("[content.js] ❌ On studio.creatio.com, not a tenant");
          return { 
            ok: false, 
            status: 0, 
            error: "WRONG_ORIGIN: On studio.creatio.com. Please open your actual tenant environment.",
            isStudioSelector: true
          };
        }
        
        const url = `${location.origin}${endpoint}`;
        const csrf = getCsrf();
      
        console.log("[content.js] 📡 apiFetch:", { 
          endpoint, 
          method: options.method || "GET",
          hasCSRF: !!csrf,
          origin: location.origin,
          pathname: location.pathname
        });
      
        const headers = Object.assign({
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(csrf ? { "BPMCSRF": csrf } : {})
        }, options.headers || {});
      
        const fetchOptions = {
          method: options.method || "GET",
          credentials: "include",
          headers,
          body: options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
          cache: "no-store",
          redirect: "follow"
        };
      
        try {
          console.log("[content.js] 🚀 Making request to:", url);
          console.log("[content.js] 📋 Request options:", {
            method: fetchOptions.method,
            hasBody: !!fetchOptions.body,
            bodyLength: fetchOptions.body?.length,
            headers: Object.keys(fetchOptions.headers)
          });
          
          // ========================================
          // ВИПРАВЛЕННЯ: Використовуємо XMLHttpRequest замість fetch
          // Це обходить CSP обмеження на деяких Creatio інстансах
          // ========================================
          
          return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Timeout 15 секунд
            xhr.timeout = 15000;
            
            xhr.onload = function() {
              console.log("[content.js] 📥 XHR Response:", {
                status: xhr.status,
                statusText: xhr.statusText,
                contentType: xhr.getResponseHeader("content-type")
              });
              
              const ct = xhr.getResponseHeader("content-type") || "";
              const text = xhr.responseText;
              
              let data = text;
              if (ct.includes("application/json")) {
                try {
                  data = text ? JSON.parse(text) : {};
                } catch (parseError) {
                  console.warn("[content.js] JSON parse failed:", parseError);
                  console.log("[content.js] Raw text:", text.substring(0, 200));
                }
              }
              
              const isOk = xhr.status >= 200 && xhr.status < 300;
              
              console.log("[content.js] ✅ XHR Success:", {
                ok: isOk,
                status: xhr.status,
                contentType: ct,
                dataLength: typeof data === 'string' ? data.length : JSON.stringify(data).length,
                isOData: typeof data === 'object' && ('value' in data || '@odata.context' in data)
              });
              
              resolve({
                ok: isOk,
                status: xhr.status,
                data,
                raw: text,
                contentType: ct,
                url
              });
            };
            
            xhr.onerror = function() {
              console.error("[content.js] ❌ XHR Network Error");
              resolve({
                ok: false,
                status: 0,
                error: "XHR Network Error",
                errorType: "NetworkError",
                url,
                fetchFailed: true,
                timestamp: new Date().toISOString()
              });
            };
            
            xhr.ontimeout = function() {
              console.error("[content.js] ❌ XHR Timeout");
              resolve({
                ok: false,
                status: 0,
                error: "XHR Timeout (15s)",
                errorType: "Timeout",
                url,
                fetchFailed: true,
                timestamp: new Date().toISOString()
              });
            };
            
            xhr.onabort = function() {
              console.error("[content.js] ❌ XHR Aborted");
              resolve({
                ok: false,
                status: 0,
                error: "XHR Aborted",
                errorType: "AbortError",
                url,
                fetchFailed: true,
                timestamp: new Date().toISOString()
              });
            };
            
            // Відкриваємо запит
            xhr.open(fetchOptions.method, url, true);
            
            // Додаємо headers
            for (const [key, value] of Object.entries(fetchOptions.headers)) {
              xhr.setRequestHeader(key, value);
            }
            
            // Встановлюємо withCredentials для cookies
            xhr.withCredentials = true;
            
            // Відправляємо запит
            console.log("[content.js] 📤 Sending XHR request...");
            xhr.send(fetchOptions.body || null);
          });
          
        } catch (error) {
          console.error("[content.js] ❌ Unexpected error:", {
            message: error.message,
            name: error.name,
            stack: error.stack?.substring(0, 300)
          });
          
          return { 
            ok: false, 
            status: 0, 
            error: error.message || String(error),
            errorType: error.name,
            url,
            fetchFailed: true,
            timestamp: new Date().toISOString()
          };
        }
    }
  
    // ---------------- Init ----------------
// ---------------- Init ----------------
async function init() {
    const { creatioUrl } = await new Promise(resolve => 
      chrome.storage.sync.get({ creatioUrl: "" }, resolve)
    );
    setCreatioUrl(creatioUrl);
    
    // НОВА ПЕРЕВІРКА: чи ми взагалі на правильній сторінці?
    const isLoginPage = /\/Login/i.test(location.pathname) || /NuiLogin/i.test(location.href);
    const isStudioSelector = location.hostname === 'studio.creatio.com' && /ClientApp|EnvironmentManagement/i.test(location.href);
    
    if (isLoginPage) {
      console.log("[content.js] ⚠️ On login page, content script inactive");
      state.isCreatioTab = false;
      return;
    }
    
    if (isStudioSelector) {
      console.log("[content.js] ⚠️ On studio.creatio.com selector, content script inactive");
      state.isCreatioTab = false;
      return;
    }
    
    if (!state.isCreatioTab) {
      console.log("[content.js] ⚠️ Not a configured Creatio tenant tab");
      return;
    }
    
    console.log("[content.js] ✅ Content script ready on:", location.origin);
    chrome.runtime.sendMessage({ 
      action: "contentScriptReady", 
      origin: location.origin,
      isReady: state.isCreatioTab 
    });
  }
  
    // ---------------- Messages ----------------
    // ============================================
    // ВИПРАВЛЕНИЙ ФРАГМЕНТ content.js
    // Замінити message listener (рядки 177-200)
    // ============================================

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        // ✅ ВИПРАВЛЕНО: ping повертає pong для узгодженості
        if (request.action === "ping") {
          sendResponse({ 
            pong: true, 
            success: true, 
            isCreatioTab: state.isCreatioTab, 
            ts: Date.now() 
          });
          return; // sync
        }

        if (request.action === "proxyFetch") {
          (async () => {
            try {
              const result = await apiFetch(request.endpoint, request.options || {});
              sendResponse(result);
            } catch (e) {
              sendResponse({ ok: false, status: 0, error: e?.message || String(e) });
            }
          })();
          return true; // async
        }

        sendResponse({ ok: false, status: 0, error: "Unknown action" });
      } catch (e) {
        sendResponse({ ok: false, status: 0, error: e?.message || String(e) });
      }
    });
  
    // ---------------- React to settings change ----------------
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (changes.creatioUrl) setCreatioUrl(changes.creatioUrl.newValue);
    });
  
    // ---------------- Boot ----------------
    init().catch(() => {});
  })();
  