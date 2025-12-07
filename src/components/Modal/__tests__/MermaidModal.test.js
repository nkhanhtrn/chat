import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MermaidModal from '../MermaidModal.vue'

// Helper to create mouse events with coordinates
function createMouseEvent(type, options = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: options.clientX || 0,
    clientY: options.clientY || 0,
    ...options
  })
}

describe('MermaidModal', () => {
  let originalClipboard

  beforeEach(() => {
    // Clear localStorage before each test to ensure clean state
    localStorage.removeItem('mermaid-modal-zoom')

    // Mock clipboard API
    originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    // Restore clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true
    })
    vi.restoreAllMocks()
  })

  const mountComponent = (props = {}) => {
    return mount(MermaidModal, {
      props: {
        visible: true,
        svg: '<svg><text>Test diagram</text></svg>',
        ...props
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
  }

  describe('rendering', () => {
    it('renders when visible is true', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.mermaid-modal-overlay').exists()).toBe(true)
      expect(wrapper.find('.mermaid-modal').exists()).toBe(true)
    })

    it('does not render when visible is false', () => {
      const wrapper = mountComponent({ visible: false })
      expect(wrapper.find('.mermaid-modal-overlay').exists()).toBe(false)
    })

    it('renders the modal header with title', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.mermaid-modal-header').exists()).toBe(true)
      expect(wrapper.find('.mermaid-modal-title').text()).toBe('Mermaid Diagram')
    })

    it('renders the svg content', () => {
      const svg = '<svg><rect width="100" height="100"/></svg>'
      const wrapper = mountComponent({ svg })
      const content = wrapper.find('.mermaid-modal-content')
      expect(content.exists()).toBe(true)
      // Check that SVG element is rendered (HTML may be slightly different due to parsing)
      expect(content.find('svg').exists()).toBe(true)
      expect(content.find('rect').exists()).toBe(true)
    })

    it('renders close button', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.modal-close-btn').exists()).toBe(true)
    })
  })

  describe('zoom controls', () => {
    it('renders zoom controls and copy button', () => {
      const wrapper = mountComponent()
      expect(wrapper.findAll('.modal-action-btn').length).toBe(4) // zoom out, zoom in, reset, copy
      expect(wrapper.find('.zoom-level').exists()).toBe(true)
    })

    it('displays 200% zoom by default', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.zoom-level').text()).toBe('200%')
    })

    it('increases zoom when zoom in button is clicked', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]

      await zoomInBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('225%')
    })

    it('decreases zoom when zoom out button is clicked', async () => {
      const wrapper = mountComponent()
      const zoomOutBtn = wrapper.findAll('.modal-action-btn')[0]

      await zoomOutBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('175%')
    })

    it('resets zoom when reset button is clicked', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]
      const resetBtn = wrapper.findAll('.modal-action-btn')[2]

      await zoomInBtn.trigger('click')
      await zoomInBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('250%')

      await resetBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('200%')
    })

    it('applies zoom transform to content', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]

      await zoomInBtn.trigger('click')
      const content = wrapper.find('.mermaid-modal-content')
      expect(content.attributes('style')).toContain('scale(2.25)')
    })

    it('does not zoom below 25%', async () => {
      const wrapper = mountComponent()
      const zoomOutBtn = wrapper.findAll('.modal-action-btn')[0]

      // Starting at 200%, need 8 clicks to try to go below 25%
      for (let i = 0; i < 10; i++) {
        await zoomOutBtn.trigger('click')
      }
      expect(wrapper.find('.zoom-level').text()).toBe('25%')
    })

    it('does not zoom above 500%', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]

      for (let i = 0; i < 20; i++) {
        await zoomInBtn.trigger('click')
      }
      expect(wrapper.find('.zoom-level').text()).toBe('500%')
    })

    it('disables zoom out button at minimum zoom', async () => {
      const wrapper = mountComponent()
      const zoomOutBtn = wrapper.findAll('.modal-action-btn')[0]

      // Starting at 200%, need 7 clicks to reach 25%
      for (let i = 0; i < 10; i++) {
        await zoomOutBtn.trigger('click')
      }
      expect(zoomOutBtn.attributes('disabled')).toBeDefined()
    })

    it('disables zoom in button at maximum zoom', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]

      for (let i = 0; i < 20; i++) {
        await zoomInBtn.trigger('click')
      }
      expect(zoomInBtn.attributes('disabled')).toBeDefined()
    })

    it('disables reset button when zoom is at default (200%)', () => {
      const wrapper = mountComponent()
      const resetBtn = wrapper.findAll('.modal-action-btn')[2]
      expect(resetBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('close functionality', () => {
    it('emits close event when close button is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.modal-close-btn').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close event when clicking overlay', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.mermaid-modal-overlay').trigger('mousedown')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('does not emit close when clicking modal content', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.mermaid-modal').trigger('mousedown')
      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('resize handles', () => {
    it('renders all 8 resize handles', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.resize-handle-e').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-w').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-s').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-n').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-se').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-sw').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-ne').exists()).toBe(true)
      expect(wrapper.find('.resize-handle-nw').exists()).toBe(true)
    })
  })

  describe('modal style', () => {
    it('applies default dimensions', () => {
      const wrapper = mountComponent()
      const modal = wrapper.find('.mermaid-modal')
      const style = modal.attributes('style')
      expect(style).toContain('width: 800px')
      expect(style).toContain('height: 600px')
    })
  })

  describe('keyboard navigation', () => {
    beforeEach(() => {
      vi.spyOn(document, 'addEventListener').mockImplementation(() => {})
      vi.spyOn(document, 'removeEventListener').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('adds keydown listener when modal opens', async () => {
      const wrapper = mount(MermaidModal, {
        props: {
          visible: false,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.setProps({ visible: true })
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('removes keydown listener when modal closes', async () => {
      const wrapper = mount(MermaidModal, {
        props: {
          visible: true,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.setProps({ visible: false })
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })

  describe('zoom persistence on reopen', () => {
    it('preserves zoom level when modal reopens', async () => {
      const wrapper = mount(MermaidModal, {
        props: {
          visible: true,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      })

      // Zoom in from default 200%
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]
      await zoomInBtn.trigger('click')
      await zoomInBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('250%')

      // Close and reopen
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      // Zoom level should be preserved
      expect(wrapper.find('.zoom-level').text()).toBe('250%')
    })
  })

  describe('copy SVG functionality', () => {
    it('copies SVG to clipboard when copy button is clicked', async () => {
      const svg = '<svg><text>Test</text></svg>'
      const wrapper = mountComponent({ svg })
      const copyBtn = wrapper.findAll('.modal-action-btn')[3]

      await copyBtn.trigger('click')
      await vi.waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(svg)
      })
    })

    it('shows success state after copying', async () => {
      const wrapper = mountComponent()
      const copyBtn = wrapper.findAll('.modal-action-btn')[3]

      await copyBtn.trigger('click')
      await vi.waitFor(() => {
        expect(copyBtn.classes()).toContain('copy-success')
      })
    })

    it('adds flashing class to body after copying', async () => {
      const wrapper = mountComponent()
      const copyBtn = wrapper.findAll('.modal-action-btn')[3]

      await copyBtn.trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('.mermaid-modal-body').classes()).toContain('flashing')
      })
    })

    it('removes success state after timeout', async () => {
      vi.useFakeTimers()
      const wrapper = mountComponent()
      const copyBtn = wrapper.findAll('.modal-action-btn')[3]

      await copyBtn.trigger('click')
      await vi.waitFor(() => {
        expect(copyBtn.classes()).toContain('copy-success')
      })

      vi.advanceTimersByTime(1500)
      await wrapper.vm.$nextTick()
      expect(copyBtn.classes()).not.toContain('copy-success')
      vi.useRealTimers()
    })

    it('handles clipboard error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('Clipboard error'))

      const wrapper = mountComponent()
      const copyBtn = wrapper.findAll('.modal-action-btn')[3]

      await copyBtn.trigger('click')
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy SVG:', expect.any(Error))
      })
      consoleSpy.mockRestore()
    })
  })

  describe('drag functionality', () => {
    it('starts dragging when mousedown on header', async () => {
      const wrapper = mountComponent()
      const header = wrapper.find('.mermaid-modal-header')

      // Mock getBoundingClientRect for modal
      const modal = wrapper.find('.mermaid-modal')
      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await header.trigger('mousedown', { clientX: 150, clientY: 120 })

      // Verify event listeners were added
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      await header.trigger('mousedown', { clientX: 150, clientY: 120 })
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })

    it('does not start dragging when clicking action buttons', async () => {
      const wrapper = mountComponent()
      const actionBtn = wrapper.find('.modal-action-btn')

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      await actionBtn.trigger('mousedown', { clientX: 150, clientY: 120 })

      // Should not add drag listeners when clicking buttons
      const mousemoveCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'mousemove'
      )
      expect(mousemoveCalls.length).toBe(0)
    })

    it('updates modal position during drag', async () => {
      const wrapper = mountComponent()
      const header = wrapper.find('.mermaid-modal-header')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      // Start drag
      await header.trigger('mousedown', { clientX: 150, clientY: 120 })

      // Simulate mousemove
      const mousemoveEvent = createMouseEvent('mousemove', { clientX: 200, clientY: 170 })
      document.dispatchEvent(mousemoveEvent)
      await wrapper.vm.$nextTick()

      // Check that position style was updated
      const style = modal.attributes('style')
      expect(style).toContain('left:')
      expect(style).toContain('top:')
    })

    it('stops dragging on mouseup', async () => {
      const wrapper = mountComponent()
      const header = wrapper.find('.mermaid-modal-header')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      // Start and stop drag
      await header.trigger('mousedown', { clientX: 150, clientY: 120 })
      document.dispatchEvent(createMouseEvent('mouseup'))

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })

  describe('resize functionality', () => {
    it('starts resizing when mousedown on resize handle', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-se')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      await resizeHandle.trigger('mousedown', { clientX: 900, clientY: 700 })

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })

    it('resizes modal when dragging east handle', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-e')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await resizeHandle.trigger('mousedown', { clientX: 900, clientY: 400 })

      // Simulate resize by moving mouse
      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 1000, clientY: 400 }))
      await wrapper.vm.$nextTick()

      const style = modal.attributes('style')
      expect(style).toContain('width: 900px')
    })

    it('resizes modal when dragging south handle', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-s')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 700 })

      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 500, clientY: 800 }))
      await wrapper.vm.$nextTick()

      const style = modal.attributes('style')
      expect(style).toContain('height: 700px')
    })

    it('resizes modal when dragging west handle', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-w')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await resizeHandle.trigger('mousedown', { clientX: 100, clientY: 400 })

      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 0, clientY: 400 }))
      await wrapper.vm.$nextTick()

      const style = modal.attributes('style')
      expect(style).toContain('width: 900px')
    })

    it('resizes modal when dragging north handle', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-n')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 100 })

      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 500, clientY: 0 }))
      await wrapper.vm.$nextTick()

      const style = modal.attributes('style')
      expect(style).toContain('height: 700px')
    })

    it('enforces minimum width of 400px', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-w')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await resizeHandle.trigger('mousedown', { clientX: 100, clientY: 400 })

      // Try to resize smaller than minimum
      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 600, clientY: 400 }))
      await wrapper.vm.$nextTick()

      const style = modal.attributes('style')
      expect(style).toContain('width: 400px')
    })

    it('enforces minimum height of 300px', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-n')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 100 })

      // Try to resize smaller than minimum
      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 500, clientY: 500 }))
      await wrapper.vm.$nextTick()

      const style = modal.attributes('style')
      expect(style).toContain('height: 300px')
    })

    it('stops resizing on mouseup', async () => {
      const wrapper = mountComponent()
      const resizeHandle = wrapper.find('.resize-handle-se')
      const modal = wrapper.find('.mermaid-modal')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      await resizeHandle.trigger('mousedown', { clientX: 900, clientY: 700 })
      document.dispatchEvent(createMouseEvent('mouseup'))

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })

  describe('pan functionality', () => {
    it('starts panning when mousedown on modal body', async () => {
      const wrapper = mountComponent()
      const body = wrapper.find('.mermaid-modal-body')

      // Mock scrollLeft and scrollTop
      Object.defineProperty(body.element, 'scrollLeft', { value: 0, writable: true })
      Object.defineProperty(body.element, 'scrollTop', { value: 0, writable: true })

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      await body.trigger('mousedown', { clientX: 400, clientY: 300 })

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })

    it('adds is-panning class when panning', async () => {
      const wrapper = mountComponent()
      const body = wrapper.find('.mermaid-modal-body')

      Object.defineProperty(body.element, 'scrollLeft', { value: 0, writable: true })
      Object.defineProperty(body.element, 'scrollTop', { value: 0, writable: true })

      await body.trigger('mousedown', { clientX: 400, clientY: 300 })
      expect(body.classes()).toContain('is-panning')
    })

    it('scrolls content during pan', async () => {
      const wrapper = mountComponent()
      const body = wrapper.find('.mermaid-modal-body')

      let scrollLeft = 50
      let scrollTop = 50
      Object.defineProperty(body.element, 'scrollLeft', {
        get: () => scrollLeft,
        set: (val) => { scrollLeft = val }
      })
      Object.defineProperty(body.element, 'scrollTop', {
        get: () => scrollTop,
        set: (val) => { scrollTop = val }
      })

      await body.trigger('mousedown', { clientX: 400, clientY: 300 })

      // Pan by moving mouse
      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 350, clientY: 250 }))
      await wrapper.vm.$nextTick()

      // Scroll should have changed (panning moves opposite to mouse direction)
      expect(scrollLeft).toBe(100) // 50 + (400 - 350)
      expect(scrollTop).toBe(100) // 50 + (300 - 250)
    })

    it('stops panning on mouseup', async () => {
      const wrapper = mountComponent()
      const body = wrapper.find('.mermaid-modal-body')

      Object.defineProperty(body.element, 'scrollLeft', { value: 0, writable: true })
      Object.defineProperty(body.element, 'scrollTop', { value: 0, writable: true })

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      await body.trigger('mousedown', { clientX: 400, clientY: 300 })
      document.dispatchEvent(createMouseEvent('mouseup'))

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })

    it('removes is-panning class after pan ends', async () => {
      const wrapper = mountComponent()
      const body = wrapper.find('.mermaid-modal-body')

      Object.defineProperty(body.element, 'scrollLeft', { value: 0, writable: true })
      Object.defineProperty(body.element, 'scrollTop', { value: 0, writable: true })

      await body.trigger('mousedown', { clientX: 400, clientY: 300 })
      expect(body.classes()).toContain('is-panning')

      document.dispatchEvent(createMouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      expect(body.classes()).not.toContain('is-panning')
    })
  })

  describe('escape key handling', () => {
    it('emits close when Escape key is pressed', async () => {
      const wrapper = mount(MermaidModal, {
        props: {
          visible: true,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        },
        attachTo: document.body
      })

      // Trigger the watch by changing visibility
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      // Dispatch Escape key event
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(escapeEvent)

      expect(wrapper.emitted('close')).toBeTruthy()
      wrapper.unmount()
    })

    it('does not emit close for other keys', async () => {
      const wrapper = mount(MermaidModal, {
        props: {
          visible: true,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        },
        attachTo: document.body
      })

      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(enterEvent)

      expect(wrapper.emitted('close')).toBeFalsy()
      wrapper.unmount()
    })
  })

  describe('cleanup on unmount', () => {
    it('removes all event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      const wrapper = mount(MermaidModal, {
        props: {
          visible: true,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      })

      wrapper.unmount()

      // Should remove keydown listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      // Should remove drag listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })

  describe('modal position reset on reopen', () => {
    it('resets position when modal reopens', async () => {
      const wrapper = mount(MermaidModal, {
        props: {
          visible: true,
          svg: '<svg></svg>'
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      })

      const modal = wrapper.find('.mermaid-modal')
      const header = wrapper.find('.mermaid-modal-header')

      modal.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 800,
        height: 600
      })

      // Drag to move modal
      await header.trigger('mousedown', { clientX: 150, clientY: 120 })
      document.dispatchEvent(createMouseEvent('mousemove', { clientX: 250, clientY: 220 }))
      document.dispatchEvent(createMouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      // Modal should have custom position
      let style = modal.attributes('style')
      expect(style).toContain('left:')

      // Close and reopen
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      // Position should be reset (no left/top, uses transform for centering)
      style = wrapper.find('.mermaid-modal').attributes('style')
      expect(style).not.toContain('transform: none')
    })
  })
})
