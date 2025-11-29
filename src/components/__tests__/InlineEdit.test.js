import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import InlineEdit from '../InlineEdit.vue'

describe('InlineEdit', () => {
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
    it('should render text span by default', () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test text'
        }
      })
      expect(wrapper.find('span').exists()).toBe(true)
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('should display modelValue in text span', () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Hello World'
        }
      })
      expect(wrapper.text()).toBe('Hello World')
    })

    it('should render slot content when provided', () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        },
        slots: {
          default: 'Custom Content'
        }
      })
      expect(wrapper.text()).toBe('Custom Content')
    })

    it('should apply textClass to span', () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test',
          textClass: 'custom-text-class'
        }
      })
      expect(wrapper.find('span').classes()).toContain('custom-text-class')
      expect(wrapper.find('span').classes()).toContain('inline-edit-text')
    })
  })

  describe('Double Click to Edit', () => {
    it('should switch to input on double click', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      expect(wrapper.find('input').exists()).toBe(true)
      expect(wrapper.find('span').exists()).toBe(false)
    })

    it('should populate input with modelValue on double click', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original Text'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      expect(input.element.value).toBe('Original Text')
    })

    it('should apply inputClass to input', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test',
          inputClass: 'custom-input-class'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      expect(wrapper.find('input').classes()).toContain('custom-input-class')
      expect(wrapper.find('input').classes()).toContain('inline-edit-input')
    })

    it('should stop event propagation on double click', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      const span = wrapper.find('span')
      const event = new MouseEvent('dblclick', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      span.element.dispatchEvent(event)
      expect(stopPropagation).toHaveBeenCalled()
    })
  })

  describe('Saving Changes', () => {
    it('should emit save and update:modelValue on Enter with changed value', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('New Value')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual(['New Value'])
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['New Value'])
    })

    it('should emit save and update:modelValue on save button click', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('New Value')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual(['New Value'])
    })

    it('should trim whitespace from saved value', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('  New Value  ')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('save')[0]).toEqual(['New Value'])
    })

    it('should not emit save if value unchanged', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').trigger('keydown.enter')

      expect(wrapper.emitted('save')).toBeFalsy()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('should not emit save if value is empty', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('save')).toBeFalsy()
    })

    it('should not emit save if value is only whitespace', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('   ')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('save')).toBeFalsy()
    })

    it('should switch back to text span after saving', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('New Value')
      await input.trigger('keydown.enter')

      expect(wrapper.find('span').exists()).toBe(true)
      expect(wrapper.find('input').exists()).toBe(false)
    })
  })

  describe('Canceling Edit', () => {
    it('should cancel editing on Escape without saving', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('Changed Value')
      await input.trigger('keydown.esc')

      expect(wrapper.emitted('save')).toBeFalsy()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
      expect(wrapper.find('span').exists()).toBe(true)
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('should cancel editing on cancel button click', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('Changed Value')
      await wrapper.find('.cancel-btn').trigger('click')

      expect(wrapper.emitted('save')).toBeFalsy()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
      expect(wrapper.find('span').exists()).toBe(true)
      expect(wrapper.find('input').exists()).toBe(false)
    })
  })

  describe('Edit Buttons', () => {
    it('should render save and cancel buttons when editing', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      expect(wrapper.find('.save-btn').exists()).toBe(true)
      expect(wrapper.find('.cancel-btn').exists()).toBe(true)
    })

    it('should disable save button when input is empty', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').setValue('')
      expect(wrapper.find('.save-btn').attributes('disabled')).toBeDefined()
    })

    it('should enable save button when input has value', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      expect(wrapper.find('.save-btn').attributes('disabled')).toBeUndefined()
    })

    it('should stop click propagation on save button', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const saveBtn = wrapper.find('.save-btn')
      const event = new MouseEvent('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      saveBtn.element.dispatchEvent(event)
      expect(stopPropagation).toHaveBeenCalled()
    })

    it('should stop click propagation on cancel button', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const cancelBtn = wrapper.find('.cancel-btn')
      const event = new MouseEvent('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      cancelBtn.element.dispatchEvent(event)
      expect(stopPropagation).toHaveBeenCalled()
    })
  })

  describe('Input Click', () => {
    it('should stop click event propagation on input', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      const event = new MouseEvent('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      input.element.dispatchEvent(event)
      expect(stopPropagation).toHaveBeenCalled()
    })
  })

  describe('Exposed Methods', () => {
    it('should expose startEditing method', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      expect(wrapper.vm.startEditing).toBeDefined()
      wrapper.vm.startEditing()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('input').exists()).toBe(true)
    })
  })

  describe('Editing Events', () => {
    it('should emit editing-start when entering edit mode via double click', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      await wrapper.find('span').trigger('dblclick')

      expect(wrapper.emitted('editing-start')).toBeTruthy()
      expect(wrapper.emitted('editing-start')).toHaveLength(1)
    })

    it('should emit editing-start when entering edit mode via exposed method', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Test'
        }
      })
      wrapper.vm.startEditing()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('editing-start')).toBeTruthy()
      expect(wrapper.emitted('editing-start')).toHaveLength(1)
    })

    it('should emit editing-end when saving changes', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').setValue('New Value')
      await wrapper.find('input').trigger('keydown.enter')

      expect(wrapper.emitted('editing-end')).toBeTruthy()
      expect(wrapper.emitted('editing-end')).toHaveLength(1)
    })

    it('should emit editing-end when canceling with Escape', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').trigger('keydown.esc')

      expect(wrapper.emitted('editing-end')).toBeTruthy()
      expect(wrapper.emitted('editing-end')).toHaveLength(1)
    })

    it('should emit editing-end when clicking cancel button', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('.cancel-btn').trigger('click')

      expect(wrapper.emitted('editing-end')).toBeTruthy()
      expect(wrapper.emitted('editing-end')).toHaveLength(1)
    })

    it('should emit editing-end when clicking save button', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').setValue('New Value')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.emitted('editing-end')).toBeTruthy()
      expect(wrapper.emitted('editing-end')).toHaveLength(1)
    })

    it('should emit editing-end when input loses focus', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        },
        attachTo: document.body
      })
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').trigger('blur', { relatedTarget: null })

      expect(wrapper.emitted('editing-end')).toBeTruthy()
      expect(wrapper.emitted('editing-end')).toHaveLength(1)
    })
  })

  describe('Blur Behavior', () => {
    it('should cancel editing when input loses focus', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        },
        attachTo: document.body
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('Changed Value')

      // Simulate blur with no related target (clicking outside)
      await input.trigger('blur', { relatedTarget: null })

      expect(wrapper.emitted('save')).toBeFalsy()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
      expect(wrapper.find('span').exists()).toBe(true)
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('should not cancel editing when clicking save button', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        },
        attachTo: document.body
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')
      await input.setValue('New Value')

      // Simulate blur with relatedTarget being the save button
      const saveBtn = wrapper.find('.save-btn').element
      await input.trigger('blur', { relatedTarget: saveBtn })

      // Should still be in editing mode
      expect(wrapper.find('input').exists()).toBe(true)
    })

    it('should not cancel editing when clicking cancel button', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        },
        attachTo: document.body
      })
      await wrapper.find('span').trigger('dblclick')
      const input = wrapper.find('input')

      // Simulate blur with relatedTarget being the cancel button
      const cancelBtn = wrapper.find('.cancel-btn').element
      await input.trigger('blur', { relatedTarget: cancelBtn })

      // Should still be in editing mode (cancel button click will handle it)
      expect(wrapper.find('input').exists()).toBe(true)
    })
  })

  describe('Multiple Edit Sessions', () => {
    it('should handle multiple edit and cancel cycles', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })

      // First edit cycle - cancel
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').setValue('Changed')
      await wrapper.find('input').trigger('keydown.esc')
      expect(wrapper.find('span').exists()).toBe(true)

      // Second edit cycle - save
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').setValue('New Value')
      await wrapper.find('input').trigger('keydown.enter')
      expect(wrapper.emitted('save')[0]).toEqual(['New Value'])
    })

    it('should reset input value on each edit session', async () => {
      wrapper = mount(InlineEdit, {
        props: {
          modelValue: 'Original'
        }
      })

      // First edit - change but cancel
      await wrapper.find('span').trigger('dblclick')
      await wrapper.find('input').setValue('Temporary')
      await wrapper.find('input').trigger('keydown.esc')

      // Second edit - should start with original value
      await wrapper.find('span').trigger('dblclick')
      expect(wrapper.find('input').element.value).toBe('Original')
    })
  })
})
