import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CollapseToggle from '../markdown/CollapseToggle.vue'

describe('CollapseToggle', () => {
  const defaultProps = {
    isCollapsed: false,
    label: 'Test content (5 lines)'
  }

  describe('rendering', () => {
    it('should render the label', () => {
      const wrapper = mount(CollapseToggle, {
        props: defaultProps
      })
      expect(wrapper.text()).toContain('Test content (5 lines)')
    })

    it('should render the collapse button', () => {
      const wrapper = mount(CollapseToggle, {
        props: defaultProps
      })
      expect(wrapper.find('.collapse-btn').exists()).toBe(true)
    })

    it('should render slot content when not collapsed', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: false },
        slots: {
          default: '<div class="test-content">Slot content</div>'
        }
      })
      expect(wrapper.find('.test-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Slot content')
    })

    it('should hide slot content when collapsed', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: true },
        slots: {
          default: '<div class="test-content">Slot content</div>'
        }
      })
      expect(wrapper.find('.test-content').exists()).toBe(false)
    })
  })

  describe('icon rotation', () => {
    it('should have collapsed class on icon when collapsed', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: true }
      })
      expect(wrapper.find('.collapse-icon').classes()).toContain('collapsed')
    })

    it('should not have collapsed class on icon when expanded', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: false }
      })
      expect(wrapper.find('.collapse-icon').classes()).not.toContain('collapsed')
    })
  })

  describe('button title', () => {
    it('should show "Expand" title when collapsed', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: true }
      })
      expect(wrapper.find('.collapse-btn').attributes('title')).toBe('Expand')
    })

    it('should show "Collapse" title when expanded', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: false }
      })
      expect(wrapper.find('.collapse-btn').attributes('title')).toBe('Collapse')
    })
  })

  describe('toggle event', () => {
    it('should emit toggle event when button is clicked', async () => {
      const wrapper = mount(CollapseToggle, {
        props: defaultProps
      })
      await wrapper.find('.collapse-btn').trigger('click')
      expect(wrapper.emitted('toggle')).toHaveLength(1)
    })

    it('should emit toggle event when label is clicked', async () => {
      const wrapper = mount(CollapseToggle, {
        props: defaultProps
      })
      await wrapper.find('.collapsed-label').trigger('click')
      expect(wrapper.emitted('toggle')).toHaveLength(1)
    })

    it('should emit toggle event multiple times on multiple clicks', async () => {
      const wrapper = mount(CollapseToggle, {
        props: defaultProps
      })
      await wrapper.find('.collapse-btn').trigger('click')
      await wrapper.find('.collapse-btn').trigger('click')
      await wrapper.find('.collapse-btn').trigger('click')
      expect(wrapper.emitted('toggle')).toHaveLength(3)
    })
  })

  describe('accessibility', () => {
    it('should have a button element for keyboard accessibility', () => {
      const wrapper = mount(CollapseToggle, {
        props: defaultProps
      })
      const button = wrapper.find('.collapse-btn')
      expect(button.element.tagName).toBe('BUTTON')
    })
  })

  describe('transition', () => {
    it('should have collapse-content wrapper for slot', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: false },
        slots: {
          default: '<div>Content</div>'
        }
      })
      expect(wrapper.find('.collapse-content').exists()).toBe(true)
    })
  })

  describe('different labels', () => {
    it('should render code block label correctly', () => {
      const wrapper = mount(CollapseToggle, {
        props: {
          isCollapsed: false,
          label: 'javascript (42 lines)'
        }
      })
      expect(wrapper.text()).toContain('javascript (42 lines)')
    })

    it('should render mermaid label correctly', () => {
      const wrapper = mount(CollapseToggle, {
        props: {
          isCollapsed: false,
          label: 'mermaid (10 lines)'
        }
      })
      expect(wrapper.text()).toContain('mermaid (10 lines)')
    })

    it('should render table label correctly', () => {
      const wrapper = mount(CollapseToggle, {
        props: {
          isCollapsed: false,
          label: 'Table (25 rows)'
        }
      })
      expect(wrapper.text()).toContain('Table (25 rows)')
    })
  })
})
