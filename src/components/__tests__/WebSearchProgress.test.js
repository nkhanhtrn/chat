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

  describe('Search Query', () => {
    it('should not render search query when not provided', () => {
      wrapper = mount(WebSearchProgress)
      expect(wrapper.find('.search-query').exists()).toBe(false)
    })

    it('should display the query text when provided', () => {
      wrapper = mount(WebSearchProgress, {
        props: {
          searchQuery: 'bitcoin price'
        }
      })
      expect(wrapper.find('.query-text').text()).toContain('bitcoin price')
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
  })
})
