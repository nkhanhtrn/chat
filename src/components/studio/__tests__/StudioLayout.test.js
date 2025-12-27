import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StudioLayout from '../StudioLayout.vue'

describe('StudioLayout', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the layout container', () => {
      wrapper = mount(StudioLayout)
      expect(wrapper.find('.studio-layout').exists()).toBe(true)
    })

    it('should render chat panel', () => {
      wrapper = mount(StudioLayout)
      expect(wrapper.find('.chat-panel').exists()).toBe(true)
    })

    it('should render canvas panel', () => {
      wrapper = mount(StudioLayout)
      expect(wrapper.find('.canvas-panel').exists()).toBe(true)
    })

    it('should render divider', () => {
      wrapper = mount(StudioLayout)
      expect(wrapper.find('.divider').exists()).toBe(true)
    })
  })

  describe('Slots', () => {
    it('should render chat slot content', () => {
      wrapper = mount(StudioLayout, {
        slots: {
          chat: '<div class="test-chat-content">Chat Content</div>'
        }
      })
      expect(wrapper.find('.test-chat-content').exists()).toBe(true)
      expect(wrapper.find('.test-chat-content').text()).toBe('Chat Content')
    })

    it('should render canvas slot content', () => {
      wrapper = mount(StudioLayout, {
        slots: {
          canvas: '<div class="test-canvas-content">Canvas Content</div>'
        }
      })
      expect(wrapper.find('.test-canvas-content').exists()).toBe(true)
      expect(wrapper.find('.test-canvas-content').text()).toBe('Canvas Content')
    })

    it('should render both slots simultaneously', () => {
      wrapper = mount(StudioLayout, {
        slots: {
          chat: '<div class="chat-slot">Chat</div>',
          canvas: '<div class="canvas-slot">Canvas</div>'
        }
      })
      expect(wrapper.find('.chat-slot').exists()).toBe(true)
      expect(wrapper.find('.canvas-slot').exists()).toBe(true)
    })
  })

  describe('Initial Layout', () => {
    it('should have default chat panel width', () => {
      wrapper = mount(StudioLayout)
      const chatPanel = wrapper.find('.chat-panel')
      expect(chatPanel.attributes('style')).toContain('width: 500px')
    })
  })

  describe('Divider Interaction', () => {
    it('should add is-dragging class when divider is dragged', async () => {
      wrapper = mount(StudioLayout)
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })
      expect(divider.classes()).toContain('is-dragging')
    })

    it('should remove is-dragging class on mouseup', async () => {
      wrapper = mount(StudioLayout)
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })
      expect(divider.classes()).toContain('is-dragging')

      // Simulate mouseup
      document.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      expect(divider.classes()).not.toContain('is-dragging')
    })

    it('should update chat panel width on drag', async () => {
      wrapper = mount(StudioLayout)
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })

      // Simulate drag
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }))
      await wrapper.vm.$nextTick()

      const chatPanel = wrapper.find('.chat-panel')
      expect(chatPanel.attributes('style')).toContain('width: 600px')
    })

    it('should enforce minimum chat panel width', async () => {
      wrapper = mount(StudioLayout)
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })

      // Simulate drag to very small width
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }))
      await wrapper.vm.$nextTick()

      const chatPanel = wrapper.find('.chat-panel')
      // Min width is 400px
      expect(chatPanel.attributes('style')).toContain('width: 400px')
    })

    it('should enforce maximum chat panel width', async () => {
      wrapper = mount(StudioLayout)
      const divider = wrapper.find('.divider')

      await divider.trigger('mousedown', { clientX: 500 })

      // Simulate drag to very large width
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }))
      await wrapper.vm.$nextTick()

      const chatPanel = wrapper.find('.chat-panel')
      // Max width is 800px
      expect(chatPanel.attributes('style')).toContain('width: 800px')
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      wrapper = mount(StudioLayout)
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
    it('should render divider handle', () => {
      wrapper = mount(StudioLayout)
      expect(wrapper.find('.divider-handle').exists()).toBe(true)
    })
  })
})
