import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import StudioChat from '../views/StudioChat.vue'

// Mock child components
vi.mock('../components/SlideTransition.vue', () => ({
  default: {
    name: 'SlideTransition',
    template: '<div class="slide-transition"><slot /></div>'
  }
}))

vi.mock('../components/studio/StudioHeader.vue', () => ({
  default: {
    name: 'StudioHeader',
    template: '<div class="studio-header"></div>',
    props: ['twoModelMode', 'selectedProvider', 'selectedModel', 'routerModel', 'executorModel', 'providers', 'models', 'allModels']
  }
}))

vi.mock('../components/studio/MessageList.vue', () => ({
  default: {
    name: 'MessageList',
    template: '<div class="message-list"></div>',
    props: ['messages', 'isStreaming', 'isSearching', 'searchQuery', 'currentPlanningStep'],
    setup() {
      return { containerRef: ref(null) }
    }
  }
}))

vi.mock('../components/studio/MessageInput.vue', () => ({
  default: {
    name: 'MessageInput',
    template: '<div class="message-input"></div>',
    props: ['modelValue', 'isStreaming', 'isSearching', 'isRouting', 'currentVerifyAttempt', 'searchStatus', 'hasLoadingUrls', 'hasLoadingFiles', 'isModelReady', 'messagesEmpty', 'detectedUrls', 'uploadedFiles'],
    emits: ['update:modelValue', 'send', 'stop', 'clear', 'trigger-upload', 'file-upload', 'remove-file'],
    setup() {
      return {
        fileInputRef: { click: vi.fn() },
        resetHeight: vi.fn()
      }
    }
  }
}))

vi.mock('../components/MobileFooter.vue', () => ({
  default: {
    name: 'MobileFooter',
    template: '<div class="mobile-footer"></div>',
    props: ['activePage', 'showHome', 'showNewNotebook', 'mobileOnly']
  }
}))

// Mock composables
const mockModelSelection = {
  twoModelMode: ref(false),
  selectedProvider: ref('lmstudio'),
  selectedModel: ref('model-1'),
  routerModel: ref('router-model'),
  executorModel: ref('executor-model'),
  providers: ref([{ id: 'lmstudio', name: 'LM Studio' }]),
  models: ref([{ id: 'model-1', name: 'Model 1' }]),
  allModels: ref([{ id: 'model-1', name: 'Model 1' }]),
  isModelReady: ref(true),
  routerModelData: ref({ providerId: 'lmstudio' }),
  executorModelData: ref({ providerId: 'lmstudio' }),
  initialize: vi.fn(() => Promise.resolve()),
  onProviderChange: vi.fn()
}

const mockAttachments = {
  detectedUrls: ref([]),
  uploadedFiles: ref([]),
  hasLoadingUrls: ref(false),
  hasLoadingFiles: ref(false),
  hasLoadingAttachments: ref(false),
  watchInputForUrls: vi.fn(),
  getSnapshot: vi.fn(() => ({
    uploadedFiles: [],
    detectedUrls: [],
    fetchedContents: {}
  })),
  clearAll: vi.fn(),
  handleFileUpload: vi.fn(),
  removeFile: vi.fn()
}

const mockWebSearch = {
  isSearching: ref(false),
  searchQuery: ref(''),
  searchStatus: ref(''),
  createSearchCallbacks: vi.fn(() => ({})),
  reset: vi.fn()
}

const mockPlanning = {
  currentPlanningStep: ref(-1),
  createPlanningCallbacks: vi.fn(() => ({})),
  reset: vi.fn()
}

const mockChat = {
  messages: ref([]),
  isStreaming: ref(false),
  isRouting: ref(false),
  currentVerifyAttempt: ref(0),
  messagesContainer: ref(null),
  sendMessage: vi.fn(() => Promise.resolve()),
  stopStreaming: vi.fn(),
  clearChat: vi.fn(),
  updateLastMessage: vi.fn(),
  getLastMessage: vi.fn(),
  scrollToBottom: vi.fn()
}

vi.mock('../composables/useModelSelection.js', () => ({
  useModelSelection: () => mockModelSelection
}))

vi.mock('../composables/useAttachments.js', () => ({
  useAttachments: () => mockAttachments
}))

vi.mock('../composables/studio/useWebSearch.js', () => ({
  useWebSearch: () => mockWebSearch
}))

vi.mock('../composables/studio/usePlanning.js', () => ({
  usePlanning: () => mockPlanning
}))

vi.mock('../composables/studio/useStudioChat.js', () => ({
  useStudioChat: () => mockChat
}))

