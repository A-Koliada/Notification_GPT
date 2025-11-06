// ============================================
/* Creatio API (ESM)
   Версія 2.3.3
   - Фікс _ensurePath для /DataService
   - Прогрів сесії перед Insert (SessionService)
   - Створення DnAppUser з урахуванням Non-nullable рядкових колонок (із $metadata)
   - Нотифікації: getNotifications, getNotificationsSince, mark read/all read, delete
*/
const LOG  = (...a) => console.log("[CreatioAPI]", ...a);
const WARN = (...a) => console.warn("[CreatioAPI]", ...a);

class CreatioAPI {
  constructor() {
    this.baseUrl = "";
    this.transport = null;
    this.csrfToken = null;
    this._knownContactId = null;
    this._inited = false;
  }

  // ------------------------------
  // Init / конфіг
  // ------------------------------
  async init(baseUrl) {
    this.baseUrl = (baseUrl || "").trim().replace(/\s+/g, "").replace(/\/+$/, "");
    if (!this.baseUrl) { WARN("init failed: empty baseUrl"); return false; }
    this.csrfToken = true; // content.js підставляє BPMCSRF з cookie в заголовок
    this._inited = true;
    LOG("Initialized:", { baseUrl: this.baseUrl, hasCsrf: !!this.csrfToken });
    return true;
  }
  setTransport(fn) { this.transport = fn; }
  setKnownContactId(id) { this._knownContactId = id || null; }

  // ------------------------------
  // Helpers
  // ------------------------------
  _ensureInited() {
    if (!this._inited || !this.baseUrl) throw new Error("CreatioAPI is not initialized. Call init(baseUrl) first.");
    if (!this.transport) throw new Error("CreatioAPI transport not set. Call setTransport(fn).");
  }
  _ensurePath(ep) {
    if (!ep) ep = "/";
    if (!ep.startsWith("/")) ep = "/" + ep;
    if (
      ep.startsWith("/0/") ||
      ep.startsWith("/odata/") ||
      ep.startsWith("/ServiceModel/") ||
      ep.startsWith("/DataService/") ||
      ep.startsWith("/Nui/")
    ) {
      return ep.startsWith("/0/") ? ep : ("/0" + ep);
    }
    return ep;
  }
  _isLikelyHtml(resObj) {
    const ct = (resObj && resObj.contentType) || "";
    const data = resObj && resObj.data;
    return ct.includes("text/html") || typeof data === "string";
  }
  _ensureJsonOrThrow(resObj, label) {
    if (!resObj) throw new Error((label || "Response") + ": empty");
    if (this._isLikelyHtml(resObj)) throw new Error((label || "Response") + ": non-JSON (likely login page)");
    const d = resObj.data;
    if (d == null || typeof d !== "object") throw new Error((label || "Response") + ": invalid JSON payload");
    return d;
  }
  _cvParam(value, dataValueType) {
    return { "Expression": { "ExpressionType": 2, "Parameter": { "DataValueType": dataValueType, "Value": value } } };
  }
  _cvGuid(guid) { return this._cvParam(guid, 10); }
  _cvBool(b)    { return this._cvParam(!!b, 12); }
  _cvText(t)    { return this._cvParam(String(t), 1); }

