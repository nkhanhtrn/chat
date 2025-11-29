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

  describe('Rendering', () => {
    it('should render input and send button', () => {
      wrapper = mount(PromptInput)
      expect(wrapper.find('input').exists()).toBe(true)
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('should display placeholder', () => {
      wrapper = mount(PromptInput, {
        props: {
          placeholder: 'Type here...'
        }
      })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Type here...')
    })

    it('should apply custom wrapper class', () => {
      wrapper = mount(PromptInput, {
        props: {
          wrapperClass: 'custom-wrapper'
        }
      })
      expect(wrapper.find('.prompt-input-wrapper').classes()).toContain('custom-wrapper')
    })

    it('should apply custom input class', () => {
      wrapper = mount(PromptInput, {
        props: {
          inputClass: 'custom-input'
        }
      })
      expect(wrapper.find('input').classes()).toContain('custom-input')
    })
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

    it('should disable send button when disabled', () => {
      wrapper = mount(PromptInput, {
        props: {
          disabled: true
        }
      })
      expect(wrapper.find('button').attributes('disabled')).toBeDefined()
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
    it('should expose focus method', () => {
      wrapper = mount(PromptInput)
      expect(wrapper.vm.focus).toBeDefined()
    })

    it('should expose clear method', async () => {
      wrapper = mount(PromptInput)
      await wrapper.find('input').setValue('test')
      wrapper.vm.clear()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('input').element.value).toBe('')
    })
  })

  describe('Click Propagation', () => {
    it('should stop click propagation on input', async () => {
      wrapper = mount(PromptInput)
      const input = wrapper.find('input')
      const event = new MouseEvent('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      input.element.dispatchEvent(event)
      expect(stopPropagation).toHaveBeenCalled()
    })
  })

  describe('Custom Icon Slot', () => {
    it('should render default send icon', () => {
      wrapper = mount(PromptInput)
      expect(wrapper.find('svg').exists()).toBe(true)
    })

    it('should render custom icon slot content', () => {
      wrapper = mount(PromptInput, {
        slots: {
          icon: '<span class="custom-icon">Send</span>'
        }
      })
      expect(wrapper.find('.custom-icon').exists()).toBe(true)
      expect(wrapper.find('.custom-icon').text()).toBe('Send')
    })
  })
})
