/** Theme options */
export type Theme = 'light' | 'dark' | 'sepia'

/** Content width options */
export type ContentWidth = 'narrow' | 'medium' | 'wide'

/** Extra service identifiers */
export type ExtraService = 'public-library' | 'web-proxy' | 'reasoning-ai'

/** User settings shape */
export interface UserSettings {
  theme: Theme
  fontSize: number
  fontFamily: string
  lineHeight: number
  contentWidth: ContentWidth
  codeApiUrl: string
  customFetchUrl: string
  bookApiUrl: string
  bookApiKey: string
  extraService: ExtraService
  currentModels: Record<string, string>
  providerConfigs: Record<string, unknown>
  devToolbar: boolean
}

/** Settings keys that can be individually get/set */
export type SettingsKey = keyof UserSettings

/** Connection status for provider testing */
export interface ConnectionStatus {
  type: 'pending' | 'success' | 'error'
  message: string
}
