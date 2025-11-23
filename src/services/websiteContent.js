// Round-robin index for CORS proxy selection
let proxyIndex = 0

// List of CORS proxy services to try
export const corsProxies = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://cors-anywhere.herokuapp.com/',
  'https://thingproxy.freeboard.io/fetch/',
  'https://crossorigin.me/',
  'https://yacdn.org/proxy/',
  'https://proxy.cors.sh/',
  'https://cors.bridged.cc/',
  'https://api.cors.lol/?url='
]

/**
 * Reset the proxy index (useful for testing)
 */
export const resetProxyIndex = () => {
  proxyIndex = 0
}

/**
 * Fetch content from a website URL
 */
export const fetchWebsiteContent = async (url) => {

  // Try direct fetch first
  try {
    const response = await fetch(url)
    if (response.ok) {
      return await parseWebsiteContent(url, await response.text())
    }
  } catch (error) {
    console.log('Direct fetch failed, trying CORS proxies...')
  }

  // Try CORS proxies using round-robin
  // Start with the current proxy and try all if needed
  let attempts = 0
  while (attempts < corsProxies.length) {
    const proxy = corsProxies[proxyIndex]
    const currentProxyIndex = proxyIndex
    proxyIndex = (proxyIndex + 1) % corsProxies.length
    attempts++
    
    try {
      const proxyUrl = proxy + encodeURIComponent(url)
      const response = await fetch(proxyUrl)
      
      if (response.ok) {
        const html = await response.text()
        return await parseWebsiteContent(url, html)
      }
      // If response not ok, fall through to try next proxy
      console.log(`Proxy ${proxy} returned non-ok response, trying next...`)
    } catch (error) {
      console.log(`Proxy ${proxy} failed, trying next...`)
    }
  }

  throw new Error('Failed to fetch content. All proxies failed or CORS blocked.')
}

/**
 * Parse HTML content and extract text
 */
export const parseWebsiteContent = async (url, html) => {
  try {
    // Extract text content from HTML (basic extraction)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // Remove script, style, and other non-content elements
    const scripts = doc.querySelectorAll('script, style, noscript, iframe')
    scripts.forEach(el => el.remove())
    
    // Get text content
    const textContent = doc.body.textContent || ''
    
    // Clean up whitespace
    const cleanedContent = textContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
    
    return {
      url,
      content: cleanedContent,
      title: doc.title || url,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error parsing website content:', error)
    throw new Error(`Failed to parse content from ${url}: ${error.message}`)
  }
}

export default {
  fetchWebsiteContent,
  parseWebsiteContent
}
