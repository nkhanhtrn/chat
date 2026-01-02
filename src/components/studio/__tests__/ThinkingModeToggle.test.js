import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ThinkingModeToggle from '../ThinkingModeToggle.vue'

describe('ThinkingModeToggle', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the toggle component', () => {
      wrapper = mount(ThinkingModeToggle)
      expect(wrapper.find('.thinking-toggle').exists()).toBe(true)
    })

    it('should render the label text', () => {
      wrapper = mount(ThinkingModeToggle)
      expect(wrapper.text()).toContain('Thinking Mode')
    })

    it('should render the slider element', () => {
      wrapper = mount(ThinkingModeToggle)
      expect(wrapper.find('.slider').exists()).toBe(true)
    })

    it('should not have checked class when modelValue is false', () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: false }
      })
      expect(wrapper.find('.slider').classes()).not.toContain('checked')
    })

    it('should have checked class when modelValue is true', () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: true }
      })
      expect(wrapper.find('.slider').classes()).toContain('checked')
    })
  })

  describe('Toggle Behavior', () => {
    it('should emit update:modelValue with true when clicked while off', async () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: false }
      })

      await wrapper.find('.thinking-toggle').trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([true])
    })

    it('should emit update:modelValue with false when clicked while on', async () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: true }
      })

      await wrapper.find('.thinking-toggle').trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should toggle value on multiple clicks', async () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: false }
      })

      // First click - turn on
      await wrapper.find('.thinking-toggle').trigger('click')
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([true])

      // Update the prop to reflect the new state
      await wrapper.setProps({ modelValue: true })

      // Second click - turn off
      await wrapper.find('.thinking-toggle').trigger('click')
      expect(wrapper.emitted('update:modelValue')[1]).toEqual([false])
    })
  })

  describe('Reactive Updates', () => {
    it('should update slider appearance when modelValue prop changes', async () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: false }
      })

      expect(wrapper.find('.slider').classes()).not.toContain('checked')

      await wrapper.setProps({ modelValue: true })

      expect(wrapper.find('.slider').classes()).toContain('checked')
    })

    it('should update slider appearance when modelValue changes from true to false', async () => {
      wrapper = mount(ThinkingModeToggle, {
        props: { modelValue: true }
      })

      expect(wrapper.find('.slider').classes()).toContain('checked')

      await wrapper.setProps({ modelValue: false })

      expect(wrapper.find('.slider').classes()).not.toContain('checked')
    })
  })

  describe('Styling', () => {
    it('should have thinking-toggle class', () => {
      wrapper = mount(ThinkingModeToggle)
      const toggle = wrapper.find('.thinking-toggle')
      expect(toggle.classes()).toContain('thinking-toggle')
    })

    it('should have slider element', () => {
      wrapper = mount(ThinkingModeToggle)
      const slider = wrapper.find('.slider')
      expect(slider.exists()).toBe(true)
    })
  })

  describe('Default Props', () => {
    it('should default to false when modelValue is not provided', () => {
      wrapper = mount(ThinkingModeToggle)
      expect(wrapper.find('.slider').classes()).not.toContain('checked')
    })
  })
})
