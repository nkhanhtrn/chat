import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Scratchpad from '../Scratchpad.vue'

describe('Scratchpad', () => {
  let wrapper

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  // Helper to open the panel by directly setting state (bypasses transition)
  const openPanel = async (w) => {
    w.vm.isOpen = true
    w.vm.showButton = false
    w.vm.showPanel = true
    await w.vm.$nextTick()
  }

  describe('Rendering', () => {
    it('should render toggle button by default', () => {
      wrapper = mount(Scratchpad)
      expect(wrapper.find('.scratchpad-toggle').exists()).toBe(true)
    })

    it('should not render panel by default', () => {
      wrapper = mount(Scratchpad)
      expect(wrapper.find('.scratchpad-panel').exists()).toBe(false)
    })

    it('should have correct container class', () => {
      wrapper = mount(Scratchpad)
      expect(wrapper.find('.scratchpad-container').exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('should accept content prop', () => {
      wrapper = mount(Scratchpad, {
        props: {
          content: 'Initial content'
        }
      })

      expect(wrapper.props('content')).toBe('Initial content')
    })

    it('should default content to empty string', () => {
      wrapper = mount(Scratchpad)

      expect(wrapper.props('content')).toBe('')
    })
  })

  describe('Opening and closing', () => {
    it('should set isOpen to true when toggle button is clicked', async () => {
      wrapper = mount(Scratchpad)

      await wrapper.find('.scratchpad-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isOpen).toBe(true)
    })

    it('should hide toggle button when opening (showButton = false)', async () => {
      wrapper = mount(Scratchpad)

      await wrapper.find('.scratchpad-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showButton).toBe(false)
    })

    it('should show panel when showPanel is true', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      expect(wrapper.find('.scratchpad-panel').exists()).toBe(true)
    })

    it('should close panel when close button is clicked', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      await wrapper.find('.scratchpad-close').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isOpen).toBe(false)
    })

    it('should set showPanel to false when closing', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      await wrapper.find('.scratchpad-close').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showPanel).toBe(false)
    })
  })

  describe('Content handling', () => {
    it('should display content in textarea when panel is open', async () => {
      wrapper = mount(Scratchpad, {
        props: {
          content: 'Test content'
        }
      })
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.element.value).toBe('Test content')
    })

    it('should emit update:content when textarea content changes', async () => {
      vi.useFakeTimers()
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      await textarea.setValue('New content')
      await textarea.trigger('input')

      // Wait for debounce (300ms)
      vi.advanceTimersByTime(300)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:content')).toBeTruthy()
      expect(wrapper.emitted('update:content')[0]).toEqual(['New content'])

      vi.useRealTimers()
    })

    it('should update local content when prop changes', async () => {
      wrapper = mount(Scratchpad, {
        props: {
          content: 'Initial'
        }
      })

      await wrapper.setProps({ content: 'Updated' })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.localContent).toBe('Updated')
    })

    it('should debounce content updates', async () => {
      vi.useFakeTimers()
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')

      // Rapid updates
      await textarea.setValue('A')
      await textarea.trigger('input')
      await textarea.setValue('AB')
      await textarea.trigger('input')
      await textarea.setValue('ABC')
      await textarea.trigger('input')

      // Before debounce timeout
      expect(wrapper.emitted('update:content')).toBeFalsy()

      // After debounce timeout
      vi.advanceTimersByTime(300)
      await wrapper.vm.$nextTick()

      // Should only emit once with final value
      expect(wrapper.emitted('update:content')).toHaveLength(1)
      expect(wrapper.emitted('update:content')[0]).toEqual(['ABC'])

      vi.useRealTimers()
    })
  })

  describe('Panel structure', () => {
    it('should have header with title', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      expect(wrapper.find('.scratchpad-header').exists()).toBe(true)
      expect(wrapper.find('.scratchpad-title').text()).toBe('Scratchpad')
    })

    it('should have close button', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      expect(wrapper.find('.scratchpad-close').exists()).toBe(true)
    })

    it('should have textarea', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      expect(wrapper.find('.scratchpad-textarea').exists()).toBe(true)
    })

    it('should have resize handle', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      expect(wrapper.find('.resize-handle').exists()).toBe(true)
    })

    it('should have placeholder text in textarea', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.attributes('placeholder')).toBe('Write your thoughts here...')
    })
  })

  describe('Resize functionality', () => {
    it('should have default panel dimensions', () => {
      wrapper = mount(Scratchpad)

      expect(wrapper.vm.panelWidth).toBe(320)
      expect(wrapper.vm.panelHeight).toBe(280)
    })

    it('should load saved size from localStorage on mount', async () => {
      localStorage.getItem.mockReturnValue(JSON.stringify({ width: 400, height: 350 }))

      wrapper = mount(Scratchpad)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.panelWidth).toBe(400)
      expect(wrapper.vm.panelHeight).toBe(350)
    })

    it('should use default size if localStorage returns invalid JSON', async () => {
      localStorage.getItem.mockReturnValue('invalid json')

      wrapper = mount(Scratchpad)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.panelWidth).toBe(320)
      expect(wrapper.vm.panelHeight).toBe(280)
    })

    it('should use default size if localStorage returns null', async () => {
      localStorage.getItem.mockReturnValue(null)

      wrapper = mount(Scratchpad)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.panelWidth).toBe(320)
      expect(wrapper.vm.panelHeight).toBe(280)
    })

    it('should start resize on mousedown', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      const resizeHandle = wrapper.find('.resize-handle')
      await resizeHandle.trigger('mousedown', { clientX: 100, clientY: 100 })

      expect(wrapper.vm.isResizing).toBe(true)
    })

    it('should save size to localStorage after resize stops', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      // Start resize
      wrapper.vm.startResize({ preventDefault: () => {}, clientX: 100, clientY: 100 })

      // Stop resize
      wrapper.vm.stopResize()

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'scratchpad-size',
        expect.any(String)
      )
    })

    it('should apply panel dimensions as style', async () => {
      wrapper = mount(Scratchpad)
      wrapper.vm.panelWidth = 400
      wrapper.vm.panelHeight = 350
      await openPanel(wrapper)

      const panel = wrapper.find('.scratchpad-panel')
      expect(panel.attributes('style')).toContain('width: 400px')
      expect(panel.attributes('style')).toContain('height: 350px')
    })

    it('should enforce minimum width during resize', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      // Start resize with initial position
      wrapper.vm.startResize({ preventDefault: () => {}, clientX: 100, clientY: 100 })

      // Simulate dragging far right (which would make width smaller than minimum)
      wrapper.vm.onResize({ clientX: 500, clientY: 100 })

      // Width should not go below MIN_WIDTH (200)
      expect(wrapper.vm.panelWidth).toBeGreaterThanOrEqual(200)
    })

    it('should enforce minimum height during resize', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      // Start resize with initial position
      wrapper.vm.startResize({ preventDefault: () => {}, clientX: 100, clientY: 100 })

      // Simulate dragging far down (which would make height smaller than minimum)
      wrapper.vm.onResize({ clientX: 100, clientY: 500 })

      // Height should not go below MIN_HEIGHT (150)
      expect(wrapper.vm.panelHeight).toBeGreaterThanOrEqual(150)
    })
  })

  describe('Accessibility', () => {
    it('should have title attribute on toggle button', () => {
      wrapper = mount(Scratchpad)

      const toggleButton = wrapper.find('.scratchpad-toggle')
      expect(toggleButton.attributes('title')).toBe('Open scratchpad')
    })

    it('should have title attribute on close button', async () => {
      wrapper = mount(Scratchpad)
      await openPanel(wrapper)

      const closeButton = wrapper.find('.scratchpad-close')
      expect(closeButton.attributes('title')).toBe('Close scratchpad')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty content', async () => {
      wrapper = mount(Scratchpad, {
        props: {
          content: ''
        }
      })
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.element.value).toBe('')
    })

    it('should handle multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3'
      wrapper = mount(Scratchpad, {
        props: {
          content: multilineContent
        }
      })
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.element.value).toBe(multilineContent)
    })

    it('should handle special characters', async () => {
      const specialContent = '<script>alert("test")</script>'
      wrapper = mount(Scratchpad, {
        props: {
          content: specialContent
        }
      })
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.element.value).toBe(specialContent)
    })

    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(10000)
      wrapper = mount(Scratchpad, {
        props: {
          content: longContent
        }
      })
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.element.value).toHaveLength(10000)
    })

    it('should handle unicode characters', async () => {
      const unicodeContent = '你好世界 🌍 Привет мир'
      wrapper = mount(Scratchpad, {
        props: {
          content: unicodeContent
        }
      })
      await openPanel(wrapper)

      const textarea = wrapper.find('.scratchpad-textarea')
      expect(textarea.element.value).toBe(unicodeContent)
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      wrapper = mount(Scratchpad)
      wrapper.unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })
})
