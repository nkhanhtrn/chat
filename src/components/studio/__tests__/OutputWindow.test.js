import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OutputWindow from '../OutputWindow.vue'

// Mock child components
vi.mock('../../ChartRenderer.vue', () => ({
  default: {
    name: 'ChartRenderer',
    props: ['option', 'height'],
    template: '<div class="mock-chart-renderer">Chart</div>'
  }
}))

vi.mock('../../markdown/MermaidBlock.vue', () => ({
  default: {
    name: 'MermaidBlock',
    props: ['code'],
    template: '<div class="mock-mermaid-block">Mermaid</div>'
  }
}))

vi.mock('../../ToolRenderer.vue', () => ({
  default: {
    name: 'ToolRenderer',
    props: ['tool'],
    template: '<div class="mock-tool-renderer">Tool</div>'
  }
}))

vi.mock('../CodeDisplay.vue', () => ({
  default: {
    name: 'CodeDisplay',
    props: ['code', 'language'],
    template: '<div class="mock-code-display">{{ code }}</div>'
  }
}))


// Mock parseChartOption
vi.mock('../../../utils/chart.js', () => ({
  parseChartOption: vi.fn((content) => content)
}))

describe('OutputWindow', () => {
  let wrapper

  const defaultWindow = {
    id: 'window-1',
    type: 'chart',
    content: { title: 'Test Chart' },
    position: { x: 100, y: 50 },
    size: { width: 400, height: 300 },
    zIndex: 100,
    title: 'Test Window'
  }

  const defaultProps = {
    window: defaultWindow,
    containerRect: { width: 1000, height: 800 }
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the output window', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.output-window').exists()).toBe(true)
    })

    it('should apply correct position styles', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const windowEl = wrapper.find('.output-window')
      expect(windowEl.attributes('style')).toContain('left: 100px')
      expect(windowEl.attributes('style')).toContain('top: 50px')
    })

    it('should apply correct size styles', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const windowEl = wrapper.find('.output-window')
      expect(windowEl.attributes('style')).toContain('width: 400px')
      expect(windowEl.attributes('style')).toContain('height: 300px')
    })

    it('should apply zIndex style', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const windowEl = wrapper.find('.output-window')
      expect(windowEl.attributes('style')).toContain('z-index: 100')
    })

    it('should render window header', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.window-header').exists()).toBe(true)
    })

    it('should render window title', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.window-title-text').text()).toBe('Test Window')
    })

    it('should render close button', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.close-btn').exists()).toBe(true)
    })

    it('should render resize handle', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.resize-handle').exists()).toBe(true)
    })
  })

  describe('Type Icons', () => {
    it('should show chart icon for chart type', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.window-type-icon').text()).toBe('📊')
    })

    it('should show mermaid icon for mermaid type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'mermaid' }
        }
      })
      expect(wrapper.find('.window-type-icon').text()).toBe('📐')
    })

    it('should show svg icon for svg type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'svg' }
        }
      })
      expect(wrapper.find('.window-type-icon').text()).toBe('🎨')
    })

    it('should show tool icon for tool type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'tool' }
        }
      })
      expect(wrapper.find('.window-type-icon').text()).toBe('🔧')
    })

    it('should show code icon for codeResult type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'codeResult' }
        }
      })
      expect(wrapper.find('.window-type-icon').text()).toBe('💻')
    })

    it('should show default icon for unknown type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'unknown' }
        }
      })
      expect(wrapper.find('.window-type-icon').text()).toBe('📋')
    })
  })

  describe('Content Rendering', () => {
    it('should render ChartRenderer for chart type', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.mock-chart-renderer').exists()).toBe(true)
    })

    it('should render MermaidBlock for mermaid type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'mermaid', content: 'graph TD; A-->B;' }
        }
      })
      expect(wrapper.find('.mock-mermaid-block').exists()).toBe(true)
    })

    it('should render svg content for svg type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'svg', content: '<svg></svg>' }
        }
      })
      expect(wrapper.find('.svg-wrapper').exists()).toBe(true)
    })

    it('should render ToolRenderer for tool type', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: { ...defaultWindow, type: 'tool', content: { name: 'test' } }
        }
      })
      expect(wrapper.find('.tool-wrapper').exists()).toBe(true)
      expect(wrapper.find('.mock-tool-renderer').exists()).toBe(true)
    })

    it('should render code result with output and collapsible code', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: {
            ...defaultWindow,
            type: 'codeResult',
            content: { result: 42, code: 'console.log(42)' }
          }
        }
      })
      expect(wrapper.find('.code-result').exists()).toBe(true)
      expect(wrapper.find('.result-value').exists()).toBe(true)
      expect(wrapper.find('.code-details').exists()).toBe(true)
    })

    it('should display result value in code result', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: {
            ...defaultWindow,
            type: 'codeResult',
            content: { result: 'Hello World', code: 'return "Hello World"' }
          }
        }
      })
      expect(wrapper.find('.result-value').text()).toBe('Hello World')
    })

    it('should hide code details when no code provided', () => {
      wrapper = mount(OutputWindow, {
        props: {
          ...defaultProps,
          window: {
            ...defaultWindow,
            type: 'codeResult',
            content: { result: 42, code: '' }
          }
        }
      })
      expect(wrapper.find('.code-details').exists()).toBe(false)
    })
  })

  describe('Events', () => {
    it('should emit close event when close button clicked', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('should emit bring-to-front on window click', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      await wrapper.find('.output-window').trigger('mousedown')
      expect(wrapper.emitted('bring-to-front')).toBeTruthy()
    })
  })

  describe('Drag Functionality', () => {
    it('should add is-dragging class when header is dragged', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const header = wrapper.find('.window-header')

      await header.trigger('mousedown', { clientX: 150, clientY: 100 })
      expect(wrapper.find('.output-window').classes()).toContain('is-dragging')
    })

    it('should emit bring-to-front when drag starts', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const header = wrapper.find('.window-header')

      await header.trigger('mousedown', { clientX: 150, clientY: 100 })
      expect(wrapper.emitted('bring-to-front')).toBeTruthy()
    })

    it('should emit update:position on drag', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const header = wrapper.find('.window-header')

      await header.trigger('mousedown', { clientX: 150, clientY: 100 })

      // Simulate mouse move
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 150 }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:position')).toBeTruthy()
    })

    it('should remove is-dragging class on mouseup', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const header = wrapper.find('.window-header')

      await header.trigger('mousedown', { clientX: 150, clientY: 100 })
      expect(wrapper.find('.output-window').classes()).toContain('is-dragging')

      document.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.output-window').classes()).not.toContain('is-dragging')
    })

    it('should constrain drag to container bounds', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const header = wrapper.find('.window-header')

      await header.trigger('mousedown', { clientX: 150, clientY: 100 })

      // Try to drag past container bounds
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: -100, clientY: -100 }))
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('update:position')
      expect(emitted).toBeTruthy()
      // Position should be constrained to >= 0
      expect(emitted[emitted.length - 1][0].x).toBeGreaterThanOrEqual(0)
      expect(emitted[emitted.length - 1][0].y).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Resize Functionality', () => {
    it('should add is-resizing class when resize handle is dragged', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const resizeHandle = wrapper.find('.resize-se')

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 350 })
      expect(wrapper.find('.output-window').classes()).toContain('is-resizing')
    })

    it('should emit bring-to-front when resize starts', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const resizeHandle = wrapper.find('.resize-se')

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 350 })
      expect(wrapper.emitted('bring-to-front')).toBeTruthy()
    })

    it('should emit update:size on resize', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const resizeHandle = wrapper.find('.resize-se')

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 350 })

      // Simulate mouse move
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 450 }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:size')).toBeTruthy()
      const emitted = wrapper.emitted('update:size')
      // Size should increase by the delta
      expect(emitted[0][0].width).toBe(500) // 400 + 100
      expect(emitted[0][0].height).toBe(400) // 300 + 100
    })

    it('should remove is-resizing class on mouseup', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const resizeHandle = wrapper.find('.resize-se')

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 350 })
      expect(wrapper.find('.output-window').classes()).toContain('is-resizing')

      document.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.output-window').classes()).not.toContain('is-resizing')
    })

    it('should constrain resize to container bounds', async () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      const resizeHandle = wrapper.find('.resize-se')

      await resizeHandle.trigger('mousedown', { clientX: 500, clientY: 350 })

      // Try to resize past container bounds
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1500, clientY: 1200 }))
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('update:size')
      expect(emitted).toBeTruthy()
      // Size should be constrained to container - position
      const lastEmit = emitted[emitted.length - 1][0]
      expect(lastEmit.width).toBeLessThanOrEqual(900) // 1000 - 100 (containerWidth - positionX)
      expect(lastEmit.height).toBeLessThanOrEqual(750) // 800 - 50 (containerHeight - positionY)
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      wrapper = mount(OutputWindow, { props: defaultProps })
      const header = wrapper.find('.window-header')
      await header.trigger('mousedown', { clientX: 150, clientY: 100 })

      wrapper.unmount()
      wrapper = null

      expect(removeEventListenerSpy).toHaveBeenCalled()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Improve Tool Panel', () => {
    const toolWindow = {
      id: 'window-1',
      type: 'tool',
      content: { name: 'test-tool', state: {}, elements: [] },
      position: { x: 100, y: 50 },
      size: { width: 400, height: 300 },
      zIndex: 100,
      title: 'Test Tool'
    }

    const toolProps = {
      window: toolWindow,
      containerRect: { width: 1000, height: 800 }
    }

    it('should show edit button only for tool windows', () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      expect(wrapper.find('.edit-btn').exists()).toBe(true)
    })

    it('should not show edit button for non-tool windows', () => {
      wrapper = mount(OutputWindow, { props: defaultProps })
      expect(wrapper.find('.edit-btn').exists()).toBe(false)
    })

    it('should not show improve panel by default', () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      expect(wrapper.find('.improve-panel').exists()).toBe(false)
    })

    it('should toggle improve panel when edit button clicked', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })

      await wrapper.find('.edit-btn').trigger('click')
      expect(wrapper.find('.improve-panel').exists()).toBe(true)

      await wrapper.find('.edit-btn').trigger('click')
      expect(wrapper.find('.improve-panel').exists()).toBe(false)
    })

    it('should render improve input textarea', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      expect(wrapper.find('.improve-input').exists()).toBe(true)
      expect(wrapper.find('.improve-input').attributes('placeholder')).toBe('Describe improvements...')
    })

    it('should render submit button', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      expect(wrapper.find('.improve-submit-btn').exists()).toBe(true)
    })

    it('should disable submit button when input is empty', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      expect(wrapper.find('.improve-submit-btn').attributes('disabled')).toBeDefined()
    })

    it('should enable submit button when input has text', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Add a new button')
      expect(wrapper.find('.improve-submit-btn').attributes('disabled')).toBeUndefined()
    })

    it('should render spec details section', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      expect(wrapper.find('.spec-details').exists()).toBe(true)
      expect(wrapper.find('.spec-details summary').text()).toBe('Current Specification')
    })

    it('should render CodeDisplay with current tool spec', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      const codeDisplay = wrapper.find('.mock-code-display')
      expect(codeDisplay.exists()).toBe(true)
      expect(codeDisplay.text()).toContain('test-tool')
    })

    it('should emit improve-tool event when submit button clicked', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Add dark mode')
      await wrapper.find('.improve-submit-btn').trigger('click')

      expect(wrapper.emitted('improve-tool')).toBeTruthy()
      const emitted = wrapper.emitted('improve-tool')[0][0]
      expect(emitted.windowId).toBe('window-1')
      expect(emitted.currentSpec).toEqual(toolWindow.content)
      expect(emitted.prompt).toBe('Add dark mode')
      expect(typeof emitted.onDone).toBe('function')
    })

    it('should show loading spinner when improving', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Improve this')
      await wrapper.find('.improve-submit-btn').trigger('click')

      // The spinning class indicates loading state
      expect(wrapper.find('.improve-submit-btn svg.spinning').exists()).toBe(true)
    })

    it('should disable submit button while improving', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Improve this')
      await wrapper.find('.improve-submit-btn').trigger('click')

      expect(wrapper.find('.improve-submit-btn').attributes('disabled')).toBeDefined()
    })

    it('should reset state when onDone callback is called', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Improve this')
      await wrapper.find('.improve-submit-btn').trigger('click')

      // Get the onDone callback from emitted event
      const emitted = wrapper.emitted('improve-tool')[0][0]
      emitted.onDone()
      await wrapper.vm.$nextTick()

      // Panel should be closed and input cleared
      expect(wrapper.find('.improve-panel').exists()).toBe(false)
    })

    it('should not emit when input is whitespace only', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('   ')
      await wrapper.find('.improve-submit-btn').trigger('click')

      expect(wrapper.emitted('improve-tool')).toBeFalsy()
    })

    it('should show overlay on tool when improving', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Improve this')
      await wrapper.find('.improve-submit-btn').trigger('click')

      expect(wrapper.find('.tool-overlay').exists()).toBe(true)
      expect(wrapper.find('.tool-overlay').text()).toContain('Improving...')
    })

    it('should add is-improving class to tool wrapper when improving', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Improve this')
      await wrapper.find('.improve-submit-btn').trigger('click')

      expect(wrapper.find('.tool-wrapper').classes()).toContain('is-improving')
    })

    it('should remove overlay when onDone is called', async () => {
      wrapper = mount(OutputWindow, { props: toolProps })
      await wrapper.find('.edit-btn').trigger('click')

      await wrapper.find('.improve-input').setValue('Improve this')
      await wrapper.find('.improve-submit-btn').trigger('click')

      expect(wrapper.find('.tool-overlay').exists()).toBe(true)

      // Call onDone
      const emitted = wrapper.emitted('improve-tool')[0][0]
      emitted.onDone()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.tool-overlay').exists()).toBe(false)
    })
  })
})
