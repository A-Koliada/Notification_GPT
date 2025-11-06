/**
 * Locales for Creatio Notifications Extension
 * Supports: Ukrainian (uk), English (en), Polish (pl)
 * Default: Ukrainian (uk)
 */

const translations = {
    uk: {
      // Global
      extensionName: "Creatio Сповіщення",
      loading: "Завантаження...",
      close: "Закрити",
      yes: "Так",
      no: "Ні",
  
      // Popup
      popupTitle: "Сповіщення",
      noNotifications: "Немає нових повідомлень",
      markAllRead: "Прочитати все",
      refresh: "Оновити",
      settings: "Налаштування",
      notificationDate: "Дата",
  
      // Notification
      goToRecord: "Перейти до запису",
      markAsRead: "Прочитано",
  
      // Settings
      settingsTitle: "Налаштування",
      instructionsTitle: "Інструкція",
      languageLabel: "Мова:",
      languageOptions: {
        uk: "Українська",
        en: "English",
        pl: "Polski"
      },
      creatioUrlLabel: "URL Creatio:",
      notificationTimeoutLabel: "Час автозакриття сповіщень (сек):",
      bringToFrontLabel: "Інтервал фокусування вікон (сек):",
      deliveryModeLabel: "Тип сповіщень:",
      deliveryModeOptions: {
        window: "Міні-вікно браузера",
        system: "Системні сповіщення"
      },
      deliveryModeHelp: "Оберіть вигляд спливаючих сповіщень",
      popupRepeatCountLabel: "Тривалість повторів:",
      popupRepeatCountHelp: "Скільки разів повторно показувати сповіщення",
      popupRepeatCountOptions: {
        infinity: "∞ Безкінечно"
      },
      deleteActionLabel: "Видалити",
      markDoneActionLabel: "Позначити як прочитане",
      visaVoteLabel: "Голосування",
      visaVotePlaceholder: "Оберіть рішення",
      visaVotePositive: "Позитивне",
      visaVoteNegative: "Негативне",
      visaVoteCanceled: "Скасовано",
      saveButton: "Зберегти",
      resetButton: "Скинути",
      saveSuccess: "Налаштування збережено!",
      resetSuccess: "Налаштування скинуті!",
  
      // Instructions
      instruction1: "1. Завантажте та встановіть пакет для Creatio",
      instruction2: "2. Вкажіть URL вашої системи Creatio",
      instruction3: "3. Налаштуйте параметри сповіщень",
      instruction4: "4. Встановіть тривалість відображення",
      downloadPackage: "Завантажити пакет",

      // Help
      creatioUrlHelp: "URL вашої Creatio системи для отримання сповіщень",
      notificationTimeoutHelp: "0 = ручне закриття, >0 = автоматичне закриття",
      bringToFrontHelp: "Частота показу вікон на передній план",
      languageHelp: "Мова інтерфейсу розширення",

      //
      markAllRead: "Прочитати все",
      refresh: "Оновити",
      settings: "Налаштування",
      markAllReadIcon: "✅",
      refreshIcon: "🔄",
      settingsIcon: "⚙️",

      // Error
      noNotifications: "Немає нових повідомлень",
      loadError: "Помилка завантаження сповіщень. Перевірте:",
      loadErrorChecklist1: "1. Підключення до інтернету",
      loadErrorChecklist2: "2. URL Creatio у налаштуваннях",
      loadErrorChecklist3: "3. Авторизацію в системі Creatio",
      retryButton: "Повторити спробу",

      // Tabs
      notifications: "Сповіщення", // "Notifications", "Powiadomienia"
      settings: "Налаштування", // "Settings", "Ustawienia" 
      instructions: "Інструкція", // "Instructions", "Instrukcja"
      feedback: "Відгук", // "Feedback", "Opinia"

      // Feedback
      feedbackTitle: "Надіслати відгук або пропозицію", // "Send feedback or suggestion", "Wyślij opinię lub sugestię"
      feedbackPlaceholder: "Повідомлення", // "Message", "Wiadomość"
      sendFeedback: "Надіслати", // "Send", "Wyślij"
      feedbackSent: "Відгук надіслано!", // "Feedback sent!", "Opinia wysłana!"

      // Для української (uk):
      authError: "Не авторизовано в системі Creatio",
      authInstruction: "Для отримання сповіщень необхідно увійти в систему Creatio",
      openCreatio: "Відкрити Creatio",

      // Для української (uk):
      noUrlError: "URL Creatio не вказано",
      noUrlInstruction: "Для отримання сповіщень необхідно вказати URL вашої системи Creatio в налаштуваннях",
      openSettings: "Відкрити налаштування",

    },
  
    en: {
      // Global
      extensionName: "Creatio Notifications",
      loading: "Loading...",
      close: "Close",
      yes: "Yes",
      no: "No",
  
      // Popup
      popupTitle: "Notifications",
      noNotifications: "No new notifications",
      markAllRead: "Mark All Read",
      refresh: "Refresh",
      settings: "Settings",
      notificationDate: "Date",
  
      // Notification
      goToRecord: "Go to Record",
      markAsRead: "Mark as Read",
  
      // Settings
      settingsTitle: "Settings",
      instructionsTitle: "Instructions",
      languageLabel: "Language:",
      languageOptions: {
        uk: "Українська",
        en: "English",
        pl: "Polski"
      },
      creatioUrlLabel: "Creatio URL:",
      notificationTimeoutLabel: "Notification timeout (sec):",
      bringToFrontLabel: "Bring to front interval (sec):",
      deliveryModeLabel: "Notification delivery mode:",
      deliveryModeOptions: {
        window: "Mini browser window",
        system: "System notification"
      },
      deliveryModeHelp: "Choose how popup notifications should appear",
      popupRepeatCountLabel: "Repeat count:",
      popupRepeatCountHelp: "Number of reminder shows for a notification",
      popupRepeatCountOptions: {
        infinity: "∞ Infinite"
      },
      deleteActionLabel: "Delete",
      markDoneActionLabel: "Mark as read",
      visaVoteLabel: "Voting",
      visaVotePlaceholder: "Select decision",
      visaVotePositive: "Positive",
      visaVoteNegative: "Negative",
      visaVoteCanceled: "Canceled",
      saveButton: "Save",
      resetButton: "Reset",
      saveSuccess: "Settings saved!",
      resetSuccess: "Settings reset!",
  
      // Instructions
      instruction1: "1. Download and install Creatio package",
      instruction2: "2. Specify your Creatio system URL",
      instruction3: "3. Configure notification settings",
      instruction4: "4. Set display duration",
      downloadPackage: "Download Package",

      // Help
        creatioUrlHelp: "URL of your Creatio system to receive notifications",
        notificationTimeoutHelp: "0 = manual close, >0 = auto close",
        bringToFrontHelp: "Frequency of bringing windows to front",
        languageHelp: "Extension interface language",
      
      //
        markAllRead: "Mark All Read",
        refresh: "Refresh",
        settings: "Settings",
        markAllReadIcon: "✅",
        refreshIcon: "🔄",
        settingsIcon: "⚙️",

      // Error
      noNotifications: "No new notifications",
      loadError: "Failed to load notifications. Please check:",
      loadErrorChecklist1: "1. Internet connection",
      loadErrorChecklist2: "2. Creatio URL in settings",
      loadErrorChecklist3: "3. Authorization in Creatio",
      retryButton: "Retry",


      // Tabs
      notifications: "Notifications", // "Notifications", "Powiadomienia"
      settings: "Settings", // "Settings", "Ustawienia" 
      instructions: "Instructions", // "Instructions", "Instrukcja"
      feedback: "Feedback", // "Feedback", "Opinia"

      // Feedback
      feedbackTitle: "Send feedback or suggestion", // "Send feedback or suggestion", "Wyślij opinię lub sugestię"
      feedbackPlaceholder: "Message", // "Message", "Wiadomość"
      sendFeedback: "Send", // "Send", "Wyślij"
      feedbackSent: "Feedback sent!", // "Feedback sent!", "Opinia wysłana!"

      // Для англійської (en):
      authError: "Not authorized in Creatio system",
      authInstruction: "To receive notifications you need to login to Creatio system",
      openCreatio: "Open Creatio",

      // Для англійської (en):
      noUrlError: "Creatio URL not specified",
      noUrlInstruction: "To receive notifications you need to specify your Creatio system URL in settings",
      openSettings: "Open Settings",
    },
  
    pl: {
      // Global
      extensionName: "Powiadomienia Creatio",
      loading: "Ładowanie...",
      close: "Zamknij",
      yes: "Tak",
      no: "Nie",
  
      // Popup
      popupTitle: "Powiadomienia",
      noNotifications: "Brak nowych powiadomień",
      markAllRead: "Oznacz wszystkie jako przeczytane",
      refresh: "Odśwież",
      settings: "Ustawienia",
      notificationDate: "Data",
  
      // Notification
      goToRecord: "Przejdź do rekordu",
      markAsRead: "Oznacz jako przeczytane",
  
      // Settings
      settingsTitle: "Ustawienia",
      instructionsTitle: "Instrukcja",
      languageLabel: "Język:",
      languageOptions: {
        uk: "Українська",
        en: "English",
        pl: "Polski"
      },
      creatioUrlLabel: "URL Creatio:",
      notificationTimeoutLabel: "Czas automatycznego zamykania (sek):",
      bringToFrontLabel: "Interwał fokusowania okien (sek):",
      deliveryModeLabel: "Tryb powiadomień:",
      deliveryModeOptions: {
        window: "Mini okno przeglądarki",
        system: "Powiadomienie systemowe"
      },
      deliveryModeHelp: "Wybierz wygląd wyskakujących powiadomień",
      popupRepeatCountLabel: "Liczba powtórzeń:",
      popupRepeatCountHelp: "Ile razy ponawiać wyświetlenie powiadomienia",
      popupRepeatCountOptions: {
        infinity: "∞ Bez ograniczeń"
      },
      deleteActionLabel: "Usuń",
      markDoneActionLabel: "Oznacz jako przeczytane",
      visaVoteLabel: "Głosowanie",
      visaVotePlaceholder: "Wybierz decyzję",
      visaVotePositive: "Pozytywna",
      visaVoteNegative: "Negatywna",
      visaVoteCanceled: "Anulowana",
      saveButton: "Zapisz",
      resetButton: "Resetuj",
      saveSuccess: "Ustawienia zapisane!",
      resetSuccess: "Ustawienia zresetowane!",
  
      // Instructions
      instruction1: "1. Pobierz i zainstaluj pakiet Creatio",
      instruction2: "2. Podaj URL swojego systemu Creatio",
      instruction3: "3. Skonfiguruj ustawienia powiadomień",
      instruction4: "4. Ustaw czas wyświetlania",
      downloadPackage: "Pobierz Pakiet",

      // Help
      creatioUrlHelp: "URL twojego systemu Creatio do otrzymywania powiadomień",
      notificationTimeoutHelp: "0 = zamknięcie ręczne, >0 = zamknięcie automatyczne",
      bringToFrontHelp: "Częstotliwość wysuwania okien na pierwszy plan",
      languageHelp: "Język interfejsu rozszerzenia",

      //
        markAllRead: "Oznacz wszystkie jako przeczytane",
        refresh: "Odśwież",
        settings: "Ustawienia",
        markAllReadIcon: "✅",
        refreshIcon: "🔄",
        settingsIcon: "⚙️",

      // Error
        noNotifications: "Brak nowych powiadomień",
        loadError: "Błąd ładowania powiadomień. Sprawdź:",
        loadErrorChecklist1: "1. Połączenie internetowe",
        loadErrorChecklist2: "2. URL Creatio w ustawieniach",
        loadErrorChecklist3: "3. Autoryzację w systemie Creatio",
        retryButton: "Spróbuj ponownie",



      // Tabs
      notifications: "Powiadomienia", // "Notifications", "Powiadomienia"
      settings: "Ustawienia", // "Settings", "Ustawienia" 
      instructions: "Instrukcja", // "Instructions", "Instrukcja"
      feedback: "Opinia", // "Feedback", "Opinia"

      // Feedback
      feedbackTitle: "Wyślij opinię lub sugestię", // "Send feedback or suggestion", "Wyślij opinię lub sugestię"
      feedbackPlaceholder: "Wiadomość", // "Message", "Wiadomość"
      sendFeedback: "Wyślij", // "Send", "Wyślij"
      feedbackSent: "Opinia wysłana!", // "Feedback sent!", "Opinia wysłana!"

      // Для польської (pl):
      authError: "Nie autoryzowany w systemie Creatio",
      authInstruction: "Aby otrzymywać powiadomienia musisz zalogować się do systemu Creatio",
      openCreatio: "Otwórz Creatio",

      // Для польської (pl):
      noUrlError: "URL Creatio nie został podany",
      noUrlInstruction: "Aby otrzymywać powiadomienia musisz podać URL systemu Creatio w ustawieniach",
      openSettings: "Otwórz ustawienia",



    }
  };
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = translations;
  } else {
    // For direct browser inclusion
    window.translations = translations;
  }