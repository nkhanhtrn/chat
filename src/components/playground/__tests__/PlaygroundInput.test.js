import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaygroundInput from '../PlaygroundInput.vue'

describe('PlaygroundInput', () => {
  let wrapper

  const defaultProps = {
    modelValue: '',
    isStreaming: false,
    isSearching: false,
    isRouting: false,
    currentVerifyAttempt: 0,
    searchStatus: '',
    hasLoadingUrls: false,
    hasLoadingFiles: false,
    isModelReady: true,
    detectedUrls: [],
    uploadedFiles: []
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the input area', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.find('.input-area').exists()).toBe(true)
    })

    it('should render textarea', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render attach button', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.find('.attach-btn').exists()).toBe(true)
    })

    it('should render send button when not streaming', () => {
      wrapper = mount(PlaygroundInput, { props: { ...defaultProps, isStreaming: false } })
      expect(wrapper.find('.send-btn').exists()).toBe(true)
    })

    it('should render stop button when streaming', () => {
      wrapper = mount(PlaygroundInput, { props: { ...defaultProps, isStreaming: true } })
      expect(wrapper.find('.stop-btn').exists()).toBe(true)
    })

    it('should show placeholder text', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.find('textarea').attributes('placeholder')).toBe('Send a message...')
    })
  })

  describe('Input Value', () => {
    it('should reflect modelValue in textarea', () => {
      wrapper = mount(PlaygroundInput, { props: { ...defaultProps, modelValue: 'Hello' } })
      expect(wrapper.find('textarea').element.value).toBe('Hello')
    })

    it('should emit update:modelValue on input', async () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      await wrapper.find('textarea').setValue('Hello')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['Hello'])
    })
  })

  describe('Send Button', () => {
    it('should be disabled when textarea is empty', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: '' }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('should be disabled when model is not ready', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', isModelReady: false }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('should be disabled when loading URLs', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', hasLoadingUrls: true }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('should be disabled when loading files', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', hasLoadingFiles: true }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('should be enabled when has text and model ready', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', isModelReady: true }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeUndefined()
    })

    it('should have ready class when can send', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', isModelReady: true }
      })
      expect(wrapper.find('.send-btn').classes()).toContain('ready')
    })

    it('should emit send when clicked', async () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', isModelReady: true }
      })
      await wrapper.find('.send-btn').trigger('click')
      expect(wrapper.emitted('send')).toBeTruthy()
    })
  })

  describe('Stop Button', () => {
    it('should emit stop when clicked', async () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      await wrapper.find('.stop-btn').trigger('click')
      expect(wrapper.emitted('stop')).toBeTruthy()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should emit send on Enter key', async () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, modelValue: 'Hello', isModelReady: true }
      })
      await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
      expect(wrapper.emitted('send')).toBeTruthy()
    })
  })

  describe('Attachments Bar', () => {
    it('should show attachments bar when there are URLs', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', loading: false, content: 'test' }]
        }
      })
      expect(wrapper.find('.attachments-bar').exists()).toBe(true)
    })

    it('should show attachments bar when there are files', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.pdf', readerName: 'pdf' }]
        }
      })
      expect(wrapper.find('.attachments-bar').exists()).toBe(true)
    })

    it('should not show attachments bar when empty', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, detectedUrls: [], uploadedFiles: [] }
      })
      expect(wrapper.find('.attachments-bar').exists()).toBe(false)
    })

    it('should show URL attachment tag', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', loading: false, content: 'test' }]
        }
      })
      expect(wrapper.find('.attachment-tag').exists()).toBe(true)
      expect(wrapper.find('.tag-icon').text()).toContain('🔗')
    })

    it('should show loading status for URL being fetched', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', loading: true }]
        }
      })
      expect(wrapper.find('.tag-status.loading').text()).toBe('fetching...')
    })

    it('should show ready status for fetched URL', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          detectedUrls: [{ url: 'https://example.com', loading: false, content: 'test' }]
        }
      })
      expect(wrapper.find('.tag-status.done').text()).toBe('ready')
    })

    it('should show file attachment tag', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.pdf', readerName: 'pdf' }]
        }
      })
      expect(wrapper.find('.attachment-tag').exists()).toBe(true)
      expect(wrapper.find('.tag-text').text()).toBe('test.pdf')
    })

    it('should show PDF icon for PDF files', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.pdf', readerName: 'pdf' }]
        }
      })
      expect(wrapper.find('.tag-icon').text()).toContain('📕')
    })

    it('should show file icon for other files', () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt' }]
        }
      })
      expect(wrapper.find('.tag-icon').text()).toContain('📄')
    })

    it('should emit removeFile when remove button clicked', async () => {
      wrapper = mount(PlaygroundInput, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.pdf', readerName: 'pdf' }]
        }
      })
      await wrapper.find('.tag-remove').trigger('click')
      expect(wrapper.emitted('removeFile')).toBeTruthy()
      expect(wrapper.emitted('removeFile')[0]).toEqual(['test.pdf'])
    })
  })

  describe('Status Text', () => {
    it('should show loading attachments status', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, hasLoadingUrls: true }
      })
      expect(wrapper.find('.status-text').text()).toBe('Loading attachments...')
    })

    it('should show searching status', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: true, isSearching: true, searchStatus: 'Searching web...' }
      })
      expect(wrapper.find('.status-text').text()).toBe('Searching web...')
    })

    it('should show routing status', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: true, isRouting: true }
      })
      expect(wrapper.find('.status-text').text()).toBe('Routing...')
    })

    it('should show retry status', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: true, currentVerifyAttempt: 2 }
      })
      expect(wrapper.find('.status-text').text()).toBe('Retrying (2)...')
    })

    it('should not show status text when idle', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.find('.status-text').exists()).toBe(false)
    })
  })

  describe('File Upload', () => {
    it('should have hidden file input', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('style')).toContain('display: none')
    })

    it('should emit fileUpload when file selected', async () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      const fileInput = wrapper.find('input[type="file"]')
      await fileInput.trigger('change')
      expect(wrapper.emitted('fileUpload')).toBeTruthy()
    })

    it('should disable attach button when streaming', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.attach-btn').attributes('disabled')).toBeDefined()
    })
  })

  describe('Textarea State', () => {
    it('should disable textarea when streaming', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('should enable textarea when not streaming', () => {
      wrapper = mount(PlaygroundInput, {
        props: { ...defaultProps, isStreaming: false }
      })
      expect(wrapper.find('textarea').attributes('disabled')).toBeUndefined()
    })
  })

  describe('Exposed Methods', () => {
    it('should expose textareaRef', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.vm.textareaRef).toBeDefined()
    })

    it('should expose fileInputRef', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(wrapper.vm.fileInputRef).toBeDefined()
    })

    it('should expose resetHeight method', () => {
      wrapper = mount(PlaygroundInput, { props: defaultProps })
      expect(typeof wrapper.vm.resetHeight).toBe('function')
    })
  })
})
