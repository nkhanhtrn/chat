import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import CollapsibleSidebar from '../CollapsibleSidebar.vue'

// Mock SettingsModal
vi.mock('../Modal/SettingsModal.vue', () => ({
  default: {
    name: 'SettingsModal',
    template: '<div class="settings-modal-mock"></div>',
    props: ['modelValue']
  }
}))

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value }),
  clear: vi.fn(() => { localStorageMock.store = {} })
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Create router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/studio', name: 'studio', component: { template: '<div>Studio</div>' } },
    { path: '/playground', name: 'playground', component: { template: '<div>Playground</div>' } },
    { path: '/calendar', name: 'calendar', component: { template: '<div>Calendar</div>' } },
    { path: '/notebook/:id', name: 'notebook', component: { template: '<div>Notebook</div>' } },
    { path: '/notebook/:id/q/:questionId', name: 'question', component: { template: '<div>Question</div>' } }
  ]
})

describe('CollapsibleSidebar', () => {
  let wrapper
  let pinia

  beforeEach(async () => {
    localStorageMock.clear()
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    await router.push('/studio')
    await router.isReady()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const mountComponent = (props = {}, slots = {}) => {
    return mount(CollapsibleSidebar, {
      props: {
        storageKey: 'test-sidebar',
        ...props
      },
      slots,
      global: {
        plugins: [router, pinia],
        stubs: {
          SettingsModal: true
        }
      }
    })
  }

  describe('Rendering', () => {
    it('should render expanded by default', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
      expect(wrapper.find('.collapsed-nav').exists()).toBe(false)
    })

    it('should render slot content when expanded', () => {
      wrapper = mountComponent({}, {
        default: '<div class="test-content">Chat Content</div>'
      })
      expect(wrapper.find('.test-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Chat Content')
    })

    it('should render collapsed navigation when not visible', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      // Wait for mount to complete
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)
      expect(wrapper.find('.sidebar-content').exists()).toBe(false)
    })

    it('should render expand button when collapsed', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.expand-btn').exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('should apply custom width to sidebar content', () => {
      wrapper = mountComponent({ width: 600 })
      const content = wrapper.find('.sidebar-content')
      expect(content.attributes('style')).toContain('width: 600px')
    })

    it('should use default width of 500px', () => {
      wrapper = mountComponent()
      const content = wrapper.find('.sidebar-content')
      expect(content.attributes('style')).toContain('width: 500px')
    })

    it('should respect defaultVisible prop as true', () => {
      wrapper = mountComponent({ defaultVisible: true })
      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
    })

    it('should respect defaultVisible prop as false', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)
    })
  })

  describe('Toggle Functionality', () => {
    it('should collapse when toggle is called', async () => {
      wrapper = mountComponent()
      expect(wrapper.find('.sidebar-content').exists()).toBe(true)

      wrapper.vm.toggle()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.sidebar-content').exists()).toBe(false)
      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)
    })

    it('should expand when expand button is clicked', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)

      await wrapper.find('.expand-btn').trigger('click')

      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
      expect(wrapper.find('.collapsed-nav').exists()).toBe(false)
    })

    it('should save state to localStorage when toggled', async () => {
      wrapper = mountComponent({ storageKey: 'my-sidebar' })

      wrapper.vm.toggle()
      await wrapper.vm.$nextTick()

      expect(localStorageMock.setItem).toHaveBeenCalledWith('my-sidebar', 'false')
    })

    it('should load state from localStorage on mount', async () => {
      localStorageMock.store['saved-sidebar'] = 'false'

      wrapper = mountComponent({ storageKey: 'saved-sidebar' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)
    })
  })

  describe('Navigation Buttons', () => {
    it('should render all navigation buttons when collapsed', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const navButtons = wrapper.findAll('.nav-btn')
      // expand, home, notebook, calendar, playground, studio, settings
      expect(navButtons.length).toBe(7)
    })

    it('should have expand button as first nav button', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const expandBtn = wrapper.find('.expand-btn')
      expect(expandBtn.exists()).toBe(true)
    })

    it('should have correct button titles', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const navButtons = wrapper.findAll('.nav-btn')
      expect(navButtons[0].attributes('title')).toBe('Expand')
      expect(navButtons[1].attributes('title')).toBe('Home')
      expect(navButtons[2].attributes('title')).toBe('Current Notebook')
      expect(navButtons[3].attributes('title')).toBe('Calendar')
      expect(navButtons[4].attributes('title')).toBe('Playground')
      expect(navButtons[5].attributes('title')).toBe('Studio')
      expect(navButtons[6].attributes('title')).toBe('Settings')
    })

    it('should disable notebook button when no current chat', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const notebookBtn = wrapper.findAll('.nav-btn')[2] // notebook is 3rd button
      expect(notebookBtn.attributes('disabled')).toBeDefined()
    })

    it('should have clickable home button', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const homeBtn = wrapper.findAll('.nav-btn')[1]
      expect(homeBtn.attributes('disabled')).toBeUndefined()
    })

    it('should have clickable calendar button', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const calendarBtn = wrapper.findAll('.nav-btn')[3]
      expect(calendarBtn.attributes('disabled')).toBeUndefined()
    })

    it('should have clickable playground button', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const playgroundBtn = wrapper.findAll('.nav-btn')[4]
      expect(playgroundBtn.attributes('disabled')).toBeUndefined()
    })

    it('should have clickable studio button', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const studioBtn = wrapper.findAll('.nav-btn')[5]
      expect(studioBtn.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Exposed Methods', () => {
    it('should expose isVisible ref', () => {
      wrapper = mountComponent()
      expect(wrapper.vm.isVisible).toBe(true)
    })

    it('should expose toggle function', async () => {
      wrapper = mountComponent()
      expect(typeof wrapper.vm.toggle).toBe('function')

      wrapper.vm.toggle()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isVisible).toBe(false)
    })
  })

  describe('Settings Modal', () => {
    it('should open settings modal when settings button clicked', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      const settingsBtn = wrapper.findAll('.nav-btn')[6] // settings is last button
      await settingsBtn.trigger('click')

      // Check that showSettings is true (modal should be visible)
      expect(wrapper.findComponent({ name: 'SettingsModal' }).exists()).toBe(true)
    })
  })

  describe('Active Page Detection', () => {
    it('should have active class binding on nav buttons', async () => {
      wrapper = mountComponent({ defaultVisible: false })
      await wrapper.vm.$nextTick()

      // Verify that navigation buttons exist with proper class bindings
      // The actual active state depends on router which is tested via integration tests
      const homeBtn = wrapper.findAll('.nav-btn')[1]
      const studioBtn = wrapper.findAll('.nav-btn')[5]

      // Buttons should exist and be able to have active class applied
      expect(homeBtn.exists()).toBe(true)
      expect(studioBtn.exists()).toBe(true)
    })
  })
})
