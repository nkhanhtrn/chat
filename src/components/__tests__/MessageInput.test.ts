import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageInput from '../project/MessageInput.vue'

function mountInput(props = {}) {
  return mount(MessageInput, {
    props: { modelValue: '', ...props },
    attachTo: document.body,
  })
}

describe('MessageInput', () => {
  describe('rendering', () => {
    it('renders a textarea', () => {
      const wrapper = mountInput()
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('disables textarea when isStreaming is true', () => {
      const wrapper = mountInput({ isStreaming: true })
      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('shows stop button when streaming', () => {
      const wrapper = mountInput({ isStreaming: true })
      expect(wrapper.find('.stop-btn').exists()).toBe(true)
      expect(wrapper.find('.send-btn').exists()).toBe(false)
    })

    it('shows send button when not streaming', () => {
      const wrapper = mountInput()
      expect(wrapper.find('.send-btn').exists()).toBe(true)
      expect(wrapper.find('.stop-btn').exists()).toBe(false)
    })

    it('send button is disabled when input is empty', () => {
      const wrapper = mountInput()
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('send button is enabled when input has text', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      expect(wrapper.find('.send-btn').attributes('disabled')).toBeUndefined()
    })

    it('shows clear button when messages are not empty', () => {
      const wrapper = mountInput({ messagesEmpty: false })
      expect(wrapper.find('.clear-btn').exists()).toBe(true)
    })

    it('hides clear button when messages are empty', () => {
      const wrapper = mountInput({ messagesEmpty: true })
      expect(wrapper.find('.clear-btn').exists()).toBe(false)
    })
  })

  describe('keyboard shortcuts', () => {
    it('emits send on Ctrl+Enter', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown.enter', {
        key: 'Enter',
        ctrlKey: true,
      })
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('emits send on Meta+Enter (Cmd+Enter)', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown.enter', {
        key: 'Enter',
        metaKey: true,
      })
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('does not emit send on bare Enter', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown.enter', {
        key: 'Enter',
      })
      expect(wrapper.emitted('send')).toBeUndefined()
    })

    it('does not emit send on Shift+Enter', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('textarea').trigger('keydown.enter', {
        key: 'Enter',
        shiftKey: true,
      })
      expect(wrapper.emitted('send')).toBeUndefined()
    })
  })

  describe('send button', () => {
    it('emits send on click', async () => {
      const wrapper = mountInput({ modelValue: 'hello' })
      await wrapper.find('.send-btn').trigger('click')
      expect(wrapper.emitted('send')).toHaveLength(1)
    })
  })

  describe('stop button', () => {
    it('emits stop on click', async () => {
      const wrapper = mountInput({ isStreaming: true })
      await wrapper.find('.stop-btn').trigger('click')
      expect(wrapper.emitted('stop')).toHaveLength(1)
    })
  })

  describe('clear button', () => {
    it('emits clear on click', async () => {
      const wrapper = mountInput({ messagesEmpty: false })
      await wrapper.find('.clear-btn').trigger('click')
      expect(wrapper.emitted('clear')).toHaveLength(1)
    })
  })

  describe('input', () => {
    it('emits update:modelValue on input', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').setValue('typed text')
      expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['typed text'])
    })
  })

  describe('paste snippets', () => {
    it('creates a paste chip for long pastes', async () => {
      const wrapper = mountInput()
      const longText = 'x'.repeat(400)
      await wrapper.find('textarea').trigger('paste', {
        clipboardData: { getData: () => longText },
      })
      expect(wrapper.find('.paste-chip').exists()).toBe(true)
    })

    it('does not create a paste chip for short pastes', async () => {
      const wrapper = mountInput()
      await wrapper.find('textarea').trigger('paste', {
        clipboardData: { getData: () => 'short text' },
      })
      expect(wrapper.find('.paste-chip').exists()).toBe(false)
    })

    it('removes snippet on click remove button', async () => {
      const wrapper = mountInput()
      const longText = 'x'.repeat(400)
      await wrapper.find('textarea').trigger('paste', {
        clipboardData: { getData: () => longText },
      })
      expect(wrapper.findAll('.paste-chip')).toHaveLength(1)

      await wrapper.find('.paste-remove').trigger('click')
      expect(wrapper.findAll('.paste-chip')).toHaveLength(0)
    })
  })
})
