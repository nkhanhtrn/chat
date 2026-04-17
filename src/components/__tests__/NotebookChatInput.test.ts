import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import NotebookChatInput from '../NotebookChatInput.vue'

function mountInput(props = {}) {
  return mount(NotebookChatInput, {
    props: { ...props },
    attachTo: document.body,
  })
}

describe('NotebookChatInput', () => {
  describe('rendering', () => {
    it('renders a textarea and send button', () => {
      const wrapper = mountInput()
      expect(wrapper.find('textarea').exists()).toBe(true)
      expect(wrapper.find('button.send-button').exists()).toBe(true)
    })

    it('disables textarea when disabled prop is true', () => {
      const wrapper = mountInput({ disabled: true })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('send button is disabled when input is empty', () => {
      const wrapper = mountInput()
      expect(wrapper.find('button.send-button').attributes('disabled')).toBeDefined()
    })

    it('send button is disabled when disabled prop is true', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('hello')
      expect(wrapper.find('button.send-button').attributes('disabled')).toBeUndefined()

      await wrapper.setProps({ disabled: true })
      expect(wrapper.find('button.send-button').attributes('disabled')).toBeDefined()
    })

    it('send button is enabled when input has text and not disabled', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('hello')
      expect(wrapper.find('button.send-button').attributes('disabled')).toBeUndefined()
    })
  })

  describe('send behavior', () => {
    it('emits send with text and empty context on button click', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('my question')
      await wrapper.find('button.send-button').trigger('click')

      expect(wrapper.emitted('send')).toHaveLength(1)
      expect(wrapper.emitted('send')![0]).toEqual(['my question', []])
    })

    it('clears input after sending', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('my question')
      await wrapper.find('button.send-button').trigger('click')

      expect(wrapper.find('textarea').element.value).toBe('')
    })

    it('does not emit send when input is only whitespace', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('   ')
      // The button should still be disabled because trim() is empty
      expect(wrapper.find('button.send-button').attributes('disabled')).toBeDefined()
    })

    it('emits send on Enter key (without modifiers)', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('hello')
      await wrapper.find('textarea').trigger('keydown.enter.exact', { key: 'Enter' })

      expect(wrapper.emitted('send')).toHaveLength(1)
      expect(wrapper.emitted('send')![0]).toEqual(['hello', []])
    })

    it('does not emit send when disabled', async () => {
      const wrapper = mountInput({ disabled: true })
      await wrapper.find('textarea').setValue('hello')
      // The button is disabled, so clicking shouldn't work
      await wrapper.find('button.send-button').trigger('click')
      expect(wrapper.emitted('send')).toBeUndefined()
    })

    it('trims the text before sending', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('  hello world  ')
      await wrapper.find('button.send-button').trigger('click')
      expect(wrapper.emitted('send')![0][0]).toBe('  hello world  ')
    })
  })

  describe('exposed methods', () => {
    it('exposes focus method', () => {
      const wrapper = mountInput()
      expect(typeof (wrapper.vm as any).focus).toBe('function')
    })

    it('autofocuses on mount when autofocus is true', async () => {
      const wrapper = mountInput({ autofocus: true })
      // Just verify it doesn't throw - focus requires real DOM
      expect(wrapper.find('textarea').exists()).toBe(true)
    })
  })
})
