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

vi.mock('../components/studio/StudioLayout.vue', () => ({
  default: {
    name: 'StudioLayout',
    template: '<div class="studio-layout"><slot name="chat" /><slot name="canvas" /></div>'
  }
}))

vi.mock('../components/studio/ChatPanel.vue', () => ({
  default: {
    name: 'ChatPanel',
    template: '<div class="chat-panel"></div>',
    props: ['modelValue', 'messages', 'isStreaming', 'isSearching', 'searchQuery', 'currentPlanningStep', 'isRouting', 'currentVerifyAttempt', 'searchStatus', 'hasLoadingUrls', 'hasLoadingFiles', 'isModelReady', 'detectedUrls', 'uploadedFiles'],
    emits: ['update:modelValue', 'send', 'stop', 'clear', 'trigger-upload', 'file-upload', 'remove-file'],
    setup() {
      return {
        messageListRef: { containerRef: ref(null) },
        messageInputRef: { fileInputRef: { click: vi.fn() }, resetHeight: vi.fn() }
      }
    }
  }
}))

vi.mock('../components/studio/CanvasPanel.vue', () => ({
  default: {
    name: 'CanvasPanel',
    template: '<div class="canvas-panel"></div>',
    props: ['windows'],
    emits: ['close-window', 'update-position', 'update-size', 'bring-to-front']
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
  scrollToBottom: vi.fn(),
  onOutput: vi.fn()
}

const mockCanvas = {
  windows: ref([]),
  addWindow: vi.fn(),
  removeWindow: vi.fn(),
  updateWindowPosition: vi.fn(),
  updateWindowSize: vi.fn(),
  bringToFront: vi.fn(),
  clearWindows: vi.fn()
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

vi.mock('../composables/studio/useStudioCanvas.js', () => ({
  useStudioCanvas: () => mockCanvas
}))

describe('StudioChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockModelSelection.twoModelMode.value = false
    mockModelSelection.isModelReady.value = true
    mockAttachments.hasLoadingAttachments.value = false
    mockChat.messages.value = []
    mockChat.isStreaming.value = false
    mockCanvas.windows.value = []
  })

  describe('rendering', () => {
    it('should render studio page structure', () => {
      const wrapper = mount(StudioChat)

      expect(wrapper.find('.studio-page').exists()).toBe(true)
      expect(wrapper.find('.studio-layout').exists()).toBe(true)
    })

    it('should render child components', () => {
      const wrapper = mount(StudioChat)

      expect(wrapper.findComponent({ name: 'StudioHeader' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'ChatPanel' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'CanvasPanel' }).exists()).toBe(true)
    })

    it('should pass correct props to ChatPanel', () => {
      mockChat.messages.value = [{ role: 'user', content: 'Hello' }]
      mockChat.isStreaming.value = true
      mockWebSearch.isSearching.value = true
      mockWebSearch.searchQuery.value = 'test query'
      mockPlanning.currentPlanningStep.value = 2
      mockChat.isRouting.value = true
      mockChat.currentVerifyAttempt.value = 2
      mockWebSearch.searchStatus.value = 'Searching...'
      mockAttachments.hasLoadingUrls.value = true
      mockAttachments.hasLoadingFiles.value = true
      mockModelSelection.isModelReady.value = false

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      expect(chatPanel.props('messages')).toEqual([{ role: 'user', content: 'Hello' }])
      expect(chatPanel.props('isStreaming')).toBe(true)
      expect(chatPanel.props('isSearching')).toBe(true)
      expect(chatPanel.props('searchQuery')).toBe('test query')
      expect(chatPanel.props('currentPlanningStep')).toBe(2)
      expect(chatPanel.props('isRouting')).toBe(true)
      expect(chatPanel.props('currentVerifyAttempt')).toBe(2)
      expect(chatPanel.props('searchStatus')).toBe('Searching...')
      expect(chatPanel.props('hasLoadingUrls')).toBe(true)
      expect(chatPanel.props('hasLoadingFiles')).toBe(true)
      expect(chatPanel.props('isModelReady')).toBe(false)
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
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send when model is not ready', async () => {
      mockModelSelection.isModelReady.value = false

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      // Simulate typing via v-model update
      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send when already streaming', async () => {
      mockChat.isStreaming.value = true

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send when attachments are loading', async () => {
      mockAttachments.hasLoadingAttachments.value = true

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')

      expect(mockChat.sendMessage).not.toHaveBeenCalled()
    })

    it('should send message with correct parameters', async () => {
      mockAttachments.getSnapshot.mockReturnValue({
        uploadedFiles: [{ name: 'test.txt' }],
        detectedUrls: [],
        fetchedContents: {}
      })

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello world')
      await chatPanel.vm.$emit('send')
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
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
      await flushPromises()

      // Check that input was cleared by checking the prop passed to ChatPanel
      expect(chatPanel.props('modelValue')).toBe('')
    })

    it('should clear attachments after sending', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
      await flushPromises()

      expect(mockAttachments.clearAll).toHaveBeenCalled()
    })

    it('should reset web search state after sending', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
      await flushPromises()

      expect(mockWebSearch.reset).toHaveBeenCalled()
    })

    it('should reset planning state after sending', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
      await flushPromises()

      expect(mockPlanning.reset).toHaveBeenCalled()
    })

    it('should create search callbacks with correct handlers', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
      await flushPromises()

      expect(mockWebSearch.createSearchCallbacks).toHaveBeenCalledWith({
        updateMessage: expect.any(Function),
        scrollToBottom: expect.any(Function)
      })
    })

    it('should create planning callbacks with correct handlers', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
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
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('stop')

      expect(mockChat.stopStreaming).toHaveBeenCalled()
    })

    it('should call clearChat on clear event', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('clear')

      expect(mockChat.clearChat).toHaveBeenCalled()
      expect(mockCanvas.clearWindows).toHaveBeenCalled()
    })

    it('should call handleFileUpload on file-upload event', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })
      const mockEvent = { target: { files: [] } }

      await chatPanel.vm.$emit('file-upload', mockEvent)

      expect(mockAttachments.handleFileUpload).toHaveBeenCalledWith(mockEvent)
    })

    it('should call removeFile on remove-file event', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('remove-file', 0)

      expect(mockAttachments.removeFile).toHaveBeenCalledWith(0)
    })
  })

  describe('two model mode', () => {
    it('should send with twoModelMode true when enabled', async () => {
      mockModelSelection.twoModelMode.value = true

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('update:modelValue', 'Hello')
      await chatPanel.vm.$emit('send')
      await flushPromises()

      expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          twoModelMode: true
        })
      )
    })
  })

  describe('messages state', () => {
    it('should have empty messages initially', () => {
      mockChat.messages.value = []

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      expect(chatPanel.props('messages')).toEqual([])
    })

    it('should pass messages when they exist', () => {
      mockChat.messages.value = [{ role: 'user', content: 'Hello' }]

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      expect(chatPanel.props('messages')).toEqual([{ role: 'user', content: 'Hello' }])
    })
  })
})
