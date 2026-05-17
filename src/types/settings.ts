export type Theme = 'light' | 'dark' | 'sepia'

export type ContentWidth = 'narrow' | 'medium' | 'wide'

export type ExtraService = 'public-library' | 'web-proxy'

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
  devToolbar: boolean
}

export type SettingsKey = keyof UserSettings

export interface ConnectionStatus {
  type: 'pending' | 'success' | 'error'
  message: string
}
