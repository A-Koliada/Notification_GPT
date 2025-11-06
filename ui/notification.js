// ============================================
// Notification Window Script
// ============================================

let notificationData = null;
let windowId = null;
let autoCloseTimer = null;

const TYPE_LABELS = {
  Visa: '✍️ Visa',
  Reminder: '🔔 Reminder',
  Email: '📧 Email',
  ESN: '💬 ESN',
  System: '⚙️ System',
  Custom: '⭐ Custom'
};

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

  const container = document.getElementById('notificationRoot');
  if (container) {
    container.classList.toggle('high-priority', priority > 0);
  }

  document.getElementById('notifTitle').textContent = truncate(title, 60);
  const singleLine = truncate(getFirstLine(message), 120);
  document.getElementById('notifMessage').textContent = singleLine;

  const typeName = getTypeName(typeId);
  const typeLabel = TYPE_LABELS[typeName] || TYPE_LABELS.Custom;
  document.getElementById('notifType').textContent = typeLabel;

  document.getElementById('notifTime').textContent = createdOn ? formatTime(createdOn) : '';

  if (isVisa) {
    document.getElementById('visaSection').style.display = 'flex';
    document.getElementById('doneBtn').style.display = 'none';
    populateVisaOptions();
  } else {
    document.getElementById('visaSection').style.display = 'none';
    document.getElementById('doneBtn').style.display = 'inline-flex';
  }

  if (autoClose > 0) {
    startAutoCloseTimer(autoClose);
  } else {
    resetAutoCloseTimer();
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

  // Основний блок - відкрити URL
  document.getElementById('notifBody').addEventListener('click', () => {
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

  // Visa select change
  document.getElementById('visaSelect').addEventListener('change', (event) => {
    const decision = event.target.value;
    if (decision) {
      handleVisaDecision(decision);
    }
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

function handleVisaDecision(decision) {
  if (!notificationData) return;
  const select = document.getElementById('visaSelect');
  if (!decision) {
    return;
  }

  console.log('[Notification Window] Visa decision:', decision);

  chrome.runtime.sendMessage({
    type: 'notification-action',
    windowId: windowId,
    action: 'visa',
    data: {
      ...notificationData,
      decision: decision
    }
  }).then(() => {
    if (select) {
      select.disabled = true;
    }
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
  resetAutoCloseTimer();
  const timerBar = document.getElementById('timerBar');
  if (!timerBar) return;

  timerBar.style.animation = `timer-countdown ${seconds}s linear`;
  autoCloseTimer = setTimeout(() => {
    console.log('[Notification Window] Auto-closing...');
    window.close();
  }, seconds * 1000);
}

function resetAutoCloseTimer() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  const timerBar = document.getElementById('timerBar');
  if (timerBar) {
    timerBar.style.animation = 'none';
    // force reflow to restart animation later
    void timerBar.offsetWidth;
  }
}

// ============================================
// HELPERS
// ============================================

function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function getFirstLine(str) {
  if (!str) return '';
  const [firstLine] = String(str).split(/\r?\n/);
  return firstLine || '';
}

function populateVisaOptions() {
  const select = document.getElementById('visaSelect');
  if (!select) return;

  const options = [
    { value: 'positive', label: '✅ Positive' },
    { value: 'negative', label: '❌ Negative' },
    { value: 'canceled', label: '🚫 Canceled' }
  ];

  const shuffled = options
    .map(item => ({ sort: Math.random(), value: item }))
    .sort((a, b) => a.sort - b.sort)
    .map(item => item.value);

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Select decision --';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  for (const option of shuffled) {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    select.appendChild(optionEl);
  }

  select.disabled = false;
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
  return types[typeId] || 'Custom';
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
