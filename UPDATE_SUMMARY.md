# CREATIO NOTIFICATIONS - ОНОВЛЕННЯ v3.0
# Підтримка Popup Notifications з двома режимами доставки

## 📋 ЗАГАЛЬНИЙ ОГЛЯД ЗМІН

Це оновлення додає підтримку спливаючих вікон (popup notifications) з двома режимами доставки:
1. **System Mode** - через chrome.notifications API
2. **Mini-window Mode** - власні вікна з повною кастомізацією

Особлива увага прид

іляється **Visa** нотифікаціям з dropdown вибором рішення.

---

## 🔧 ФАЙЛИ ЩО ПОТРЕБУЮТЬ ОНОВЛЕННЯ:

### 1. **storage/db-manager.js** ⚠️ КРИТИЧНО
**Статус:** ПОВНІСТЮ ЗАМІНИТИ

**Зміни:**
- Оновлення схеми БД з v1 до v3
- Додано objectStore "queue" для PATCH черги з ретраями
- Додано нові індекси: `seen`, `softDelete`, `suppressed`, `contentHash`
- Нові методи:
  - `addToQueue(id, op, payload)`
  - `getReadyQueueItems()`
  - `updateQueueItem(queueId, updates)`
  - `removeFromQueue(queueId)`
  - `clearQueue()`
  - `getUnreadCount()`
  - `getActiveNotifications()`
  - `getNotificationById(id)`
  - `upsertNotification(notification)`

**Примітка:** Схема v3 повністю сумісна зі старими даними. При першому запуску відбудеться автоматична міграція.

---

### 2. **api/creatio-api.js** ⚠️ КРИТИЧНО
**Статус:** ОНОВИТИ МЕТОДИ

**Методи для ЗАМІНИ:**
- `getNotifications()` - тепер працює з DnNotifications, нові фільтри
- `setNotificationRead()` - підтримка DnIsRead + DnDateRead
- `deleteNotification()` - тепер через DnDelete=true (soft delete)
- `setVisaDecision()` - нова логіка (positive/negative/canceled)
- `request()` - додано автоматичну підстановку BPMCSRF

**Нові методи для ДОДАВАННЯ:**
- `getNotificationsSince(sinceIso, options)` - інкрементальна синхронізація
- `getBPMCSRF()` - отримання CSRF токена з cookies
- `_normalizeDnNotification(raw)` - нормалізація даних

**Файл інструкцій:** `api/CREATIO_API_CHANGES.txt`

---

### 3. **api/sync-manager.js** ⚠️ КРИТИЧНО  
**Статус:** ПОВНІСТЮ ЗАМІНИТИ

**Ключові зміни:**
- Двостороння синхронізація з PATCH чергою
- Підтримка contentHash для дедуплікації
- Логіка повторів (repeatLeft)
- Інтеграція з notifiers (System + Mini-window)
- Методи:
  - `syncNow()` - з підтримкою queue
  - `pushQueue()` - відправка PATCH з backoff (5s → 30s → 2m → 10m → 30m)
  - `pullSince(sinceIso)` - отримання нових
  - `upsertNotifications()` - diff + dedupe
  - `showNotification()` - універсальний показ
  - `markAsRead()`, `deleteNotification()`, `setVisaDecision()` - через queue

---

### 4. **notifiers/os-notifier.js** ✅ НОВИЙ ФАЙЛ
**Статус:** ДОДАТИ

**Опис:**
System-режим через `chrome.notifications` API.

**Функціонал:**
- Показ нотифікацій через ОС
- 2 кнопки: "🗑 Delete" і "✔ Done"
- Клік по нотифікації відкриває URL
- `requireInteraction` опція з налаштувань
- Обробка подій: click, buttonClick, closed

---

### 5. **notifiers/window-notifier.js** ✅ НОВИЙ ФАЙЛ
**Статус:** ДОДАТИ

**Опис:**
Mini-window режим через `chrome.windows.create()`.

**Функціонал:**
- Створення popup вікон у правому верхньому куті
- Каскадне розміщення (зсув 30px)
- Auto-close таймер (за замовчуванням 10с)
- Підтримка Visa dropdown
- Messaging між background і вікном

