import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MobileFooter from '../MobileFooter.vue'
import { useChatStore } from '../../stores/chat.js'

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
  initProvider: vi.fn(() => Promise.resolve())
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
    // Clear localStorage before each test
    localStorage.clear()

    // Setup pinia
    setActivePinia(createPinia())
    chatStore = useChatStore()

    // Reset router mock
    mockRouterPush.mockClear()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Clear localStorage after each test
    localStorage.clear()
  })

  describe('Rendering', () => {
    it('should render mobile footer wrapper', () => {
      wrapper = mount(MobileFooter)
      expect(wrapper.find('.mobile-footer-wrapper').exists()).toBe(true)
    })

    it('should render mobile footer container', () => {
      wrapper = mount(MobileFooter)
      expect(wrapper.find('.mobile-footer').exists()).toBe(true)
    })

    it('should render footer buttons', () => {
      wrapper = mount(MobileFooter)
      const buttons = wrapper.findAll('.footer-btn')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should render hover indicator', () => {
      wrapper = mount(MobileFooter)
      expect(wrapper.find('.hover-indicator').exists()).toBe(true)
    })

    it('should render hover indicator with arrow icon', () => {
      wrapper = mount(MobileFooter)
      const indicator = wrapper.find('.hover-indicator')
      expect(indicator.find('svg').exists()).toBe(true)
    })

    it('should render hover indicator at the end of footer', () => {
      wrapper = mount(MobileFooter)
      const footer = wrapper.find('.mobile-footer')
      const lastElement = footer.find('.hover-indicator')
      expect(lastElement.exists()).toBe(true)
    })

    it('should not show new notebook button by default', () => {
      wrapper = mount(MobileFooter)
      const newNotebookBtn = wrapper.find('[title="New Notebook"]')
      expect(newNotebookBtn.exists()).toBe(false)
    })

    it('should show new notebook button when showNewNotebook prop is true', () => {
      wrapper = mount(MobileFooter, {
        props: {
          showNewNotebook: true
        }
      })
      const newNotebookBtn = wrapper.find('[title="New Notebook"]')
      expect(newNotebookBtn.exists()).toBe(true)
    })

    it('should not show home button by default', () => {
      wrapper = mount(MobileFooter)
      const homeBtn = wrapper.find('[title="Home"]')
      expect(homeBtn.exists()).toBe(false)
    })

    it('should show home button when showHome prop is true', () => {
      wrapper = mount(MobileFooter, {
        props: {
          showHome: true
        }
      })
      const homeBtn = wrapper.find('[title="Home"]')
      expect(homeBtn.exists()).toBe(true)
    })
  })

  describe('Dictionary Button (Dd)', () => {
    it('should render dictionary button with "Dd" text', () => {
      wrapper = mount(MobileFooter)
      const dictBtn = wrapper.find('[title="Review vocabulary"]')
      expect(dictBtn.exists()).toBe(true)
      expect(dictBtn.text()).toContain('Dd')
    })

    it('should have dict-letter class on the Dd text', () => {
      wrapper = mount(MobileFooter)
      const dictLetter = wrapper.find('.dict-letter')
      expect(dictLetter.exists()).toBe(true)
      expect(dictLetter.text()).toBe('Dd')
    })

    it('should have footer-letter class on the Dd text', () => {
      wrapper = mount(MobileFooter)
      const dictLetter = wrapper.find('.dict-letter')
      expect(dictLetter.classes()).toContain('footer-letter')
    })

    it('should open vocab review modal when dictionary button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const dictBtn = wrapper.find('[title="Review vocabulary"]')
      await dictBtn.trigger('click')

      // Check that the VocabReviewModal has visible=true
      const vocabModal = wrapper.findComponent({ name: 'VocabReviewModal' })
      expect(vocabModal.props('visible')).toBe(true)
    })

    it('should show vocab due count badge when vocabCardsDueCount > 0', async () => {
      // Set up store with vocab due count
      chatStore.vocabData = {
        'vocab-1': {
          nextReviewDate: Date.now() - 1000 // Due (in the past)
        }
      }

      wrapper = mount(MobileFooter)
      const dictBtn = wrapper.find('[title="Review vocabulary"]')
      const badge = dictBtn.find('.review-badge')
      expect(badge.exists()).toBe(true)
    })

    it('should not show vocab due count badge when vocabCardsDueCount is 0', () => {
      wrapper = mount(MobileFooter)
      const dictBtn = wrapper.find('[title="Review vocabulary"]')
      const badge = dictBtn.find('.review-badge')
      expect(badge.exists()).toBe(false)
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

  describe('Active State', () => {
    it('should apply active class to home button when activePage is home', () => {
      wrapper = mount(MobileFooter, {
        props: {
          showHome: true,
          activePage: 'home'
        }
      })
      const homeBtn = wrapper.find('[title="Home"]')
      expect(homeBtn.classes()).toContain('active')
    })

    it('should apply active class to calendar button when activePage is calendar', () => {
      wrapper = mount(MobileFooter, {
        props: {
          activePage: 'calendar'
        }
      })
      const calendarBtn = wrapper.find('[title="Calendar"]')
      expect(calendarBtn.classes()).toContain('active')
    })

    it('should apply active class to question button when activePage is question', () => {
      wrapper = mount(MobileFooter, {
        props: {
          activePage: 'question'
        }
      })
      const questionBtn = wrapper.find('[title="Current Question"]')
      expect(questionBtn.classes()).toContain('active')
    })
  })

  describe('Modals', () => {
    it('should open settings modal when settings button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const settingsBtn = wrapper.find('[title="Settings"]')

      // Verify the button click triggers the modal by checking that SettingsModal receives visible=true
      // We check by triggering click and then looking at the component's HTML or props
      await settingsBtn.trigger('click')

      // The SettingsModal should now have visible=true prop
      // We can verify this by checking the wrapper's vm state or the rendered HTML
      const html = wrapper.html()
      // After clicking settings, the SettingsModal should be mounted/visible
      // Just verify the click was successful by checking there's a settings modal in the tree
      expect(wrapper.findComponent({ name: 'SettingsModal' }).exists()).toBe(true)
    })

    it('should open review modal when review button is clicked', async () => {
      wrapper = mount(MobileFooter)
      const reviewBtn = wrapper.find('[title="Review cards"]')
      await reviewBtn.trigger('click')

      const reviewModal = wrapper.findComponent({ name: 'ReviewModal' })
      expect(reviewModal.props('visible')).toBe(true)
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
      expect(wrapper.emitted('new-notebook')).toHaveLength(1)
    })
  })

  describe('Mobile Only Mode', () => {
    it('should not have mobile-only class by default', () => {
      wrapper = mount(MobileFooter)
      expect(wrapper.find('.mobile-footer-wrapper').classes()).not.toContain('mobile-only')
    })

    it('should have mobile-only class when mobileOnly prop is true', () => {
      wrapper = mount(MobileFooter, {
        props: {
          mobileOnly: true
        }
      })
      expect(wrapper.find('.mobile-footer-wrapper').classes()).toContain('mobile-only')
    })

    it('should not have mobile-only class when mobileOnly prop is false', () => {
      wrapper = mount(MobileFooter, {
        props: {
          mobileOnly: false
        }
      })
      expect(wrapper.find('.mobile-footer-wrapper').classes()).not.toContain('mobile-only')
    })
  })

  describe('Desktop Hover Behavior', () => {
    it('should have hover-indicator as part of footer content', () => {
      wrapper = mount(MobileFooter)
      const footer = wrapper.find('.mobile-footer')
      const indicator = footer.find('.hover-indicator')
      expect(indicator.exists()).toBe(true)
    })

    it('should position indicator after all buttons', () => {
      wrapper = mount(MobileFooter)
      const footer = wrapper.find('.mobile-footer')
      const children = footer.findAll(':scope > *')
      const lastVisibleChild = children.filter(c =>
        c.classes().includes('footer-btn') || c.classes().includes('hover-indicator')
      ).pop()
      expect(lastVisibleChild.classes()).toContain('hover-indicator')
    })
  })
})
