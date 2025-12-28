import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatView from '../views/ChatView.vue'
import ChatSidebar from '../components/ChatSidebar.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatMessage from '../components/ChatMessage.vue'
import NotebookOverview from '../components/NotebookOverview.vue'
import Scratchpad from '../components/Scratchpad.vue'
import { useChatStore } from '../stores/chat.js'
import Message from '../stores/Message.js'

// Mock vue-router
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockRouteParams = { id: null, questionId: null }
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace
  }),
  useRoute: () => ({
    name: 'notebook',
    params: mockRouteParams
  })
}))

// Mock the LLM API module
vi.mock('../services/api.js', () => ({
  sendChatMessage: vi.fn((model, messages, onChunk, signal) => {
    // Simulate streaming response
    onChunk('Test response')
    return Promise.resolve()
  }),
  sendChatMessageForFeature: vi.fn((featureType, messages, onChunk, signal) => {
    // Simulate streaming response
    onChunk('Test response')
    return Promise.resolve()
  }),
  FeatureType: {
    QUESTION: 'question',
    DEEP_DIVE: 'deep_dive',
    SUMMARY: 'summary',
    EXPLAIN: 'explain',
    DICTIONARY: 'dictionary',
    SR_SUMMARY: 'sr_summary'
  },
  fetchModels: vi.fn(() => Promise.resolve([
    { id: 'test-model', name: 'Test Model' }
  ])),
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getCurrentConfig: vi.fn(() => ({})),
  setProvider: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true)),
  initProvider: vi.fn(() => Promise.resolve())
}))

// Mock firestore
vi.mock('../services/firestore.js', () => ({
  loadUserSettings: vi.fn(() => Promise.resolve(null)),
  saveUserSettings: vi.fn(() => Promise.resolve()),
  syncChatStateToFirestore: vi.fn(() => Promise.resolve()),
  loadChatStateFromFirestore: vi.fn(() => Promise.resolve(null)),
  subscribeToChatState: vi.fn(() => () => {}),
  deleteChatStateFromFirestore: vi.fn(() => Promise.resolve()),
  subscribeToUserSettings: vi.fn(() => () => {})
}))

// Mock useEnvironment
vi.mock('../composables/useEnvironment.js', () => ({
  getIsDev: vi.fn(() => false),
  getDefaultQuestions: vi.fn(() => [
    'Explain quantum physics',
    'How does photosynthesis work?'
  ])
}))

// Mock extraPrompt
vi.mock('../services/extraPrompt.js', () => ({
  getMainPrompts: vi.fn((question, prev, ctx) => [
    { role: 'user', content: question }
  ]),
  getSRSummaryPrompts: vi.fn((response) => [
    { role: 'system', content: 'Summarize' },
    { role: 'user', content: response }
  ])
}))

// Mock AppLayout to avoid route dependency issues
vi.mock('../components/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="app-container"><slot name="side" /><slot /></div>',
    props: ['storageKey']
  }
}))

