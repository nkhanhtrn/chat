/**
 * Fetch proxy utilities for tool components.
 * Provides a proxied fetch function that routes HTTP/HTTPS requests through a proxy.
 */

import { getProxyBaseUrl } from '../services/urlFetcher.js'

/**
 * Build a proxy URL for fetching external content.
 * @param {string} url - The URL to proxy
 * @param {string} proxyBaseUrl - The base URL of the proxy
 * @returns {string} - The proxy URL
 */
export function buildProxyUrl(url, proxyBaseUrl) {
  return `${proxyBaseUrl}/fetchWebsiteContent?url=${encodeURIComponent(url)}`
}

/**
 * Create a mock Response object from proxy response data.
 * @param {string|string|Object} data - The response data
 * @param {string} contentType - The content type header
 * @returns {Object} - A mock Response object
 */
export function createMockResponse(data, contentType = '') {
  const text = typeof data === 'string' ? data : (data.content || data.html || data.data || '')

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name) => name === 'content-type' ? 'text/html' : null
    },
    json: async () => ({ content: text }),
    text: async () => text
  }
}

/**
 * Create a fetch function for tools that auto-detects when to use proxy.
 * - Auto-detects API calls vs web scraping
 * - Known API domains and paths use direct fetch
 * - Arbitrary websites use proxy (for CORS/restricted content)
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.getProxyBaseUrl - Function to get the proxy base URL
 * @param {Function} options.fetch - The fetch function to use (default: window.fetch)
 * @param {Function} options.debugLog - Optional debug logging function
 * @returns {Function} - Fetch function with auto-detecting proxy support
 */
export function createProxiedFetch(options = {}) {
  const {
    getProxyBaseUrl: getProxyUrl = getProxyBaseUrl,
    fetch: fetchFn = window?.fetch,
    debugLog = () => {}
  } = options

  // Known API domains that should use direct fetch
  const apiDomains = new Set([
    'api.openai.com',
    'api.anthropic.com',
    'generativelanguage.googleapis.com',
    'api.cerebras.ai',
    'api.cloudflare.com',
    'api.github.com',
    'api.coinbase.com',
    'api.stripe.com',
    'api.twilio.com',
    'api.sendgrid.com',
    'api.polygon.io',
    'api.weather.gov',
    'api.ipify.org',
    'jsonplaceholder.typicode.com',
    'reqres.in',
    'fakestoreapi.com',
    'pokeapi.co',
    'official-joke-api.appspot.com'
  ])

  // Check if URL looks like an API endpoint
  function isLikelyAPI(url) {
    try {
      const urlObj = new URL(url)

      // Check for known API domains
      if (apiDomains.has(urlObj.hostname)) {
        return true
      }

      // Check for API-like paths
      const path = urlObj.pathname.toLowerCase()
      const apiPatterns = ['/api/', '/v1/', '/v2/', '/v3/', '/v4/', '/graphql']
      return apiPatterns.some(pattern => path.includes(pattern))
    } catch {
      return false
    }
  }

  return async function fetch(url, fetchOptions = {}) {
    // Extract URL string from Request object if needed
    let urlString = url
    if (url instanceof Request) {
      urlString = url.url
      // Merge Request options with fetchOptions
      fetchOptions = {
        method: url.method,
        headers: url.headers,
        body: url.body,
        ...fetchOptions
      }
    }

    // Check if proxy is explicitly requested or denied
    const explicitProxy = fetchOptions?.useProxy === true
    const explicitNoProxy = fetchOptions?.useProxy === false

    // For same-origin or data URLs, always use native fetch
    if (typeof urlString === 'string' && !urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      return fetchFn(url, fetchOptions)
    }

    // Auto-detect: use proxy for non-API URLs
    const shouldUseProxy = explicitProxy || (!explicitNoProxy && !isLikelyAPI(urlString))

    if (shouldUseProxy) {
      const proxyBaseUrl = getProxyUrl()

      // If proxy is not configured, throw a clear error
      if (!proxyBaseUrl) {
        throw new Error('Proxy URL not configured. Please set a custom fetch URL in settings to fetch external content.')
      }

      const proxyUrl = buildProxyUrl(urlString, proxyBaseUrl)
      debugLog('[Tool fetch] Proxying:', urlString, 'through:', proxyBaseUrl)

      try {
        // Don't pass the useProxy option to the underlying fetch
        const { useProxy, ...cleanOptions } = fetchOptions
        const response = await fetchFn(proxyUrl, {
          ...cleanOptions,
          method: 'GET' // Proxy uses GET with URL as query param
        })

        if (!response.ok) {
          throw new Error(`Proxy error: HTTP ${response.status}`)
        }

        const contentType = response.headers.get('content-type') || ''

        // Handle JSON response from proxy
        if (contentType.includes('application/json')) {
          const data = await response.json()
          // Return a mock Response object with the content
          return createMockResponse(data, contentType)
        }

        // Handle text response
        const text = await response.text()
        return createMockResponse(text, contentType)
      } catch (error) {
        console.error('[Tool fetch error]', error.message)
        throw error
      }
    }

    // Default: use direct fetch (for APIs, etc.)
    debugLog('[Tool fetch] Direct fetch:', urlString)
    return fetchFn(url, fetchOptions)
  }
}
