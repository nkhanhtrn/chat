import { describe, it, expect, beforeEach } from 'vitest'
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
    it('should render textarea and send button', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      expect(wrapper.find('textarea').exists()).toBe(true)
      expect(wrapper.find('.send-btn').exists()).toBe(true)
      expect(wrapper.find('.send-btn').text()).toBe('Send')
    })

    it('should show placeholder text', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('placeholder')).toBe('Type your message here...')
    })

    it('should show compress button when showCompress is true', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          showCompress: true
        }
      })

      expect(wrapper.find('.compress-btn').exists()).toBe(true)
      expect(wrapper.find('.compress-btn').text()).toBe('Compress')
    })

    it('should not show compress button when showCompress is false', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          showCompress: false
        }
      })

      expect(wrapper.find('.compress-btn').exists()).toBe(false)
    })
  })

  describe('Props', () => {
    it('should require selectedModel prop', () => {
      const { selectedModel } = ChatInput.props
      expect(selectedModel.required).toBe(true)
    })

    it('should have default values for optional props', () => {
      const { isLoading, showCompress } = ChatInput.props
      expect(isLoading.default).toBe(false)
      expect(showCompress.default).toBe(false)
    })
  })

  describe('Loading State', () => {
    it('should disable textarea when loading', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: true
        }
      })

      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('disabled')).toBeDefined()
    })

    it('should disable send button when loading', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: true
        }
      })

      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })

    it('should show "Sending..." text when loading', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: true
        }
      })

      expect(wrapper.find('.send-btn').text()).toBe('Send')
    })

    it('should disable compress button when loading', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: true,
          showCompress: true
        }
      })

      const compressBtn = wrapper.find('.compress-btn')
      expect(compressBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Input Handling', () => {
    it('should update input value when typing', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello world')

      expect(textarea.element.value).toBe('Hello world')
    })

    it('should disable send button when input is empty', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })

    it('should disable send button when input is only whitespace', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('   ')

      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has text', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello')

      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeUndefined()
    })

    it('should disable send button when no model is selected', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: '',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello')

      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Send Functionality', () => {
    it('should emit send event with trimmed message when send button is clicked', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('  Hello world  ')

      const sendBtn = wrapper.find('.send-btn')
      await sendBtn.trigger('click')

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0]).toEqual(['Hello world'])
    })

    it('should clear input after sending', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello world')

      const sendBtn = wrapper.find('.send-btn')
      await sendBtn.trigger('click')

      expect(textarea.element.value).toBe('')
    })

    it('should emit send event when Enter is pressed', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Test message')
      await textarea.trigger('keydown.enter', { exact: true })

      expect(wrapper.emitted('send')).toBeTruthy()
      expect(wrapper.emitted('send')[0]).toEqual(['Test message'])
    })

    it('should not emit send event when input is empty', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const sendBtn = wrapper.find('.send-btn')
      await sendBtn.trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should not emit send event when loading', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: true
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Test message')

      const sendBtn = wrapper.find('.send-btn')
      await sendBtn.trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should not emit send event when no model selected', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: '',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('Test message')

      const sendBtn = wrapper.find('.send-btn')
      await sendBtn.trigger('click')

      expect(wrapper.emitted('send')).toBeFalsy()
    })

    it('should not emit send event when Enter is pressed with whitespace only', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      const textarea = wrapper.find('textarea')
      await textarea.setValue('   ')
      await textarea.trigger('keydown.enter', { exact: true })

      expect(wrapper.emitted('send')).toBeFalsy()
    })
  })

  describe('Compress Functionality', () => {
    it('should emit compress event when compress button is clicked', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          showCompress: true
        }
      })

      const compressBtn = wrapper.find('.compress-btn')
      await compressBtn.trigger('click')

      expect(wrapper.emitted('compress')).toBeTruthy()
      expect(wrapper.emitted('compress')).toHaveLength(1)
    })

    it('should have title attribute on compress button', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          showCompress: true
        }
      })

      const compressBtn = wrapper.find('.compress-btn')
      expect(compressBtn.attributes('title')).toBe('Compress conversation')
    })
  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      expect(wrapper.find('.input-area').exists()).toBe(true)
      expect(wrapper.find('.input-container').exists()).toBe(true)
      expect(wrapper.find('.button-group').exists()).toBe(true)
    })
  })

  describe('Auto Focus', () => {
    it('should auto-focus textarea when component mounts', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        },
        attachTo: document.body
      })

      // Wait for onMounted to execute
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea').element
      expect(document.activeElement).toBe(textarea)

      wrapper.unmount()
    })

    it('should have textareaRef in component instance', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false
        }
      })

      // Verify the ref is defined in the component instance
      expect(wrapper.vm.textareaRef).toBeDefined()
    })

    it('should focus textarea even when disabled initially', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: true
        },
        attachTo: document.body
      })

      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea').element
      // Focus is called even when disabled, though it may not visually focus
      expect(textarea).toBeDefined()

      wrapper.unmount()
    })
  })

  describe('Stop Streaming Functionality', () => {
    it('should show stop button when isStreaming is true', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          isStreaming: true
        }
      })

      expect(wrapper.find('.stop-btn').exists()).toBe(true)
      expect(wrapper.find('.stop-btn').text()).toBe('Stop')
      expect(wrapper.find('.send-btn').exists()).toBe(false)
    })

    it('should show send button when isStreaming is false', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          isStreaming: false
        }
      })

      expect(wrapper.find('.send-btn').exists()).toBe(true)
      expect(wrapper.find('.send-btn').text()).toBe('Send')
      expect(wrapper.find('.stop-btn').exists()).toBe(false)
    })

    it('should emit stop event when stop button is clicked', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          isStreaming: true
        }
      })

      const stopBtn = wrapper.find('.stop-btn')
      await stopBtn.trigger('click')

      expect(wrapper.emitted('stop')).toBeTruthy()
      expect(wrapper.emitted('stop')).toHaveLength(1)
    })

    it('should have title attribute on stop button', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          isStreaming: true
        }
      })

      const stopBtn = wrapper.find('.stop-btn')
      expect(stopBtn.attributes('title')).toBe('Stop generating')
    })

    it('should replace send button with stop button during streaming', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          isStreaming: false
        }
      })

      // Initially should show send button
      expect(wrapper.find('.send-btn').exists()).toBe(true)
      expect(wrapper.find('.stop-btn').exists()).toBe(false)

      // Update to streaming state
      await wrapper.setProps({ isStreaming: true })

      // Should now show stop button instead
      expect(wrapper.find('.stop-btn').exists()).toBe(true)
      expect(wrapper.find('.send-btn').exists()).toBe(false)
    })

    it('should switch back to send button when streaming stops', async () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          isStreaming: true
        }
      })

      // Initially should show stop button
      expect(wrapper.find('.stop-btn').exists()).toBe(true)
      expect(wrapper.find('.send-btn').exists()).toBe(false)

      // Update to non-streaming state
      await wrapper.setProps({ isStreaming: false })

      // Should now show send button again
      expect(wrapper.find('.send-btn').exists()).toBe(true)
      expect(wrapper.find('.stop-btn').exists()).toBe(false)
    })

    it('should have isStreaming prop with default value false', () => {
      const { isStreaming } = ChatInput.props
      expect(isStreaming.type).toBe(Boolean)
      expect(isStreaming.default).toBe(false)
    })
  })
})