---

### 6. **ui/notification.html** ⚠️ КРИТИЧНО
**Статус:** ПОВНІСТЮ ЗАМІНИТИ

**Опис:**
Сучасний UI для mini-window нотифікацій.

**Основні елементи:**
- Header з градієнтом та кнопкою закриття
- Body з title, message, metadata
- **Visa section** з dropdown (Positive/Negative/Canceled)
- Footer з кнопками:
  - "Delete" (завжди)
  - "Mark as read" (для звичайних)
  - "Submit Visa" (тільки для Visa)
- Auto-close timer bar (прогрес-бар)
- Клік по вікну відкриває URL

---

### 7. **ui/notification.css** ✅ НОВИЙ ФАЙЛ
**Статус:** ДОДАТИ

**Опис:**
Сучасний дизайн для notification window.

**Особливості:**
- Градієнтний header (синій для normal, червоний для high priority)
- Анімації (fadeIn, slideIn)
- Підтримка різних пріоритетів
- Адаптивний scrollbar
- Hover ефекти на кнопках

---

### 8. **ui/notification.js** ✅ НОВИЙ ФАЙЛ
**Статус:** ДОДАТИ

**Опис:**
Логіка для notification window.

**Функціонал:**
- Отримання даних від background
- Рендеринг контенту (truncate до 200 символів)
- Auto-close таймер з анімацією
- Обробка дій:
  - click → відкрити URL + mark as read
  - delete → додати в queue
  - done → mark as read
  - visa submit → перевірка вибору + PATCH

---

### 9. **options.html** ⚠️ ДОДАТИ СЕКЦІЮ
**Статус:** РОЗШИРИТИ

**Нова секція:** "Notification Delivery"

**Налаштування:**
```html
<section class="settings-section">
  <h2>Notification Delivery</h2>
  
  <!-- Вибір режиму -->
  <div class="settings-group">
    <label>Delivery Mode</label>
    <select id="deliveryMode">
      <option value="system">System Notifications</option>
      <option value="window">Mini-window</option>
    </select>
  </div>
  
  <!-- System Mode налаштування -->
  <div id="systemSettings">
    <label>
      <input type="checkbox" id="requireInteraction">
      Require interaction (stay until closed)
    </label>
    
    <label>Repeat count</label>
    <input type="number" id="repeatCount" min="0" max="10" value="3">
    
    <label>Repeat interval (seconds)</label>
    <input type="number" id="repeatInterval" min="60" value="60">
  </div>
  
  <!-- Mini-window налаштування -->
  <div id="windowSettings">
    <label>Auto-close (seconds, 0 = never)</label>
    <input type="number" id="autoClose" min="0" max="60" value="10">
    
    <label>
      <input type="checkbox" id="cascade" checked>
      Cascade windows
    </label>
  </div>
  
  <!-- Visa налаштування -->
  <div class="settings-group">
    <label>
      <input type="checkbox" id="openUrlAfterVisa" checked>
      Open URL after Visa decision
    </label>
  </div>
  
  <!-- Типи нотифікацій -->
  <div class="settings-group">
    <h3>Notification Types</h3>
    <p>Select which types to receive:</p>
    
    <label>
      <input type="checkbox" id="type_visa" value="ead36165-7815-45d1-9805-1faa47de504a" checked>
      <span class="type-indicator" style="background: #dc2626"></span>
      Visa
    </label>
    
    <label>
      <input type="checkbox" id="type_reminder" value="337065ba-e6e6-4086-b493-0f6de115bc7a" checked>
      <span class="type-indicator" style="background: #f59e0b"></span>
      Reminder
    </label>
    
    <label>
      <input type="checkbox" id="type_system" value="7e1bf266-2e6b-49a5-982b-4ae407f3ae26" checked>
      <span class="type-indicator" style="background: #3b82f6"></span>
      System
    </label>
    
    <label>
      <input type="checkbox" id="type_email" value="8ebcc160-7a78-444b-8904-0a78348a5141" checked>
      <span class="type-indicator" style="background: #8b5cf6"></span>
      Email
    </label>
    
    <label>
      <input type="checkbox" id="type_custom" value="ae6c7636-32fd-4548-91a7-1784a28e7f9e" checked>
      <span class="type-indicator" style="background: #10b981"></span>
      Custom
    </label>
    
    <label>
      <input type="checkbox" id="type_esn" value="fa41b6a0-eafd-4bb9-a913-aa74000b46f6" checked>
      <span class="type-indicator" style="background: #06b6d4"></span>
      ESN
    </label>
  </div>
</section>
```

