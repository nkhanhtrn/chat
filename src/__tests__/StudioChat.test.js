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

vi.mock('../components/studio/ChatPanel.vue', () => ({
  default: {
    name: 'ChatPanel',
    template: '<div class="chat-panel"></div>',
    props: ['modelValue', 'routerProviderId', 'executorProviderId', 'thinkingMode', 'messages', 'isStreaming', 'isSearching', 'searchQuery', 'currentPlanningStep', 'isRouting', 'currentVerifyAttempt', 'searchStatus', 'hasLoadingUrls', 'hasLoadingFiles', 'isModelReady', 'detectedUrls', 'uploadedFiles', 'providers'],
    emits: ['update:modelValue', 'update:routerProviderId', 'update:executorProviderId', 'update:thinkingMode', 'send', 'stop', 'clear', 'trigger-upload', 'file-upload', 'remove-file', 'edit'],
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
    props: ['windows', 'sessionId', 'hasHistoryFn'],
    emits: ['close-window', 'minimize-window', 'restore-window', 'update-position', 'update-size', 'bring-to-front']
  }
}))

vi.mock('../components/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="studio-page"><div class="studio-layout"><slot name="side" /><slot /></div></div>',
    props: ['storageKey']
  }
}))

vi.mock('../components/studio/SessionTabs.vue', () => ({
  default: {
    name: 'SessionTabs',
    template: '<div class="session-tabs"></div>',
    props: ['sessions', 'activeSessionId'],
    emits: ['select', 'close', 'new', 'rename', 'browse']
  }
}))

vi.mock('../components/studio/SessionBrowser.vue', () => ({
  default: {
    name: 'SessionBrowser',
    template: '<div class="session-browser"></div>',
    props: ['sessions', 'activeSessionId'],
    emits: ['close', 'select', 'delete', 'new', 'rename']
  }
}))

// Mock LMService
vi.mock('../services/llm/LMService.js', () => ({
  Category: {
    FREE: 'free',
    QUICK: 'quick',
    DETAILS: 'details',
    REASONING: 'reasoning'
  },
  default: {
    listProviders: vi.fn(() => [
      { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
      { id: 'cerebras', name: 'Cerebras', requiresApiKey: true },
      { id: 'google', name: 'Google AI', requiresApiKey: true }
    ])
  }
}))

// Mock Settings
vi.mock('../services/Settings.js', () => ({
  Settings: {
    getAll: vi.fn(() => ({
      currentModels: {
        lmstudio: 'local-model',
        cerebras: 'cerebras-model',
        google: 'gemini-model'
      }
    }))
  }
}))

// Mock composables
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
  onOutput: vi.fn(),
  setSessionManager: vi.fn(),
  loadState: vi.fn(),
  getState: vi.fn(() => ({ messages: [], nextMessageId: 1 })),
  deleteMessagePair: vi.fn()
}

const mockCanvas = {
  getNextCascadePosition: vi.fn(() => ({ x: 0, y: 0 })),
  getNextZIndex: vi.fn(() => 100),
  getDefaultSize: vi.fn(() => ({ width: 400, height: 300 })),
  getMinSize: vi.fn(() => ({ width: 200, height: 150 })),
  generateTitle: vi.fn(() => 'Tool'),
  cleanObject: vi.fn((obj) => obj),
  pushToHistory: vi.fn(),
  hasHistory: vi.fn(() => false),
  popFromHistory: vi.fn(),
  clearHistory: vi.fn(),
  DISPLAY_STATES: {
    OPEN: 'open',
    MINIMIZED: 'minimized',
    CLOSED: 'closed'
  }
}

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

vi.mock('../composables/studio/useContentEditor.js', () => ({
  useContentEditor: () => ({
    editContent: vi.fn()
  })
}))

vi.mock('../composables/studio/useStudioCanvas.js', () => ({
  useStudioCanvas: () => mockCanvas,
  hasHistory: vi.fn(() => false)
}))

