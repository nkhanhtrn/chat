import { Settings } from './settings'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

const NO_PROXY_DOMAINS = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'firebase.googleapis.com',
  'gstatic.com',
  'googleapis.com',
  'us-central1-nk-cloud-323802.cloudfunctions.net',
]

export interface DetectedUrl {
  url: string
  status: 'loading' | 'success' | 'error'
  content: string
}

export interface FetchResult {
  success: boolean
  content: string
  error?: string
}

export function shouldBypassProxy(url: string): boolean {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return NO_PROXY_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  } catch {
    return false
  }
}

let settingsCache: { customFetchUrl: string } | null = null
let settingsCacheTimestamp = 0
const SETTINGS_CACHE_TTL = 30000

let cachedProxyBaseUrl: string | null = null

export async function getCustomFetchUrl(): Promise<string | null> {
  const now = Date.now()
  if (settingsCache && settingsCache.customFetchUrl && now - settingsCacheTimestamp < SETTINGS_CACHE_TTL) {
    return settingsCache.customFetchUrl
  }

  const customFetchUrl = Settings.getString('customFetchUrl')
  if (customFetchUrl) {
    settingsCache = { customFetchUrl }
    settingsCacheTimestamp = now
  }
  return customFetchUrl || null
}

export async function invalidateFetchSettingsCache(): Promise<void> {
  settingsCache = null
  settingsCacheTimestamp = 0
  const url = await getCustomFetchUrl()
  cachedProxyBaseUrl = url
}

export function getProxyBaseUrl(): string | null {
  if (cachedProxyBaseUrl) return cachedProxyBaseUrl
  const fromSettings = Settings.getString('customFetchUrl')
  if (fromSettings) {
    cachedProxyBaseUrl = fromSettings
  }
  return cachedProxyBaseUrl || null
}

getCustomFetchUrl()
  .then((url) => {
    cachedProxyBaseUrl = url
  })
  .catch(() => {})

export function getProxiedImageUrl(imageUrl: string): string | null {
  if (!imageUrl) return null
  if (shouldBypassProxy(imageUrl)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/fetchBinaryContent?url=${encodeURIComponent(imageUrl)}`
}

export function getProxiedTextUrl(url: string): string | null {
  if (shouldBypassProxy(url)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/fetchWebsiteContent?url=${encodeURIComponent(url)}`
}

export function getProxiedBrowseUrl(url: string): string | null {
  if (shouldBypassProxy(url)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/browse?url=${encodeURIComponent(url)}`
}

export function getProxiedBinaryUrl(url: string): string | null {
  if (shouldBypassProxy(url)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/browseBinary?url=${encodeURIComponent(url)}`
}

export async function fetchTextContent(url: string): Promise<string> {
  if (shouldBypassProxy(url)) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      return data.content || data.html || data.data || JSON.stringify(data)
    }
    return await response.text()
  }

  const proxyUrl = getProxiedTextUrl(url)
  if (!proxyUrl) {
    throw new Error(
      'Proxy URL not configured. Please set a custom fetch URL in settings.',
    )
  }

  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error(`Proxy error: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await response.json()
    return data.content || data.html || data.data || JSON.stringify(data)
  }

  return await response.text()
}

export async function fetchBinaryContent(
  url: string,
  onProgress: ((progress: number) => void) | null = null,
): Promise<ArrayBuffer> {
  if (shouldBypassProxy(url)) {
    onProgress?.(10)
    const response = await fetch(url)
    onProgress?.(50)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    onProgress?.(80)
    const buffer = await response.arrayBuffer()
    onProgress?.(100)
    return buffer
  }

  const proxyUrl = getProxiedBinaryUrl(url)
  if (!proxyUrl) {
    throw new Error(
      'Proxy URL not configured. Please set a custom fetch URL in settings.',
    )
  }

  onProgress?.(10)

  const response = await fetch(proxyUrl)
  onProgress?.(50)

  if (!response.ok) {
    throw new Error(`Binary proxy error: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('text/html') || contentType.includes('html')) {
    const html = await response.text()
    const actualUrl = findDirectDownloadLink(html, url)

    if (actualUrl) {
      const fileProxyUrl = getProxiedBinaryUrl(actualUrl)
      if (!fileProxyUrl) {
        throw new Error(
          'Proxy URL not configured. Please set a custom fetch URL in settings.',
        )
      }

      const fileResponse = await fetch(fileProxyUrl)
      onProgress?.(80)

      if (!fileResponse.ok) {
        throw new Error(`File download error: HTTP ${fileResponse.status}`)
      }

      return await fileResponse.arrayBuffer()
    } else {
      throw new Error('Could not find direct download link')
    }
  }

  onProgress?.(80)
  const buffer = await response.arrayBuffer()
  onProgress?.(100)

  return buffer
}

