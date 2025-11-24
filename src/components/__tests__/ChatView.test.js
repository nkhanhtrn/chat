import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatView from '../ChatView.vue'
import MessageItem from '../MessageItem.vue'
import ChatInput from '../ChatInput.vue'
import * as api from '../../services/api.js'
import { useChatStore } from '../../composables/useChatStore.js'

// Mock the API module
vi.mock('../../services/api.js', () => ({
  sendChatMessage: vi.fn(),
  abortChatMessage: vi.fn(),
  saveChats: vi.fn()
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

    // Set up store state
    const store = useChatStore()
    store.chats.value = []
    store.activeChatId.value = null

    // Create a fresh chat object for each test
    mockChat = {
      id: 1,
      title: 'Test Chat',
      messages: []
    }
    store.chats.value.push(mockChat)
    store.activeChatId.value = mockChat.id
  })

  describe('Rendering', () => {
    it('should render chat view with messages container and input', () => {
      wrapper = mount(ChatView, {
        props: {
          selectedModel: 'test-model'
        }
      })

      expect(wrapper.find('.chat-view').exists()).toBe(true)
      expect(wrapper.find('.messages-container').exists()).toBe(true)
      expect(wrapper.findComponent(ChatInput).exists()).toBe(true)
    })

    it('should render MessageItem for each message in chat', () => {
      const store = useChatStore()
      store.chats.value[0].messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' },
        { role: 'assistant', content: 'Hi there', displayContent: 'Hi there' }
      ]

      wrapper = mount(ChatView, {
        props: {
          selectedModel: 'test-model'
        }
      })

      const messageItems = wrapper.findAllComponents(MessageItem)
      expect(messageItems).toHaveLength(2)
    })

    it('should pass correct props to ChatInput', () => {
      const store = useChatStore()
      store.chats.value[0].messages = [
        { role: 'user', content: 'Test', displayContent: 'Test' }
      ]

      wrapper = mount(ChatView, {
        props: {
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
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.props('showCompress')).toBe(false)
    })
  })

  describe('Props', () => {
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
      
      // Chat message should be added
      expect(mockChat.messages[1].role).toBe('assistant')
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

    it('should update chat message with API response', async () => {
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.content).toBe('AI response text')
      expect(chatMsg.displayContent).toBe('AI response text')
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.displayContent).toBe('Hello world!')
      expect(chatMsg.content).toBe('Hello world!')
    })

    it('should remove waiting indicator when first chunk arrives', async () => {
      let resolveChunk
      const chunkPromise = new Promise(resolve => { resolveChunk = resolve })
      
      // Mock streaming with a controlled delay
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        if (onChunk) {
          // Wait before sending first chunk so we can check isWaiting state
          await chunkPromise
          onChunk('First chunk')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk(' second chunk')
        }
        return 'First chunk second chunk'
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

      // Check that chat message starts with isWaiting = true
      const chatMsg = mockChat.messages[1]
      expect(chatMsg.isWaiting).toBe(true)

      // Now release the first chunk
      resolveChunk()
      await new Promise(resolve => setTimeout(resolve, 50))

      // After first chunk, isWaiting should be false
      expect(chatMsg.isWaiting).toBe(false)
      expect(chatMsg.displayContent).toContain('First chunk')
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.thinking).toBe('Let me analyze this')
      expect(chatMsg.displayContent).toBe('Here is my answer')
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.thinking).toBe('Analyzing')
      expect(chatMsg.displayContent).toBe('Response text')
      expect(chatMsg.content).toBe('<think>Analyzing</think>Response text')
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.content).toContain('Error:')
      
      consoleErrorSpy.mockRestore()
    })

    it('should not send thinking content back to server', async () => {
      // Add a previous conversation with thinking tags
      mockChat.messages = [
        { role: 'user', content: 'First question', displayContent: 'First question' },
        { 
          role: 'assistant', 
          content: '<think>Some thinking</think>First answer',
          displayContent: 'First answer',
          thinking: 'Some thinking'
        }
      ]

      api.sendChatMessage.mockResolvedValue('Second answer')

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Second question')
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify API was called
      expect(api.sendChatMessage).toHaveBeenCalled()
      
      // Get the messages sent to the API (first argument of the call)
      const sentMessages = api.sendChatMessage.mock.calls[0][0]
      
      // Find the assistant message in sent messages
      const sentAssistantMsg = sentMessages.find(m => m.role === 'assistant')
      
      // Verify it contains only displayContent, not the thinking tags
      expect(sentAssistantMsg.content).toBe('First answer')
      expect(sentAssistantMsg.content).not.toContain('<think>')
      expect(sentAssistantMsg.content).not.toContain('Some thinking')
    })

    it('should handle cancelled request error without displaying error message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      api.sendChatMessage.mockRejectedValue(new Error('Request cancelled'))

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

      const chatMsg = mockChat.messages[1]
      // Should not show error for cancelled requests
      expect(chatMsg.content).not.toContain('Error:')
      expect(chatMsg.isWaiting).toBe(false)
      
      consoleErrorSpy.mockRestore()
    })

    it('should parse complete think tags correctly', async () => {
      // Mock streaming with complete think tags in one chunk
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        const fullResponse = '<think>Complete thinking process</think>Final response'
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.thinking).toBe('Complete thinking process')
      expect(chatMsg.displayContent).toBe('Final response')
      expect(chatMsg.content).toBe('<think>Complete thinking process</think>Final response')
    })

    it('should only update thinking when currentThinking is set', async () => {
      // Mock streaming without think tags
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        if (onChunk) {
          onChunk('Response without thinking')
        }
        return 'Response without thinking'
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

      const chatMsg = mockChat.messages[1]
      expect(chatMsg.thinking).toBeUndefined()
      expect(chatMsg.displayContent).toBe('Response without thinking')
    })

    it('should update correct chat when switching chats during streaming', async () => {
      // Create two separate chat objects
      const chat1 = {
        id: 1,
        title: 'Chat 1',
        messages: []
      }
      const chat2 = {
        id: 2,
        title: 'Chat 2',
        messages: []
      }

      // Mock streaming with delay
      let streamCallback
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        streamCallback = onChunk
        if (onChunk) {
          // Simulate slow streaming
          await new Promise(resolve => setTimeout(resolve, 50))
          onChunk('Response ')
          await new Promise(resolve => setTimeout(resolve, 50))
          onChunk('from ')
          await new Promise(resolve => setTimeout(resolve, 50))
          onChunk('chat 1')
        }
        return 'Response from chat 1'
      })

      // Mount with chat1
      wrapper = mount(ChatView, {
        props: {
          chat: chat1,
          selectedModel: 'test-model'
        }
      })

      // Send message in chat1
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Hello')
      await nextTick()

      // Verify message was added to chat1
      expect(chat1.messages).toHaveLength(2)
      expect(chat1.messages[0].role).toBe('user')
      expect(chat1.messages[1].role).toBe('assistant')
      expect(chat1.messages[1].isWaiting).toBe(true)

      // Simulate switching to chat2 before response completes
      await wrapper.setProps({ chat: chat2 })
      await nextTick()

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // Response should still be in chat1, not chat2
      expect(chat1.messages[1].displayContent).toBe('Response from chat 1')
      expect(chat1.messages[1].content).toBe('Response from chat 1')
      expect(chat2.messages).toHaveLength(0)
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

      // Messages after retry point should be removed and new chat message added
      expect(mockChat.messages).toHaveLength(2)
      expect(mockChat.messages[1].role).toBe('assistant')
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
      
      // Messages after edit point should be removed and new chat message added
      expect(mockChat.messages).toHaveLength(2)
      expect(mockChat.messages[1].role).toBe('assistant')
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

  describe('Stop Streaming', () => {
    it('should stop streaming when stop button is triggered', async () => {
      const abortSpy = vi.spyOn(api, 'abortChatMessage')
      
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      // Set streaming state
      wrapper.vm.isStreaming = true
      wrapper.vm.isLoading = true
      await nextTick()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('stop')
      await nextTick()

      expect(abortSpy).toHaveBeenCalled()
      expect(wrapper.vm.isStreaming).toBe(false)
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.emitted('loading-change')).toBeTruthy()
      expect(wrapper.emitted('loading-change')[0]).toEqual([false])
      
      abortSpy.mockRestore()
    })

    it('should emit loading-change false when stopping', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      wrapper.vm.isStreaming = true
      wrapper.vm.isLoading = true
      await nextTick()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('stop')
      await nextTick()

      expect(wrapper.emitted('loading-change')).toBeTruthy()
      const loadingChanges = wrapper.emitted('loading-change')
      expect(loadingChanges[loadingChanges.length - 1]).toEqual([false])
    })
  })

  describe('Chat Switching During Streaming', () => {
    it('should update correct chat when switching chats during streaming', async () => {
      const chat1 = {
        id: 1,
        title: 'Chat 1',
        messages: []
      }
      const chat2 = {
        id: 2,
        title: 'Chat 2',
        messages: []
      }

      // Mock streaming behavior
      let streamingCallback
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        streamingCallback = onChunk
        if (onChunk) {
          // Simulate delayed streaming
          await new Promise(resolve => setTimeout(resolve, 50))
          onChunk('Response for chat 1')
        }
        return 'Response for chat 1'
      })

      // Start with chat1
      wrapper = mount(ChatView, {
        props: {
          chat: chat1,
          selectedModel: 'test-model'
        }
      })

      // Send message to chat1
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Hello chat 1')
      await nextTick()

      // Chat1 should have user message and waiting assistant message
      expect(chat1.messages).toHaveLength(2)
      expect(chat1.messages[0].role).toBe('user')
      expect(chat1.messages[1].role).toBe('assistant')
      expect(chat1.messages[1].isWaiting).toBe(true)

      // Switch to chat2 before streaming completes
      await wrapper.setProps({ chat: chat2 })
      await nextTick()

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Chat1 should have the response, not chat2
      expect(chat1.messages[1].displayContent).toBe('Response for chat 1')
      expect(chat2.messages).toHaveLength(0)
    })

    it('should only scroll when viewing the chat receiving the response', async () => {
      const chat1 = {
        id: 1,
        title: 'Chat 1',
        messages: []
      }
      const chat2 = {
        id: 2,
        title: 'Chat 2',
        messages: []
      }

      // Mock streaming behavior
      api.sendChatMessage.mockImplementation(async (messages, model, onChunk) => {
        if (onChunk) {
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk('Chunk 1')
          await new Promise(resolve => setTimeout(resolve, 20))
          onChunk(' Chunk 2')
        }
        return 'Chunk 1 Chunk 2'
      })

      wrapper = mount(ChatView, {
        props: {
          chat: chat1,
          selectedModel: 'test-model'
        },
        attachTo: document.body
      })

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await nextTick()

      // Switch to chat2
      await wrapper.setProps({ chat: chat2 })
      await nextTick()

      // Get scroll position - should not change for chat2's container
      const messagesContainer = wrapper.find('.messages-container').element
      const initialScrollTop = messagesContainer.scrollTop

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Scroll position should remain the same since we're viewing chat2
      expect(messagesContainer.scrollTop).toBe(initialScrollTop)

      wrapper.unmount()
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

  describe('Scroll Behavior', () => {
    it('should scroll to bottom when component mounts with existing messages', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Message 1', displayContent: 'Message 1' },
        { role: 'assistant', content: 'Response 1', displayContent: 'Response 1' },
        { role: 'user', content: 'Message 2', displayContent: 'Message 2' },
        { role: 'assistant', content: 'Response 2', displayContent: 'Response 2' }
      ]

      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        },
        attachTo: document.body
      })

      await nextTick()
      await nextTick()

      const messagesContainer = wrapper.find('.messages-container').element
      
      // Verify scroll position is at bottom
      // Note: In test environment, scrollHeight and scrollTop might both be 0
      // But we can verify the scrollTop was set to scrollHeight
      expect(messagesContainer.scrollTop).toBe(messagesContainer.scrollHeight)
      
      wrapper.unmount()
    })

    it('should scroll to bottom when component mounts with empty messages', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        },
        attachTo: document.body
      })

      await nextTick()
      await nextTick()

      const messagesContainer = wrapper.find('.messages-container').element
      
      // With no messages, both should be 0
      expect(messagesContainer.scrollTop).toBe(0)
      expect(messagesContainer.scrollHeight).toBe(0)
      
      wrapper.unmount()
    })

    it('should scroll to bottom after adding a new message', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        },
        attachTo: document.body
      })

      api.sendChatMessage.mockResolvedValue('Response')

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'New message')
      await nextTick()
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const messagesContainer = wrapper.find('.messages-container').element
      expect(messagesContainer.scrollTop).toBe(messagesContainer.scrollHeight)
      
      wrapper.unmount()
    })

    it('should scroll to bottom when messages length changes', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        },
        attachTo: document.body
      })

      await nextTick()

      // Manually add a message to trigger the watch
      mockChat.messages.push({ role: 'user', content: 'Test', displayContent: 'Test' })
      
      await nextTick()
      await nextTick()

      const messagesContainer = wrapper.find('.messages-container').element
      expect(messagesContainer.scrollTop).toBe(messagesContainer.scrollHeight)
      
      wrapper.unmount()
    })

    it('should handle scrollToBottom when messagesContainer is null', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })

      // Set messagesContainer ref to null
      wrapper.vm.messagesContainer = null
      
      // Call scrollToBottom through a watcher trigger - should not throw error
      mockChat.messages.push({ role: 'user', content: 'Test', displayContent: 'Test' })
      
      await nextTick()
      await nextTick()
      
      // Should complete without error
      expect(wrapper.vm.messagesContainer).toBeNull()
    })
  })

  describe('Collapse/Expand Button', () => {
    it('should toggle allCollapsed when button is clicked', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })
      const btn = wrapper.find('.collapse-all-btn')
      expect(wrapper.vm.allCollapsed).toBe(false)
      await btn.trigger('click')
      expect(wrapper.vm.allCollapsed).toBe(true)
      await btn.trigger('click')
      expect(wrapper.vm.allCollapsed).toBe(false)
    })
  })

  describe('Delete Functionality', () => {
    it('should not delete if message is not user role', async () => {
      mockChat.messages = [
        { role: 'assistant', content: 'Hi', displayContent: 'Hi' },
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })
      // Try to delete assistant message
      wrapper.vm.deleteMessage(0)
      expect(mockChat.messages.length).toBe(2)
    })

    it('should handle delete when chat.chats is undefined', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' },
        { role: 'assistant', content: 'Hi', displayContent: 'Hi' }
      ]
      // Remove chats property
      delete mockChat.chats
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })
      // Should not throw
      expect(() => wrapper.vm.deleteMessage(0)).not.toThrow()
    })
  })

  describe('Edge Cases for editMessage and retryMessage', () => {
    it('should not throw if editMessage called with invalid index', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })
      // Should not throw even if index is out of range
      await expect(wrapper.vm.editMessage(99, 'test')).resolves.toBeUndefined()
    })
    it('should not throw if retryMessage called with invalid index', async () => {
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })
      await expect(wrapper.vm.retryMessage(99)).resolves.toBeUndefined()
    })
  })

  describe('Compress Functionality', () => {
    it('should not call alert if no error in compressConversation', async () => {
      mockChat.messages = [
        { role: 'user', content: 'Hello', displayContent: 'Hello' }
      ]
      api.sendChatMessage.mockResolvedValue('Summary')
      const alertMock = vi.fn()
      window.alert = alertMock
      wrapper = mount(ChatView, {
        props: {
          chat: mockChat,
          selectedModel: 'test-model'
        }
      })
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('compress')
      await nextTick()
      expect(alertMock).not.toHaveBeenCalled()
    })
  })
})
