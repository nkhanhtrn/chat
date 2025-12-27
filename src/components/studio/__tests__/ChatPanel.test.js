import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatPanel from '../ChatPanel.vue'

// Mock child components
vi.mock('../MessageList.vue', () => ({
  default: {
    name: 'MessageList',
    props: ['messages', 'isStreaming', 'isSearching', 'searchQuery', 'currentPlanningStep'],
    template: '<div class="mock-message-list">{{ messages.length }} messages</div>'
  }
}))

vi.mock('../MessageInput.vue', () => ({
  default: {
    name: 'MessageInput',
    props: [
      'modelValue', 'isStreaming', 'isSearching', 'isRouting',
      'currentVerifyAttempt', 'searchStatus', 'hasLoadingUrls',
      'hasLoadingFiles', 'isModelReady', 'messagesEmpty',
      'detectedUrls', 'uploadedFiles'
    ],
    emits: ['update:modelValue', 'send', 'stop', 'clear', 'trigger-upload', 'file-upload', 'remove-file'],
    template: '<div class="mock-message-input"><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>'
  }
}))

describe('ChatPanel', () => {
  let wrapper

  const defaultProps = {
    messages: [],
    isStreaming: false,
    isSearching: false,
    searchQuery: '',
    currentPlanningStep: -1,
    modelValue: '',
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
    it('should render the chat panel content', () => {
      wrapper = mount(ChatPanel, { props: defaultProps })
      expect(wrapper.find('.chat-panel-content').exists()).toBe(true)
    })

    it('should render MessageList component', () => {
      wrapper = mount(ChatPanel, { props: defaultProps })
      expect(wrapper.find('.mock-message-list').exists()).toBe(true)
    })

    it('should render MessageInput component', () => {
      wrapper = mount(ChatPanel, { props: defaultProps })
      expect(wrapper.find('.mock-message-input').exists()).toBe(true)
    })
  })

  describe('Props Passing', () => {
    it('should pass messages to MessageList', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' }
      ]
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, messages }
      })

      const messageList = wrapper.findComponent({ name: 'MessageList' })
      expect(messageList.props('messages')).toEqual(messages)
    })

    it('should pass isStreaming to MessageList', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, isStreaming: true }
      })

      const messageList = wrapper.findComponent({ name: 'MessageList' })
      expect(messageList.props('isStreaming')).toBe(true)
    })

    it('should pass isSearching to MessageList', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, isSearching: true }
      })

      const messageList = wrapper.findComponent({ name: 'MessageList' })
      expect(messageList.props('isSearching')).toBe(true)
    })

    it('should pass searchQuery to MessageList', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, searchQuery: 'test query' }
      })

      const messageList = wrapper.findComponent({ name: 'MessageList' })
      expect(messageList.props('searchQuery')).toBe('test query')
    })

    it('should pass currentPlanningStep to MessageList', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, currentPlanningStep: 2 }
      })

      const messageList = wrapper.findComponent({ name: 'MessageList' })
      expect(messageList.props('currentPlanningStep')).toBe(2)
    })

    it('should pass modelValue to MessageInput', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, modelValue: 'test input' }
      })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      expect(messageInput.props('modelValue')).toBe('test input')
    })

    it('should pass isStreaming to MessageInput', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, isStreaming: true }
      })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      expect(messageInput.props('isStreaming')).toBe(true)
    })

    it('should pass isRouting to MessageInput', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, isRouting: true }
      })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      expect(messageInput.props('isRouting')).toBe(true)
    })

    it('should pass isModelReady to MessageInput', () => {
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, isModelReady: false }
      })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      expect(messageInput.props('isModelReady')).toBe(false)
    })

    it('should pass uploadedFiles to MessageInput', () => {
      const files = [{ name: 'test.pdf' }]
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, uploadedFiles: files }
      })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      expect(messageInput.props('uploadedFiles')).toEqual(files)
    })

    it('should pass detectedUrls to MessageInput', () => {
      const urls = ['https://example.com']
      wrapper = mount(ChatPanel, {
        props: { ...defaultProps, detectedUrls: urls }
      })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      expect(messageInput.props('detectedUrls')).toEqual(urls)
    })
  })

  describe('Events', () => {
    it('should emit update:modelValue', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('update:modelValue', 'new value')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['new value'])
    })

    it('should emit send event', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('send')

      expect(wrapper.emitted('send')).toBeTruthy()
    })

    it('should emit stop event', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('stop')

      expect(wrapper.emitted('stop')).toBeTruthy()
    })

    it('should emit clear event', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('clear')

      expect(wrapper.emitted('clear')).toBeTruthy()
    })

    it('should emit trigger-upload event', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('trigger-upload')

      expect(wrapper.emitted('trigger-upload')).toBeTruthy()
    })

    it('should emit file-upload event with payload', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })
      const file = new File([''], 'test.pdf')

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('file-upload', file)

      expect(wrapper.emitted('file-upload')).toBeTruthy()
      expect(wrapper.emitted('file-upload')[0]).toEqual([file])
    })

    it('should emit remove-file event with index', async () => {
      wrapper = mount(ChatPanel, { props: defaultProps })

      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      await messageInput.vm.$emit('remove-file', 0)

      expect(wrapper.emitted('remove-file')).toBeTruthy()
      expect(wrapper.emitted('remove-file')[0]).toEqual([0])
    })
  })

  describe('Exposed Refs', () => {
    it('should expose messageListRef', () => {
      wrapper = mount(ChatPanel, { props: defaultProps })
      expect(wrapper.vm.messageListRef).toBeDefined()
    })

    it('should expose messageInputRef', () => {
      wrapper = mount(ChatPanel, { props: defaultProps })
      expect(wrapper.vm.messageInputRef).toBeDefined()
    })
  })

  describe('Default Props', () => {
    it('should use default values when props not provided', () => {
      wrapper = mount(ChatPanel)

      const messageList = wrapper.findComponent({ name: 'MessageList' })
      expect(messageList.props('messages')).toEqual([])
      expect(messageList.props('isStreaming')).toBe(false)
      expect(messageList.props('isSearching')).toBe(false)
      expect(messageList.props('searchQuery')).toBe('')
      expect(messageList.props('currentPlanningStep')).toBe(-1)
    })
  })
})
