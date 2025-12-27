import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageInput from '../MessageInput.vue'
import Button from '../../Button.vue'
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

    it('should render the input wrapper', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.input-wrapper').exists()).toBe(true)
    })

    it('should render textarea', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render upload button', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.upload-button').exists()).toBe(true)
    })

    it('should render hidden file input', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('style')).toContain('display: none')
    })

    it('should render clear button', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.clear-button').exists()).toBe(true)
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
      expect(wrapper.findComponent(Button).exists()).toBe(true)
    })

    it('should show stop button when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.stop-button').exists()).toBe(true)
    })

    it('should not show send button when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.send-button').exists()).toBe(false)
    })
  })

  describe('Button Text', () => {
    it('should show "Send" by default', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.findComponent(Button).text()).toBe('Send')
    })

    it('should show "Loading..." when URLs are loading', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, hasLoadingUrls: true }
      })
      expect(wrapper.findComponent(Button).text()).toBe('Loading...')
    })

    it('should show "Loading..." when files are loading', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, hasLoadingFiles: true }
      })
      expect(wrapper.findComponent(Button).text()).toBe('Loading...')
    })

    it('should show "Searching..." when searching', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isSearching: true }
      })
      expect(wrapper.findComponent(Button).text()).toBe('Searching...')
    })
  })

  describe('Stop Button Text', () => {
    it('should show "Stop generating" by default when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.stop-button').text()).toBe('Stop generating')
    })

    it('should show search status when searching', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true, isSearching: true, searchStatus: 'Fetching results...' }
      })
      expect(wrapper.find('.stop-button').text()).toBe('Fetching results...')
    })

    it('should show "Routing..." when routing', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true, isRouting: true }
      })
      expect(wrapper.find('.stop-button').text()).toBe('Routing...')
    })

    it('should show retry attempt when verifying', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true, currentVerifyAttempt: 2 }
      })
      expect(wrapper.find('.stop-button').text()).toBe('Retrying (2)...')
    })
  })

  describe('Can Send Logic', () => {
    it('should disable send when input is empty', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: '', isModelReady: true }
      })
      expect(wrapper.findComponent(Button).props('disabled')).toBe(true)
    })

    it('should disable send when model is not ready', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'hello', isModelReady: false }
      })
      expect(wrapper.findComponent(Button).props('disabled')).toBe(true)
    })

    it('should disable send when URLs are loading', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'hello', isModelReady: true, hasLoadingUrls: true }
      })
      expect(wrapper.findComponent(Button).props('disabled')).toBe(true)
    })

    it('should disable send when files are loading', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'hello', isModelReady: true, hasLoadingFiles: true }
      })
      expect(wrapper.findComponent(Button).props('disabled')).toBe(true)
    })

    it('should enable send when all conditions met', () => {
      wrapper = mount(MessageInput, {
        props: {
          ...defaultProps,
          modelValue: 'hello',
          isModelReady: true,
          hasLoadingUrls: false,
          hasLoadingFiles: false
        }
      })
      expect(wrapper.findComponent(Button).props('disabled')).toBe(false)
    })

    it('should disable send when input is only whitespace', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: '   ', isModelReady: true }
      })
      expect(wrapper.findComponent(Button).props('disabled')).toBe(true)
    })
  })

  describe('Textarea', () => {
    it('should have correct placeholder', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('textarea').attributes('placeholder')).toBe('Type your message...')
    })

    it('should be disabled when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('should not be disabled when not streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: false }
      })
      expect(wrapper.find('textarea').attributes('disabled')).toBeUndefined()
    })

    it('should display modelValue', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'test message' }
      })
      expect(wrapper.find('textarea').element.value).toBe('test message')
    })
  })

  describe('Upload Button', () => {
    it('should be disabled when streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      expect(wrapper.find('.upload-button').attributes('disabled')).toBeDefined()
    })

    it('should not be disabled when not streaming', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: false }
      })
      expect(wrapper.find('.upload-button').attributes('disabled')).toBeUndefined()
    })
  })

  describe('Clear Button', () => {
    it('should be disabled when messages are empty', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, messagesEmpty: true }
      })
      expect(wrapper.find('.clear-button').attributes('disabled')).toBeDefined()
    })

    it('should not be disabled when messages exist', () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, messagesEmpty: false }
      })
      expect(wrapper.find('.clear-button').attributes('disabled')).toBeUndefined()
    })

    it('should show "Clear chat" text', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.find('.clear-button').text()).toBe('Clear chat')
    })
  })

  describe('Events', () => {
    it('should emit update:modelValue on input', async () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const textarea = wrapper.find('textarea')
      await textarea.setValue('new text')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['new text'])
    })

    it('should emit send on enter key', async () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      const textarea = wrapper.find('textarea')
      await textarea.trigger('keydown.enter')
      expect(wrapper.emitted('send')).toBeTruthy()
    })

    it('should emit send when send button clicked', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, modelValue: 'test', isModelReady: true }
      })
      await wrapper.findComponent(Button).trigger('click')
      expect(wrapper.emitted('send')).toBeTruthy()
    })

    it('should emit stop when stop button clicked', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, isStreaming: true }
      })
      await wrapper.find('.stop-button').trigger('click')
      expect(wrapper.emitted('stop')).toBeTruthy()
    })

    it('should emit clear when clear button clicked', async () => {
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, messagesEmpty: false }
      })
      await wrapper.find('.clear-button').trigger('click')
      expect(wrapper.emitted('clear')).toBeTruthy()
    })

    it('should emit triggerUpload when upload button clicked', async () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      await wrapper.find('.upload-button').trigger('click')
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
      attachmentStatus.vm.$emit('removeFile', 0)
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

  describe('Exposed Refs and Methods', () => {
    it('should expose textareaRef', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.vm.textareaRef).toBeDefined()
    })

    it('should expose fileInputRef', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(wrapper.vm.fileInputRef).toBeDefined()
    })

    it('should expose resetHeight method', () => {
      wrapper = mount(MessageInput, { props: defaultProps })
      expect(typeof wrapper.vm.resetHeight).toBe('function')
    })
  })

  describe('AttachmentStatus Props', () => {
    it('should pass detectedUrls to AttachmentStatus', () => {
      const urls = [{ url: 'https://test.com', status: 'success', content: 'data' }]
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, detectedUrls: urls }
      })
      const attachmentStatus = wrapper.findComponent(AttachmentStatus)
      expect(attachmentStatus.props('detectedUrls')).toEqual(urls)
    })

    it('should pass uploadedFiles to AttachmentStatus', () => {
      const files = [{ name: 'test.txt', status: 'success', content: 'data' }]
      wrapper = mount(MessageInput, {
        props: { ...defaultProps, uploadedFiles: files }
      })
      const attachmentStatus = wrapper.findComponent(AttachmentStatus)
      expect(attachmentStatus.props('uploadedFiles')).toEqual(files)
    })
  })
})