---

### 10. **options.js** ⚠️ РОЗШИРИТИ
**Статус:** ДОДАТИ КОД

**Нові функції:**
```javascript
// Завантаження налаштувань
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    // ... існуючі
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
      'ead36165-7815-45d1-9805-1faa47de504a': '#dc2626', // Visa - red
      '337065ba-e6e6-4086-b493-0f6de115bc7a': '#f59e0b', // Reminder - orange
      '7e1bf266-2e6b-49a5-982b-4ae407f3ae26': '#3b82f6', // System - blue
      '8ebcc160-7a78-444b-8904-0a78348a5141': '#8b5cf6', // Email - purple
      'ae6c7636-32fd-4548-91a7-1784a28e7f9e': '#10b981', // Custom - green
      'fa41b6a0-eafd-4bb9-a913-aa74000b46f6': '#06b6d4'  // ESN - cyan
    }
  });
  
  // Заповнити поля
  document.getElementById('deliveryMode').value = settings.deliveryMode;
  document.getElementById('requireInteraction').checked = settings.requireInteraction;
  document.getElementById('repeatCount').value = settings.repeatCount;
  document.getElementById('repeatInterval').value = settings.repeatInterval;
  document.getElementById('autoClose').value = settings.autoClose;
  document.getElementById('cascade').checked = settings.cascade;
  document.getElementById('openUrlAfterVisa').checked = settings.openUrlAfterVisa;
  
  // Заповнити типи
  settings.enabledTypes.forEach(typeId => {
    const checkbox = document.querySelector(`input[value="${typeId}"]`);
    if (checkbox) checkbox.checked = true;
  });
  
  // Показати/сховати секції
  toggleDeliverySettings(settings.deliveryMode);
}

// Перемикання видимості налаштувань
function toggleDeliverySettings(mode) {
  document.getElementById('systemSettings').style.display = 
    mode === 'system' ? 'block' : 'none';
  document.getElementById('windowSettings').style.display = 
    mode === 'window' ? 'block' : 'none';
}

// При зміні режиму
document.getElementById('deliveryMode').addEventListener('change', (e) => {
  toggleDeliverySettings(e.target.value);
});

// Збереження
async function saveSettings() {
  const settings = {
    // ... існуючі
    deliveryMode: document.getElementById('deliveryMode').value,
    requireInteraction: document.getElementById('requireInteraction').checked,
    repeatCount: parseInt(document.getElementById('repeatCount').value),
    repeatInterval: parseInt(document.getElementById('repeatInterval').value),
    autoClose: parseInt(document.getElementById('autoClose').value),
    cascade: document.getElementById('cascade').checked,
    openUrlAfterVisa: document.getElementById('openUrlAfterVisa').checked,
    
    // Збираємо enabled types
    enabledTypes: Array.from(document.querySelectorAll('.settings-group input[type="checkbox"]:checked'))
      .filter(cb => cb.value && cb.value.includes('-'))
      .map(cb => cb.value)
  };
  
  await chrome.storage.sync.set(settings);
  await chrome.runtime.sendMessage({ action: 'settingsUpdated' });
}
```

---

### 11. **background.js** ⚠️ КРИТИЧНО
**Статус:** РОЗШИРИТИ

**Зміни:**

1. **Імпорти** (на початку файлу):
```javascript
import { OSNotifier } from "/notifiers/os-notifier.js";
import { WindowNotifier } from "/notifiers/window-notifier.js";
```

