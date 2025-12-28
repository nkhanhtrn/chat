import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CollapseToggle from '../markdown/CollapseToggle.vue'

describe('CollapseToggle', () => {
  const defaultProps = {
    isCollapsed: false,
    label: 'Test content (5 lines)'
  }

  describe('rendering', () => {
    it('should render slot content when not collapsed', () => {
      const wrapper = mount(CollapseToggle, {
        props: { ...defaultProps, isCollapsed: false },
        slots: {
          default: '<div class="test-content">Slot content</div>'
        }
      })
      expect(wrapper.find('.test-content').exists()).toBe(true)
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
  })
})
