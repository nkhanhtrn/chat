import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageInput from '../MessageInput.vue'
import AttachmentStatus from '../AttachmentStatus.vue'

describe('MessageInput', () => {
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
    messagesEmpty: true,
    detectedUrls: [],
    uploadedFiles: []
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the input container', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.input-container').exists()).toBe(true)
    })

    it('should render the input box', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.input-box').exists()).toBe(true)
    })

    it('should render textarea', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render upload button', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.upload-btn').exists()).toBe(true)
    })

    it('should render hidden file input', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('style')).toContain('display: none')
    })

    it('should render clear button when messages exist', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, messagesEmpty: false }
      })
      expect(wrapper.find('.clear-btn').exists()).toBe(true)
    })

    it('should not render clear button when messages empty', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.clear-btn').exists()).toBe(false)
    })

    it('should render AttachmentStatus component', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.findComponent(AttachmentStatus).exists()).toBe(true)
    })
  })

  describe('Send Button', () => {
    it('should show send button when not streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: false }
      })
      expect(wrapper.find('.send-btn').exists()).toBe(true)
    })

    it('should show stop button when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.stop-btn').exists()).toBe(true)
    })

    it('should not show send button when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.send-btn').exists()).toBe(false)
    })

    it('should not show stop button when not streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: false }
      })
      expect(wrapper.find('.stop-btn').exists()).toBe(false)
    })
  })

  describe('Send Button State', () => {
    it('should disable send button when model not ready', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isModelReady: false }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('should enable send button when model ready and has input', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isModelReady: true, modelValue: 'hello' }
      })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeUndefined()
    })

    it('should show loading spinner when URLs are loading', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, hasLoadingUrls: true }
      })
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    })

    it('should show loading spinner when files are loading', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, hasLoadingFiles: true }
      })
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    })
  })

  describe('Status Text', () => {
    it('should show status text when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.status-text').exists()).toBe(true)
    })

    it('should not show status text when not streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: false }
      })
      expect(wrapper.find('.status-text').exists()).toBe(false)
    })

    it('should show search status when searching', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true, isSearching: true, searchStatus: 'Searching web...' }
      })
      expect(wrapper.find('.status-text').text()).toContain('Searching web')
    })

    it('should show "Analyzing..." when routing', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true, isRouting: true }
      })
      expect(wrapper.find('.status-text').text()).toContain('Analyzing')
    })

    it('should show "Generating..." by default when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.status-text').text()).toContain('Generating')
    })
  })

  describe('Textarea', () => {
    it('should have correct placeholder', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('textarea').attributes('placeholder')).toBe('Message...')
    })

    it('should be disabled when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('should display modelValue', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'Hello world' }
      })
      expect(wrapper.find('textarea').element.value).toBe('Hello world')
    })
  })

  describe('Events', () => {
    it('should emit update:modelValue on input', async () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const textarea = wrapper.find('textarea')
      await textarea.setValue('test message')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['test message'])
    })

    it('should emit send on Enter key', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'test' }
      })
      await wrapper.find('textarea').trigger('keydown.enter')
      expect(wrapper.emitted('send')).toBeTruthy()
    })

    it('should emit send when send button clicked', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'test' }
      })
      await wrapper.find('.send-btn').trigger('click')
      expect(wrapper.emitted('send')).toBeTruthy()
    })

    it('should emit stop when stop button clicked', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      await wrapper.find('.stop-btn').trigger('click')
      expect(wrapper.emitted('stop')).toBeTruthy()
    })

    it('should emit clear when clear button clicked', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, messagesEmpty: false }
      })
      await wrapper.find('.clear-btn').trigger('click')
      expect(wrapper.emitted('clear')).toBeTruthy()
    })

    it('should emit triggerUpload when upload button clicked', async () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      await wrapper.find('.upload-btn').trigger('click')
      expect(wrapper.emitted('triggerUpload')).toBeTruthy()
    })

    it('should emit fileUpload on file input change', async () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const fileInput = wrapper.find('input[type="file"]')
      await fileInput.trigger('change')
      expect(wrapper.emitted('fileUpload')).toBeTruthy()
    })

    it('should emit removeFile from AttachmentStatus', async () => {
      wrapper = mount(MessageInput, {
        props: {
          ...defaultProps,
          uploadedFiles: [{ name: 'test.txt', status: 'success', content: 'test' }]
        }
      })
      const attachmentStatus = wrapper.findComponent(AttachmentStatus)
      await attachmentStatus.vm.$emit('remove-file', 0)
      expect(wrapper.emitted('removeFile')).toBeTruthy()
      expect(wrapper.emitted('removeFile')[0]).toEqual([0])
    })
  })

  describe('File Input Attributes', () => {
    it('should allow multiple file selection', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.attributes('multiple')).toBeDefined()
    })
  })

  describe('Button Disabling', () => {
    it('should disable upload button when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.upload-btn').attributes('disabled')).toBeDefined()
    })
  })
})