const mockSessions = {
  sessions: ref([]),
  activeSessionId: ref(null),
  activeSession: ref(null),
  sortedSessions: ref([]),
  allSessions: ref([]),
  activeChatState: ref({ messages: [], nextMessageId: 1 }),
  activeCanvasState: ref({ windows: [], nextWindowId: 1, cascadeOffset: { x: 0, y: 0 }, maxZIndex: 100 }),
  activeTools: ref({}),
  windows: ref([]),
  visibleWindows: ref([]),
  minimizedWindowsByCategory: ref([]),
  initializeSessions: vi.fn(() => Promise.resolve()),
  createNewSession: vi.fn(),
  switchToSession: vi.fn(),
  renameSession: vi.fn(),
  hideSession: vi.fn(),
  showSession: vi.fn(),
  deleteSession: vi.fn(),
  updateChatState: vi.fn(),
  updateCanvasState: vi.fn(),
  syncSessionData: vi.fn(() => Promise.resolve()),
  forceSyncToCloud: vi.fn(() => Promise.resolve()),
  resetStateForTesting: vi.fn(),
  enableSkipWatch: vi.fn(),
  disableSkipWatch: vi.fn(),
  addWindow: vi.fn(),
  removeWindow: vi.fn(),
  updateWindow: vi.fn(),
  getWindows: vi.fn(() => [])
}

vi.mock('../composables/studio/useStudioSessions.js', () => ({
  useStudioSessions: () => mockSessions
}))

describe('StudioChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAttachments.hasLoadingAttachments.value = false
    mockChat.messages.value = []
    mockChat.isStreaming.value = false
    mockSessions.windows.value = []
    mockSessions.visibleWindows.value = []
    mockSessions.minimizedWindowsByCategory.value = []
    mockSessions.sessions.value = []
    mockSessions.sortedSessions.value = []
    mockSessions.allSessions.value = []
  })

  describe('rendering', () => {
    it('should render studio page structure', () => {
      const wrapper = mount(StudioChat)

      expect(wrapper.find('.studio-page').exists()).toBe(true)
      expect(wrapper.find('.studio-layout').exists()).toBe(true)
    })

    it('should render child components', () => {
      const wrapper = mount(StudioChat)

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
      expect(chatPanel.props('isModelReady')).toBe(true) // Both lmstudio providers have models
    })
  })

  describe('initialization', () => {
    it('should initialize sessions on mount', async () => {
      mount(StudioChat)
      await flushPromises()

      expect(mockSessions.initializeSessions).toHaveBeenCalled()
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
      // Mock settings without currentModels
      const { Settings } = require('../services/Settings.js')
      Settings.getAll.mockReturnValueOnce({ currentModels: {} })

      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

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
        twoModelMode: true,
        modelSelection: expect.objectContaining({
          routerModel: 'local-model',
          executorModel: expect.any(String),
          routerProviderId: 'lmstudio',
          executorProviderId: 'lmstudio'
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
  })

  describe('event handling', () => {
    it('should call stopStreaming on stop event', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('stop')

      expect(mockChat.stopStreaming).toHaveBeenCalled()
    })

    it('should call clearChat on clear event but keep canvas windows', async () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      await chatPanel.vm.$emit('clear')

      expect(mockChat.clearChat).toHaveBeenCalled()
      expect(mockCanvas.clearWindows).not.toHaveBeenCalled()
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

  describe('provider selection', () => {
    it('should pass providers to ChatPanel', () => {
      const wrapper = mount(StudioChat)
      const chatPanel = wrapper.findComponent({ name: 'ChatPanel' })

      expect(chatPanel.props('providers')).toEqual([
        { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
        { id: 'cerebras', name: 'Cerebras', requiresApiKey: true },
        { id: 'google', name: 'Google AI', requiresApiKey: true }
      ])
    })
  })
})