describe('StudioChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockModelSelection.twoModelMode.value = false
    mockModelSelection.isModelReady.value = true
    mockAttachments.hasLoadingAttachments.value = false
    mockChat.messages.value = []
    mockChat.isStreaming.value = false
  })

  describe('rendering', () => {
    it('should render studio page structure', () => {
      const wrapper = mount(StudioChat)

      expect(wrapper.find('.studio-page').exists()).toBe(true)
      expect(wrapper.find('.studio-content').exists()).toBe(true)
    })

    it('should render child components', () => {
      const wrapper = mount(StudioChat)

      expect(wrapper.findComponent({ name: 'StudioHeader' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'MessageList' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'MessageInput' }).exists()).toBe(true)
    })

    it('should pass correct props to MessageList', () => {
      mockChat.messages.value = [{ role: 'user', content: 'Hello' }]
      mockChat.isStreaming.value = true
      mockWebSearch.isSearching.value = true
      mockWebSearch.searchQuery.value = 'test query'
      mockPlanning.currentPlanningStep.value = 2

      const wrapper = mount(StudioChat)
      const messageList = wrapper.findComponent({ name: 'MessageList' })

      expect(messageList.props('messages')).toEqual([{ role: 'user', content: 'Hello' }])
      expect(messageList.props('isStreaming')).toBe(true)
      expect(messageList.props('isSearching')).toBe(true)
      expect(messageList.props('searchQuery')).toBe('test query')
      expect(messageList.props('currentPlanningStep')).toBe(2)
    })

    it('should pass correct props to MessageInput', () => {
      mockChat.isStreaming.value = true
      mockWebSearch.isSearching.value = true
      mockChat.isRouting.value = true
      mockChat.currentVerifyAttempt.value = 2
      mockWebSearch.searchStatus.value = 'Searching...'
      mockAttachments.hasLoadingUrls.value = true
      mockAttachments.hasLoadingFiles.value = true
      mockModelSelection.isModelReady.value = false

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      expect(messageInput.props('isStreaming')).toBe(true)
      expect(messageInput.props('isSearching')).toBe(true)
      expect(messageInput.props('isRouting')).toBe(true)
      expect(messageInput.props('currentVerifyAttempt')).toBe(2)
      expect(messageInput.props('searchStatus')).toBe('Searching...')
      expect(messageInput.props('hasLoadingUrls')).toBe(true)
      expect(messageInput.props('hasLoadingFiles')).toBe(true)
      expect(messageInput.props('isModelReady')).toBe(false)
    })
  })

  describe('initialization', () => {
    it('should initialize model selection on mount', async () => {
      mount(StudioChat)
      await flushPromises()

      expect(mockModelSelection.initialize).toHaveBeenCalled()
    })

    it('should watch input for URLs', () => {
      mount(StudioChat)

      expect(mockAttachments.watchInputForUrls).toHaveBeenCalled()
    })
  })

  describe('handleSend', () => {
    it('should not send when input is empty', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send when model is not ready', async () => {
      mockModelSelection.isModelReady.value = false

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      // Simulate typing via v-model update
      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send when already streaming', async () => {
      mockChat.isStreaming.value = true

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send when attachments are loading', async () => {
      mockAttachments.hasLoadingAttachments.value = true

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should send message with correct parameters', async () => {
      mockAttachments.getSnapshot.mockReturnValue({
        uploadedFiles: [{ name: 'test.txt' }],
        detectedUrls: [],
        fetchedContents: {}
      })

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello world')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockChat.sendMessage).toHaveBeenCalledWith({
        inputText: 'Hello world',
        attachmentSnapshot: {
          uploadedFiles: [{ name: 'test.txt' }],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: false,
        modelSelection: expect.objectContaining({
          routerModel: 'router-model',
          executorModel: 'executor-model',
          selectedModel: 'model-1'
        }),
        searchCallbacks: expect.any(Object),
        planningCallbacks: expect.any(Object)
      })
    })

    it('should clear input after sending', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      // Check that input was cleared by checking the prop passed to MessageInput
      expect(messageInput.props('modelValue')).toBe('')
    })

    it('should clear attachments after sending', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockAttachments.clearAll).toHaveBeenCalled()
    })

    it('should reset web search state after sending', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockWebSearch.reset).toHaveBeenCalled()
    })

    it('should reset planning state after sending', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockPlanning.reset).toHaveBeenCalled()
    })

    it('should create search callbacks with correct handlers', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockWebSearch.createSearchCallbacks).toHaveBeenCalledWith({
        updateMessage: expect.any(Function),
        scrollToBottom: expect.any(Function)
      })
    })

    it('should create planning callbacks with correct handlers', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockPlanning.createPlanningCallbacks).toHaveBeenCalledWith({
        updateMessage: expect.any(Function),
        getMessage: expect.any(Function),
        scrollToBottom: expect.any(Function)
      })
    })
  })

  describe('event handling', () => {
    it('should call stopStreaming on stop event', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('stop')

      expect(mockChat.stopStreaming).toHaveBeenCalled()
    })

    it('should call clearChat on clear event', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('clear')

      expect(mockChat.clearChat).toHaveBeenCalled()
    })

    it('should call handleFileUpload on file-upload event', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })
      const mockEvent = { target: { files: [] } }

      await messageInput.vm.$emit('file-upload', mockEvent)

      expect(mockAttachments.handleFileUpload).toHaveBeenCalledWith(mockEvent)
    })

    it('should call removeFile on remove-file event', async () => {
      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('remove-file', 0)

      expect(mockAttachments.removeFile).toHaveBeenCalledWith(0)
    })
  })

  describe('two model mode', () => {
    it('should send with twoModelMode true when enabled', async () => {
      mockModelSelection.twoModelMode.value = true

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      await messageInput.vm.$emit('update:modelValue', 'Hello')
      await messageInput.vm.$emit('send')
      await flushPromises()

      expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          twoModelMode: true
        })
      )
    })
  })

  describe('messagesEmpty prop', () => {
    it('should pass messagesEmpty as true when no messages', () => {
      mockChat.messages.value = []

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      expect(messageInput.props('messagesEmpty')).toBe(true)
    })

    it('should pass messagesEmpty as false when has messages', () => {
      mockChat.messages.value = [{ role: 'user', content: 'Hello' }]

      const wrapper = mount(StudioChat)
      const messageInput = wrapper.findComponent({ name: 'MessageInput' })

      expect(messageInput.props('messagesEmpty')).toBe(false)
    })
  })
})
