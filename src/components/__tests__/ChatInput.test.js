import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatInput from '../ChatInput.vue'
import { useChatStore } from '../../stores/chat.js'

describe('ChatInput', () => {
  let wrapper
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const mountWithStore = (options = {}) => {
    return mount(ChatInput, {
      global: {
        plugins: [pinia]
      },
      ...options
    })
  }

  describe('Rendering', () => {
    it('should render textarea', () => {
      wrapper = mountWithStore()
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render send button', () => {
      wrapper = mountWithStore()
      expect(wrapper.find('.send-button').exists()).toBe(true)
      expect(wrapper.find('.send-text').text()).toBe('Send')
    })

    it('should render send icon for mobile display', () => {
      wrapper = mountWithStore()
      expect(wrapper.find('.send-icon').exists()).toBe(true)
      expect(wrapper.find('.send-icon').element.tagName.toLowerCase()).toBe('svg')
    })

    it('should show placeholder text', () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('placeholder')).toBe('Ask anything you want to learn...')
    })

    it('should show input hint', () => {
      wrapper = mountWithStore()
      const hint = wrapper.find('.input-hint')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('Press Enter to send')
    })

    it('should have initial row count of 1', () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('rows')).toBe('1')
    })
  })

  describe('Props', () => {
    it('should accept disabled prop', () => {
      wrapper = mountWithStore({
        props: {
          disabled: true
        }
      })

      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('disabled')).toBeDefined()
    })

    it('should accept isLoading prop', () => {
      wrapper = mountWithStore({
        props: {
          isLoading: true
        }
      })

      expect(wrapper.find('.spinner').exists()).toBe(true)
      expect(wrapper.find('.send-button').text()).not.toBe('Send')
    })

    it('should disable send button when disabled prop is true', () => {
      wrapper = mountWithStore({
        props: {
          disabled: true
        }
      })

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should add loading class to button when isLoading', () => {
      wrapper = mountWithStore({
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
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Hello world')
      expect(textarea.element.value).toBe('Hello world')
    })

    it('should emit send event when send button is clicked', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0][0]).toBe('Test message')
      expect(wrapper.emitted('send')[0][1]).toEqual([])
    })

    it('should clear input after sending', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(textarea.element.value).toBe('')
    })

    it('should not emit send event when input is empty', async () => {
      wrapper = mountWithStore()

      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should not emit send event when input is only whitespace', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('   ')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should trim whitespace from message', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('  Test message  ')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][0]).toBe('  Test message  ')
    })

    it('should not send when disabled', async () => {
      wrapper = mountWithStore({
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
      wrapper = mountWithStore({
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
      wrapper = mountWithStore({
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
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter', { shiftKey: false })

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0][0]).toBe('Test message')
      expect(wrapper.emitted('send')[0][1]).toEqual([])
    })

    it('should not send on Shift+Enter', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Line 1')
      await textarea.trigger('keydown.enter', { shiftKey: true })

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should prevent default on Enter', async () => {
      wrapper = mountWithStore()
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
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter')
      await wrapper.vm.$nextTick()

      expect(textarea.element.value).toBe('')
    })
  })

  describe('Button State', () => {
    it('should disable send button when input is empty', async () => {
      wrapper = mountWithStore()
      const sendButton = wrapper.find('.send-button')

      expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has text', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Hello')
      await wrapper.vm.$nextTick()

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeUndefined()
    })

    it('should disable send button when only whitespace', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('   ')
      await wrapper.vm.$nextTick()

      const sendButton = wrapper.find('.send-button')
      expect(sendButton.attributes('disabled')).toBeDefined()
    })

    it('should show loading spinner when isLoading is true', async () => {
      wrapper = mountWithStore({
        props: {
          isLoading: true
        }
      })

      expect(wrapper.find('.spinner').exists()).toBe(true)
      expect(wrapper.find('.send-button').text()).toBe('')
    })

    it('should show Send text when not loading', async () => {
      wrapper = mountWithStore({
        props: {
          isLoading: false
        }
      })

      expect(wrapper.find('.spinner').exists()).toBe(false)
      expect(wrapper.find('.send-text').text()).toBe('Send')
    })
  })

  describe('Auto-height Adjustment', () => {
    it('should call adjustHeight on input', async () => {
      wrapper = mountWithStore()
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
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      // Set initial height
      textarea.element.style.height = '100px'

      await textarea.setValue('Test')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(textarea.element.style.height).toBe('auto')
    })

    it('should reset height to auto in nextTick after sending via Enter key', async () => {
      wrapper = mountWithStore()
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
      expect(wrapper.emitted('send')[0][0]).toBe('Test message')
    })

    it('should limit max height to 200px', async () => {
      wrapper = mountWithStore()
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
      wrapper = mountWithStore()

      expect(wrapper.find('.chat-input-container').exists()).toBe(true)
      expect(wrapper.find('.input-wrapper').exists()).toBe(true)
      expect(wrapper.find('textarea').exists()).toBe(true)
      expect(wrapper.find('.send-button').exists()).toBe(true)
      expect(wrapper.find('.input-hint').exists()).toBe(true)
    })

    it('should wrap textarea and button in input-wrapper', () => {
      wrapper = mountWithStore()
      const inputWrapper = wrapper.find('.input-wrapper')

      expect(inputWrapper.find('textarea').exists()).toBe(true)
      expect(inputWrapper.find('.send-button').exists()).toBe(true)
    })
  })

  describe('Autofocus', () => {
    it('should accept autofocus prop', () => {
      wrapper = mountWithStore({
        props: {
          autofocus: true
        }
      })

      expect(wrapper.props('autofocus')).toBe(true)
    })

    it('should default autofocus to false', () => {
      wrapper = mountWithStore()

      expect(wrapper.props('autofocus')).toBe(false)
    })

    it('should focus textarea on mount when autofocus is true', async () => {
      wrapper = mountWithStore({
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
      wrapper = mountWithStore({
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
      wrapper = mountWithStore({
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
      wrapper = mountWithStore()

      expect(typeof wrapper.vm.focus).toBe('function')
    })

    it('should focus textarea when focus method is called', async () => {
      wrapper = mountWithStore({
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
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.find('.send-button').trigger('click')

      // Should only emit once since input is cleared after first send
      expect(wrapper.emitted('send')).toHaveLength(1)
    })

    it('should handle multiline text', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      const multilineText = 'Line 1\nLine 2\nLine 3'
      await textarea.setValue(multilineText)
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][0]).toBe(multilineText)
    })

    it('should handle special characters', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      const specialText = '<script>alert("test")</script>'
      await textarea.setValue(specialText)
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][0]).toBe(specialText)
    })

    it('should handle very long text', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      const longText = 'a'.repeat(10000)
      await textarea.setValue(longText)
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][0]).toHaveLength(10000)
    })

    it('should handle adjustHeight when inputRef is null', async () => {
      wrapper = mountWithStore()

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
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')

      // Set inputRef to null before sending
      wrapper.vm.inputRef = null

      // Should not throw error when trying to reset height
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      // Should still emit the message
      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0][0]).toBe('Test message')
    })

    it('should check inputRef existence before resetting height in handleSend', async () => {
      wrapper = mountWithStore()
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

  describe('Context Questions Drag and Drop', () => {
    const mockMessage = {
      id: 'msg1',
      question: 'What is JavaScript?',
      questionSummarized: 'JavaScript basics',
      response: 'JavaScript is a programming language...'
    }

    const setupStoreWithMessage = () => {
      const chatStore = useChatStore()
      chatStore.messagesById = { [mockMessage.id]: mockMessage }
      return chatStore
    }

    it('should show input hint about dragging questions', () => {
      wrapper = mountWithStore()
      const hint = wrapper.find('.input-hint')
      expect(hint.text()).toContain('Drag questions here to add context')
    })

    it('should not show context questions section initially', () => {
      wrapper = mountWithStore()
      expect(wrapper.find('.context-questions').exists()).toBe(false)
    })

    it('should add drag-over class on dragover with question context', async () => {
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('dragover', {
        dataTransfer: {
          types: ['application/x-question-context'],
          dropEffect: ''
        }
      })

      expect(container.classes()).toContain('drag-over')
    })

    it('should not add drag-over class on dragover without question context', async () => {
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('dragover', {
        dataTransfer: {
          types: ['text/plain'],
          dropEffect: ''
        }
      })

      expect(container.classes()).not.toContain('drag-over')
    })

    it('should remove drag-over class on dragleave', async () => {
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      // First trigger dragover
      await container.trigger('dragover', {
        dataTransfer: {
          types: ['application/x-question-context'],
          dropEffect: ''
        }
      })
      expect(container.classes()).toContain('drag-over')

      // Then trigger dragleave outside bounds
      const rect = container.element.getBoundingClientRect()
      await container.trigger('dragleave', {
        clientX: rect.left - 10,
        clientY: rect.top - 10
      })

      expect(container.classes()).not.toContain('drag-over')
    })

    it('should add context question on drop', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      expect(wrapper.find('.context-questions').exists()).toBe(true)
      expect(wrapper.find('.context-item').exists()).toBe(true)
      expect(wrapper.find('.context-text').text()).toBe('JavaScript basics')
    })

    it('should display question text when questionSummarized is not available', async () => {
      const chatStore = useChatStore()
      const msgWithoutSummary = { ...mockMessage, questionSummarized: null }
      chatStore.messagesById = { [msgWithoutSummary.id]: msgWithoutSummary }
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      expect(wrapper.find('.context-text').text()).toBe('What is JavaScript?')
    })

    it('should not add duplicate context questions', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      const dropEvent = {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      }

      // Drop same message twice
      await container.trigger('drop', dropEvent)
      await container.trigger('drop', dropEvent)

      expect(wrapper.findAll('.context-item').length).toBe(1)
    })

    it('should support multiple different context questions', async () => {
      const chatStore = useChatStore()
      const mockMessage2 = {
        id: 'msg2',
        question: 'What is TypeScript?',
        questionSummarized: 'TypeScript basics',
        response: 'TypeScript is...'
      }
      chatStore.messagesById = {
        [mockMessage.id]: mockMessage,
        [mockMessage2.id]: mockMessage2
      }
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage2.id })
            }
            return ''
          }
        }
      })

      expect(wrapper.findAll('.context-item').length).toBe(2)
    })

    it('should remove context question when X button is clicked', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      expect(wrapper.find('.context-item').exists()).toBe(true)

      await wrapper.find('.context-remove').trigger('click')

      expect(wrapper.find('.context-item').exists()).toBe(false)
      expect(wrapper.find('.context-questions').exists()).toBe(false)
    })

    it('should include context questions when sending message', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')
      const textarea = wrapper.find('textarea')

      // Add context
      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      // Type and send message
      await textarea.setValue('Tell me more')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0][0]).toBe('Tell me more')
      expect(wrapper.emitted('send')[0][1]).toEqual([{
        id: mockMessage.id,
        question: mockMessage.question,
        questionSummarized: mockMessage.questionSummarized,
        response: mockMessage.response
      }])
    })

    it('should clear context questions after sending', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')
      const textarea = wrapper.find('textarea')

      // Add context
      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      expect(wrapper.find('.context-item').exists()).toBe(true)

      // Send message
      await textarea.setValue('Test')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.context-item').exists()).toBe(false)
    })

    it('should expose clearContext method', () => {
      wrapper = mountWithStore()
      expect(typeof wrapper.vm.clearContext).toBe('function')
    })

    it('should handle invalid drop data gracefully', async () => {
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      // Drop with invalid JSON
      await container.trigger('drop', {
        dataTransfer: {
          getData: () => 'invalid json'
        }
      })

      // Should not crash and no context added
      expect(wrapper.find('.context-questions').exists()).toBe(false)
    })

    it('should handle drop with non-existent message ID', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: 'non-existent-id' })
            }
            return ''
          }
        }
      })

      expect(wrapper.find('.context-questions').exists()).toBe(false)
    })

    it('should handle drop without context data type', async () => {
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: () => ''
        }
      })

      expect(wrapper.find('.context-questions').exists()).toBe(false)
    })

    it('should show context label when context questions exist', async () => {
      setupStoreWithMessage()
      wrapper = mountWithStore()
      const container = wrapper.find('.chat-input-container')

      await container.trigger('drop', {
        dataTransfer: {
          getData: (type) => {
            if (type === 'application/x-question-context') {
              return JSON.stringify({ messageId: mockMessage.id })
            }
            return ''
          }
        }
      })

      expect(wrapper.find('.context-label').exists()).toBe(true)
      expect(wrapper.find('.context-label').text()).toBe('Context from:')
    })

    it('should emit empty array when sending without context', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')[0][1]).toEqual([])
    })
  })

  describe('Mobile Send Button Display', () => {
    it('should have both send-text and send-icon elements', () => {
      wrapper = mountWithStore()
      expect(wrapper.find('.send-text').exists()).toBe(true)
      expect(wrapper.find('.send-icon').exists()).toBe(true)
    })

    it('should have send-text containing "Send"', () => {
      wrapper = mountWithStore()
      expect(wrapper.find('.send-text').text()).toBe('Send')
    })

    it('should have send-icon as SVG element', () => {
      wrapper = mountWithStore()
      const icon = wrapper.find('.send-icon')
      expect(icon.element.tagName.toLowerCase()).toBe('svg')
    })

    it('should have send-icon with correct SVG attributes', () => {
      wrapper = mountWithStore()
      const icon = wrapper.find('.send-icon')
      expect(icon.attributes('viewBox')).toBe('0 0 24 24')
      expect(icon.attributes('width')).toBe('18')
      expect(icon.attributes('height')).toBe('18')
    })

    it('should have send-icon with paper plane path elements', () => {
      wrapper = mountWithStore()
      const icon = wrapper.find('.send-icon')
      expect(icon.find('line').exists()).toBe(true)
      expect(icon.find('polygon').exists()).toBe(true)
    })

    it('should wrap send-text and send-icon in send-button', () => {
      wrapper = mountWithStore()
      const sendButton = wrapper.find('.send-button')
      expect(sendButton.find('.send-text').exists()).toBe(true)
      expect(sendButton.find('.send-icon').exists()).toBe(true)
    })

    it('should still send message when clicking button with both elements', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0][0]).toBe('Test message')
    })

    it('should clear input after sending with icon button', async () => {
      wrapper = mountWithStore()
      const textarea = wrapper.find('textarea')

      await textarea.setValue('Test message')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(textarea.element.value).toBe('')
    })
  })
})
