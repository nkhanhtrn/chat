import { debugLog } from '../utils/debug.js'

/**
 * Settings class - Abstracts localStorage operations for user settings
 *
 * All settings changes should go through this class.
 * Provides a simple sync API for getting and setting values.
 * Automatically handles trimming of string values.
 */
class SettingsClass {
  static STORAGE_KEY = 'user-settings'

  /**
   * Get all settings from localStorage
   * @returns {Object} All settings or empty object if none exist
   */
  static getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      debugLog('[Settings.getAll] Reading from localStorage:', this.STORAGE_KEY, data ? 'found' : 'not found')
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }

  /**
   * Get a single setting value
   * @param {string} key - The setting key
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} The setting value or defaultValue
   */
  static get(key, defaultValue = null) {
    const settings = this.getAll()
    return settings[key] !== undefined ? settings[key] : defaultValue
  }

  /**
   * Get a string setting value, trimmed
   * @param {string} key - The setting key
   * @param {string} defaultValue - Default value if key doesn't exist
   * @returns {string} The trimmed setting value or defaultValue
   */
  static getString(key, defaultValue = '') {
    const value = this.get(key, defaultValue)
    return typeof value === 'string' ? value.trim() : value
  }

  /**
   * Set one or more settings
   * Automatically trims string values
   * @param {Object} changes - Key-value pairs to set
   */
  static set(changes) {
    const settings = this.getAll()
    const cleaned = {}

    for (const [key, value] of Object.entries(changes)) {
      cleaned[key] = typeof value === 'string' ? value.trim() : value
    }

    const merged = { ...settings, ...cleaned }
    debugLog('[Settings.set] Writing to localStorage:', this.STORAGE_KEY, { changes, merged })
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged))
  }

  /**
   * Delete one or more settings
   * @param {string|Array<string>} keys - Key(s) to delete
   */
  static delete(keys) {
    const settings = this.getAll()
    const keysToDelete = Array.isArray(keys) ? keys : [keys]
    debugLog('[Settings.delete] Removing keys:', keysToDelete)
    keysToDelete.forEach(key => delete settings[key])
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings))
  }

  /**
   * Clear all settings
   */
  static clear() {
    debugLog('[Settings.clear] Removing all settings from localStorage:', this.STORAGE_KEY)
    localStorage.removeItem(this.STORAGE_KEY)
  }
}

export const Settings = SettingsClass
export default Settings
