# Зміни в розширенні Creatio Notifications v2.3.1

## Дата: 22 жовтня 2025

### Проблеми, що були виправлені:

#### 1. Масове підключення з 10 спробами кожного запиту ❌→✅
**Проблема:** Функція `contentFetch` в `background.js` робила 10 спроб для кожного невдалого запиту, що призводило до сотень невдалих спроб підключення.

**Рішення:** Зменшено кількість спроб з 10 до 3 у функції `contentFetch` (background.js, рядок 379).

**Файли змінені:**
- `background.js` - рядок 379: `for (let i = 0; i < 3; i++)` замість `for (let i = 0; i < 10; i++)`
- `background.js` - рядок 399: `Attempt ${i + 1}/3` замість `Attempt ${i + 1}/10`
- `background.js` - рядок 413: `після 3 спроб` замість `після 10 спроб`

---

#### 2. Неправильна назва об'єкта DnNotification ❌→✅
**Проблема:** У системі назва об'єкта `DnNotifications` (з "s" на кінці), але в коді використовувалась назва `DnNotification`.

**Рішення:** Змінено всі посилання на об'єкт з `DnNotification` на `DnNotifications` в усіх OData та EntityDataService запитах.

**Файли змінені:**
- `api/creatio-api.js` - всі рядки, де використовується `/odata/DnNotification` → `/odata/DnNotifications`
- `api/creatio-api.js` - всі рядки, де `RootSchemaName: "DnNotification"` → `RootSchemaName: "DnNotifications"`

**Змінені рядки:**
- 446: `/odata/DnNotifications?...`
- 448: `"OData DnNotifications since"`
- 482: `/odata/DnNotifications?...`
- 485: `"OData DnNotifications"`
- 491: `/odata/DnNotifications?...`
- 494: `"OData DnNotifications (unread)"`
- 523: `RootSchemaName: "DnNotifications"`
- 558: `RootSchemaName: "DnNotifications"`
- 589: `"EntityDataService.Select DnNotifications"`
- 604: `/odata/DnNotifications(...)`
- 617: `RootSchemaName: "DnNotifications"`
- 642: `/odata/DnNotifications(...)`
- 648: `RootSchemaName: "DnNotifications"`
- 675: `/odata/DnNotifications(...)`
- 688: `RootSchemaName: "DnNotifications"`

---

#### 3. Використання застарілих полів DnExternalUserId та DnExternalUser ❌→✅
**Проблема:** При створенні запису `DnAppUser` використовувались поля `DnExternalUserId` та `DnExternalUser`, які більше не потрібні.

**Рішення:** Видалено всі посилання на `DnExternalUserId` з функції `createDnAppUser`.

**Файли змінені:**
- `api/creatio-api.js` - рядок 261: видалено `DnExternalUserId: fields?.DnExternalUserId || ""`
- `api/creatio-api.js` - рядок 334: видалено `"DnExternalUserId": this._cvText(requiredData.DnExternalUserId)`

---

## Підсумок змін:

### background.js
- ✅ Зменшено кількість спроб підключення з 10 до 3
- ✅ Оптимізовано час очікування між спробами

### api/creatio-api.js
- ✅ Змінено назву об'єкта з `DnNotification` на `DnNotifications` у всіх місцях
- ✅ Видалено застаріле поле `DnExternalUserId` з створення `DnAppUser`
- ✅ Залишено тільки актуальні поля відповідно до нової структури

### Очікуваний результат:
1. **Значне зменшення навантаження на сервер** - замість сотень невдалих спроб буде максимум кілька десятків
2. **Правильна робота з нотифікаціями** - запити будуть йти до правильного об'єкта `DnNotifications`
3. **Коректне створення записів DnAppUser** - без застарілих полів, що можуть викликати помилки

### Структура для створення DnAppUser (оновлена):
```json
{
  "DnContact": { "Id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  "DnDaysUntilDeactivation": 14,
  "DnDaysUntiDelete": 30,
  "DnFerstSeenOn": "2025-10-12T14:30:00Z",
  "DnIsActive": true,
  "DnLastActivityOn": "2025-10-12T14:30:00Z",
  "DnLastIp": "192.168.1.100",
  "DnLastUserAgent": "Mozilla/5.0...",
  "DnLocale": "uk-UA",
  "DnNotificationEnabled": true,
  "DnReceiveNotifications": true,
  "DnReceiveNotificationsApproval": true,
  "DnReceiveNotificationsEmail": true,
  "DnReceiveNotificationsFeed": true,
  "DnReceiveNotificationsProcess": true,
  "DnReceiveNotificationsTask": true,
  "DnSessionCount": 1,
  "DnTimeZone": "Europe/Kyiv",
  "DnWebPushAllowed": false
}
```

**Примітка:** Поля `DnExternalUserId` та `DnExternalUser` більше не використовуються.
