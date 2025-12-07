import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MermaidModal from '../MermaidModal.vue'

describe('MermaidModal', () => {
  beforeEach(() => {
    // Clear localStorage before each test to ensure clean state
    localStorage.removeItem('mermaid-modal-zoom')
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

    it('displays 100% zoom by default', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.zoom-level').text()).toBe('100%')
    })

    it('increases zoom when zoom in button is clicked', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]

      await zoomInBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('125%')
    })

    it('decreases zoom when zoom out button is clicked', async () => {
      const wrapper = mountComponent()
      const zoomOutBtn = wrapper.findAll('.modal-action-btn')[0]

      await zoomOutBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('75%')
    })

    it('resets zoom when reset button is clicked', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]
      const resetBtn = wrapper.findAll('.modal-action-btn')[2]

      await zoomInBtn.trigger('click')
      await zoomInBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('150%')

      await resetBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('100%')
    })

    it('applies zoom transform to content', async () => {
      const wrapper = mountComponent()
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]

      await zoomInBtn.trigger('click')
      const content = wrapper.find('.mermaid-modal-content')
      expect(content.attributes('style')).toContain('scale(1.25)')
    })

    it('does not zoom below 25%', async () => {
      const wrapper = mountComponent()
      const zoomOutBtn = wrapper.findAll('.modal-action-btn')[0]

      for (let i = 0; i < 5; i++) {
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

      for (let i = 0; i < 5; i++) {
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

    it('disables reset button when zoom is at 100%', () => {
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
    let keydownHandler

    beforeEach(() => {
      keydownHandler = null
      vi.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'keydown') {
          keydownHandler = handler
        }
      })
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

      // Zoom in
      const zoomInBtn = wrapper.findAll('.modal-action-btn')[1]
      await zoomInBtn.trigger('click')
      await zoomInBtn.trigger('click')
      expect(wrapper.find('.zoom-level').text()).toBe('150%')

      // Close and reopen
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      // Zoom level should be preserved
      expect(wrapper.find('.zoom-level').text()).toBe('150%')
    })
  })
})