  async request(endpoint, options = {}) {
    this._ensureInited();
    const ep = this._ensurePath(endpoint);
    const res = await this.transport(ep, options);
    if (!res) throw new Error(`Empty response for ${ep}`);
    if (res.ok === false) {
      const msg = (typeof res.data === "string" && res.data) || res.raw || `HTTP ${res.status}`;
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return res;
  }
  async get(endpoint, { headers, params, select, top } = {}) {
    let ep = endpoint;
    if (!ep.startsWith("/")) {
      const q = [];
      if (typeof top !== "undefined") q.push(`$top=${encodeURIComponent(top)}`);
      if (select) q.push(`$select=${encodeURIComponent(select)}`);
      if (params && typeof params === "object") {
        for (const [k, v] of Object.entries(params)) {
          if (v == null) continue;
          q.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        }
      }
      ep = `/odata/${encodeURIComponent(endpoint)}${q.length ? ("?" + q.join("&")) : ""}`;
    }
    return this.request(ep, { method: "GET", headers: Object.assign({ "Accept": "application/json" }, headers || {}) });
  }
  async post(endpoint, body, headers) {
    return this.request(endpoint, {
      method: "POST",
      headers: Object.assign({ "Accept": "application/json", "Content-Type": "application/json" }, headers || {}),
      body
    });
  }
  async patch(endpoint, body, headers) {
    const baseHeaders = { "Accept": "application/json", "Content-Type": "application/json", "If-Match": "*" };
    return this.request(endpoint, {
      method: "PATCH",
      headers: Object.assign(baseHeaders, headers || {}),
      body
    });
  }
  async _ensureServerSession() {
    try { await this.post("/ServiceModel/SessionService.svc/GetCurrentUserInfo", {}); } catch {}
  }

  // ------------------------------
  // Current User
  // ------------------------------
  async getCurrentUserInfo() {
    if (this._knownContactId) return { ContactId: this._knownContactId, source: "known" };
    try {
      const r = await this.post("/ServiceModel/SessionService.svc/GetCurrentUserInfo", {});
      const j = this._ensureJsonOrThrow(r, "SessionService");
      const p = j.GetCurrentUserInfoResult || j || {};
      const cid = p.contactId || p.ContactId;
      if (cid) return { ContactId: cid, Name: p.name || p.Name || "User", Id: p.id || p.Id, source: "SessionService" };
    } catch {}
    try {
      const r = await this.post("/ServiceModel/ConfigurationService.svc/GetCurrentUserInfo", {});
      const p = this._ensureJsonOrThrow(r, "ConfigurationService");
      const cid = p.contactId || p.ContactId;
      if (cid) return { ContactId: cid, Name: p.name || p.Name || "User", Id: p.id || p.Id, source: "ConfigurationService" };
    } catch {}
    try {
      const body = {
        RootSchemaName: "Contact",
        OperationType: 0,
        Columns: {
          "Id":   { "Expression": { "ExpressionType": 0, "ColumnPath": "Id"   } },
          "Name": { "Expression": { "ExpressionType": 0, "ColumnPath": "Name" } }
        },
        Filters: {
          "FilterType": 6,
          "ComparisonType": 11,
          "LeftExpression":  { "ExpressionType": 0, "ColumnPath": "Id" },
          "RightExpression": { "ExpressionType": 1, "FunctionType": 2, "MacrosType": 4 }
        },
        IsDistinct: true,
        UseRecordDeactivation: false
      };
      const r = await this.post("/ServiceModel/EntityDataService.svc/Select", body);
      const j = this._ensureJsonOrThrow(r, "EntityDataService.Select");
      if (Array.isArray(j.rows) && j.rows.length) {
        return { ContactId: j.rows[0].Id, Name: j.rows[0].Name, source: "EntityDataService.Select" };
      }
    } catch {}
    try {
      const r = await this.get("Contact", { top: 1, select: "Id,Name" });
      const j = this._ensureJsonOrThrow(r, "ODataFallback");
      if (j && Array.isArray(j.value) && j.value.length) {
        const c = j.value[0];
        return { ContactId: c.Id, Name: c.Name, source: "ODataFallback" };
      }
    } catch {}
    throw new Error("Could not get current user info from any method");
  }

  async getContactId() {
    const SYSTEM_CONTACTS = [
      '05ae5b9b-ee27-4a89-b20f-7395cf09232b', // Creatio Maintenance
      '76929f8c-7e15-4c64-bdb0-aed54463bc00', // Supervisor
      '00000000-0000-0000-0000-000000000000'  // Empty
    ];
  
    // Use cached ContactId if available
    if (this._knownContactId && !SYSTEM_CONTACTS.includes(this._knownContactId)) {
      LOG("✅ Using known ContactId:", this._knownContactId);
      return this._knownContactId;
    }
  
    LOG("🔍 Getting current user ContactId...");
  
    // METHOD 1: Try OData with CurrentUserContactId() function
    try {
      LOG("Attempting OData CurrentUserContactId() method...");
      const r = await this.get("Contact", {
        params: { "$filter": "Id eq CurrentUserContactId()" },
        select: "Id,Name"
      });
      const j = this._ensureJsonOrThrow(r, "OData CurrentUserContactId");
      if (j?.value?.[0]?.Id) {
        const cid = j.value[0].Id;
        if (!SYSTEM_CONTACTS.includes(cid)) {
          LOG("✅ ContactId from OData CurrentUserContactId:", cid);
          this._knownContactId = cid;
          return cid;
        }
      }
    } catch (e) {
      LOG("OData CurrentUserContactId failed:", e?.message);
    }
  
    // METHOD 2: Try SysAdminUnit query with CurrentUser macro
    try {
      LOG("Attempting SysAdminUnit EDS query...");
      const body = {
        RootSchemaName: "SysAdminUnit",
        OperationType: 0,
        Columns: {
          "ContactId": { "Expression": { "ExpressionType": 0, "ColumnPath": "Contact.Id" } },
          "ContactName": { "Expression": { "ExpressionType": 0, "ColumnPath": "Contact.Name" } }
        },
        Filters: {
          "FilterType": 6,
          "ComparisonType": 3,
          "LeftExpression": { "ExpressionType": 0, "ColumnPath": "Id" },
          "RightExpression": { "ExpressionType": 1, "FunctionType": 2, "MacrosType": 1 }
        },
        IsDistinct: true,
        UseRecordDeactivation: false
      };
      
      const r = await this.post("/ServiceModel/EntityDataService.svc/SelectQuery", body);
      const j = this._ensureJsonOrThrow(r, "SysAdminUnit.SelectQuery");
      if (j?.rows?.[0]?.ContactId) {
        const cid = j.rows[0].ContactId;
        if (!SYSTEM_CONTACTS.includes(cid)) {
          LOG("✅ ContactId from SysAdminUnit:", cid);
          this._knownContactId = cid;
          return cid;
        }
      }
    } catch (e) {
      LOG("SysAdminUnit query failed:", e?.message);
    }
  
    // METHOD 3: Try OData SysAdminUnit with current user filter
    try {
      LOG("Attempting OData SysAdminUnit query...");
      const r = await this.get("SysAdminUnit", {
        params: { 
          "$filter": "Id eq CurrentUserId()",
          "$expand": "Contact($select=Id,Name)"
        },
        select: "Id"
      });
      const j = this._ensureJsonOrThrow(r, "OData SysAdminUnit");
      if (j?.value?.[0]?.Contact?.Id) {
        const cid = j.value[0].Contact.Id;
        if (!SYSTEM_CONTACTS.includes(cid)) {
          LOG("✅ ContactId from OData SysAdminUnit:", cid);
          this._knownContactId = cid;
          return cid;
        }
      }
    } catch (e) {
      LOG("OData SysAdminUnit failed:", e?.message);
    }
  
    // METHOD 4: Try SessionService (original method)
    try {
      const r = await this.request("/0/ServiceModel/SessionService.svc/GetCurrentUserInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const j = this._ensureJsonOrThrow(r, "SessionService");
      const cid = j?.contactId || j?.ContactId || j?.GetCurrentUserInfoResult?.contactId;
      if (cid && !SYSTEM_CONTACTS.includes(cid)) {
        LOG("✅ ContactId from SessionService:", cid);
        this._knownContactId = cid;
        return cid;
      }
      LOG("⚠️ SessionService returned system contact:", cid);
    } catch (e) {
      LOG("SessionService failed:", e?.message);
    }
  
    // METHOD 5: Try ConfigurationService (original method)
    try {
      const r = await this.request("/0/ServiceModel/ConfigurationService.svc/GetCurrentUserInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const j = this._ensureJsonOrThrow(r, "ConfigurationService");
      const cid = j?.contactId || j?.ContactId;
      if (cid && !SYSTEM_CONTACTS.includes(cid)) {
        LOG("✅ ContactId from ConfigurationService:", cid);
        this._knownContactId = cid;
        return cid;
      }
      LOG("⚠️ ConfigurationService returned system contact:", cid);
    } catch (e) {
      LOG("ConfigurationService failed:", e?.message);
    }
  
    // METHOD 6: Try EntityDataService with proper body structure
    try {
      LOG("Attempting EntityDataService Contact query...");
      const body = {
        RootSchemaName: "Contact",
        OperationType: 0,
        Columns: {
          "Id":   { "Expression": { "ExpressionType": 0, "ColumnPath": "Id"   } },
          "Name": { "Expression": { "ExpressionType": 0, "ColumnPath": "Name" } }
        },
        Filters: {
          "FilterType": 6,
          "ComparisonType": 11,
          "LeftExpression":  { "ExpressionType": 0, "ColumnPath": "Id" },
          "RightExpression": { "ExpressionType": 1, "FunctionType": 2, "MacrosType": 4 }
        },
        IsDistinct: true,
        UseRecordDeactivation: false
      };
      const r = await this.post("/ServiceModel/EntityDataService.svc/SelectQuery", body);
      const j = this._ensureJsonOrThrow(r, "EntityDataService.Contact");
      if (Array.isArray(j.rows) && j.rows.length > 0) {
        const cid = j.rows[0].Id;
        if (!SYSTEM_CONTACTS.includes(cid)) {
          LOG("✅ ContactId from EntityDataService:", cid);
          this._knownContactId = cid;
          return cid;
        }
      }
    } catch (e) {
      LOG("EntityDataService Contact query failed:", e?.message);
    }

    // METHOD 7: Emergency fallback - Get first Contact from DnAppUser
    try {
      LOG("Attempting emergency fallback via DnAppUser...");
      const r = await this.get("DnAppUser", {
        top: 1,
        select: "DnContactId",
        params: { "$filter": "DnIsActive eq true", "$orderby": "DnLastActivityOn desc" }
      });
      const j = this._ensureJsonOrThrow(r, "DnAppUser fallback");
      if (j?.value?.[0]?.DnContactId) {
        const cid = j.value[0].DnContactId;
        if (!SYSTEM_CONTACTS.includes(cid)) {
          WARN("⚠️ ContactId from DnAppUser fallback (last active user):", cid);
          this._knownContactId = cid;
          return cid;
        }
      }
    } catch (e) {
      LOG("DnAppUser fallback failed:", e?.message);
    }

    // METHOD 8: Absolute last resort - just get ANY Contact from Contact table
    try {
      LOG("Attempting absolute fallback - first Contact from Contact table...");
      const r = await this.get("Contact", {
        top: 1,
        select: "Id,Name"
      });
      const j = this._ensureJsonOrThrow(r, "Contact table fallback");
      if (j?.value?.[0]?.Id) {
        const cid = j.value[0].Id;
        if (!SYSTEM_CONTACTS.includes(cid)) {
          WARN("⚠️⚠️ ContactId from Contact table (FIRST CONTACT - may be wrong user!):", cid);
          WARN("⚠️⚠️ This is emergency fallback. Please check user configuration!");
          this._knownContactId = cid;
          return cid;
        }
      }
    } catch (e) {
      LOG("Contact table fallback failed:", e?.message);
    }
  
    // Остання спроба: повернути збережений ContactId навіть якщо system
    if (this._knownContactId) {
      WARN("⚠️ Returning stored ContactId (may be system):", this._knownContactId);
      return this._knownContactId;
    }
  
    LOG("❌ Could not get valid ContactId from any method");
    throw new Error("Cannot determine current user ContactId");
  }

  // ------------------------------
  // DnAppUser
  // ------------------------------
// ============================================
// ФІНАЛЬНИЙ getDnAppUser (БЕЗ DnContactId в $select)
// Замінити в creatio-api.js
// ============================================

async getDnAppUser(contactId) {
  const cid = contactId || await this.getContactId();
  
  // ✅ КЕШУВАННЯ: перевіряємо чи вже шукали цей ContactId недавно
  const cacheKey = `dnappuser_${cid}`;
  const cached = this._getDnAppUserCache?.[cacheKey];
  if (cached && (Date.now() - cached.timestamp < 60000)) { // 1 хвилина
    LOG("✅ getDnAppUser: using cached result for", cid);
    return cached.data;
  }
  
  LOG("getDnAppUser: searching for contactId =", cid);

  // ✅ ВИПРАВЛЕНО: Прибрано DnContactId з $select (поле не існує)
  const odataFilters = [
    { filter: `DnContact/Id eq ${cid}`, name: "DnContact/Id (Lookup)" },
    { filter: `ContactId eq ${cid}`, name: "ContactId (Alternative)" },
    { filter: `Contact/Id eq ${cid}`, name: "Contact/Id (No prefix)" }
  ];

  LOG(`📋 Trying ${odataFilters.length} OData filter variants...`);
  
  for (const {filter, name} of odataFilters) {
    try {
      // ✅ ВИПРАВЛЕНО: Прибрано DnContactId з select
      const path = `/odata/DnAppUser?$filter=${filter}&$top=1&$select=Id,DnSessionCount,DnLastActivityOn,DnIsActive`;
      LOG(`  🔍 Attempt OData: ${name}`);
      LOG(`     URL: ${path}`);
      
      const r = await this.request(path, { 
        method: "GET", 
        headers: { "Accept": "application/json" } 
      });
      
      const j = this._ensureJsonOrThrow(r, "OData DnAppUser");
      LOG(`     ✅ Response received:`, j);
      
      if (j?.value?.length) {
        const result = j.value[0];
        LOG(`✅ FOUND existing DnAppUser via OData (${name}):`, result);
        
        // Зберігаємо в кеш
        if (!this._getDnAppUserCache) this._getDnAppUserCache = {};
        this._getDnAppUserCache[cacheKey] = { data: result, timestamp: Date.now() };
        
        return result;
      } else {
        LOG(`     ⚠️ Empty result (no records match filter)`);
      }
    } catch (e) {
      // ❌ Якщо це network error - НЕ продовжуємо пошук! Повертаємо null
      if (e?.message?.includes("Failed to fetch") || e?.message?.includes("після 3 спроб")) {
        WARN("⚠️ Network error in getDnAppUser - returning null to prevent duplicate creation");
        WARN("   Error:", e?.message);
        return null;
      }
      LOG(`     ❌ Failed: ${e?.message || e}`);
    }
  }

  // ❌ Прибрано: Full scan (викликав network errors і створював дублі)
  // Якщо OData фільтри не спрацювали - записутака немає

  LOG("❌ No existing DnAppUser found for contactId:", cid);
  return null;
}


  // УСЕРЕДИНІ класу CreatioAPI
 // FIXED createDnAppUser method for creatio-api.js
// Replace the existing createDnAppUser method with this version

// ============================================
// ВИПРАВЛЕНИЙ createDnAppUser (НЕ кидає помилку)
// Замінити в creatio-api.js (метод createDnAppUser)
// ============================================

// ============================================
// ВИПРАВЛЕНИЙ createDnAppUser
// Замінити в /api/creatio-api.js (починаючи з рядка 241)
// ============================================

async createDnAppUser(fields) {
  LOG("createDnAppUser: fields =", fields);

  const contactId =
    fields?.DnContactId ||
    fields?.ContactId ||
    fields?.DnContact?.Id ||
    await this.getContactId();
  
  if (!contactId) throw new Error("createDnAppUser: no ContactId");

  // ✅ ВСІ ПОЛЯ включаючи обов'язкові Nullable="false"
  const userData = {
    // Lookup на Contact
    DnContactId: contactId,
    
    // Базові поля
    DnFirstSeenOn: fields?.DnFirstSeenOn || new Date().toISOString(),
    DnLastActivityOn: fields?.DnLastActivityOn || new Date().toISOString(),
    
    // ✅ ОБОВ'ЯЗКОВІ STRING поля (Nullable="false")
    DnNotes: fields?.DnNotes || "",
    DnLastIp: fields?.DnLastIp || "",
    DnLastUserAgent: fields?.DnLastUserAgent || navigator.userAgent || "",
    DnTimeZone: fields?.DnTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv",
    DnLocale: fields?.DnLocale || navigator.language || "uk-UA",
    DnWebPushEndpoint: fields?.DnWebPushEndpoint || "",
    DnBrowserFingerprint: fields?.DnBrowserFingerprint || "",
    DnExternalUserId: fields?.DnExternalUserId || "",
    
    // Статус
    DnIsActive: fields?.DnIsActive !== undefined ? fields.DnIsActive : true,
    DnSessionCount: fields?.DnSessionCount || 1,
    
    // Дні до деактивації/видалення
    DnDaysUntilDeactivation: fields?.DnDaysUntilDeactivation || 14,
    DnDaysUntilDelete: fields?.DnDaysUntilDelete || 30,
    
    // Налаштування нотифікацій
    DnNotificationsEnabled: fields?.DnNotificationsEnabled !== undefined ? fields.DnNotificationsEnabled : true,
    DnReceiveNotifications: fields?.DnReceiveNotifications !== undefined ? fields.DnReceiveNotifications : true,
    DnReceiveNotificationsApproval: fields?.DnReceiveNotificationsApproval !== undefined ? fields.DnReceiveNotificationsApproval : true,
    DnReceiveNotificationsEmail: fields?.DnReceiveNotificationsEmail !== undefined ? fields.DnReceiveNotificationsEmail : true,
    DnReceiveNotificationsFeed: fields?.DnReceiveNotificationsFeed !== undefined ? fields.DnReceiveNotificationsFeed : true,
    DnReceiveNotificationsProcess: fields?.DnReceiveNotificationsProcess !== undefined ? fields.DnReceiveNotificationsProcess : true,
    DnReceiveNotificationsTask: fields?.DnReceiveNotificationsTask !== undefined ? fields.DnReceiveNotificationsTask : true,
    
    // Web Push
    DnWebPushAllowed: fields?.DnWebPushAllowed !== undefined ? fields.DnWebPushAllowed : false
  };

  LOG("Creating DnAppUser with all required fields:", userData);

  // ✅ ТІЛЬКИ OData (EntityDataService видалено через HTTP 401 помилки)
  try {
    LOG("🔄 Trying OData POST to /odata/DnAppUser...");
    
    const response = await this.post("/odata/DnAppUser", userData);
    LOG("✅ OData insert response:", response);
    
    // Даємо час на збереження
    await new Promise(r => setTimeout(r, 800));
    
    // Перевіряємо що запис створився
    const created = await this.getDnAppUser(contactId);
    if (created?.Id) {
      LOG("✅ DnAppUser created successfully with ID:", created.Id);
      return created;
    } else {
      WARN("⚠️ OData POST succeeded but cannot find created record");
      return null;
    }
  } catch (e) {
    // Якщо це network error - не логуємо як критичну помилку
    if (e?.message?.includes("Failed to fetch")) {
      WARN("⚠️ Network error during create - will retry on next attempt");
      return null;
    }
    WARN("❌ OData insert failed:", e?.message || e);
    return null;
  }
}

  
 // ------------------------------
// Update DnAppUser
// ------------------------------
// ============================================
// ФІНАЛЬНИЙ updateDnAppUser (згідно з вашим JSON)
// Замінити в creatio-api.js
// ============================================

async updateDnAppUser(dnAppUserId, fields) {
  LOG("updateDnAppUser: id =", dnAppUserId, "fields =", fields);
  
  if (!dnAppUserId) throw new Error("updateDnAppUser: no DnAppUser ID");
  
  // ✅ Відповідно до вашого JSON приклад для оновлення
  const updateData = {
    DnLastActivityOn: fields?.DnLastActivityOn || new Date().toISOString(),
    DnLastIp: fields?.DnLastIp,
    DnLastUserAgent: fields?.DnLastUserAgent,
    DnSessionCount: fields?.DnSessionCount,
    DnIsActive: fields?.DnIsActive,
    DnTimeZone: fields?.DnTimeZone,
    DnLocale: fields?.DnLocale,
    DnDaysUntilDeactivation: fields?.DnDaysUntilDeactivation,
    DnDaysUntilDelete: fields?.DnDaysUntilDelete,
    DnNotificationsEnabled: fields?.DnNotificationsEnabled,
    DnReceiveNotifications: fields?.DnReceiveNotifications,
    DnReceiveNotificationsApproval: fields?.DnReceiveNotificationsApproval,
    DnReceiveNotificationsEmail: fields?.DnReceiveNotificationsEmail,
    DnReceiveNotificationsFeed: fields?.DnReceiveNotificationsFeed,
    DnReceiveNotificationsProcess: fields?.DnReceiveNotificationsProcess,
    DnReceiveNotificationsTask: fields?.DnReceiveNotificationsTask,
    DnWebPushAllowed: fields?.DnWebPushAllowed
  };
  
  // Видаляємо undefined поля
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) delete updateData[key];
  });
  
  LOG("📤 Updating DnAppUser with fields:", JSON.stringify(updateData, null, 2));
  
  // ✅ ВИПРАВЛЕНО: без guid' в URL
  try {
    LOG("🔍 Trying OData PATCH...");
    await this.patch(`/odata/DnAppUser(${dnAppUserId})`, updateData);
    LOG("✅ DnAppUser updated via OData");
    return true;
  } catch (e) {
    WARN("❌ OData PATCH failed:", e?.message);
    LOG("   💡 Full error:", e);
  }
  
  return false;
}

