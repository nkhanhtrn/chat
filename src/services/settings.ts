import type { Theme, ContentWidth } from '@/types/settings'

const SETTINGS_KEY = 'user-settings'

interface SettingsData {
  theme?: Theme
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  contentWidth?: ContentWidth
  codeApiUrl?: string
  customFetchUrl?: string
  bookApiUrl?: string
  bookApiKey?: string
  extraService?: string
  currentModels?: Record<string, string>
  providerConfigs?: Record<string, unknown>
  devToolbar?: boolean
  [key: string]: unknown
}

class SettingsManager {
  private cache: SettingsData = {}

  async initialize(): Promise<void> {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      try { this.cache = JSON.parse(stored) } catch { /* ignore */ }
    }
  }

  getAll(): SettingsData {
    return { ...this.cache }
  }

  get<K extends keyof SettingsData>(key: K): SettingsData[K] {
    return this.cache[key]
  }

  getString(key: string): string {
    const value = this.cache[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  set(changes: Partial<SettingsData>): void {
    for (const [key, value] of Object.entries(changes)) {
      this.cache[key] = typeof value === 'string' ? value.trim() : value
    }
    this._persist()
  }

  delete(keys: string | string[]): void {
    const keysToDelete = Array.isArray(keys) ? keys : [keys]
    for (const key of keysToDelete) {
      delete this.cache[key]
    }
    this._persist()
  }

  clear(): void {
    this.cache = {}
    localStorage.removeItem(SETTINGS_KEY)
  }

  private _persist(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.cache))
  }
}

export const Settings = new SettingsManager()

export function setTheme(theme: Theme): boolean {
  if (!['light', 'dark', 'sepia'].includes(theme)) return false
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  return true
}

export function getTheme(): string {
  const cached = localStorage.getItem('theme')
  if (cached && ['light', 'dark', 'sepia'].includes(cached)) return cached
  return 'light'
}

export function initializeTheme(): void {
  const cached = localStorage.getItem('theme')
  if (cached && ['light', 'dark', 'sepia'].includes(cached)) {
    document.documentElement.setAttribute('data-theme', cached)
  }
}

export function applyFontSize(size: number): void {
  document.documentElement.style.setProperty('--message-font-size', `${size}px`)
}

export function applyFontFamily(family: string): void {
  document.documentElement.style.setProperty('--message-font-family', family)
}

export function applyLineHeight(height: number): void {
  document.documentElement.style.setProperty('--message-line-height', height.toString())
}

export function applyContentWidth(width: string): void {
  const widthMap: Record<string, string> = { narrow: '600px', medium: '800px', wide: '1000px' }
  document.documentElement.style.setProperty('--content-max-width', widthMap[width] || '800px')
}

export function applySettings(settings: SettingsData): void {
  if (!settings) return
  if (settings.theme) setTheme(settings.theme)
  if (settings.fontSize) applyFontSize(settings.fontSize)
  if (settings.fontFamily) applyFontFamily(settings.fontFamily)
  if (settings.lineHeight) applyLineHeight(settings.lineHeight)
  if (settings.contentWidth) applyContentWidth(settings.contentWidth)
}

export function exposeGlobally(): void {
  if (import.meta.env.DEV) {
    ;(window as any).Settings = Settings
    ;(window as any).__setTheme = setTheme
    ;(window as any).__getTheme = getTheme
  }
}

export function exposeEchartsGlobally(): void {
  // Echarts will be lazy-loaded and exposed when needed
}
