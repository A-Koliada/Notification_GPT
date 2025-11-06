// ============================================
// DN APP USER MANAGER - SIMPLIFIED v2
// ТІЛЬКИ OData, БЕЗ ДУБЛІКАТІВ
// ============================================

const LOG = (...args) => console.log("[DnAppUser]", ...args);
const WARN = (...args) => console.warn("[DnAppUser]", ...args);

class DnAppUserManager {
  constructor(creatioAPI) {
    this.api = creatioAPI;
    this.lastRegistrationTime = null;
    this.registrationCooldown = 30000; // 30 секунд cooldown
  }

  // ============================================
  // REGISTER OR UPDATE - SIMPLIFIED
  // ============================================
  async registerOrUpdateUser(additionalFields = {}) {
    // Cooldown для запобігання занадто частих запитів
    if (this.lastRegistrationTime && 
        (Date.now() - this.lastRegistrationTime < this.registrationCooldown)) {
      LOG("⏳ Cooldown active, skipping registration");
      return { skipped: true, reason: "cooldown" };
    }

    LOG("🔄 Starting registration/update process");

    try {
      // 1. Отримати ContactId
      const contactId = await this.api.getContactId();
      if (!contactId) {
        WARN("❌ Cannot register without ContactId");
        return { success: false, error: "No ContactId" };
      }
      
      LOG("👤 Current Contact ID:", contactId);

      // 2. Перевірити чи існує запис DnAppUser
      LOG("🔍 Searching for existing DnAppUser record...");
      const existingUser = await this.api.getDnAppUser(contactId);

      // ⚠️ ВАЖЛИВО: Якщо getDnAppUser повернув null через network error
      // НЕ створюємо новий запис! Просто пропускаємо цей раз
      if (existingUser === null) {
        // Це може означати:
        // a) Запису немає (тоді можна створити)
        // b) Network error (тоді НЕ можна створити - буде дублікат!)
        
        // Як відрізнити? Якщо є network проблеми - getDnAppUser записує це в лог
        // Тому перевіримо чи були помилки в останніх 5 секунд
        
        WARN("⚠️ getDnAppUser returned null - checking if safe to create...");
        
        // Простіший підхід: спробуємо створити ТІЛЬКИ якщо це перший запуск
        // Інакше - пропускаємо
        if (this.lastRegistrationTime) {
          WARN("⚠️ Not first run and getDnAppUser returned null - skipping to prevent duplicates");
          return { success: false, error: "Unsafe to create (possible network issues)" };
        }
      }

      // 3. Підготувати дані для оновлення/створення
      const now = new Date().toISOString();
      const userAgent = navigator.userAgent || "";
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const locale = navigator.language || "en-US";
      
      const sessionCount = (existingUser?.DnSessionCount || 0) + 1;

      const userData = {
        DnLastActivityOn: now,
        DnLastIp: "", // Не можемо отримати IP з extension
        DnLastUserAgent: userAgent,
        DnSessionCount: sessionCount,
        DnIsActive: true,
        DnTimeZone: timeZone,
        DnLocale: locale,
        ...additionalFields
      };

      // 4A. Оновити існуючий запис
      if (existingUser?.Id) {
        LOG("✅ Found existing DnAppUser with ID:", existingUser.Id);
        LOG("📝 Updating existing record");

        const success = await this.api.updateDnAppUser(existingUser.Id, userData);
        
        if (success) {
          LOG("✅ DnAppUser successfully updated");
          this.lastRegistrationTime = Date.now();
          return {
            success: true,
            updated: true,
            Id: existingUser.Id,
            sessionCount
          };
        } else {
          WARN("⚠️ Update failed, but not creating duplicate");
          return { success: false, error: "Update failed" };
        }
      }

      // 4B. Створити новий запис (ТІЛЬКИ якщо точно немає існуючого)
      LOG("❌ No existing DnAppUser found");
      LOG("➕ Creating NEW DnAppUser record for Contact:", contactId);

      const createData = {
        DnContactId: contactId,
        DnFirstSeenOn: now,
        ...userData
      };

      const result = await this.api.createDnAppUser(createData);
      
      if (result?.Id) {
        LOG("✅ DnAppUser successfully created with ID:", result.Id);
        this.lastRegistrationTime = Date.now();
        return {
          success: true,
          created: true,
          Id: result.Id,
          sessionCount: 1
        };
      } else {
        WARN("⚠️ Create returned no ID");
        return { success: false, error: "Create failed" };
      }

    } catch (error) {
      WARN("❌ Registration error:", error);
      return { 
        success: false, 
        error: error.message || String(error) 
      };
    }
  }

  // ============================================
  // GET USER INFO
  // ============================================
  async getUserInfo(contactId) {
    if (!contactId) {
      contactId = await this.api.getContactId();
    }
    
    if (!contactId) {
      return null;
    }

    return await this.api.getDnAppUser(contactId);
  }
}

// ⬇️ ЕКСПОРТ (ES6 модуль)
export { DnAppUserManager };