  // ------------------------------
  // Notifications
  // ------------------------------
_mapNotification(raw) {
    const id = raw.Id || raw.id || raw.PrimaryColumnValue || raw.primaryColumnValue || null;
    const title = raw.DnTitle || raw.Title || raw.Name || raw.Caption || raw.Subject || raw.dnTitle || null;
    const message = raw.DnMessage || raw.Message || raw.Body || raw.Text || raw.Description || raw.DnBody || raw.dnBody || null;
    const created = raw.CreatedOn || raw.createdOn || raw.SysCreatedOn || raw.sysCreatedOn || null;
    const isRead = (typeof raw.DnIsRead === "boolean" ? raw.DnIsRead : undefined)
                ?? (typeof raw.IsRead === "boolean" ? raw.IsRead : undefined)
                ?? (typeof raw.Read   === "boolean" ? raw.Read   : undefined)
                ?? false;
    
    // Include all notification fields
    return { 
      Id: id, 
      DnTitle: title,
      DnMessage: message, 
      CreatedOn: created, 
      DnIsRead: !!isRead,
      DnSourceUrl: raw.DnSourceUrl || raw.sourceUrl || null,
      DnNotificationTypeId: raw.DnNotificationTypeId || raw.notificationTypeId || null,
      DnNotificationType: raw.DnNotificationType || null,
      DnPriority: raw.DnPriority || raw.priority || 0,
      DnContactId: raw.DnContactId || raw.ContactId || null,
      DnVisaStatusId: raw.DnVisaStatusId || null,
      DnDataRead: raw.DnDataRead || null,
      DnVisaCanceled: raw.DnVisaCanceled || false,
      DnVisaNegative: raw.DnVisaNegative || false,
      DnVisaPositive: raw.DnVisaPositive || false,
      Raw: raw 
    };
}

async getNotifications({ onlyUnread = false, limit = 100 } = {}) {
    // Спробуємо отримати ContactId, але якщо не вдасться - продовжимо без фільтра
    let contactId = null;
    try {
      contactId = this._knownContactId || await this.getContactId();
      LOG("✅ getNotifications using ContactId:", contactId);
    } catch (e) {
      WARN("⚠️ Could not get ContactId for notifications, will try without filter:", e?.message);
    }

    // OData - спочатку з ContactId, потім без
    if (contactId) {
      try {
        const arr = await this._tryGetODataNotifications(contactId, { onlyUnread, limit });
        if (arr?.length) {
          LOG(`✅ Got ${arr.length} notifications via OData with ContactId`);
          return arr.map(n => this._mapNotification(n));
        }
      } catch (e) { 
        WARN("OData getNotifications with ContactId failed:", e?.message || e); 
      }
    }

    // OData без фільтра по ContactId (fallback)
    try {
      LOG("Trying OData without ContactId filter...");
      const top = Math.max(1, Math.min(500, Number(limit) || 100));
      const select = [
        "Id", "DnTitle", "DnMessage", "DnSourceUrl", "DnIsRead", "DnContactId",
        "CreatedOn", "DnPriority", "DnNotificationTypeId"
      ].join(",");
      
      let query = `/odata/DnNotifications?$top=${top}&$orderby=CreatedOn desc&$select=${encodeURIComponent(select)}`;
      if (onlyUnread) {
        query += `&$filter=${encodeURIComponent('DnIsRead eq false')}`;
      }
      
      const r = await this.request(query, { method: "GET", headers: { "Accept": "application/json" } });
      const j = this._ensureJsonOrThrow(r, "OData DnNotifications without filter");
      if (j?.value?.length) {
        LOG(`✅ Got ${j.value.length} notifications via OData without ContactId`);
        // Якщо ContactId відомий - фільтруємо на клієнті
        let filtered = j.value;
        if (contactId) {
          filtered = j.value.filter(n => n.DnContactId === contactId || n.ContactId === contactId);
          LOG(`Filtered to ${filtered.length} notifications for current user`);
        }
        return filtered.map(n => this._mapNotification(n));
      }
    } catch (e) { 
      WARN("OData getNotifications without filter failed:", e?.message || e); 
    }

    // Простіший OData запит - абсолютний мінімум без фільтрів
    try {
      LOG("Trying simplest OData query...");
      const query = `/odata/DnNotifications?$top=${Math.min(limit, 100)}`;
      const r = await this.request(query, { method: "GET", headers: { "Accept": "application/json" } });
      const j = this._ensureJsonOrThrow(r, "OData DnNotifications minimal");
      if (j?.value?.length) {
        LOG(`✅ Got ${j.value.length} notifications via minimal OData`);
        // Фільтруємо на клієнті
        let filtered = j.value;
        if (contactId) {
          filtered = j.value.filter(n => n.DnContactId === contactId || n.ContactId === contactId);
          LOG(`Filtered to ${filtered.length} for current user`);
        }
        if (onlyUnread) {
          filtered = filtered.filter(n => !n.DnIsRead && !n.IsRead && !n.Read);
          LOG(`Filtered to ${filtered.length} unread`);
        }
        return filtered.map(n => this._mapNotification(n));
      }
    } catch (e) {
      WARN("Minimal OData query failed:", e?.message || e);
    }

    // ❌ Прибрано: EntityDataService (давав HTTP 401)
    // Залишено ТІЛЬКИ OData GET запити

    WARN("⚠️ Could not fetch notifications from any OData method");
    return [];
  }

