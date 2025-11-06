// ============================================
// LOGGER - Централізоване логування
// ============================================

const DEBUG_MODE = true; // Змініть на false для production

const logger = {
  log: function(...args) {
    if (DEBUG_MODE) {
      console.log('[Logger]', ...args);
    }
  },

  info: function(...args) {
    console.info('[Info]', ...args);
  },

  warn: function(...args) {
    console.warn('[Warning]', ...args);
  },

  error: function(...args) {
    console.error('[Error]', ...args);
  },

  debug: function(...args) {
    if (DEBUG_MODE) {
      console.debug('[Debug]', ...args);
    }
  },

  trace: function(...args) {
    if (DEBUG_MODE) {
      console.trace('[Trace]', ...args);
    }
  },

  group: function(label) {
    if (DEBUG_MODE) {
      console.group(label);
    }
  },

  groupEnd: function() {
    if (DEBUG_MODE) {
      console.groupEnd();
    }
  },

  table: function(data) {
    if (DEBUG_MODE) {
      console.table(data);
    }
  },

  time: function(label) {
    if (DEBUG_MODE) {
      console.time(label);
    }
  },

  timeEnd: function(label) {
    if (DEBUG_MODE) {
      console.timeEnd(label);
    }
  }
};

export { logger };