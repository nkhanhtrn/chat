import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatView from '../ChatView.vue'
import MessageItem from '../MessageItem.vue'
import ChatInput from '../ChatInput.vue'
import * as api from '../../services/api.js'
import * as websiteContent from '../../services/websiteContent.js'
import * as storage from '../../services/storage.js'

// Mock the API module
vi.mock('../../services/api.js', () => ({
  sendChatMessage: vi.fn()
}))

// Mock the websiteContent module
vi.mock('../../services/websiteContent.js', () => ({
  fetchWebsiteContent: vi.fn()
}))

// Mock the storage module
vi.mock('../../services/storage.js', () => ({
  loadWebsiteContext: vi.fn(),
  saveWebsiteContext: vi.fn(),
  deleteWebsiteContext: vi.fn()
}))

describe('ChatView', () => {
  let wrapper
  let mockChat

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Create a fresh chat object for each test
    mockChat = {
      id: 1,
      title: 'Test Chat',
      messages: []
    }
  })

  describe('Rendering', () => {
    it('should render chat view with messages container and input', () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      expect(wrapper.find('.chat-view').exists()).toBe(true)
      expect(wrapper.find('.messages-container').exists()).toBe(true)
      expect(wrapper.findComponent(ChatInput).exists()).toBe(true)
    })

    it('should render MessageItem for each message in chat', () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' },
        { role: 'assistant', content: 'Hi there', displayContent: 'Hi there' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      expect(messageItems).toHaveLength(2)
    })

    it('should pass correct props to ChatInput', () => {
      mockChat.messages = [
        { role: 'user', content: 'Test', displayContent: 'Test' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'gpt-4'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.props('selectedModel')).toBe('gpt-4')
      expect(chatInput.props('isLoading')).toBe(false)
      expect(chatInput.props('showCompress')).toBe(true)
    })

    it('should not show compress button when no messages', () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.props('showCompress')).toBe(false)
    })
  })

  describe('Props', () => {
    it('should require chat prop', () => {
      const { chat } = ChatView.props
      expect(chat.required).toBe(true)
      expect(chat.type).toBe(Object)
    })

    it('should require selectedModel prop', () => {
      const { selectedModel } = ChatView.props
      expect(selectedModel.required).toBe(true)
      expect(selectedModel.type).toBe(String)
    })
  })

  describe('Sending Messages', () => {
    it('should handle sending a message', async () => {
      api.sendChatMessage.mockResolvedValue('AI response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Hello AI')
      await nextTick()
      await nextTick() // Wait for message to be added

      // User message should be added
      expect(mockChat.messages).toHaveLength(2)
      expect(mockChat.messages[0].role).toBe('user')
      expect(mockChat.messages[0].content).toBe('Hello AI')
      
      // Assistant message should be added (may or may not be loading depending on timing)
      expect(mockChat.messages[1].role).toBe('assistant')
      expect(mockChat.messages[1]).toHaveProperty('loading')
    })

    it('should emit update-title when sending first message', async () => {
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'First message')
      await nextTick()

      expect(wrapper.emitted('update-title')).toBeTruthy()
      expect(wrapper.emitted('update-title')[0]).toEqual([1, 'First message'])
    })

    it('should truncate long title when sending first message', async () => {
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const longMessage = 'This is a very long message that exceeds thirty characters'
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', longMessage)
      await nextTick()

      expect(wrapper.emitted('update-title')).toBeTruthy()
      expect(wrapper.emitted('update-title')[0][1]).toBe('This is a very long message th...')
    })

    it('should not emit update-title for subsequent messages', async () => {
      mockChat.messages = [
        { role: 'user', content: 'First', displayContent: 'First' }
      ]

      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Second message')
      await nextTick()

      expect(wrapper.emitted('update-title')).toBeFalsy()
    })

    it('should update assistant message with API response', async () => {
      // Mock streaming behavior
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        if (onChunk) {
          onChunk('AI response text')
        }
        return 'AI response text'
      })

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test message')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      const assistantMsg = mockChat.messages[1]
      expect(assistantMsg.content).toBe('AI response text')
      expect(assistantMsg.displayContent).toBe('AI response text')
      expect(assistantMsg.loading).toBe(false)
    })

    it('should stream chunks incrementally', async () => {
      // Mock streaming with multiple chunks
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        if (onChunk) {
          onChunk('Hello')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk(' world')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk('!')
        }
        return 'Hello world!'
      })

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      const assistantMsg = mockChat.messages[1]
      expect(assistantMsg.displayContent).toBe('Hello world!')
      expect(assistantMsg.content).toBe('Hello world!')
      expect(assistantMsg.loading).toBe(false)
    })

    it('should parse thinking tags from response', async () => {
      // Mock streaming behavior with think tags
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        const fullResponse = '<think>Let me analyze this</think>Here is my answer'
        if (onChunk) {
          onChunk(fullResponse)
        }
        return fullResponse
      })

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      const assistantMsg = mockChat.messages[1]
      expect(assistantMsg.thinking).toBe('Let me analyze this')
      expect(assistantMsg.displayContent).toBe('Here is my answer')
    })

    it('should parse thinking tags incrementally during streaming', async () => {
      // Mock streaming with think tags arriving in chunks
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        if (onChunk) {
          onChunk('<think>')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk('Analyzing')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk('</think>')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk('Response text')
        }
        return '<think>Analyzing</think>Response text'
      })

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 150))

      const assistantMsg = mockChat.messages[1]
      expect(assistantMsg.thinking).toBe('Analyzing')
      expect(assistantMsg.displayContent).toBe('Response text')
      expect(assistantMsg.content).toBe('<think>Analyzing</think>Response text')
    })

    it('should handle API error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      api.sendChatMessage.mockRejectedValue(new Error('API Error'))

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const assistantMsg = mockChat.messages[1]
      expect(assistantMsg.content).toContain('Error:')
      expect(assistantMsg.loading).toBe(false)
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Retry Functionality', () => {
    it('should retry message when retry event is emitted', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' },
        { role: 'assistant', content: 'Response', displayContent: 'Response' }
      ]

      api.sendChatMessage.mockResolvedValue('New response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      await messageItems[0].vm.$emit('retry')
      await nextTick()
      await nextTick() // Wait for message to be added

      // Messages after retry point should be removed and new assistant message added
      expect(mockChat.messages).toHaveLength(2)
      expect(mockChat.messages[1].role).toBe('assistant')
      expect(mockChat.messages[1]).toHaveProperty('loading')
    })

    it('should not retry when loading', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      // Trigger loading state
      wrapper.vm.isLoading = true
      await nextTick()

      const messageItems = wrapper.findAllComponents(MessageItem)
      await messageItems[0].vm.$emit('retry')
      await nextTick()

      expect(api.sendChatMessage).not.toHaveBeenCalled()
    })

    it('should not retry when no model selected', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: ''
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      await messageItems[0].vm.$emit('retry')
      await nextTick()

      expect(api.sendChatMessage).not.toHaveBeenCalled()
    })
  })

  describe('Edit Functionality', () => {
    it('should edit message and resend', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' },
        { role: 'assistant', content: 'Response', displayContent: 'Response' }
      ]

      api.sendChatMessage.mockResolvedValue('New response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      await messageItems[0].vm.$emit('edit', 'Updated message')
      await nextTick()
      await nextTick() // Wait for message to be added

      // Message content should be updated
      expect(mockChat.messages[0].content).toBe('Updated message')
      expect(mockChat.messages[0].displayContent).toBe('Updated message')
      
      // Messages after edit point should be removed and new assistant message added
      expect(mockChat.messages).toHaveLength(2)
      expect(mockChat.messages[1].role).toBe('assistant')
      expect(mockChat.messages[1]).toHaveProperty('loading')
    })

    it('should not edit when loading', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      wrapper.vm.isLoading = true
      await nextTick()

      const messageItems = wrapper.findAllComponents(MessageItem)
      await messageItems[0].vm.$emit('edit', 'New content')
      await nextTick()

      expect(mockChat.messages[0].content).toBe('Hello')
    })

    it('should not edit when no model selected', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: ''
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      await messageItems[0].vm.$emit('edit', 'New content')
      await nextTick()

      expect(mockChat.messages[0].content).toBe('Hello')
    })
  })

  describe('Compress Functionality', () => {
    it('should compress conversation', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' },
        { role: 'assistant', content: 'Hi', displayContent: 'Hi' },
        { role: 'user', content: 'How are you?', displayContent: 'How are you?' },
        { role: 'assistant', content: 'Good', displayContent: 'Good' }
      ]

      api.sendChatMessage.mockResolvedValue('Conversation summary')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('compress')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockChat.messages).toHaveLength(5)
      const compressedMsg = mockChat.messages[4]
      expect(compressedMsg.compressed).toBe(true)
      expect(compressedMsg.compressedCount).toBe(4)
      expect(compressedMsg.thinking).toBe('Conversation summary')
    })

    it('should not compress when loading', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      wrapper.vm.isLoading = true
      await nextTick()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('compress')
      await nextTick()

      expect(api.sendChatMessage).not.toHaveBeenCalled()
    })

    it('should not compress when no messages', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('compress')
      await nextTick()

      expect(api.sendChatMessage).not.toHaveBeenCalled()
    })

    it('should not compress when no model selected', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: ''
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('compress')
      await nextTick()

      expect(api.sendChatMessage).not.toHaveBeenCalled()
    })

    it('should handle compression error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const originalAlert = window.alert
      const alertMock = vi.fn()
      window.alert = alertMock
      
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]

      api.sendChatMessage.mockRejectedValue(new Error('Compression failed'))

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('compress')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Failed to compress conversation'))
      
      consoleErrorSpy.mockRestore()
      window.alert = originalAlert
    })
  })

  describe('Loading State', () => {
    it('should set loading state when sending message', async () => {
      api.sendChatMessage.mockImplementation(() => new Promise(() => {}))

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      expect(wrapper.vm.isLoading).toBe(false)

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()

      expect(wrapper.vm.isLoading).toBe(true)
    })

    it('should clear loading state after successful response', async () => {
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(wrapper.vm.isLoading).toBe(false)
    })

    it('should clear loading state after error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      api.sendChatMessage.mockRejectedValue(new Error('Error'))

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(wrapper.vm.isLoading).toBe(false)
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Website Context', () => {
    it('should include website context in API call with custom label', async () => {
      const websiteData = {
        url: 'https://example.com',
        title: 'Example Site',
        content: 'This is website content'
      }
      
      storage.loadWebsiteContext.mockReturnValue(websiteData)
      api.sendChatMessage.mockResolvedValue('Response based on website')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      await nextTick()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Tell me about this website')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(api.sendChatMessage).toHaveBeenCalled()
      const callArgs = api.sendChatMessage.mock.calls[0][0]
      const systemMessage = callArgs.find(msg => msg.role === 'system')
      
      expect(systemMessage).toBeTruthy()
      expect(systemMessage.content).toContain('The website content is:')
      expect(systemMessage.content).toContain(websiteData.title)
      expect(systemMessage.content).toContain(websiteData.url)
      expect(systemMessage.content).toContain(websiteData.content)
    })

    it('should not include website context when none exists', async () => {
      storage.loadWebsiteContext.mockReturnValue(null)
      api.sendChatMessage.mockResolvedValue('Normal response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      await nextTick()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Hello')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(api.sendChatMessage).toHaveBeenCalled()
      const callArgs = api.sendChatMessage.mock.calls[0][0]
      const systemMessage = callArgs.find(msg => msg.role === 'system')
      
      expect(systemMessage).toBeUndefined()
    })

    it('should detect and fetch URL from message', async () => {
      storage.loadWebsiteContext.mockReturnValue(null)
      websiteContent.fetchWebsiteContent.mockResolvedValue({
        url: 'https://example.com',
        title: 'Example Page',
        content: 'Page content here'
      })
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Check this out https://example.com')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(websiteContent.fetchWebsiteContent).toHaveBeenCalledWith('https://example.com')
      expect(storage.saveWebsiteContext).toHaveBeenCalled()
    })

    it('should show loading indicator while fetching URL', async () => {
      storage.loadWebsiteContext.mockReturnValue(null)
      websiteContent.fetchWebsiteContent.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          url: 'https://example.com',
          title: 'Example',
          content: 'Content'
        }), 50)
      }))
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'https://example.com')
      await nextTick()

      // Check that a loading message was added temporarily
      const loadingMessage = mockChat.messages.find(m => m.thinking === 'Fetching content from URL...')
      expect(loadingMessage).toBeTruthy()
    })

    it('should handle URL fetch failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      storage.loadWebsiteContext.mockReturnValue(null)
      websiteContent.fetchWebsiteContent.mockRejectedValue(new Error('Failed to fetch'))
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'https://example.com')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should continue without website context
      expect(storage.saveWebsiteContext).not.toHaveBeenCalled()
      expect(api.sendChatMessage).toHaveBeenCalled()
      
      consoleErrorSpy.mockRestore()
    })

    it('should load website context on mount', async () => {
      const savedContext = {
        url: 'https://saved.com',
        title: 'Saved Site',
        content: 'Saved content'
      }
      storage.loadWebsiteContext.mockReturnValue(savedContext)

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      await nextTick()

      expect(storage.loadWebsiteContext).toHaveBeenCalledWith(mockChat.id)
      expect(wrapper.vm.websiteContext).toEqual(savedContext)
    })

    it('should update website context when chat changes', async () => {
      const context1 = { url: 'https://chat1.com', title: 'Chat 1', content: 'Content 1' }
      const context2 = { url: 'https://chat2.com', title: 'Chat 2', content: 'Content 2' }
      
      storage.loadWebsiteContext.mockReturnValueOnce(context1).mockReturnValueOnce(context2)

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      await nextTick()
      expect(wrapper.vm.websiteContext).toEqual(context1)

      // Change chat
      const newChat = { id: 2, title: 'Chat 2', messages: [] }
      await wrapper.setProps({ chat: newChat })
      await nextTick()

      expect(storage.loadWebsiteContext).toHaveBeenCalledWith(2)
      expect(wrapper.vm.websiteContext).toEqual(context2)
    })

    it('should handle website-removed event', async () => {
      const websiteData = {
        url: 'https://example.com',
        title: 'Example',
        content: 'Content'
      }
      storage.loadWebsiteContext.mockReturnValue(websiteData)

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      await nextTick()
      expect(wrapper.vm.websiteContext).toEqual(websiteData)

      // Emit website-removed event
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('website-removed')
      await nextTick()

      expect(wrapper.vm.websiteContext).toBeNull()
      expect(storage.deleteWebsiteContext).toHaveBeenCalledWith(mockChat.id)
    })

    it('should extract multiple URLs but fetch only first one', async () => {
      storage.loadWebsiteContext.mockReturnValue(null)
      websiteContent.fetchWebsiteContent.mockResolvedValue({
        url: 'https://first.com',
        title: 'First',
        content: 'Content'
      })
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Check https://first.com and https://second.com')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(websiteContent.fetchWebsiteContent).toHaveBeenCalledTimes(1)
      expect(websiteContent.fetchWebsiteContent).toHaveBeenCalledWith('https://first.com')
    })

    it('should not fetch URL if message has no URLs', async () => {
      storage.loadWebsiteContext.mockReturnValue(null)
      api.sendChatMessage.mockResolvedValue('Response')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Regular message without URL')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(websiteContent.fetchWebsiteContent).not.toHaveBeenCalled()
    })
  })

  describe('MessageItem Props', () => {
    it('should pass correct isLastUserMessage prop', () => {
      mockChat.messages = [
        { role: 'user', content: 'First', displayContent: 'First' },
        { role: 'assistant', content: 'Response', displayContent: 'Response' },
        { role: 'user', content: 'Second', displayContent: 'Second' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      expect(messageItems[0].props('isLastUserMessage')).toBe(false)
      expect(messageItems[2].props('isLastUserMessage')).toBe(true)
    })

    it('should pass isLoading prop to all MessageItems', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Test', displayContent: 'Test' }
      ]

      api.sendChatMessage.mockImplementation(() => new Promise(() => {}))

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'New message')
      await nextTick()

      const messageItems = wrapper.findAllComponents(MessageItem)
      messageItems.forEach(item => {
        expect(item.props('isLoading')).toBe(true)
      })
    })
  })
})
