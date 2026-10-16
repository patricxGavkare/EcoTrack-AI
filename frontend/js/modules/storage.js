/**
 * Storage Module (storage.js)
 * Safe localStorage read/write with error resilience and try/catch handlers.
 */

export const Storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      console.warn(`[EcoTrack Storage] Failed to read "${key}" from localStorage:`, e);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[EcoTrack Storage] Failed to save "${key}" to localStorage:`, e);
      return false;
    }
  },

  getRaw(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? item : fallback;
    } catch (e) {
      console.warn(`[EcoTrack Storage] Failed to read raw key "${key}":`, e);
      return fallback;
    }
  },

  setRaw(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (e) {
      console.error(`[EcoTrack Storage] Failed to write raw key "${key}":`, e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[EcoTrack Storage] Failed to remove "${key}":`, e);
      return false;
    }
  }
};
