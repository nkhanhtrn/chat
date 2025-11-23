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
      expect(textarea.attributes('placeholder')).toBe('Type your message here (include URLs to load their content)...')
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
      expect(wrapper.find('.compress-btn').text()).toBe('🗜️')
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

      expect(wrapper.find('.send-btn').text()).toBe('Sending...')
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

  describe('Website Context', () => {
    it('should not display website context when websiteContext is null', () => {
      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext: null
        }
      })

      expect(wrapper.find('.website-context-display').exists()).toBe(false)
    })

    it('should display website context when provided', () => {
      const websiteContext = {
        url: 'https://example.com',
        title: 'Example Site',
        content: 'Content'
      }

      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext
        }
      })

      expect(wrapper.find('.website-context-display').exists()).toBe(true)
      expect(wrapper.find('.context-title').text()).toBe('Example Site')
    })

    it('should display website URL as clickable link', () => {
      const websiteContext = {
        url: 'https://example.com/page',
        title: 'Example Page',
        content: 'Content'
      }

      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext
        }
      })

      const urlLink = wrapper.find('.context-url')
      expect(urlLink.exists()).toBe(true)
      expect(urlLink.text()).toBe('https://example.com/page')
      expect(urlLink.attributes('href')).toBe('https://example.com/page')
      expect(urlLink.attributes('target')).toBe('_blank')
      expect(urlLink.attributes('rel')).toBe('noopener noreferrer')
    })

    it('should show icon in website context', () => {
      const websiteContext = {
        url: 'https://example.com',
        title: 'Example',
        content: 'Content'
      }

      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext
        }
      })

      expect(wrapper.find('.context-icon').exists()).toBe(true)
      expect(wrapper.find('.context-icon').text()).toBe('🌐')
    })

    it('should show remove button in website context', () => {
      const websiteContext = {
        url: 'https://example.com',
        title: 'Example',
        content: 'Content'
      }

      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext
        }
      })

      const removeBtn = wrapper.find('.remove-context-btn')
      expect(removeBtn.exists()).toBe(true)
      expect(removeBtn.attributes('title')).toBe('Remove website context')
    })

    it('should emit website-removed event when remove button is clicked', async () => {
      const websiteContext = {
        url: 'https://example.com',
        title: 'Example',
        content: 'Content'
      }

      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext
        }
      })

      const removeBtn = wrapper.find('.remove-context-btn')
      await removeBtn.trigger('click')

      expect(wrapper.emitted('website-removed')).toBeTruthy()
      expect(wrapper.emitted('website-removed')).toHaveLength(1)
    })

    it('should display context-details container with title and URL', () => {
      const websiteContext = {
        url: 'https://example.com',
        title: 'Example Site',
        content: 'Content'
      }

      wrapper = mount(ChatInput, {
        props: {
          selectedModel: 'test-model',
          isLoading: false,
          websiteContext
        }
      })

      const contextDetails = wrapper.find('.context-details')
      expect(contextDetails.exists()).toBe(true)
      
      const title = contextDetails.find('.context-title')
      const url = contextDetails.find('.context-url')
      
      expect(title.exists()).toBe(true)
      expect(url.exists()).toBe(true)
    })

    it('should handle websiteContext prop default value', () => {
      const { websiteContext } = ChatInput.props
      expect(websiteContext.type).toBe(Object)
      expect(websiteContext.default).toBe(null)
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
})
