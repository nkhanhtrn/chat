import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WebSearchProgress from '../WebSearchProgress.vue'

describe('WebSearchProgress', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render websearch-progress container', () => {
      wrapper = mount(WebSearchProgress)
      expect(wrapper.find('.websearch-progress').exists()).toBe(true)
    })

    it('should render search-sources container', () => {
      wrapper = mount(WebSearchProgress)
      expect(wrapper.find('.search-sources').exists()).toBe(true)
    })
  })

  describe('Search Query', () => {
    it('should not render search query when not provided', () => {
      wrapper = mount(WebSearchProgress)
      expect(wrapper.find('.search-query').exists()).toBe(false)
    })

    it('should render search query when provided', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          searchQuery: 'test query'
        }
      })
      expect(wrapper.find('.search-query').exists()).toBe(true)
    })

    it('should display the query text', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          searchQuery: 'bitcoin price'
        }
      })
      expect(wrapper.find('.query-text').text()).toContain('bitcoin price')
    })

    it('should display query label', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          searchQuery: 'test'
        }
      })
      expect(wrapper.find('.query-label').text()).toBe('Query:')
    })
  })

  describe('Sources', () => {
    it('should not render sources when array is empty', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: []
        }
      })
      expect(wrapper.findAll('.source-item').length).toBe(0)
    })

    it('should render sources when provided', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Source 1', url: 'https://example.com', status: 'success' },
            { title: 'Source 2', url: 'https://example2.com', status: 'loading' }
          ]
        }
      })
      expect(wrapper.findAll('.source-item').length).toBe(2)
    })

    it('should display source numbers', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Source 1', url: 'https://example.com', status: 'success' }
          ]
        }
      })
      expect(wrapper.find('.source-number').text()).toBe('1')
    })

    it('should render source title as link when URL is provided', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Example Site', url: 'https://example.com', status: 'success' }
          ]
        }
      })
      const link = wrapper.find('.source-title-link')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://example.com')
      expect(link.text()).toBe('Example Site')
    })

    it('should open links in new tab', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Example', url: 'https://example.com', status: 'success' }
          ]
        }
      })
      const link = wrapper.find('.source-title-link')
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })

    it('should display source URL', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Example', url: 'https://example.com/page', status: 'success' }
          ]
        }
      })
      expect(wrapper.find('.source-url').text()).toBe('https://example.com/page')
    })

    it('should render source title as span when URL is not provided', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Loading...', status: 'loading' }
          ]
        }
      })
      expect(wrapper.find('.source-title-link').exists()).toBe(false)
      expect(wrapper.find('.source-title').exists()).toBe(true)
    })
  })

  describe('Source Status', () => {
    it('should show spinner for loading status', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Loading', url: 'https://example.com', status: 'loading' }
          ]
        }
      })
      expect(wrapper.find('.spinner').exists()).toBe(true)
    })

    it('should apply loading class to source item', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Loading', url: 'https://example.com', status: 'loading' }
          ]
        }
      })
      expect(wrapper.find('.source-item').classes()).toContain('loading')
    })

    it('should apply success class to source item', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Done', url: 'https://example.com', status: 'success' }
          ]
        }
      })
      expect(wrapper.find('.source-item').classes()).toContain('success')
    })

    it('should apply error class to source item', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Failed', url: 'https://example.com', status: 'error' }
          ]
        }
      })
      expect(wrapper.find('.source-item').classes()).toContain('error')
    })
  })

  describe('Fetch Status Badge', () => {
    it('should show "Fetched" for fetched status', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Page', url: 'https://example.com', status: 'success', fetchStatus: 'fetched' }
          ]
        }
      })
      expect(wrapper.find('.fetch-badge').text()).toBe('Fetched')
    })

    it('should show "Snippet" for snippet status', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Page', url: 'https://example.com', status: 'error', fetchStatus: 'snippet' }
          ]
        }
      })
      expect(wrapper.find('.fetch-badge').text()).toBe('Snippet')
    })

    it('should apply fetched class to badge', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Page', url: 'https://example.com', status: 'success', fetchStatus: 'fetched' }
          ]
        }
      })
      expect(wrapper.find('.fetch-badge').classes()).toContain('fetched')
    })

    it('should apply snippet class to badge', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Page', url: 'https://example.com', status: 'error', fetchStatus: 'snippet' }
          ]
        }
      })
      expect(wrapper.find('.fetch-badge').classes()).toContain('snippet')
    })
  })

  describe('Multiple Sources', () => {
    it('should render all sources with correct numbers', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Source 1', url: 'https://a.com', status: 'success' },
            { title: 'Source 2', url: 'https://b.com', status: 'success' },
            { title: 'Source 3', url: 'https://c.com', status: 'loading' }
          ]
        }
      })
      const numbers = wrapper.findAll('.source-number')
      expect(numbers.length).toBe(3)
      expect(numbers[0].text()).toBe('1')
      expect(numbers[1].text()).toBe('2')
      expect(numbers[2].text()).toBe('3')
    })

    it('should handle mixed status sources', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          sources: [
            { title: 'Success', url: 'https://a.com', status: 'success', fetchStatus: 'fetched' },
            { title: 'Loading', url: 'https://b.com', status: 'loading' },
            { title: 'Error', url: 'https://c.com', status: 'error', fetchStatus: 'snippet' }
          ]
        }
      })
      const items = wrapper.findAll('.source-item')
      expect(items[0].classes()).toContain('success')
      expect(items[1].classes()).toContain('loading')
      expect(items[2].classes()).toContain('error')
    })
  })

  describe('Default Props', () => {
    it('should have empty string as default searchQuery', () => {
      wrapper = mount(WebSearchProgress)
      expect(wrapper.find('.search-query').exists()).toBe(false)
    })

    it('should have empty array as default sources', () => {
      wrapper = mount(WebSearchProgress)
      expect(wrapper.findAll('.source-item').length).toBe(0)
    })
  })
})
