export function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname.length > 20
      ? urlObj.pathname.substring(0, 17) + '...'
      : urlObj.pathname
    return urlObj.hostname + path
  } catch {
    return url.substring(0, maxLength - 3) + '...'
  }
}

export function truncateFileName(name: string, maxLength = 30): string {
  if (name.length <= maxLength) return name
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : ''
  const baseName = name.slice(0, name.length - ext.length)
  return baseName.slice(0, maxLength - 5 - ext.length) + '...' + ext
}

export function formatSize(charCount: number): string {
  if (charCount < 1000) return `${charCount} chars`
  return `${(charCount / 1000).toFixed(1)}k chars`
}
