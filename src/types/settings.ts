/** Theme options */
export type Theme = 'light' | 'dark' | 'sepia'

/** User settings shape */
export interface UserSettings {
  theme: Theme
  fontSize: number
  codeApiUrl: string
  currentModels: Record<string, string>
  providerConfigs: Record<string, unknown>
  devToolbar: boolean
}

/** Settings keys that can be individually get/set */
export type SettingsKey = keyof UserSettings