  async getNotificationsSince(sinceIso, options = {}) {
    const sinceTs = Date.parse(sinceIso || "") || 0;

    // (спроба OData фільтра по CreatedOn)
    try {
      const contactId = await this.getContactId();
      const baseFilters = [
        `DnRecipientId eq guid'${contactId}'`,
        `RecipientId eq guid'${contactId}'`,
        `ContactId eq guid'${contactId}'`,
        `DnContactId eq guid'${contactId}'`,
        `DnRecipient/Id eq guid'${contactId}'`,
        `Recipient/Id eq guid'${contactId}'`,
        `Contact/Id eq guid'${contactId}'`
      ];
      const tsIso = new Date(sinceTs).toISOString();
      const byDate = [`CreatedOn gt ${tsIso}`, `SysCreatedOn gt ${tsIso}`];

      const select = [
        "Id", "Title", "Name", "Caption", "Subject",
        "Body", "Message", "Text", "Description",
        "CreatedOn", "SysCreatedOn",
        "IsRead", "DnIsRead", "Read"
      ].join(",");

      for (const fc of baseFilters) {
        for (const fd of byDate) {
          const both = encodeURIComponent(`${fc} and ${fd}`);
          const path = `/odata/DnNotifications?$top=200&$orderby=CreatedOn desc&$select=${encodeURIComponent(select)}&$filter=${both}`;
          const r = await this.request(path, { method: "GET", headers: { "Accept": "application/json" } });
          const j = this._ensureJsonOrThrow(r, "OData DnNotifications since");
          if (j?.value?.length) return j.value.map(n => this._mapNotification(n));
        }
      }
    } catch {}

    // фолбек — беремо все і фільтруємо на клієнті
    const all = await this.getNotifications(options);
    return (all || []).filter(n => {
      const d = n.CreatedOn || (n.Raw && (n.Raw.CreatedOn || n.Raw.SysCreatedOn)) || "";
      return (Date.parse(d) || 0) > sinceTs;
    });
  }

