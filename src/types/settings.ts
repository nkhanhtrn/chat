export type Theme = 'light' | 'dark' | 'sepia'

export type ContentWidth = 'narrow' | 'medium' | 'wide'

export interface ConnectionStatus {
  type: 'pending' | 'success' | 'error'
  message: string
}