function findDirectDownloadLink(
  html: string,
  pageUrl: string,
): string | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const fileExtensions = ['.epub', '.pdf', '.mobi', '.azw3', '.djvu']
  for (const ext of fileExtensions) {
    const links = doc.querySelectorAll(`a[href$="${ext}"]`)
    if (links.length > 0) {
      const href = links[0].getAttribute('href')
      if (href) {
        if (href.startsWith('/')) {
          const origin = new URL(pageUrl).origin
          return `${origin}${href}`
        }
        return href
      }
    }
  }

  const downloadLinks = doc.querySelectorAll(
    'a[href*="download"], a[href*="get"]',
  )
  for (const link of downloadLinks) {
    const href = link.getAttribute('href')
    if (href) {
      if (href.startsWith('/')) {
        const origin = new URL(pageUrl).origin
        return `${origin}${href}`
      }
      return href
    }
  }

  return null
}

export function detectUrls(text: string): string[] {
  if (!text) return []
  const matches = text.match(URL_REGEX) ?? []
  return [...new Set(matches)]
}

async function fetchViaCustomService(
  url: string,
  customFetchUrl: string,
): Promise<string> {
  const baseUrl = customFetchUrl.replace(/\/$/, '')
  const fetchUrl = `${baseUrl}/fetchWebsiteContent?url=${encodeURIComponent(url)}`
  const response = await fetch(fetchUrl)

  if (!response.ok) {
    throw new Error(`Custom fetch service error: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const data = await response.json()
    if (data.success === false) {
      throw new Error(data.error || data.message || 'Custom fetch failed')
    }
    return (
      data.content || data.data || data.html || data.body || JSON.stringify(data)
    )
  }

  return await response.text()
}

export function cleanHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc
    .querySelectorAll(
      'script, style, noscript, iframe, nav, header, footer, aside, svg, form, [hidden]',
    )
    .forEach((el) => el.remove())

  const mainContent =
    doc.querySelector(
      'main, article, .content, #content, .post, .article',
    ) || doc.body

  return ((mainContent?.textContent || '') as string)
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
}

export async function fetchUrlContent(url: string): Promise<string> {
  if (shouldBypassProxy(url)) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.text()
  }

  const customFetchUrl = await getCustomFetchUrl()

  if (!customFetchUrl) {
    throw new Error(
      'No custom fetch URL configured. Please set a custom fetch URL in settings to fetch external content.',
    )
  }

  try {
    return await fetchViaCustomService(url, customFetchUrl)
  } catch (error) {
    console.warn('Custom fetch service failed:', (error as Error).message)
    throw new Error(
      `Failed to fetch ${url}: ${(error as Error).message}`,
    )
  }
}

export async function fetchMultipleUrls(
  urls: string[],
): Promise<Record<string, FetchResult>> {
  const results: Record<string, FetchResult> = {}

  await Promise.all(
    urls.map(async (url) => {
      try {
        const content = await fetchUrlContent(url)
        results[url] = { success: true, content }
      } catch (error) {
        results[url] = {
          success: false,
          content: '',
          error: (error as Error).message,
        }
      }
    }),
  )

  return results
}

export function formatFetchedContentForPrompt(
  fetchedContents: Record<string, FetchResult>,
): string {
  const entries = Object.entries(fetchedContents).filter(
    ([, result]) => result.content && result.content.trim(),
  )

  if (entries.length === 0) return ''

  return entries
    .map(
      ([url, result]) =>
        `--- Content from ${url} ---\n${result.content}\n--- End of ${url} ---`,
    )
    .join('\n\n')
}