describe('ChatView', () => {
  let wrapper
  let pinia
  let chatStore

  const mountComponent = (options = {}) => {
    return mount(ChatView, {
      global: {
        plugins: [pinia],
        stubs: {
          DevToolbar: true,
          SlideTransition: {
            template: '<div><slot /></div>'
          }
        }
      },
      ...options
    })
  }

  // Helper to create a proper Message object
  const createMessage = (data) => {
    return new Message({
      id: data.id,
      question: data.question,
      response: data.response || '',
      parentId: data.parentId || null,
      childIds: data.childIds || [],
      highlightedText: data.highlightedText || null,
      questionSummarized: data.questionSummarized || null
    })
  }

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    mockPush.mockClear()
    mockReplace.mockClear()
    mockRouteParams.id = null
    mockRouteParams.questionId = null

    pinia = createPinia()
    setActivePinia(pinia)
    chatStore = useChatStore(pinia)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Initial Rendering', () => {
    it('should render the app container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.app-container').exists()).toBe(true)
    })

    it('should render ChatSidebar component', () => {
      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)
      expect(sidebar.exists()).toBe(true)
    })

    it('should render chat container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.chat-container').exists()).toBe(true)
    })

    it('should render messages container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })

    it('should show welcome message when no questions exist', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.welcome-message').exists()).toBe(true)
      expect(wrapper.find('.welcome-message h2').text()).toContain('Welcome')
    })

    it('should show example prompts in welcome message', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.example-prompts').exists()).toBe(true)
      const examples = wrapper.findAll('.example-prompts li')
      expect(examples.length).toBeGreaterThan(0)
    })

    it('should render ChatInput when no questions exist', () => {
      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.exists()).toBe(true)
    })
  })

  describe('Notebook Navigation', () => {
    it('should switch to notebook when route has id param', async () => {
      const chat = chatStore.createNewChat()
      mockRouteParams.id = chat.id

      wrapper = mountComponent()
      await flushPromises()

      expect(chatStore.currentChatId).toBe(chat.id)
    })

    it('should redirect to home when notebook does not exist', async () => {
      mockRouteParams.id = 'non-existent-id'

      wrapper = mountComponent()
      await flushPromises()

      expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
    })

  })

  describe('Question Navigation', () => {
    it('should navigate to question when route has questionId', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      chatStore.chats.find(c => c.id === chat.id).rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      expect(chatStore.currentChatId).toBe(chat.id)
    })

    it('should redirect to notebook when question does not exist', async () => {
      const chat = chatStore.createNewChat()
      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'non-existent-question'

      wrapper = mountComponent()
      await flushPromises()

      expect(mockReplace).toHaveBeenCalledWith({
        name: 'notebook',
        params: { id: chat.id }
      })
    })

    it('should handle select-question event from sidebar', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      chatStore.chats.find(c => c.id === chat.id).rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('select-question', { id: 'msg1', chatId: chat.id })

      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: chat.id, questionId: 'msg1' }
      })
    })
  })

  describe('Sending Messages', () => {
    it('should render ChatInput component', () => {
      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.exists()).toBe(true)
    })

    it('should handle send event from ChatInput', async () => {
      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      expect(chatStore.rootMessages.length).toBe(1)
      expect(chatStore.rootMessages[0].question).toBe('Test message')
    })

    it('should update URL after sending message', async () => {
      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      expect(mockReplace).toHaveBeenCalledWith({
        name: 'question',
        params: { id: chat.id, questionId: expect.any(String) }
      })
    })

    it('should not send empty messages', async () => {
      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      await chatInput.vm.$emit('send', '   ')
      await flushPromises()

      expect(chatStore.rootMessages.length).toBe(0)
    })

    it('should pass disabled prop to ChatInput when streaming', async () => {
      chatStore.isStreaming = true

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      expect(chatInput.props('disabled')).toBe(true)
    })

    it('should pass isLoading prop to ChatInput when streaming', async () => {
      chatStore.isStreaming = true

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      expect(chatInput.props('isLoading')).toBe(true)
    })
  })

  describe('Displaying Messages', () => {
    it('should display ChatMessage when a root message exists', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      const chatMessage = wrapper.findComponent(ChatMessage)
      expect(chatMessage.exists()).toBe(true)
    })

    it('should hide welcome message when displaying a question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('.welcome-message').exists()).toBe(false)
    })

    it('should hide ChatInput when displaying a question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.exists()).toBe(false)
    })
  })

  describe('Adding New Question', () => {
    it('should show welcome message for new question when triggered', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('new-question')
      await flushPromises()

      expect(wrapper.find('.welcome-message').exists()).toBe(true)
      expect(wrapper.find('.welcome-message h2').text()).toContain('Ask a new question')
    })

    it('should show ChatInput when adding new question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('new-question')
      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.exists()).toBe(true)
    })

    it('should set autofocus on ChatInput when adding new question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('new-question')
      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.props('autofocus')).toBe(true)
    })
  })

  describe('Question Management', () => {
    it('should handle delete-question event from sidebar', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      const deleteQuestionSpy = vi.spyOn(chatStore, 'deleteQuestion')

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('delete-question', 'msg1', chat.id)

      expect(deleteQuestionSpy).toHaveBeenCalledWith('msg1', chat.id)
    })

    it('should handle rename-question event from sidebar', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = createMessage({
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      })
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      const setQuestionSummarizedSpy = vi.spyOn(chatStore, 'setQuestionSummarized')

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('rename-question', 'msg1', 'New title')

      expect(setQuestionSummarizedSpy).toHaveBeenCalledWith('msg1', 'New title')
    })
  })

  describe('Streaming', () => {
    it('should show stop streaming button when streaming', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Partial response...',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0
      chatStore.isStreaming = true

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('.stop-streaming-button').exists()).toBe(true)
    })

    it('should call stopStreaming when stop button is clicked', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Partial response...',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0
      chatStore.isStreaming = true

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      const stopStreamingSpy = vi.spyOn(chatStore, 'stopStreaming')

      wrapper = mountComponent()
      await flushPromises()

      const stopButton = wrapper.find('.stop-streaming-button')
      await stopButton.trigger('click')

      expect(stopStreamingSpy).toHaveBeenCalled()
    })

    it('should hide stop button when not streaming', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Complete response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0
      chatStore.isStreaming = false

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('.stop-streaming-button').exists()).toBe(false)
    })
  })

  describe('Notebook Overview', () => {
    it('should show NotebookOverview when notebook has questions but no question selected', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = null

      wrapper = mountComponent()
      await flushPromises()

      const overview = wrapper.findComponent(NotebookOverview)
      expect(overview.exists()).toBe(true)
    })

    it('should hide NotebookOverview when question is selected', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentRootIndex = 0

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'msg1'

      wrapper = mountComponent()
      await flushPromises()

      const overview = wrapper.findComponent(NotebookOverview)
      expect(overview.exists()).toBe(false)
    })

    it('should navigate to question when overview emits select-question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = null

      wrapper = mountComponent()
      await flushPromises()

      const overview = wrapper.findComponent(NotebookOverview)
      await overview.vm.$emit('select-question', { id: 'msg1' })

      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: chat.id, questionId: 'msg1' }
      })
    })
  })

  describe('Scratchpad', () => {
    it('should show Scratchpad when questions exist', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      await flushPromises()

      const scratchpad = wrapper.findComponent(Scratchpad)
      expect(scratchpad.exists()).toBe(true)
    })

    it('should hide Scratchpad when no questions exist', () => {
      wrapper = mountComponent()

      const scratchpad = wrapper.findComponent(Scratchpad)
      expect(scratchpad.exists()).toBe(false)
    })

    it('should pass current scratchpad content to Scratchpad', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatObj.scratchpad = 'My notes'
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      await flushPromises()

      const scratchpad = wrapper.findComponent(Scratchpad)
      expect(scratchpad.props('content')).toBe('My notes')
    })

    it('should update scratchpad when content is updated', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      const updateScratchpadSpy = vi.spyOn(chatStore, 'updateScratchpad')

      wrapper = mountComponent()
      await flushPromises()

      const scratchpad = wrapper.findComponent(Scratchpad)
      await scratchpad.vm.$emit('update:content', 'New notes')

      expect(updateScratchpadSpy).toHaveBeenCalledWith('New notes')
    })

    it('should pass isStreaming to Scratchpad', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.isStreaming = true

      wrapper = mountComponent()
      await flushPromises()

      const scratchpad = wrapper.findComponent(Scratchpad)
      expect(scratchpad.props('isStreaming')).toBe(true)
    })

    it('should stop streaming when Scratchpad emits stop-streaming', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.isStreaming = true

      const stopStreamingSpy = vi.spyOn(chatStore, 'stopStreaming')

      wrapper = mountComponent()
      await flushPromises()

      const scratchpad = wrapper.findComponent(Scratchpad)
      await scratchpad.vm.$emit('stop-streaming')

      expect(stopStreamingSpy).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when error exists', async () => {
      wrapper = mountComponent()

      // Manually set error through component
      wrapper.vm.error = 'Test error message'
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toBe('Test error message')
    })

    it('should hide error message when no error', () => {
      wrapper = mountComponent()

      expect(wrapper.find('.error-message').exists()).toBe(false)
    })
  })

  describe('Example Prompts', () => {
    it('should send message when example prompt is clicked', async () => {
      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')

      wrapper = mountComponent()

      const examplePrompt = wrapper.find('.example-prompts li.clickable')
      await examplePrompt.trigger('click')
      await flushPromises()

      expect(chatStore.rootMessages.length).toBe(1)
    })
  })

  describe('Sidebar Props', () => {
    it('should pass chats to sidebar', () => {
      chatStore.createNewChat()
      chatStore.createNewChat()

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      expect(sidebar.props('chats').length).toBe(2)
    })

    it('should pass currentChatId to sidebar', () => {
      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      expect(sidebar.props('currentChatId')).toBe(chat.id)
    })

    it('should pass currentMessageId to sidebar', () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentMessageId = 'msg1'

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      expect(sidebar.props('currentMessageId')).toBe('msg1')
    })

    it('should pass null for currentMessageId when adding new question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        response: 'Test response',
        childIds: []
      }
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.currentMessageId = 'msg1'

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('new-question')
      await flushPromises()

      expect(sidebar.props('currentMessageId')).toBe(null)
    })
  })

  describe('Model Loading', () => {
    it('should set model on mount when models are available', async () => {
      wrapper = mountComponent()
      await flushPromises()

      expect(chatStore.currentModel).toBe('test-model')
    })
  })

  describe('Provide/Inject', () => {
    it('should provide draggedItem ref', () => {
      wrapper = mountComponent()

      // Check that the component provides these refs by checking it doesn't throw
      expect(wrapper.vm).toBeDefined()
    })

    it('should provide scroll functions', () => {
      wrapper = mountComponent()

      // The component should mount without errors when providing these functions
      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })
  })

  describe('API Error Handling', () => {
    it('should display error and remove message when API call fails', async () => {
      const { sendChatMessageForFeature } = await import('../services/api.js')
      sendChatMessageForFeature.mockRejectedValueOnce(new Error('API Error'))

      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      expect(wrapper.vm.error).toBe('API Error')
      expect(chatStore.rootMessages.length).toBe(0)
    })

    it('should display error when no models are available', async () => {
      const { fetchModels } = await import('../services/api.js')
      fetchModels.mockResolvedValueOnce([])

      wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.vm.error).toBe('No models available. Please load a model in LM Studio.')
    })

    it('should display error when fetchModels fails', async () => {
      const { fetchModels } = await import('../services/api.js')
      fetchModels.mockRejectedValueOnce(new Error('Network error'))

      wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.vm.error).toBe('Network error')
    })
  })

  describe('Scroll Position Management', () => {
    it('should save scroll position when selecting a different question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = createMessage({
        id: 'msg1',
        question: 'First question',
        response: 'First response'
      })
      chatStore.messagesById['msg2'] = createMessage({
        id: 'msg2',
        question: 'Second question',
        response: 'Second response'
      })
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1', 'msg2']
      chatStore.rootMessageIds = ['msg1', 'msg2']
      chatStore.currentChatId = chat.id
      chatStore.currentMessageId = 'msg1'

      const saveScrollPositionSpy = vi.spyOn(chatStore, 'saveScrollPosition')

      wrapper = mountComponent()
      const sidebar = wrapper.findComponent(ChatSidebar)

      await sidebar.vm.$emit('select-question', { id: 'msg2', chatId: chat.id })

      expect(saveScrollPositionSpy).toHaveBeenCalledWith('msg1', expect.any(Number))
    })
  })

  describe('Navigation to Child Messages', () => {
    it('should navigate to child message within the same root', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['root1'] = createMessage({
        id: 'root1',
        question: 'Root question',
        response: 'Root response',
        childIds: ['child1']
      })
      chatStore.messagesById['child1'] = createMessage({
        id: 'child1',
        question: 'Child question',
        response: 'Child response',
        parentId: 'root1'
      })
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['root1']
      chatStore.rootMessageIds = ['root1']
      chatStore.currentChatId = chat.id

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = 'child1'

      wrapper = mountComponent()
      await flushPromises()

      // Should have navigated and set the root index correctly
      expect(chatStore.currentRootIndex).toBe(0)
    })
  })

  describe('Route Watch', () => {
    it('should show overview when navigating to notebook without question', async () => {
      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = createMessage({
        id: 'msg1',
        question: 'Test question',
        response: 'Test response'
      })
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id

      mockRouteParams.id = chat.id
      mockRouteParams.questionId = null

      wrapper = mountComponent()
      await flushPromises()

      const overview = wrapper.findComponent(NotebookOverview)
      expect(overview.exists()).toBe(true)
    })
  })

  describe('Sending Follow-up Messages', () => {
    it('should send message with DEEPDIVE prefix when notebook already has questions', async () => {
      const { getMainPrompts } = await import('../services/extraPrompt.js')

      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = createMessage({
        id: 'msg1',
        question: 'First question',
        response: 'First response'
      })
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')

      wrapper = mountComponent()
      await flushPromises()

      // Trigger new question mode
      const sidebar = wrapper.findComponent(ChatSidebar)
      await sidebar.vm.$emit('new-question')
      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Follow-up question')
      await flushPromises()

      // Check that getMainPrompts was called with DEEPDIVE prefix
      expect(getMainPrompts).toHaveBeenCalledWith(
        expect.stringContaining('[DEEPDIVE]'),
        expect.any(Array),
        expect.any(Array)
      )
    })

    it('should include previous questions as context', async () => {
      const { getMainPrompts } = await import('../services/extraPrompt.js')

      const chat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = createMessage({
        id: 'msg1',
        question: 'First question',
        response: 'First response'
      })
      const chatObj = chatStore.chats.find(c => c.id === chat.id)
      chatObj.rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1']
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')

      wrapper = mountComponent()
      await flushPromises()

      // Trigger new question mode
      const sidebar = wrapper.findComponent(ChatSidebar)
      await sidebar.vm.$emit('new-question')
      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Second question')
      await flushPromises()

      // Check that getMainPrompts received previous messages
      expect(getMainPrompts).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ question: 'First question' })
        ]),
        expect.any(Array)
      )
    })
  })

  describe('Streaming State', () => {
    it('should not send message while streaming', async () => {
      const chat = chatStore.createNewChat()
      chatStore.currentChatId = chat.id
      chatStore.setCurrentModel('test-model')
      chatStore.isStreaming = true

      wrapper = mountComponent()
      const chatInput = wrapper.findComponent(ChatInput)

      const initialMessageCount = chatStore.rootMessages.length
      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      expect(chatStore.rootMessages.length).toBe(initialMessageCount)
    })
  })
})
