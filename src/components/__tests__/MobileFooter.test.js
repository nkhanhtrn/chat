import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MobileFooter from '../MobileFooter.vue'
import { useChatStore } from '../../stores/chat.js'
import { Category } from '../../services/llm/LMService.js'

// Mock vue-router at the module level
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Mock the LLM API module to prevent real network calls from SettingsModal
vi.mock('../../services/api.js', () => ({
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getCurrentConfig: vi.fn(() => ({})),
  setProvider: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true)),
  fetchModels: vi.fn(() => Promise.resolve([
    { id: 'model-1', name: 'Test Model 1' }
  ])),
  initProvider: vi.fn(() => Promise.resolve()),
  sendChatMessage: vi.fn(),
  sendChatMessageForFeature: vi.fn(),
  Category
}))

// Mock firestore to prevent real network calls
vi.mock('../../services/firestore.js', () => ({
  loadUserSettings: vi.fn(() => Promise.resolve(null)),
  saveUserSettings: vi.fn(() => Promise.resolve()),
  syncChatStateToFirestore: vi.fn(() => Promise.resolve()),
  loadChatStateFromFirestore: vi.fn(() => Promise.resolve(null)),
  subscribeToChatState: vi.fn(() => () => {}),
  deleteChatStateFromFirestore: vi.fn(() => Promise.resolve()),
  subscribeToUserSettings: vi.fn(() => () => {})
}))

describe('MobileFooter', () => {
  let wrapper
  let chatStore

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    setActivePinia(createPinia())
    chatStore = useChatStore()
    mockRouterPush.mockClear()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
  })

  describe('Dictionary Button', () => {
    it('should open vocab review modal when dictionary button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const dictBtn = wrapper.find('[title="Review vocabulary"]')
      await dictBtn.trigger('click')

      const vocabModal = wrapper.findComponent({ name: 'VocabReviewModal' })
      expect(vocabModal.props('visible')).toBe(true)
    })

    it('should show vocab due count badge when vocabCardsDueCount > 0', async () => {
      chatStore.vocabData = {
        'vocab-1': {
          nextReviewDate: Date.now() - 1000
        }
      }

      wrapper = mount(MobileFooter)
      const dictBtn = wrapper.find('[title="Review vocabulary"]')
      const badge = dictBtn.find('.review-badge')
      expect(badge.exists()).toBe(true)
    })
  })

  describe('Navigation', () => {
    it('should navigate to home when home button is clicked', async () => {
      wrapper = mount(MobileFooter, {
        props: {
          showHome: true
        }
      })
      const homeBtn = wrapper.find('[title="Home"]')
      await homeBtn.trigger('click')

      expect(mockRouterPush).toHaveBeenCalledWith({ name: 'home' })
    })

    it('should navigate to calendar when calendar button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const calendarBtn = wrapper.find('[title="Calendar"]')
      await calendarBtn.trigger('click')

      expect(mockRouterPush).toHaveBeenCalledWith({ name: 'calendar' })
    })

    it('should navigate to studio when studio button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const studioBtn = wrapper.find('[title="AI Studio"]')
      await studioBtn.trigger('click')

      expect(mockRouterPush).toHaveBeenCalledWith({ name: 'studio' })
    })

    it('should disable current question button when no current question', () => {
      wrapper = mount(MobileFooter)
      const questionBtn = wrapper.find('[title="Current Question"]')
      expect(questionBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable current question button when there is a current chat', () => {
      chatStore.currentChatId = 'chat-1'
      wrapper = mount(MobileFooter)
      const questionBtn = wrapper.find('[title="Current Question"]')
      expect(questionBtn.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Modals', () => {
    it('should open settings modal when settings button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const settingsBtn = wrapper.find('[title="Settings"]')
      await settingsBtn.trigger('click')

      expect(wrapper.findComponent({ name: 'SettingsModal' }).exists()).toBe(true)
    })
  })

  describe('Events', () => {
    it('should emit new-notebook event when new notebook button is clicked', async () => {
      wrapper = mount(MobileFooter, {
        props: {
          showNewNotebook: true
        }
      })
      const newNotebookBtn = wrapper.find('[title="New Notebook"]')
      await newNotebookBtn.trigger('click')

      expect(wrapper.emitted('new-notebook')).toBeTruthy()
    })
  })
})
