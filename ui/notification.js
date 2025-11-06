// ============================================
// Notification Window Script
// ============================================

let notificationData = null;
let windowId = null;
let autoCloseTimer = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Notification Window] DOM loaded');
  
  // Отримуємо ID вікна
  chrome.windows.getCurrent((window) => {
    windowId = window.id;
    console.log('[Notification Window] Window ID:', windowId);
    
    // Запитуємо дані у background
    requestNotificationData();
  });
  
  // Слухаємо повідомлення від background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'notification-data') {
      console.log('[Notification Window] Received data:', message.data);
      notificationData = message.data;
      renderNotification();
      sendResponse({ success: true });
      return true;
    }
  });
  
  // Setup event listeners
  setupEventListeners();
});

// ============================================
// REQUEST DATA
// ============================================

function requestNotificationData() {
  // Даємо час background script відправити дані
  setTimeout(() => {
    if (!notificationData) {
      console.warn('[Notification Window] No data received, closing...');
      window.close();
    }
  }, 2000);
}

// ============================================
// RENDER NOTIFICATION
// ============================================

function renderNotification() {
  if (!notificationData) return;
  
  const {
    title,
    message,
    typeId,
    priority,
    createdOn,
    isVisa,
    autoClose
  } = notificationData;
  
  // Title
  document.getElementById('notifTitle').textContent = truncate(title, 40);
  
  // Message (truncate до 200 символів)
  document.getElementById('notifMessage').textContent = truncate(message, 200);
  
  // Type badge (опціонально)
  const typeEl = document.getElementById('notifType');
  if (typeId) {
    typeEl.textContent = getTypeName(typeId);
    typeEl.style.display = 'inline-block';
  }
  
  // Time
  const timeEl = document.getElementById('notifTime');
  if (createdOn) {
    timeEl.textContent = formatTime(createdOn);
    timeEl.style.display = 'inline-block';
  }
  
  // Priority header color
  if (priority > 0) {
    document.getElementById('notifHeader').classList.add('high-priority');
  }
  
  // Visa section
  if (isVisa) {
    document.getElementById('visaSection').style.display = 'block';
    document.getElementById('visaBtn').style.display = 'flex';
    document.getElementById('doneBtn').style.display = 'none';
  } else {
    document.getElementById('visaSection').style.display = 'none';
    document.getElementById('visaBtn').style.display = 'none';
    document.getElementById('doneBtn').style.display = 'flex';
  }
  
  // Auto-close timer
  if (autoClose > 0) {
    startAutoCloseTimer(autoClose);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Close button
  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });
  
  // Header click - відкрити URL
  document.getElementById('notifHeader').addEventListener('click', () => {
    handleAction('click');
  });
  
  // Delete button
  document.getElementById('deleteBtn').addEventListener('click', () => {
    handleAction('delete');
  });
  
  // Done button
  document.getElementById('doneBtn').addEventListener('click', () => {
    handleAction('done');
  });
  
  // Visa submit button
  document.getElementById('visaBtn').addEventListener('click', () => {
    handleVisaSubmit();
  });
}

// ============================================
// ACTIONS
// ============================================

function handleAction(action) {
  if (!notificationData) return;
  
  console.log('[Notification Window] Action:', action);
  
  // Відправляємо повідомлення в background
  chrome.runtime.sendMessage({
    type: 'notification-action',
    windowId: windowId,
    action: action,
    data: notificationData
  }).then(() => {
    window.close();
  }).catch(err => {
    console.error('[Notification Window] Failed to send action:', err);
    window.close();
  });
}

function handleVisaSubmit() {
  const select = document.getElementById('visaSelect');
  const decision = select.value;
  
  if (!decision) {
    // Highlight select якщо не обрано
    select.style.borderColor = '#dc2626';
    select.focus();
    setTimeout(() => {
      select.style.borderColor = '#f59e0b';
    }, 1000);
    return;
  }
  
  console.log('[Notification Window] Visa decision:', decision);
  
  // Відправляємо повідомлення в background
  chrome.runtime.sendMessage({
    type: 'notification-action',
    windowId: windowId,
    action: 'visa',
    data: {
      ...notificationData,
      decision: decision
    }
  }).then(() => {
    window.close();
  }).catch(err => {
    console.error('[Notification Window] Failed to send visa decision:', err);
    window.close();
  });
}

// ============================================
// AUTO-CLOSE TIMER
// ============================================

function startAutoCloseTimer(seconds) {
  const timerBar = document.getElementById('timerBar');
  timerBar.style.animation = `timer-countdown ${seconds}s linear`;
  
  autoCloseTimer = setTimeout(() => {
    console.log('[Notification Window] Auto-closing...');
    window.close();
  }, seconds * 1000);
}

// ============================================
// HELPERS
// ============================================

function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function getTypeName(typeId) {
  const types = {
    'ead36165-7815-45d1-9805-1faa47de504a': 'Visa',
    '337065ba-e6e6-4086-b493-0f6de115bc7a': 'Reminder',
    '7e1bf266-2e6b-49a5-982b-4ae407f3ae26': 'System',
    '8ebcc160-7a78-444b-8904-0a78348a5141': 'Email',
    'ae6c7636-32fd-4548-91a7-1784a28e7f9e': 'Custom',
    'fa41b6a0-eafd-4bb9-a913-aa74000b46f6': 'ESN'
  };
  return types[typeId] || 'Notification';
}

function formatTime(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
