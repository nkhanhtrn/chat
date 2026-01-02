/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UrlAttachmentsPreview from '../UrlAttachmentsPreview.vue'

describe('UrlAttachmentsPreview', () => {
  it('should not render when urls array is empty', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: { urls: [] }
    })

    expect(wrapper.find('.url-attachments').exists()).toBe(false)
  })

  it('should not render when urls prop is not provided', () => {
    const wrapper = mount(UrlAttachmentsPreview)

    expect(wrapper.find('.url-attachments').exists()).toBe(false)
  })

  it('should render loading status correctly', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [
          { url: 'https://example.com', status: 'loading' }
        ]
      }
    })

    expect(wrapper.find('.url-attachments').exists()).toBe(true)
    expect(wrapper.find('.url-attachment').exists()).toBe(true)
    expect(wrapper.find('.url-attachment.loading').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading...')
    expect(wrapper.text()).toContain('example.com')
  })

  it('should render success status correctly', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [
          { url: 'https://example.com', status: 'success' }
        ]
      }
    })

    expect(wrapper.find('.url-attachment.success').exists()).toBe(true)
    expect(wrapper.find('.url-status.success').exists()).toBe(true)
    expect(wrapper.text()).toContain('✓')
  })

  it('should render error status correctly', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [
          { url: 'https://example.com', status: 'error' }
        ]
      }
    })

    expect(wrapper.find('.url-attachment.error').exists()).toBe(true)
    expect(wrapper.find('.url-status.error').exists()).toBe(true)
    expect(wrapper.text()).toContain('✗')
  })

  it('should render multiple urls', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [
          { url: 'https://example.com', status: 'success' },
          { url: 'https://another.com', status: 'loading' }
        ]
      }
    })

    expect(wrapper.findAll('.url-attachment')).toHaveLength(2)
    expect(wrapper.text()).toContain('example.com')
    expect(wrapper.text()).toContain('another.com')
  })

  it('should apply size-small class when size is small', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [{ url: 'https://example.com', status: 'loading' }],
        size: 'small'
      }
    })

    expect(wrapper.find('.url-attachments.size-small').exists()).toBe(true)
  })

  it('should apply size-medium class by default', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [{ url: 'https://example.com', status: 'loading' }]
      }
    })

    expect(wrapper.find('.url-attachments.size-medium').exists()).toBe(true)
  })

  it('should apply size-large class when size is large', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [{ url: 'https://example.com', status: 'loading' }],
        size: 'large'
      }
    })

    expect(wrapper.find('.url-attachments.size-large').exists()).toBe(true)
  })

  it('should truncate long URLs', () => {
    const longUrl = 'https://example.com/very/long/path/that/should/be/truncated/for/display/purposes'
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [{ url: longUrl, status: 'loading' }]
      }
    })

    const urlText = wrapper.find('.url-text')
    // truncateUrl truncates to 40 chars with ellipsis
    expect(urlText.text().length).toBeLessThan(longUrl.length)
    expect(urlText.text()).toContain('...')
  })

  it('should show link icon for each URL', () => {
    const wrapper = mount(UrlAttachmentsPreview, {
      props: {
        urls: [
          { url: 'https://example.com', status: 'success' },
          { url: 'https://another.com', status: 'success' }
        ]
      }
    })

    const icons = wrapper.findAll('.url-icon')
    expect(icons).toHaveLength(2)
    icons.forEach(icon => {
      expect(icon.text()).toBe('🔗')
    })
  })
})
