// ─── Session Manager ──────────────────────────────────────────────────────────

const sessions = new Map();

/**
 * Get or create a session for a phone number
 * @param {string} phone - The phone number
 * @returns {Object} Session object
 */
export function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { 
      mode: "demo", 
      history: [], 
      isNew: true, 
      currentCap: null 
    });
  }
  return sessions.get(phone);
}

/**
 * Reset a session for a phone number
 * @param {string} phone - The phone number
 * @param {string} mode - Mode to reset to (demo or freeform)
 */
export function resetSession(phone, mode = "demo") {
  sessions.set(phone, { 
    mode, 
    history: [], 
    isNew: true, 
    currentCap: null 
  });
}

/**
 * Clear all sessions (useful for testing)
 */
export function clearAllSessions() {
  sessions.clear();
}
