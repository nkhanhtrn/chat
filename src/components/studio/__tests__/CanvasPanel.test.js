import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CanvasPanel from '../CanvasPanel.vue'

// Mock OutputWindow component
vi.mock('../OutputWindow.vue', () => ({
  default: {
    name: 'OutputWindow',
    props: ['window', 'containerRect'],
    template: '<div class="mock-output-window" :data-id="window.id">{{ window.title }}</div>'
  }
}))

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver

describe('CanvasPanel', () => {
  let wrapper

  const defaultProps = {
    windows: []
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the canvas container', () => {
      wrapper = mount(CanvasPanel, { props: defaultProps })
      expect(wrapper.find('.canvas-container').exists()).toBe(true)
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no windows', () => {
      wrapper = mount(CanvasPanel, { props: defaultProps })
      expect(wrapper.find('.canvas-empty-state').exists()).toBe(true)
    })

    it('should display canvas title in empty state', () => {
      wrapper = mount(CanvasPanel, { props: defaultProps })
      expect(wrapper.find('.empty-title').text()).toBe('Canvas')
    })

    it('should display description in empty state', () => {
      wrapper = mount(CanvasPanel, { props: defaultProps })
      expect(wrapper.find('.empty-description').text()).toContain('Chat outputs will appear here')
    })

    it('should hide empty state when windows exist', () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{
            id: 'window-1',
            type: 'chart',
            content: {},
            position: { x: 0, y: 0 },
            size: { width: 400, height: 300 },
            zIndex: 100,
            title: 'Chart'
          }]
        }
      })
      expect(wrapper.find('.canvas-empty-state').exists()).toBe(false)
    })
  })

  describe('Window Rendering', () => {
    it('should render OutputWindow for each window', () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [
            { id: 'window-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart 1' },
            { id: 'window-2', type: 'mermaid', content: {}, position: { x: 50, y: 50 }, size: { width: 500, height: 400 }, zIndex: 101, title: 'Diagram' }
          ]
        }
      })
      expect(wrapper.findAll('.mock-output-window')).toHaveLength(2)
    })

    it('should pass correct props to OutputWindow', () => {
      const window = {
        id: 'window-1',
        type: 'chart',
        content: { title: 'Test' },
        position: { x: 100, y: 200 },
        size: { width: 450, height: 350 },
        zIndex: 105,
        title: 'Test Chart'
      }
      wrapper = mount(CanvasPanel, {
        props: { windows: [window] }
      })

      const outputWindow = wrapper.findComponent({ name: 'OutputWindow' })
      expect(outputWindow.props('window')).toEqual(window)
    })
  })

  describe('Events', () => {
    it('should emit close-window event', async () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{ id: 'window-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }]
        }
      })

      const outputWindow = wrapper.findComponent({ name: 'OutputWindow' })
      await outputWindow.vm.$emit('close')

      expect(wrapper.emitted('close-window')).toBeTruthy()
      expect(wrapper.emitted('close-window')[0]).toEqual(['window-1'])
    })

    it('should emit update-position event', async () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{ id: 'window-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }]
        }
      })

      const outputWindow = wrapper.findComponent({ name: 'OutputWindow' })
      await outputWindow.vm.$emit('update:position', { x: 100, y: 200 })

      expect(wrapper.emitted('update-position')).toBeTruthy()
      expect(wrapper.emitted('update-position')[0]).toEqual(['window-1', { x: 100, y: 200 }])
    })

    it('should emit update-size event', async () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{ id: 'window-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }]
        }
      })

      const outputWindow = wrapper.findComponent({ name: 'OutputWindow' })
      await outputWindow.vm.$emit('update:size', { width: 500, height: 400 })

      expect(wrapper.emitted('update-size')).toBeTruthy()
      expect(wrapper.emitted('update-size')[0]).toEqual(['window-1', { width: 500, height: 400 }])
    })

    it('should emit bring-to-front event', async () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{ id: 'window-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }]
        }
      })

      const outputWindow = wrapper.findComponent({ name: 'OutputWindow' })
      await outputWindow.vm.$emit('bring-to-front')

      expect(wrapper.emitted('bring-to-front')).toBeTruthy()
      expect(wrapper.emitted('bring-to-front')[0]).toEqual(['window-1'])
    })
  })

  describe('Multiple Windows', () => {
    it('should handle multiple windows with different types', () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [
            { id: 'w-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' },
            { id: 'w-2', type: 'mermaid', content: {}, position: { x: 30, y: 30 }, size: { width: 500, height: 400 }, zIndex: 101, title: 'Diagram' },
            { id: 'w-3', type: 'tool', content: {}, position: { x: 60, y: 60 }, size: { width: 350, height: 400 }, zIndex: 102, title: 'Tool' }
          ]
        }
      })

      const windows = wrapper.findAll('.mock-output-window')
      expect(windows).toHaveLength(3)
      expect(windows[0].attributes('data-id')).toBe('w-1')
      expect(windows[1].attributes('data-id')).toBe('w-2')
      expect(windows[2].attributes('data-id')).toBe('w-3')
    })
  })

  describe('Dynamic Updates', () => {
    it('should update when windows prop changes', async () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{ id: 'w-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }]
        }
      })

      expect(wrapper.findAll('.mock-output-window')).toHaveLength(1)

      await wrapper.setProps({
        windows: [
          { id: 'w-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' },
          { id: 'w-2', type: 'mermaid', content: {}, position: { x: 30, y: 30 }, size: { width: 500, height: 400 }, zIndex: 101, title: 'Diagram' }
        ]
      })

      expect(wrapper.findAll('.mock-output-window')).toHaveLength(2)
    })

    it('should show empty state when all windows removed', async () => {
      wrapper = mount(CanvasPanel, {
        props: {
          windows: [{ id: 'w-1', type: 'chart', content: {}, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, zIndex: 100, title: 'Chart' }]
        }
      })

      expect(wrapper.find('.canvas-empty-state').exists()).toBe(false)

      await wrapper.setProps({ windows: [] })

      expect(wrapper.find('.canvas-empty-state').exists()).toBe(true)
    })
  })
})
