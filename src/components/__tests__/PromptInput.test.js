import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PromptInput from '../PromptInput.vue'

describe('PromptInput', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Disabled State', () => {
    it('should disable input when disabled prop is true', () => {
      wrapper = mount(PromptInput, {
        props: {
          disabled: true
        }
      })
      expect(wrapper.find('input').attributes('disabled')).toBeDefined()
    })

    it('should disable send button when input is empty', () => {
      wrapper = mount(PromptInput)
      expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has value', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').setValue('test')
      expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    })
  })

  describe('Submit Behavior', () => {
    it('should emit submit with value on Enter', async () => {
      wrapper = mount(PromptInput)
      const input = wrapper.find('input')
      await input.setValue('test message')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('submit')).toBeTruthy()
      expect(wrapper.emitted('submit')[0]).toEqual(['test message'])
    })

    it('should emit submit with value on button click', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').setValue('test message')
      await wrapper.find('button').trigger('click')

      expect(wrapper.emitted('submit')).toBeTruthy()
      expect(wrapper.emitted('submit')[0]).toEqual(['test message'])
    })

    it('should trim whitespace from submitted value', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').setValue('  test message  ')
      await wrapper.find('input').trigger('keydown.enter')

      expect(wrapper.emitted('submit')[0]).toEqual(['test message'])
    })

    it('should not emit submit if value is empty', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').trigger('keydown.enter')

      expect(wrapper.emitted('submit')).toBeFalsy()
    })

    it('should not emit submit if value is only whitespace', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').setValue('   ')
      await wrapper.find('input').trigger('keydown.enter')

      expect(wrapper.emitted('submit')).toBeFalsy()
    })

    it('should clear input after submit by default', async () => {
      wrapper = mount(PromptInput)
      const input = wrapper.find('input')
      await input.setValue('test message')
      await input.trigger('keydown.enter')

      expect(input.element.value).toBe('')
    })

    it('should not clear input after submit when clearOnSubmit is false', async () => {
      wrapper = mount(PromptInput, {
        props: {
          clearOnSubmit: false
        }
      })
      const input = wrapper.find('input')
      await input.setValue('test message')
      await input.trigger('keydown.enter')

      expect(input.element.value).toBe('test message')
    })
  })

  describe('Cancel Behavior', () => {
    it('should emit cancel on Escape', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').trigger('keydown.esc')

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('Exposed Methods', () => {
    it('should expose clear method', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').setValue('test')
      wrapper.vm.clear()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('input').element.value).toBe('')
    })
  })
})
