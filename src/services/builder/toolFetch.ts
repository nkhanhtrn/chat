import { getProxiedTextUrl, shouldBypassProxy } from '@/services/urlFetcher'

const nativeFetch: typeof fetch = window.fetch.bind(window)

export function createProxiedFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    if (shouldBypassProxy(url)) {
      return nativeFetch(input, init)
    }

    const proxyUrl = getProxiedTextUrl(url)
    if (proxyUrl) {
      return nativeFetch(proxyUrl, init)
    }

    return nativeFetch(input, init)
  }
}