2. **Розширити state**:
```javascript
const state = {
  // ... існуючі поля
  notifier: null, // OSNotifier або WindowNotifier
  deliveryMode: 'system', // 'system' | 'window'
  notificationSettings: {
    requireInteraction: false,
    repeatCount: 3,
    repeatInterval: 60,
    autoClose: 10,
    cascade: true,
    openUrlAfterVisa: true,
    enabledTypes: [...],
    typeColors: {...}
  }
};
```

3. **Нова функція initializeNotifier()**:
```javascript
async function initializeNotifier() {
  // Отримуємо налаштування
  const settings = await chrome.storage.sync.get({
    deliveryMode: 'system',
    requireInteraction: false,
    repeatCount: 3,
    repeatInterval: 60,
    autoClose: 10,
    cascade: true,
    openUrlAfterVisa: true,
    enabledTypes: [...],
    typeColors: {...}
  });
  
  state.deliveryMode = settings.deliveryMode;
  state.notificationSettings = settings;
  
  // Callback для дій користувача
  const onAction = async (notificationId, action, data) => {
    log(`📢 Notification action: ${action} for ${data.id}`);
    
    switch (action) {
      case 'click':
        // Відкрити URL
        if (data.sourceUrl) {
          const fullUrl = state.creatioUrl + data.sourceUrl;
          await chrome.tabs.create({ url: fullUrl });
        }
        // Позначити як прочитано
        await state.syncManager.markAsRead(data.id);
        break;
      
      case 'delete':
        await state.syncManager.deleteNotification(data.id);
        break;
      
      case 'done':
        await state.syncManager.markAsRead(data.id);
        break;
      
      case 'visa':
        await state.syncManager.setVisaDecision(data.id, data.decision);
        // Відкрити URL якщо налаштовано
        if (settings.openUrlAfterVisa && data.sourceUrl) {
          const fullUrl = state.creatioUrl + data.sourceUrl;
          await chrome.tabs.create({ url: fullUrl });
        }
        break;
    }
  };
  
  // Створюємо відповідний notifier
  if (settings.deliveryMode === 'system') {
    state.notifier = new OSNotifier(onAction);
  } else {
    state.notifier = new WindowNotifier(onAction);
  }
  
  log(`✅ Notifier initialized: ${settings.deliveryMode}`);
}
```

4. **Оновити initializeManagers()**:
```javascript
async function initializeManagers() {
  // ... існуючий код
  
  // Додати після ініціалізації sync manager:
  await initializeNotifier();
  
  // Передати notifier в sync manager
  state.syncManager.setNotifier(state.notifier);
}
```

5. **Обробка settingsUpdated**:
```javascript
case "settingsUpdated": {
  await loadSettings();
  await initializeNotifier(); // Переініціалізувати notifier
  await initializeManagers();
  sendResponse({ success: true });
  return;
}
```

---

### 12. **popup.html/js** ⚙️ ОПЦІОНАЛЬНО
**Статус:** ПОКРАЩЕННЯ

**Зміни:**
- Додати відображення типу нотифікації з кольоровою стрічкою
- Фільтр по типах
- Покращений дизайн

**Примітка:** Ці зміни не критичні і можуть бути відкладені.

---

## 📦 НОВІ КОНСТАНТИ

### Типи нотифікацій (DnNotificationType):
```javascript
const NOTIFICATION_TYPES = {
  VISA: 'ead36165-7815-45d1-9805-1faa47de504a',
  REMINDER: '337065ba-e6e6-4086-b493-0f6de115bc7a',
  SYSTEM: '7e1bf266-2e6b-49a5-982b-4ae407f3ae26',
  EMAIL: '8ebcc160-7a78-444b-8904-0a78348a5141',
  CUSTOM: 'ae6c7636-32fd-4548-91a7-1784a28e7f9e',
  ESN: 'fa41b6a0-eafd-4bb9-a913-aa74000b46f6'
};

const TYPE_COLORS = {
  [NOTIFICATION_TYPES.VISA]: '#dc2626',     // Червоний
  [NOTIFICATION_TYPES.REMINDER]: '#f59e0b', // Помаранчевий
  [NOTIFICATION_TYPES.SYSTEM]: '#3b82f6',   // Синій
  [NOTIFICATION_TYPES.EMAIL]: '#8b5cf6',    // Фіолетовий
  [NOTIFICATION_TYPES.CUSTOM]: '#10b981',   // Зелений
  [NOTIFICATION_TYPES.ESN]: '#06b6d4'       // Cyan
};
```

