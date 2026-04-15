// Stub - will be fully implemented when porting URL fetching

export interface DetectedUrl {
  url: string
  status: 'loading' | 'success' | 'error'
  content: string
}

export function detectUrls(text: string): string[] {
  if (!text) return []
  const urlRegex = /https?:\/\/[^\s<>\"']+/gi
  return text.match(urlRegex) ?? []
}
