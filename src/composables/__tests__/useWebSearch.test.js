import { describe, it, expect, vi } from 'vitest'
import { useWebSearch } from '../useWebSearch.js'

describe('useWebSearch', () => {
  it('should initialize with default state', () => {
    const webSearch = useWebSearch()

    expect(webSearch.isSearching.value).toBe(false)
    expect(webSearch.searchQuery.value).toBe('')
    expect(webSearch.searchStatus.value).toBe('')
  })

  it('should reset state', () => {
    const webSearch = useWebSearch()

    webSearch.isSearching.value = true
    webSearch.searchQuery.value = 'test query'
    webSearch.searchStatus.value = 'Searching...'

    webSearch.reset()

    expect(webSearch.isSearching.value).toBe(false)
    expect(webSearch.searchQuery.value).toBe('')
    expect(webSearch.searchStatus.value).toBe('')
  })

  describe('createSearchCallbacks', () => {
    it('should create callbacks object', () => {
      const webSearch = useWebSearch()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = webSearch.createSearchCallbacks({ updateMessage, scrollToBottom })

      expect(callbacks.onWebSearchStart).toBeDefined()
      expect(callbacks.onWebSearchProgress).toBeDefined()
      expect(callbacks.onWebSearchResult).toBeDefined()
      expect(callbacks.onWebSearchComplete).toBeDefined()
    })

    it('should handle onWebSearchStart', () => {
      const webSearch = useWebSearch()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = webSearch.createSearchCallbacks({ updateMessage, scrollToBottom })
      callbacks.onWebSearchStart('test query')

      expect(webSearch.isSearching.value).toBe(true)
      expect(webSearch.searchQuery.value).toBe('test query')
      expect(webSearch.searchStatus.value).toBe('Searching...')
      expect(updateMessage).toHaveBeenCalledWith({ webSearchQuery: 'test query' })
      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('should handle onWebSearchProgress with search_complete phase', () => {
      const webSearch = useWebSearch()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = webSearch.createSearchCallbacks({ updateMessage, scrollToBottom })
      callbacks.onWebSearchProgress({
        phase: 'search_complete',
        resultsCount: 5,
        results: [{ url: 'https://example.com', title: 'Example' }]
      })

      expect(webSearch.searchStatus.value).toBe('Found 5 results')
      expect(updateMessage).toHaveBeenCalledWith({
        webSearchTotal: 5,
        webSearchPending: [{ url: 'https://example.com', title: 'Example' }],
        webSearchResults: []
      })
    })

    it('should handle onWebSearchProgress with fetching phase', () => {
      const webSearch = useWebSearch()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = webSearch.createSearchCallbacks({ updateMessage, scrollToBottom })
      callbacks.onWebSearchProgress({ phase: 'fetching', total: 3 })

      expect(webSearch.searchStatus.value).toBe('Fetching 3 pages...')
    })

    it('should handle onWebSearchProgress with error phase', () => {
      const webSearch = useWebSearch()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = webSearch.createSearchCallbacks({ updateMessage, scrollToBottom })
      callbacks.onWebSearchProgress({ phase: 'error', error: 'Network failed' })

      expect(webSearch.searchStatus.value).toBe('Search failed: Network failed')
    })

    it('should handle onWebSearchResult', () => {
      const webSearch = useWebSearch()
      const scrollToBottom = vi.fn()

      const getMessage = vi.fn(() => ({
        webSearchResults: [],
        webSearchTotal: 3
      }))

      const callbacks = webSearch.createSearchCallbacks({ updateMessage: vi.fn(), scrollToBottom })
      callbacks.onWebSearchResult(
        { url: 'https://example.com', success: true },
        0,
        getMessage
      )

      expect(webSearch.searchStatus.value).toContain('Fetched')
      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('should handle onWebSearchComplete', () => {
      const webSearch = useWebSearch()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()
      const updateMessageResults = vi.fn()

      webSearch.isSearching.value = true
      webSearch.searchQuery.value = 'test'
      webSearch.searchStatus.value = 'Fetching...'

      const callbacks = webSearch.createSearchCallbacks({ updateMessage, scrollToBottom })
      callbacks.onWebSearchComplete(
        [{ url: 'https://a.com' }, null, { url: 'https://b.com' }],
        updateMessageResults
      )

      expect(webSearch.isSearching.value).toBe(false)
      expect(webSearch.searchQuery.value).toBe('')
      expect(webSearch.searchStatus.value).toBe('')
      expect(updateMessageResults).toHaveBeenCalledWith([
        { url: 'https://a.com' },
        { url: 'https://b.com' }
      ])
    })
  })
})
