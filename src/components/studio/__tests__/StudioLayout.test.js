import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import StudioLayout from '../StudioLayout.vue'

// Mock SettingsModal
vi.mock('../../Modal/SettingsModal.vue', () => ({
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
    { path: '/studio', name: 'studio', component: { template: '<div>Studio</div>' } }
  ]
})

describe('StudioLayout', () => {
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
    return mount(StudioLayout, {
      props,
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
    it('should render the layout container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.studio-layout').exists()).toBe(true)
    })

    it('should render sidebar content when visible', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.sidebar-content').exists()).toBe(true)
    })

    it('should render canvas panel', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.canvas-panel').exists()).toBe(true)
    })

    it('should render divider when sidebar is visible', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.divider').exists()).toBe(true)
    })
  })

  describe('Slots', () => {
    it('should render chat slot content', () => {
      wrapper = mountComponent({}, {
        chat: '<div class="test-chat-content">Chat Content</div>'
      })
      expect(wrapper.find('.test-chat-content').exists()).toBe(true)
      expect(wrapper.find('.test-chat-content').text()).toBe('Chat Content')
    })

    it('should render canvas slot content', () => {
      wrapper = mountComponent({}, {
        canvas: '<div class="test-canvas-content">Canvas Content</div>'
      })
      expect(wrapper.find('.test-canvas-content').exists()).toBe(true)
      expect(wrapper.find('.test-canvas-content').text()).toBe('Canvas Content')
    })

    it('should render both slots simultaneously', () => {
      wrapper = mountComponent({}, {
        chat: '<div class="chat-slot">Chat</div>',
        canvas: '<div class="canvas-slot">Canvas</div>'
      })
      expect(wrapper.find('.chat-slot').exists()).toBe(true)
      expect(wrapper.find('.canvas-slot').exists()).toBe(true)
    })
  })

  describe('Initial Layout', () => {
    it('should have default sidebar width', () => {
      wrapper = mountComponent()
      const sidebarContent = wrapper.find('.sidebar-content')
      expect(sidebarContent.attributes('style')).toContain('width: 500px')
    })
  })

  describe('Divider Interaction', () => {
    it('should add is-dragging class when divider is dragged', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })
      expect(divider.classes()).toContain('is-dragging')
    })

    it('should remove is-dragging class on mouseup', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })
      expect(divider.classes()).toContain('is-dragging')

      // Simulate mouseup
      document.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      expect(divider.classes()).not.toContain('is-dragging')
    })

    it('should update sidebar width on drag', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })

      // Simulate drag
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }))
      await wrapper.vm.$nextTick()

      const sidebarContent = wrapper.find('.sidebar-content')
      expect(sidebarContent.attributes('style')).toContain('width: 600px')
    })

    it('should enforce minimum sidebar width', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })

      // Simulate drag to very small width
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }))
      await wrapper.vm.$nextTick()

      const sidebarContent = wrapper.find('.sidebar-content')
      // Min width is 400px
      expect(sidebarContent.attributes('style')).toContain('width: 400px')
    })

    it('should enforce maximum sidebar width', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })

      // Simulate drag to very large width
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }))
      await wrapper.vm.$nextTick()

      const sidebarContent = wrapper.find('.sidebar-content')
      // Max width is 800px
      expect(sidebarContent.attributes('style')).toContain('width: 800px')
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const divider = wrapper.find('.divider')
      await divider.trigger('mousedown', { clientX: 500 })

      wrapper.unmount()
      wrapper = null

      // Listeners should be cleaned up
      expect(removeEventListenerSpy).toHaveBeenCalled()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Divider Handle', () => {
    it('should render divider handle', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.divider-handle').exists()).toBe(true)
    })
  })
})