  async _tryGetODataNotifications(contactId, { onlyUnread, limit }) {
    const filtersByContact = [
      `DnContactId eq guid'${contactId}'`,
      `DnContact/Id eq guid'${contactId}'`,
      `DnRecipientId eq guid'${contactId}'`,
      `RecipientId eq guid'${contactId}'`,
      `ContactId eq guid'${contactId}'`,
      `DnRecipient/Id eq guid'${contactId}'`,
      `Recipient/Id eq guid'${contactId}'`,
      `Contact/Id eq guid'${contactId}'`
    ];
    const unreadFilters = ['DnIsRead eq false', 'IsRead eq false', 'Read eq false'];
    const top = Math.max(1, Math.min(500, Number(limit) || 100));
    const select = [
      "Id", "DnTitle", "DnMessage", "DnSourceUrl", "DnIsRead", "DnContactId",
      "CreatedOn", "DnPriority", "DnNotificationTypeId",
      "DnVisaStatusId", "DnDataRead", "DnVisaCanceled", "DnVisaNegative", "DnVisaPositive"
    ].join(",");

    for (const fc of filtersByContact) {
      let query = `/odata/DnNotifications?$top=${top}&$orderby=CreatedOn desc&$select=${encodeURIComponent(select)}&$filter=${encodeURIComponent(fc)}`;
      try {
        const r = await this.request(query, { method: "GET", headers: { "Accept": "application/json" } });
        const j = this._ensureJsonOrThrow(r, "OData DnNotifications");
        if (j?.value?.length) {
          return j.value;
        }
      } catch {}
      if (onlyUnread) {
        for (const fu of unreadFilters) {
          const both = `${fc} and ${fu}`;
          query = `/odata/DnNotifications?$top=${top}&$orderby=CreatedOn desc&$select=${encodeURIComponent(select)}&$filter=${encodeURIComponent(both)}`;
          try {
            const r2 = await this.request(query, { method: "GET", headers: { "Accept": "application/json" } });
            const j2 = this._ensureJsonOrThrow(r2, "OData DnNotifications (unread)");
            if (j2?.value?.length) {
              // Map the expanded navigation property
              return j2.value.map(n => ({
                ...n,
                DnNotificationType: n.DnNotificationType?.Name || n.DnNotificationType
              }));
            }
          } catch {}
        }
      }
    }
    return [];
  }

