import type { Theme } from '@/types/settings'

const SETTINGS_KEY = 'user-settings'

interface SettingsData {
  theme?: Theme
  fontSize?: number
  codeApiUrl?: string
  currentModels?: Record<string, string>
  providerConfigs?: Record<string, unknown>
  devToolbar?: boolean
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

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.cache[key] = value
    this._persist()
  }

  private _persist(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.cache))
  }
}

export const Settings = new SettingsManager()

export function initializeTheme(): void {
  try {
    const theme = localStorage.getItem('theme')
    if (theme && ['light', 'dark', 'sepia'].includes(theme)) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  } catch { /* ignore */ }
}

export function applySettings(settings: SettingsData): void {
  if (settings.theme) {
    document.documentElement.setAttribute('data-theme', settings.theme)
    localStorage.setItem('theme', settings.theme)
  }
  if (settings.fontSize) {
    document.documentElement.style.fontSize = `${settings.fontSize}px`
  }
}

export function exposeGlobally(): void {
  if (import.meta.env.DEV) {
    ;(window as any).Settings = Settings
  }
}

export function exposeEchartsGlobally(): void {
  // Echarts will be lazy-loaded and exposed when needed
}
