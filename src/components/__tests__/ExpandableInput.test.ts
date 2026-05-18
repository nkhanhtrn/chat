import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ExpandableInput from '../ExpandableInput.vue'

function mountInput(props = {}) {
  return mount(ExpandableInput, {
    props: {
      modelValue: '',
      ...props,
    },
    attachTo: document.body,
  })
}

describe('ExpandableInput', () => {
  describe('rendering', () => {
    it('renders a textarea and expand button', () => {
      const wrapper = mountInput()
      expect(wrapper.find('textarea').exists()).toBe(true)
      expect(wrapper.find('button.expand-btn').exists()).toBe(true)
    })

    it('shows send button when not streaming', () => {
      const wrapper = mountInput()
      expect(wrapper.find('.send-btn').exists()).toBe(true)
      expect(wrapper.find('.stop-btn').exists()).toBe(false)
    })

    it('shows stop button when streaming', () => {
      const wrapper = mountInput({ isStreaming: true })
      expect(wrapper.find('.stop-btn').exists()).toBe(true)
      expect(wrapper.find('.send-btn').exists()).toBe(false)
    })

    it('disables textarea when disabled prop is true', () => {
      const wrapper = mountInput({ disabled: true })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('disables textarea when streaming', () => {
      const wrapper = mountInput({ isStreaming: true })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('send button is disabled when input is empty', () => {
      const wrapper = mountInput()
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('send button is enabled when input has text', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeUndefined()
    })

    it('does not have expanded class by default', () => {
      const wrapper = mountInput()
      expect(wrapper.find('.input-box').classes()).not.toContain('expanded')
    })
  })

  describe('v-model', () => {
    it('emits update:modelValue on input', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('hello')
      expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['hello'])
    })

    it('reflects modelValue in textarea', () => {
      const wrapper = mountInput({ modelValue: 'existing text' })
      expect(wrapper.find('textarea').element.value).toBe('existing text')
    })
  })

  describe('send behavior (collapsed)', () => {
    it('emits send on Enter key without modifiers', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
      })
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('does not emit send on Shift+Enter', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
        shiftKey: true,
      })
      expect(wrapper.emitted('send')).toBeUndefined()
    })

    it('does not emit send on Ctrl+Enter when collapsed', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
        ctrlKey: true,
      })
      expect(wrapper.emitted('send')).toBeUndefined()
    })

    it('does not emit send on non-Enter keys', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown', { key: 'a' })
      await wrapper.find('textarea').trigger('keydown', { key: ' ' })
      expect(wrapper.emitted('send')).toBeUndefined()
    })

    it('emits send on send button click', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('.send-btn').trigger('click')
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('does not emit send on click when input is empty', async () => {
      const wrapper = mountInput()
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })
  })

  describe('send behavior (expanded)', () => {
    async function mountExpanded() {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('.expand-btn').trigger('click')
      return wrapper
    }

    it('adds expanded class on toggle', async () => {
      const wrapper = await mountExpanded()
      expect(wrapper.find('.input-box').classes()).toContain('expanded')
    })

    it('removes expanded class on second toggle', async () => {
      const wrapper = await mountExpanded()
      await wrapper.find('.expand-btn').trigger('click')
      expect(wrapper.find('.input-box').classes()).not.toContain('expanded')
    })

    it('Enter creates newline (does not send) when expanded', async () => {
      const wrapper = await mountExpanded()
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
      })
      expect(wrapper.emitted('send')).toBeUndefined()
    })

    it('emits send on Ctrl+Enter when expanded', async () => {
      const wrapper = await mountExpanded()
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
        ctrlKey: true,
      })
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('emits send on Cmd+Enter when expanded', async () => {
      const wrapper = await mountExpanded()
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
        metaKey: true,
      })
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('does not emit send on Ctrl+Shift+Enter when expanded', async () => {
      const wrapper = await mountExpanded()
      await wrapper.find('textarea').trigger('keydown', {
        key: 'Enter',
        ctrlKey: true,
        shiftKey: true,
      })
      expect(wrapper.emitted('send')).toBeUndefined()
    })
  })

  describe('stop behavior', () => {
    it('emits stop on stop button click', async () => {
      const wrapper = mountInput({ isStreaming: true })
      await wrapper.find('.stop-btn').trigger('click')
      expect(wrapper.emitted('stop')).toHaveLength(1)
    })
  })

  describe('exposed methods', () => {
    it('exposes resetHeight method', () => {
      const wrapper = mountInput()
      expect(typeof (wrapper.vm as any).resetHeight).toBe('function')
    })

    it('exposes inputRef', () => {
      const wrapper = mountInput()
      expect((wrapper.vm as any).inputRef).toBeDefined()
    })
  })

  describe('slots', () => {
    it('renders before-send slot content', () => {
      const wrapper = mount(ExpandableInput, {
        props: { modelValue: '' },
        slots: {
          'before-send': '<button class="custom-btn">Custom</button>',
        },
      })
      expect(wrapper.find('.custom-btn').exists()).toBe(true)
    })
  })
})
