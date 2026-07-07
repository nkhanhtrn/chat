import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSettingsGetString = vi.fn()

vi.mock('../settings', () => ({
  Settings: {
    getString: (...args: string[]) => mockSettingsGetString(...args),
  },
}))

import {
  getCustomFetchUrl,
  getProxyBaseUrl,
  getProxiedImageUrl,
  getProxiedTextUrl,
  getProxiedBrowseUrl,
  getProxiedBinaryUrl,
  shouldBypassProxy,
  invalidateFetchSettingsCache,
} from '../urlFetcher'

describe('urlFetcher', () => {
  beforeEach(async () => {
    mockSettingsGetString.mockReturnValue('')
    await invalidateFetchSettingsCache()
    vi.clearAllMocks()
  })

  describe('shouldBypassProxy', () => {
    it('bypasses firebase domains', () => {
      expect(shouldBypassProxy('https://firestore.googleapis.com/v1/...')).toBe(true)
      expect(shouldBypassProxy('https://my-app.firebaseio.com/data')).toBe(true)
      expect(shouldBypassProxy('https://firebase.googleapis.com/v1/...')).toBe(true)
    })

    it('bypasses cloud functions domain', () => {
      expect(shouldBypassProxy('https://us-central1-nk-cloud-323802.cloudfunctions.net/proxy')).toBe(true)
    })

    it('does not bypass other domains', () => {
      expect(shouldBypassProxy('https://example.com/page')).toBe(false)
      expect(shouldBypassProxy('https://library.org/search')).toBe(false)
    })

    it('returns false for empty/invalid URLs', () => {
      expect(shouldBypassProxy('')).toBe(false)
      expect(shouldBypassProxy('not-a-url')).toBe(false)
    })
  })

  describe('getCustomFetchUrl', () => {
    it('returns value from settings', async () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      const url = await getCustomFetchUrl()
      expect(url).toBe('https://proxy.example.com')
    })

    it('returns null when setting is empty', async () => {
      mockSettingsGetString.mockReturnValue('')
      await invalidateFetchSettingsCache()
      const url = await getCustomFetchUrl()
      expect(url).toBeNull()
    })

    it('caches non-empty values within TTL', async () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      await getCustomFetchUrl()
      mockSettingsGetString.mockReturnValue('https://other-proxy.example.com')
      const url = await getCustomFetchUrl()
      expect(url).toBe('https://proxy.example.com')
    })

    it('does not cache empty values', async () => {
      mockSettingsGetString.mockReturnValue('')
      await getCustomFetchUrl()
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      const url = await getCustomFetchUrl()
      expect(url).toBe('https://proxy.example.com')
    })
  })

  describe('getProxyBaseUrl', () => {
    it('returns null when no proxy configured', () => {
      expect(getProxyBaseUrl()).toBeNull()
    })

    it('falls back to settings when cache is empty', () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      const url = getProxyBaseUrl()
      expect(url).toBe('https://proxy.example.com')
    })

    it('uses cached value when available', async () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      await invalidateFetchSettingsCache()
      await getCustomFetchUrl()
      mockSettingsGetString.mockReturnValue('https://other-proxy.example.com')
      expect(getProxyBaseUrl()).toBe('https://proxy.example.com')
    })
  })

  describe('invalidateFetchSettingsCache', () => {
    it('clears cache and refreshes', async () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      await invalidateFetchSettingsCache()
      expect(getProxyBaseUrl()).toBe('https://proxy.example.com')
    })
  })

  describe('proxy URL construction', () => {
    beforeEach(async () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      await getCustomFetchUrl()
    })

    it('getProxiedImageUrl constructs correct URL', () => {
      const url = getProxiedImageUrl('https://img.example.com/cover.jpg')
      expect(url).toBe('https://proxy.example.com/fetchBinaryContent?url=https%3A%2F%2Fimg.example.com%2Fcover.jpg')
    })

    it('getProxiedTextUrl constructs correct URL', () => {
      const url = getProxiedTextUrl('https://example.com/page')
      expect(url).toBe('https://proxy.example.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com%2Fpage')
    })

    it('getProxiedBrowseUrl constructs correct URL', () => {
      const url = getProxiedBrowseUrl('https://example.com/browse')
      expect(url).toBe('https://proxy.example.com/browse?url=https%3A%2F%2Fexample.com%2Fbrowse')
    })

    it('getProxiedBinaryUrl constructs correct URL', () => {
      const url = getProxiedBinaryUrl('https://example.com/file.epub')
      expect(url).toBe('https://proxy.example.com/browseBinary?url=https%3A%2F%2Fexample.com%2Ffile.epub')
    })

    it('returns null for bypass domains', () => {
      expect(getProxiedImageUrl('https://firestore.googleapis.com/v1/...')).toBeNull()
      expect(getProxiedTextUrl('https://firebase.googleapis.com/v1/...')).toBeNull()
    })

    it('returns null for empty input on image URL', async () => {
      mockSettingsGetString.mockReturnValue('https://proxy.example.com')
      await invalidateFetchSettingsCache()
      expect(getProxiedImageUrl('')).toBeNull()
    })

    it('returns null when proxy not configured', async () => {
      mockSettingsGetString.mockReturnValue('')
      await invalidateFetchSettingsCache()
      expect(getProxiedImageUrl('https://img.example.com/cover.jpg')).toBeNull()
    })
  })
})
