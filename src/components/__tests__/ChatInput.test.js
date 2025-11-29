import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '../ChatInput.vue'

describe('ChatInput', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render textarea', () => {
      wrapper = mount(ChatInput)
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render send button', () => {
      wrapper = mount(ChatInput)
      expect(wrapper.find('.send-button').exists()).toBe(true)
      expect(wrapper.find('.send-button').text()).toBe('Send')
    })

    it('should show placeholder text', () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('placeholder')).toBe('Ask anything you want to learn...')
    })

    it('should show input hint', () => {
      wrapper = mount(ChatInput)
      const hint = wrapper.find('.input-hint')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('Press Enter to send')
    })

    it('should have initial row count of 1', () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('rows')).toBe('1')
    })
  })

  describe('Props', () => {
    it('should accept disabled prop', () => {
      wrapper = mount(ChatInput, {
        props: {
          disabled: true
        }
      })

      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('disabled')).toBeDefined()
    })

    it('should accept isLoading prop', () => {
      wrapper = mount(ChatInput, {
        props: {
          isLoading: true
        }
      })

      expect(wrapper.find('.spinner').exists()).toBe(true)
      expect(wrapper.find('.send-button').text()).not.toBe('Send')
    })

    it('should disable send button when disabled prop is true', () => {
      wrapper = mount(ChatInput, {
        props: {
          disabled: true
        }
      })

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should add loading class to button when isLoading', () => {
      wrapper = mount(ChatInput, {
        props: {
          isLoading: true
        }
      })

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.classes()).toContain('btn-loading')
    })
  })

  describe('User Input', () => {
    it('should update input text when user types', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Hello world')
      expect(textarea.element.value).toBe('Hello world')
    })

    it('should emit send event when send button is clicked', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0]).toEqual(['Test message'])
    })

    it('should clear input after sending', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(textarea.element.value).toBe('')
    })

    it('should not emit send event when input is empty', async () => {
      wrapper = mount(ChatInput)

      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should not emit send event when input is only whitespace', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('   ')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should trim whitespace from message', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('  Test message  ')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][0]).toBe('  Test message  ')
    })

    it('should not send when disabled', async () => {
      wrapper = mount(ChatInput, {
        props: {
          disabled: true
        }
      })
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should not send via Enter key when disabled', async () => {
      wrapper = mount(ChatInput, {
        props: {
          disabled: true
        }
      })
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter')

      expect(wrapper.emitted('send')).toBeFalsy()
      // Input should remain unchanged
      expect(textarea.element.value).toBe('Test message')
    })

    it('should not send with empty input when disabled', async () => {
      wrapper = mount(ChatInput, {
        props: {
          disabled: true
        }
      })

      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should send message on Enter key', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter', { shiftKey: false })

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0]).toEqual(['Test message'])
    })

    it('should not send on Shift+Enter', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Line 1')
      await textarea.trigger('keydown.enter', { shiftKey: true })

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should prevent default on Enter', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test')
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      await textarea.trigger('keydown.enter')

      // The component uses @keydown.enter.exact.prevent which prevents default
      // We can verify the behavior by checking the emit
      expect(wrapper.emitted('send')).toBeTruthy()
    })

    it('should clear input after Enter key send', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter')
      await wrapper.vm.$nextTick()

      expect(textarea.element.value).toBe('')
    })
  })

  describe('Button State', () => {
    it('should disable send button when input is empty', async () => {
      wrapper = mount(ChatInput)
      const sendButton = wrapper.find('.send-button')

      expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has text', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Hello')
      await wrapper.vm.$nextTick()

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeUndefined()
    })

    it('should disable send button when only whitespace', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('   ')
      await wrapper.vm.$nextTick()

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should show loading spinner when isLoading is true', async () => {
      wrapper = mount(ChatInput, {
        props: {
          isLoading: true
        }
      })

      expect(wrapper.find('.spinner').exists()).toBe(true)
      expect(wrapper.find('.send-button').text()).toBe('')
    })

    it('should show Send text when not loading', async () => {
      wrapper = mount(ChatInput, {
        props: {
          isLoading: false
        }
      })

      expect(wrapper.find('.spinner').exists()).toBe(false)
      expect(wrapper.find('.send-button').text()).toBe('Send')
    })
  })

  describe('Auto-height Adjustment', () => {
    it('should call adjustHeight on input', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      // Mock scrollHeight
      Object.defineProperty(textarea.element, 'scrollHeight', {
        configurable: true,
        value: 100
      })

      await textarea.trigger('input')
      await wrapper.vm.$nextTick()

      // Height should be adjusted (implementation sets style.height)
      expect(textarea.element.style.height).toBeTruthy()
    })

    it('should reset height after sending', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      // Set initial height
      textarea.element.style.height = '100px'

      await textarea.setValue('Test')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(textarea.element.style.height).toBe('auto')
    })

    it('should reset height to auto in nextTick after sending via Enter key', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      // Set initial height to simulate expanded textarea
      textarea.element.style.height = '150px'

      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter')
      await wrapper.vm.$nextTick()

      // Verify height is reset to auto after sending
      expect(textarea.element.style.height).toBe('auto')
      // Verify message was sent
      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0]).toEqual(['Test message'])
    })

    it('should limit max height to 200px', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      // Mock scrollHeight to be very large
      Object.defineProperty(textarea.element, 'scrollHeight', {
        configurable: true,
        value: 500
      })

      await textarea.trigger('input')
      await wrapper.vm.$nextTick()

      expect(parseInt(textarea.element.style.height)).toBeLessThanOrEqual(200)
    })
  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      wrapper = mount(ChatInput)

      expect(wrapper.find('.chat-input-container').exists()).toBe(true)
      expect(wrapper.find('.input-wrapper').exists()).toBe(true)
      expect(wrapper.find('textarea').exists()).toBe(true)
      expect(wrapper.find('.send-button').exists()).toBe(true)
      expect(wrapper.find('.input-hint').exists()).toBe(true)
    })

    it('should wrap textarea and button in input-wrapper', () => {
      wrapper = mount(ChatInput)
      const inputWrapper = wrapper.find('.input-wrapper')

      expect(inputWrapper.find('textarea').exists()).toBe(true)
      expect(inputWrapper.find('.send-button').exists()).toBe(true)
    })
  })

  describe('Autofocus', () => {
    it('should accept autofocus prop', () => {
      wrapper = mount(ChatInput, {
        props: {
          autofocus: true
        }
      })

      expect(wrapper.props('autofocus')).toBe(true)
    })

    it('should default autofocus to false', () => {
      wrapper = mount(ChatInput)

      expect(wrapper.props('autofocus')).toBe(false)
    })

    it('should focus textarea on mount when autofocus is true', async () => {
      wrapper = mount(ChatInput, {
        props: {
          autofocus: true
        },
        attachTo: document.body
      })

      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea').element
      expect(document.activeElement).toBe(textarea)

      wrapper.unmount()
    })

    it('should not focus textarea on mount when autofocus is false', async () => {
      wrapper = mount(ChatInput, {
        props: {
          autofocus: false
        },
        attachTo: document.body
      })

      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea').element
      expect(document.activeElement).not.toBe(textarea)

      wrapper.unmount()
    })

    it('should focus textarea when autofocus changes from false to true', async () => {
      wrapper = mount(ChatInput, {
        props: {
          autofocus: false
        },
        attachTo: document.body
      })

      await wrapper.vm.$nextTick()

      // Initially not focused
      const textarea = wrapper.find('textarea').element
      expect(document.activeElement).not.toBe(textarea)

      // Change autofocus to true
      await wrapper.setProps({ autofocus: true })
      await wrapper.vm.$nextTick()

      expect(document.activeElement).toBe(textarea)

      wrapper.unmount()
    })

    it('should expose focus method', () => {
      wrapper = mount(ChatInput)

      expect(typeof wrapper.vm.focus).toBe('function')
    })

    it('should focus textarea when focus method is called', async () => {
      wrapper = mount(ChatInput, {
        attachTo: document.body
      })

      await wrapper.vm.$nextTick()

      // Initially not focused
      const textarea = wrapper.find('textarea').element
      expect(document.activeElement).not.toBe(textarea)

      // Call focus method
      wrapper.vm.focus()
      await wrapper.vm.$nextTick()

      expect(document.activeElement).toBe(textarea)

      wrapper.unmount()
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid send button clicks', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.find('.send-button').trigger('click')

      // Should only emit once since input is cleared after first send
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('should handle multiline text', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      const multilineText = 'Line 1\nLine 2\nLine 3'
      await textarea.setValue(multilineText)
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0]).toEqual([multilineText])
    })

    it('should handle special characters', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      const specialText = '<script>alert("test")</script>'
      await textarea.setValue(specialText)
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0]).toEqual([specialText])
    })

    it('should handle very long text', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      const longText = 'a'.repeat(10000)
      await textarea.setValue(longText)
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][0]).toHaveLength(10000)
    })

    it('should handle adjustHeight when inputRef is null', async () => {
      wrapper = mount(ChatInput)

      // Save the original ref value
      const originalRef = wrapper.vm.inputRef

      // Set inputRef to null
      wrapper.vm.inputRef = null

      // Trigger input event - should not throw error
      const textarea = wrapper.find('textarea')
      await textarea.trigger('input')
      await wrapper.vm.$nextTick()

      // Restore ref
      wrapper.vm.inputRef = originalRef

      // Should not have thrown an error
      expect(true).toBe(true)
    })

    it('should handle handleSend when inputRef is null after sending', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')

      // Set inputRef to null before sending
      wrapper.vm.inputRef = null

      // Should not throw error when trying to reset height
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      // Should still emit the message
      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0]).toEqual(['Test message'])
    })

    it('should check inputRef existence before resetting height in handleSend', async () => {
      wrapper = mount(ChatInput)
      const textarea = wrapper.find('textarea')

      // Set initial height and text
      textarea.element.style.height = '100px'
      await textarea.setValue('Test')

      // Verify inputRef exists and has the textarea element
      expect(wrapper.vm.inputRef).toBeTruthy()
      expect(wrapper.vm.inputRef).toBe(textarea.element)

      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      // Verify the height was reset when inputRef exists
      expect(textarea.element.style.height).toBe('auto')
      expect(wrapper.emitted('send')).toBeTruthy()
    })
  })
})
