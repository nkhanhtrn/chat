import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AttachmentStatus from '../AttachmentStatus.vue'

// Mock the format utilities
vi.mock('../../../utils/format.js', () => ({
  truncateUrl: vi.fn((url) => url.length > 20 ? url.substring(0, 17) + '...' : url),
  truncateFileName: vi.fn((name) => name.length > 20 ? name.substring(0, 17) + '...' : name),
  formatSize: vi.fn((size) => size < 1000 ? `${size} chars` : `${(size / 1000).toFixed(1)}k chars`)
}))

describe('AttachmentStatus', () => {
  let wrapper

  const defaultProps = {
    detectedUrls: [],
    uploadedFiles: []
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the container', () => {
      wrapper = mount(AttachmentStatus, { props: defaultProps })
      expect(wrapper.find('.attachment-status').exists()).toBe(true)
    })

    it('should not show URL container when no URLs', () => {
      wrapper = mount(AttachmentStatus, { props: defaultProps })
      expect(wrapper.find('.url-status-container').exists()).toBe(false)
    })

    it('should not show file container when no files', () => {
      wrapper = mount(AttachmentStatus, { props: defaultProps })
      expect(wrapper.find('.file-status-container').exists()).toBe(false)
    })
  })

  describe('URL Status Display', () => {
    it('should show URL container when URLs exist', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'loading', content: '' }]
        }
      })
      expect(wrapper.find('.url-status-container').exists()).toBe(true)
    })

    it('should render each URL as an item', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [
            { url: 'https://example.com', status: 'success', content: 'test' },
            { url: 'https://test.com', status: 'loading', content: '' }
          ]
        }
      })
      expect(wrapper.findAll('.url-status-item')).toHaveLength(2)
    })

    it('should show spinner for loading URLs', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'loading', content: '' }]
        }
      })
      expect(wrapper.find('.spinner').exists()).toBe(true)
    })

    it('should show check icon for success URLs', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'success', content: 'test content' }]
        }
      })
      expect(wrapper.find('.check-icon').exists()).toBe(true)
    })

    it('should show error icon for failed URLs', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'error', content: 'Failed to fetch' }]
        }
      })
      expect(wrapper.find('.error-icon').exists()).toBe(true)
    })

    it('should show content size for successful URLs', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'success', content: 'test content' }]
        }
      })
      expect(wrapper.find('.url-content-size').exists()).toBe(true)
    })

    it('should show error message for failed URLs', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'error', content: 'Network error' }]
        }
      })
      const errorEl = wrapper.find('.url-error')
      expect(errorEl.exists()).toBe(true)
      expect(errorEl.text()).toBe('Network error')
    })

    it('should display truncated URL text', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', status: 'success', content: 'test' }]
        }
      })
      expect(wrapper.find('.url-text').exists()).toBe(true)
    })
  })

  describe('File Status Display', () => {
    it('should show file container when files exist', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'loading', content: '' }]
        }
      })
      expect(wrapper.find('.file-status-container').exists()).toBe(true)
    })

    it('should render each file as an item', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [
            { name: 'file1.txt', status: 'success', content: 'content1' },
            { name: 'file2.txt', status: 'loading', content: '' }
          ]
        }
      })
      expect(wrapper.findAll('.file-status-item')).toHaveLength(2)
    })

    it('should show spinner for loading files', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'loading', content: '' }]
        }
      })
      expect(wrapper.find('.file-status-item .spinner').exists()).toBe(true)
    })

    it('should show document icon for successful text files', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'success', content: 'content' }]
        }
      })
      expect(wrapper.find('.file-icon').exists()).toBe(true)
    })

    it('should show PDF icon for PDF files', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'document.pdf', status: 'success', content: 'pdf content' }]
        }
      })
      const fileIcon = wrapper.find('.file-icon')
      expect(fileIcon.exists()).toBe(true)
      // PDF uses book icon (different from text file)
    })

    it('should show error icon for failed files', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'error', content: '', error: 'Failed' }]
        }
      })
      expect(wrapper.find('.file-status-item .error-icon').exists()).toBe(true)
    })

    it('should show file size for successful files', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'success', content: 'test content' }]
        }
      })
      expect(wrapper.find('.file-size').exists()).toBe(true)
    })

    it('should show error message for failed files', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'error', content: '', error: 'File too large' }]
        }
      })
      const errorEl = wrapper.find('.file-error')
      expect(errorEl.exists()).toBe(true)
      expect(errorEl.text()).toBe('File too large')
    })

    it('should show reader badge when readerName is present', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'doc.pdf', status: 'success', content: 'content', readerName: 'pdf' }]
        }
      })
      const badge = wrapper.find('.file-reader-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('pdf')
    })

    it('should not show reader badge when readerName is absent', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'success', content: 'content' }]
        }
      })
      expect(wrapper.find('.file-reader-badge').exists()).toBe(false)
    })

    it('should render remove button for each file', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'success', content: 'content' }]
        }
      })
      expect(wrapper.find('.file-remove').exists()).toBe(true)
    })
  })

  describe('Events', () => {
    it('should emit removeFile with index when remove button clicked', async () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [
            { name: 'file1.txt', status: 'success', content: 'content1' },
            { name: 'file2.txt', status: 'success', content: 'content2' }
          ]
        }
      })
      const removeButtons = wrapper.findAll('.file-remove')
      await removeButtons[1].trigger('click')
      expect(wrapper.emitted('removeFile')).toBeTruthy()
      expect(wrapper.emitted('removeFile')[0]).toEqual([1])
    })

    it('should emit removeFile with correct index for first file', async () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'file1.txt', status: 'success', content: 'content' }]
        }
      })
      await wrapper.find('.file-remove').trigger('click')
      expect(wrapper.emitted('removeFile')[0]).toEqual([0])
    })
  })

  describe('Mixed Content', () => {
    it('should show both URLs and files when both exist', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          detectedUrls: [{ url: 'https://example.com', status: 'success', content: 'test' }],
          uploadedFiles: [{ name: 'test.txt', status: 'success', content: 'content' }]
        }
      })
      expect(wrapper.find('.url-status-container').exists()).toBe(true)
      expect(wrapper.find('.file-status-container').exists()).toBe(true)
    })

    it('should render correct number of items for each type', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          detectedUrls: [
            { url: 'https://a.com', status: 'success', content: 'a' },
            { url: 'https://b.com', status: 'success', content: 'b' }
          ],
          uploadedFiles: [
            { name: 'x.txt', status: 'success', content: 'x' },
            { name: 'y.txt', status: 'success', content: 'y' },
            { name: 'z.txt', status: 'success', content: 'z' }
          ]
        }
      })
      expect(wrapper.findAll('.url-status-item')).toHaveLength(2)
      expect(wrapper.findAll('.file-status-item')).toHaveLength(3)
    })
  })

  describe('Status Variations', () => {
    it('should handle mixed URL statuses', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          detectedUrls: [
            { url: 'https://a.com', status: 'loading', content: '' },
            { url: 'https://b.com', status: 'success', content: 'data' },
            { url: 'https://c.com', status: 'error', content: 'Failed' }
          ]
        }
      })
      expect(wrapper.find('.spinner').exists()).toBe(true)
      expect(wrapper.find('.check-icon').exists()).toBe(true)
      expect(wrapper.find('.error-icon').exists()).toBe(true)
    })

    it('should handle mixed file statuses', () => {
      wrapper = mount(AttachmentStatus, {
        props: {
          ...defaultProps,
          uploadedFiles: [
            { name: 'a.txt', status: 'loading', content: '' },
            { name: 'b.txt', status: 'success', content: 'data' },
            { name: 'c.txt', status: 'error', content: '', error: 'Error' }
          ]
        }
      })
      const items = wrapper.findAll('.file-status-item')
      expect(items).toHaveLength(3)
    })
  })
})