  async _tryGetEdsNotifications(contactId, { onlyUnread, limit }) {
    const top = Math.max(1, Math.min(500, Number(limit) || 100));
    const contactColumnCandidates = ["DnRecipient", "Recipient", "Contact", "DnContact"];
    const unreadColumnCandidates = ["DnIsRead", "IsRead", "Read"];

    const bodies = [];
    for (const contactCol of contactColumnCandidates) {
      const baseFilter = {
        "FilterType": 6,
        "LogicalOperation": 0,
        "Items": {
          "ByContact": {
            "FilterType": 1,
            "ComparisonType": 11,
            "LeftExpression": { "ExpressionType": 0, "ColumnPath": contactCol },
            "RightExpression": { "ExpressionType": 1, "FunctionType": 2, "MacrosType": 4 }
          }
        }
      };
      bodies.push({
        RootSchemaName: "DnNotifications",
        OperationType: 0,
        Columns: {
          "Id":            { "Expression": { "ExpressionType": 0, "ColumnPath": "Id" } },
          "Title":         { "Expression": { "ExpressionType": 0, "ColumnPath": "Title" } },
          "Name":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Name" } },
          "Caption":       { "Expression": { "ExpressionType": 0, "ColumnPath": "Caption" } },
          "Subject":       { "Expression": { "ExpressionType": 0, "ColumnPath": "Subject" } },
          "Body":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Body" } },
          "Message":       { "Expression": { "ExpressionType": 0, "ColumnPath": "Message" } },
          "Text":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Text" } },
          "Description":   { "Expression": { "ExpressionType": 0, "ColumnPath": "Description" } },
          "CreatedOn":     { "Expression": { "ExpressionType": 0, "ColumnPath": "CreatedOn" } },
          "SysCreatedOn":  { "Expression": { "ExpressionType": 0, "ColumnPath": "SysCreatedOn" } },
          "IsRead":        { "Expression": { "ExpressionType": 0, "ColumnPath": "IsRead" } },
          "DnIsRead":      { "Expression": { "ExpressionType": 0, "ColumnPath": "DnIsRead" } },
          "Read":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Read" } }
        },
        Filters: baseFilter,
        IsDistinct: true,
        RowsOffset: 0,
        RowsLimit: top,
        IsPageable: true,
        UseRecordDeactivation: false
      });

      if (onlyUnread) {
        const unreadFilter = JSON.parse(JSON.stringify(baseFilter));
        unreadFilter.Items.Unread = {
          "FilterType": 1,
          "ComparisonType": 3,
          "LeftExpression": { "ExpressionType": 0, "ColumnPath": unreadColumnCandidates[0] }, // сервер сам підбере
          "RightExpression": { "ExpressionType": 2, "Parameter": { "DataValueType": 12, "Value": false } }
        };
        bodies.push({
          RootSchemaName: "DnNotifications",
          OperationType: 0,
          Columns: {
            "Id":            { "Expression": { "ExpressionType": 0, "ColumnPath": "Id" } },
            "Title":         { "Expression": { "ExpressionType": 0, "ColumnPath": "Title" } },
            "Name":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Name" } },
            "Caption":       { "Expression": { "ExpressionType": 0, "ColumnPath": "Caption" } },
            "Subject":       { "Expression": { "ExpressionType": 0, "ColumnPath": "Subject" } },
            "Body":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Body" } },
            "Message":       { "Expression": { "ExpressionType": 0, "ColumnPath": "Message" } },
            "Text":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Text" } },
            "Description":   { "Expression": { "ExpressionType": 0, "ColumnPath": "Description" } },
            "CreatedOn":     { "Expression": { "ExpressionType": 0, "ColumnPath": "CreatedOn" } },
            "SysCreatedOn":  { "Expression": { "ExpressionType": 0, "ColumnPath": "SysCreatedOn" } },
            "IsRead":        { "Expression": { "ExpressionType": 0, "ColumnPath": "IsRead" } },
            "DnIsRead":      { "Expression": { "ExpressionType": 0, "ColumnPath": "DnIsRead" } },
            "Read":          { "Expression": { "ExpressionType": 0, "ColumnPath": "Read" } }
          },
          Filters: unreadFilter,
          IsDistinct: true,
          RowsOffset: 0,
          RowsLimit: top,
          IsPageable: true,
          UseRecordDeactivation: false
        });
      }
    }

    for (const body of bodies) {
      try {
        const r = await this.post("/ServiceModel/EntityDataService.svc/Select", body);
        const j = this._ensureJsonOrThrow(r, "EntityDataService.Select DnNotifications");
        if (Array.isArray(j.rows) && j.rows.length) return j.rows;
      } catch {}
    }
    return [];
  }