---

## 🔄 ПОСЛІДОВНІСТЬ ВСТАНОВЛЕННЯ:

### Крок 1: Резервна копія
```bash
# Створіть резервну копію існуючого додатку
cp -r extension extension_backup_$(date +%Y%m%d)
```

### Крок 2: Оновлення БД
1. Замініть `storage/db-manager.js` новою версією
2. При першому запуску відбудеться автоматична міграція до v3

### Крок 3: Оновлення API
1. Відкрийте `api/creatio-api.js`
2. Використайте інструкції з файлу `api/CREATIO_API_CHANGES.txt`
3. Замініть/додайте вказані методи

### Крок 4: Оновлення Sync Manager
1. Замініть `api/sync-manager.js` новою версією

### Крок 5: Додати Notifiers
1. Створіть директорію `notifiers/`
2. Додайте `os-notifier.js`
3. Додайте `window-notifier.js`

### Крок 6: Оновлення UI
1. Створіть директорію `ui/` (або використайте існуючу)
2. Замініть `notification.html` новою версією
3. Додайте `notification.css`
4. Додайте `notification.js`

### Крок 7: Розширення Options
1. Відкрийте `options.html`
2. Додайте нову секцію "Notification Delivery" (див. вище)
3. Оновіть `options.js` новими функціями

### Крок 8: Оновлення Background
1. Відкрийте `background.js`
2. Додайте імпорти notifiers
3. Додайте `initializeNotifier()`
4. Оновіть `initializeManagers()`

### Крок 9: Тестування
1. Відкрийте Chrome → Extensions → Load unpacked
2. Виберіть папку з оновленим розширенням
3. Перевірте:
   - Відкриття Settings → нова секція присутня
   - Синхронізація працює
   - Нотифікації показуються в обраному режимі
   - Visa dropdown працює в mini-window
   - Дії (Done/Delete/Visa) працюють

---

## ✅ КОНТРОЛЬНИЙ СПИСОК:

- [ ] Резервна копія створена
- [ ] db-manager.js оновлено (v3)
- [ ] creatio-api.js оновлено (нові методи)
- [ ] sync-manager.js замінено
- [ ] notifiers створено (os-notifier + window-notifier)
- [ ] notification.html/css/js створено
- [ ] options.html розширено (нова секція)
- [ ] options.js оновлено
- [ ] background.js оновлено
- [ ] Тестування пройдено

---

## 🐛 МОЖЛИВІ ПРОБЛЕМИ:

### 1. Міграція БД не відбулася
**Симптом:** Помилки в консолі про відсутні індекси

**Рішення:**
```javascript
// В консолі браузера виконайте:
indexedDB.deleteDatabase('CreatioNotificationsDB');
// Потім перезавантажте розширення
```

### 2. Нотифікації не показуються
**Перевірте:**
- Налаштування дозволів (Permissions)
- Налаштування в options → Notification Delivery
- Консоль background.js на помилки
- Чи правильно ініціалізовано notifier

### 3. Visa dropdown не з'являється
**Перевірте:**
- Тип нотифікації має typeId = 'ead36165-7815-45d1-9805-1faa47de504a'
- window-notifier правильно визначає isVisa
- notification.html містить visa-section

---

## 📞 ПІДТРИМКА:

При виникненні проблем:
1. Перевірте консоль Background (chrome://extensions → Details → Inspect views)
2. Перевірте консоль Notification window (F12 на вікні)
3. Перевірте chrome.storage.sync.get() на правильність налаштувань

---

**Версія:** 3.0.0  
**Дата:** 2024-10-28  
**Автор:** Claude AI Assistant
