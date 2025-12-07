/**
 * Settings service for managing theme and user preferences
 */

const VALID_THEMES = ['light', 'dark', 'sepia']
const THEME_STORAGE_KEY = 'theme'

// Current theme state
let currentTheme = 'light'

/**
 * Set the theme and apply it to the document
 * @param {string} theme - The theme to set ('light', 'dark', or 'sepia')
 * @returns {boolean} - Whether the theme was valid and applied
 */
export const setTheme = (theme) => {
  if (!VALID_THEMES.includes(theme)) {
    return false
  }
  currentTheme = theme
  document.documentElement.setAttribute('data-theme', theme)
  // Cache theme in localStorage for instant loading
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch (e) {
    // localStorage may be unavailable
  }
  return true
}

/**
 * Get the current theme
 * @returns {string} - The current theme
 */
export const getTheme = () => currentTheme

/**
 * Get list of valid themes
 * @returns {string[]} - Array of valid theme names
 */
export const getValidThemes = () => [...VALID_THEMES]

/**
 * Load cached theme from localStorage
 * @returns {string|null} - The cached theme or null if not found/invalid
 */
export const loadCachedTheme = () => {
  try {
    const cachedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (cachedTheme && VALID_THEMES.includes(cachedTheme)) {
      return cachedTheme
    }
  } catch (e) {
    // localStorage may be unavailable
  }
  return null
}

/**
 * Initialize theme from localStorage or use default
 * @param {string} defaultTheme - The default theme to use if no cached theme
 * @returns {string} - The initialized theme
 */
export const initializeTheme = (defaultTheme = 'light') => {
  const cachedTheme = loadCachedTheme()
  if (cachedTheme) {
    currentTheme = cachedTheme
    document.documentElement.setAttribute('data-theme', cachedTheme)
    return cachedTheme
  }
  setTheme(defaultTheme)
  return defaultTheme
}

/**
 * Apply user settings to the document
 * @param {Object} settings - The settings object
 * @param {string} [settings.theme] - Theme name
 * @param {number} [settings.fontSize] - Font size in pixels
 * @param {string} [settings.fontFamily] - Font family
 * @param {number} [settings.lineHeight] - Line height
 * @param {string} [settings.contentWidth] - Content width ('narrow', 'medium', 'wide')
 */
export const applySettings = (settings) => {
  if (!settings) return

  if (settings.theme) {
    setTheme(settings.theme)
  }
  if (settings.fontSize) {
    document.documentElement.style.setProperty('--message-font-size', `${settings.fontSize}px`)
  }
  if (settings.fontFamily) {
    document.documentElement.style.setProperty('--message-font-family', settings.fontFamily)
  }
  if (settings.lineHeight) {
    document.documentElement.style.setProperty('--message-line-height', settings.lineHeight.toString())
  }
  if (settings.contentWidth) {
    const widthMap = { narrow: '600px', medium: '800px', wide: '1000px' }
    document.documentElement.style.setProperty('--content-max-width', widthMap[settings.contentWidth] || '800px')
  }
}

/**
 * Expose theme functions globally for components to use
 */
export const exposeGlobally = () => {
  window.__setTheme = setTheme
  window.__getTheme = getTheme
}

// For testing purposes - reset internal state
export const _resetForTesting = () => {
  currentTheme = 'light'
}