  // Позначити як прочитане
  async setNotificationRead(id, isRead = true) {
    if (!id) return;

    // OData PATCH (пробуємо різні назви)
    const candidates = [{ DnIsRead: !!isRead }, { IsRead: !!isRead }, { Read: !!isRead }];
    for (const payload of candidates) {
      try {
        await this.patch(`/odata/DnNotifications(${id})`, payload);
        return true;
      } catch {}
    }

    // EDS Update — також з різними назвами
    const itemsArr = [
      { "DnIsRead": this._cvBool(!!isRead) },
      { "IsRead": this._cvBool(!!isRead) },
      { "Read": this._cvBool(!!isRead) }
    ];
    for (const Items of itemsArr) {
      try {
        const body = { RootSchemaName: "DnNotifications", PrimaryColumnValue: id, ColumnValues: { Items } };
        await this.post("/ServiceModel/EntityDataService.svc/Update", body);
        return true;
      } catch {}
    }
    return false;
  }

  // Позначити всі як прочитані (простий варіант)
  async setAllNotificationsRead(contactId) {
    const list = await this.getNotifications({ onlyUnread: true, limit: 500 });
    let ok = 0;
    for (const n of list) {
      const done = await this.setNotificationRead(n.Id, true);
      if (done) ok++;
    }
    return ok;
  }

  // Видалення
  async deleteNotification(id) {
    if (!id) return;

    // OData DELETE
    try {
      await this.request(`/odata/DnNotifications(${id})`, { method: "DELETE", headers: { "If-Match": "*" } });
      return true;
    } catch {}

    // EDS Delete
    try {
      const body = { RootSchemaName: "DnNotifications", PrimaryColumnValue: id };
      await this.post("/ServiceModel/EntityDataService.svc/Delete", body);
      return true;
    } catch {}
    return false;
  }

  // Опційно: оновлення рішення по візі
  // ============================================
  // DEBUGGING METHODS (додано для діагностики)
  // ============================================
  
  async checkDnAppUserSchema() {
    try {
      const result = await this.get("DnAppUser/$metadata");
      LOG("DnAppUser schema exists:", result);
      return true;
    } catch (e) {
      WARN("DnAppUser schema check failed:", e?.message);
      return false;
    }
  }

  async verifyContactExists(contactId) {
    try {
      const result = await this.get(`Contact(${contactId})`, { select: "Id,Name" });
      const data = this._ensureJsonOrThrow(result, "Contact verification");
      LOG("Contact verified:", data);
      return !!data.Id;
    } catch (e) {
      WARN("Contact verification failed:", e?.message);
      return false;
    }
  }

