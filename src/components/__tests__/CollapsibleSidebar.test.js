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
    it('should render collapsed by default', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)
      expect(wrapper.find('.sidebar-content').exists()).toBe(false)
    })

    it('should render slot content when expanded', () => {
      wrapper = mountComponent({ defaultVisible: true }, {
        default: '<div class="test-content">Chat Content</div>'
      })
      expect(wrapper.find('.test-content').exists()).toBe(true)
    })

    it('should render collapsed navigation when not visible', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)
      expect(wrapper.find('.sidebar-content').exists()).toBe(false)
    })
  })

  describe('Toggle Functionality', () => {
    it('should expand when toggle is called', async () => {
      wrapper = mountComponent()
      expect(wrapper.find('.collapsed-nav').exists()).toBe(true)

      wrapper.vm.toggle()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
      expect(wrapper.find('.collapsed-nav').exists()).toBe(false)
    })

    it('should expand when expand button is clicked', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      await wrapper.find('.expand-btn').trigger('click')

      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
      expect(wrapper.find('.collapsed-nav').exists()).toBe(false)
    })

    it('should save state to localStorage when toggled', async () => {
      wrapper = mountComponent({ storageKey: 'my-sidebar' })

      wrapper.vm.toggle()
      await wrapper.vm.$nextTick()

      expect(localStorageMock.setItem).toHaveBeenCalledWith('my-sidebar', 'true')
    })

    it('should load state from localStorage on mount', async () => {
      localStorageMock.store['saved-sidebar'] = 'true'

      wrapper = mountComponent({ storageKey: 'saved-sidebar' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
    })
  })

  describe('Navigation Buttons', () => {
    it('should render all navigation buttons when collapsed', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const navButtons = wrapper.findAll('.nav-btn')
      expect(navButtons.length).toBe(6)
    })

    it('should disable notebook button when no current chat', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const notebookBtn = wrapper.findAll('.nav-btn')[2]
      expect(notebookBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Settings Modal', () => {
    it('should open settings modal when settings button clicked', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const settingsBtn = wrapper.findAll('.nav-btn')[5]
      await settingsBtn.trigger('click')

      expect(wrapper.findComponent({ name: 'SettingsModal' }).exists()).toBe(true)
    })
  })
})
