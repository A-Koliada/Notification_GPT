# UI - Notification Window

## Файли в цій папці:

- `notification.html` - HTML структура для mini-window
- `notification.css` - Стилі
- `notification.js` - Логіка вікна

Всі файли **повністю готові** і не потребують змін!

## Як працює:

1. WindowNotifier створює popup window з notification.html
2. Background відправляє дані через chrome.runtime.sendMessage
3. notification.js отримує дані і рендерить їх
4. При діях користувача (click/delete/done/visa) відправляє action назад в background
5. Background викликає onAction callback і закриває вікно