  async getDnAppUserMetadata() {
    try {
      const result = await this.request("/odata/$metadata?$format=json", { 
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      const data = result.data;
      
      if (data && typeof data === 'object') {
        LOG("Metadata retrieved. Search for DnAppUser schema:", data);
        return data;
      }
    } catch (e) {
      WARN("Metadata fetch failed:", e?.message);
    }
    
    try {
      const result = await this.get("DnAppUser", { top: 1 });
      const data = this._ensureJsonOrThrow(result, "DnAppUser sample");
      if (data.value && data.value[0]) {
        LOG("Sample DnAppUser record structure:", Object.keys(data.value[0]));
        return data.value[0];
      }
    } catch (e) {
      WARN("Sample record fetch failed:", e?.message);
    }
    
    return null;
  }

  // ============================================
  // COMPREHENSIVE DIAGNOSTIC METHOD
  // ============================================
  
  async diagnoseNotificationIssues() {
    const report = {
      timestamp: new Date().toISOString(),
      contactId: null,
      contactIdMethod: null,
      dnAppUserExists: false,
      dnNotificationsSchema: false,
      dnNotificationsCount: 0,
      sampleNotification: null,
      fetchedNotifications: 0,
      errors: []
    };

    LOG("🔍 Starting comprehensive diagnostic...");

    // Test 1: Get ContactId
    try {
      report.contactId = await this.getContactId();
      report.contactIdMethod = "Success";
      LOG("✅ Diagnostic: ContactId obtained:", report.contactId);
    } catch (e) {
      report.errors.push({ test: "getContactId", error: e.message });
      WARN("❌ Diagnostic: ContactId failed:", e.message);
    }

    // Test 2: Check DnAppUser schema
    try {
      const r = await this.get("DnAppUser", { top: 1 });
      this._ensureJsonOrThrow(r, "DnAppUser schema check");
      report.dnAppUserExists = true;
      LOG("✅ Diagnostic: DnAppUser schema exists");
      
      // Try to get user's DnAppUser record
      if (report.contactId) {
        try {
          const userRecord = await this.getDnAppUser(report.contactId);
          if (userRecord) {
            LOG("✅ Diagnostic: Found DnAppUser record for current user:", userRecord);
            report.dnAppUserRecord = userRecord;
          }
        } catch (e) {
          WARN("⚠️ Diagnostic: No DnAppUser record for current user");
        }
      }
    } catch (e) {
      report.errors.push({ test: "DnAppUser schema", error: e.message });
      WARN("❌ Diagnostic: DnAppUser schema missing:", e.message);
    }

    // Test 3: Check DnNotifications schema
    try {
      const r = await this.get("DnNotifications", { top: 1 });
      const j = this._ensureJsonOrThrow(r, "DnNotifications schema check");
      report.dnNotificationsSchema = true;
      report.dnNotificationsCount = j?.value?.length || 0;
      if (j?.value?.[0]) {
        report.sampleNotification = j.value[0];
        LOG("✅ Diagnostic: DnNotifications schema exists, sample:", j.value[0]);
      }
    } catch (e) {
      report.errors.push({ test: "DnNotifications schema", error: e.message });
      WARN("❌ Diagnostic: DnNotifications schema missing:", e.message);
    }

    // Test 4: Try to fetch notifications with current ContactId
    if (report.contactId && report.dnNotificationsSchema) {
      try {
        LOG("🔍 Diagnostic: Attempting to fetch notifications...");
        const notifications = await this.getNotifications({ limit: 5 });
        report.fetchedNotifications = notifications.length;
        LOG(`✅ Diagnostic: Fetched ${notifications.length} notifications`);
        if (notifications.length > 0) {
          report.sampleFetchedNotification = notifications[0];
        }
      } catch (e) {
        report.errors.push({ test: "fetch notifications", error: e.message });
        WARN("❌ Diagnostic: Notification fetch failed:", e.message);
      }
    }

    // Test 5: Check database connection count
    try {
      const allNotifs = await this.get("DnNotifications", { 
        top: 100,
        select: "Id,DnContactId"
      });
      const data = this._ensureJsonOrThrow(allNotifs, "Count all notifications");
      if (data?.value) {
        report.totalNotificationsInDB = data.value.length;
        if (report.contactId) {
          const forCurrentUser = data.value.filter(n => 
            n.DnContactId === report.contactId || n.ContactId === report.contactId
          );
          report.notificationsForCurrentUser = forCurrentUser.length;
          LOG(`📊 Diagnostic: Found ${forCurrentUser.length} notifications for current user out of ${data.value.length} total`);
        }
      }
    } catch (e) {
      report.errors.push({ test: "count notifications", error: e.message });
      WARN("⚠️ Diagnostic: Could not count notifications:", e.message);
    }

    LOG("📊 Diagnostic Report Complete:", report);
    return report;
  }
// ==============================


  async setVisaDecision(id, decision) {
    const d = String(decision || '').toLowerCase();
    const body = {
      DnVisaPositive: d === 'positive' || d === 'approved' || d === 'yes' || d === 'true',
      DnVisaNegative: d === 'negative' || d === 'rejected' || d === 'no' || d === 'false',
      DnVisaCanceled: d === 'canceled' || d === 'cancelled'
    };
    if (body.DnVisaPositive) { body.DnVisaNegative = false; body.DnVisaCanceled = false; }
    else if (body.DnVisaNegative) { body.DnVisaPositive = false; body.DnVisaCanceled = false; }
    else if (body.DnVisaCanceled) { body.DnVisaPositive = false; body.DnVisaNegative = false; }
    else { return false; }
    try {
      await this.patch(`/odata/DnNotifications(${id})`, body);
      return true;
    } catch (e) {
      try {
        const Items = Object.fromEntries(Object.entries(body).map(([k,v]) => [k, { "value": v }]));
        const payload = { RootSchemaName: "DnNotifications", PrimaryColumnValue: id, ColumnValues: { Items } };
        await this.post("/ServiceModel/EntityDataService.svc/Update", payload);
        return true;
      } catch (e2) {
        WARN("setVisaDecision failed:", e2?.message || e2);
        return false;
      }
    }
  }


}

export const creatioAPI = new CreatioAPI();
export default creatioAPI;
