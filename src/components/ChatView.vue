<template>
  <div class="chat-view">
    <div class="messages-container" ref="messagesContainer">
      <MessageItem
        v-for="(message, index) in chat.messages" 
        :key="index"
        :message="message"
        :is-loading="isLoading"
        :is-last-user-message="message.role === 'user' && index === chat.messages.map(m => m.role).lastIndexOf('user')"
        @retry="retryMessage(index)"
        @edit="editMessage(index, $event)"
      />
    </div>

    <ChatInput 
      :is-loading="globalLoading"
      :is-streaming="isStreaming"
      :selected-model="selectedModel"
      :show-compress="chat.messages.length > 0"
      @send="handleSendMessage"
      @compress="compressConversation"
      @stop="stopStreaming"
    />
  </div>
</template>

<script>
import { ref, watch, nextTick, onMounted } from 'vue'
import { sendChatMessage, abortChatMessage } from '../services/api.js'
import MessageItem from './MessageItem.vue'
import ChatInput from './ChatInput.vue'

export default {
  name: 'ChatView',
  components: {
    MessageItem,
    ChatInput
  },
  props: {
    chat: {
      type: Object,
      required: true
    },
    selectedModel: {
      type: String,
      required: true
    },
    globalLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update-title', 'loading-change'],
  setup(props, { emit }) {
    const isLoading = ref(false)
    const isStreaming = ref(false)
    const messagesContainer = ref(null)

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    // Scroll to bottom when component is mounted (after page refresh)
    onMounted(() => {
      scrollToBottom()
    })

    const stopStreaming = () => {
      abortChatMessage()
      isStreaming.value = false
      isLoading.value = false
      emit('loading-change', false)
    }

    const sendMessageToAPI = async (chatMessage, targetChat) => {
      isLoading.value = true
      emit('loading-change', true)
      isStreaming.value = false
      
      try {
        // Prepare messages for API - use displayContent to exclude thinking tags
        const messages = targetChat.messages
          .map(m => ({ 
            role: m.role, 
            // Use displayContent for assistant messages to exclude thinking,
            // use content for user messages (they don't have displayContent distinction)
            content: m.role === 'assistant' && m.displayContent ? m.displayContent : m.content 
          }))

        let accumulatedContent = ''
        let accumulatedDisplayContent = ''
        let currentThinking = ''
        let insideThinkTag = false
        let thinkTagBuffer = ''
        let rafPending = false
        
        // Get the message index once at the start
        const messageIndex = targetChat.messages.length - 1
        
        // Callback to handle streaming chunks
        const handleChunk = (chunk) => {
          // Set streaming state on first chunk
          if (!isStreaming.value) {
            isStreaming.value = true
          }
          
          // Remove waiting state on first chunk
          if (targetChat.messages[messageIndex] && targetChat.messages[messageIndex].isWaiting) {
            targetChat.messages[messageIndex].isWaiting = false
          }
          
          accumulatedContent += chunk
          
          // Parse for <think> tags incrementally
          let tempContent = accumulatedContent
          const thinkStartMatch = tempContent.match(/<think>/i)
          const thinkEndMatch = tempContent.match(/<\/think>/i)
          
          if (thinkStartMatch && thinkEndMatch) {
            // Complete think tag found
            const fullThinkMatch = tempContent.match(/<think>([\s\S]*?)<\/think>/i)
            if (fullThinkMatch) {
              currentThinking = fullThinkMatch[1].trim()
              tempContent = tempContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
              insideThinkTag = false
              thinkTagBuffer = ''
            }
          } else if (thinkStartMatch && !insideThinkTag) {
            // Think tag started but not finished
            insideThinkTag = true
            const thinkStart = tempContent.indexOf('<think>')
            thinkTagBuffer = tempContent.substring(thinkStart + 7) // After <think>
            tempContent = tempContent.substring(0, thinkStart)
          } else if (insideThinkTag) {
            // Accumulating content inside think tag
            thinkTagBuffer += chunk
            tempContent = tempContent.substring(0, tempContent.indexOf('<think>'))
          }
          
          accumulatedDisplayContent = tempContent.trim()
          
          // Use requestAnimationFrame to batch updates
          if (!rafPending) {
            rafPending = true
            requestAnimationFrame(() => {
              rafPending = false
              
              // Update the message directly by index in the target chat
              if (targetChat.messages[messageIndex]) {
                targetChat.messages[messageIndex].displayContent = accumulatedDisplayContent
                if (currentThinking) {
                  targetChat.messages[messageIndex].thinking = currentThinking
                }
              }
              
              // Only scroll if we're viewing this chat
              if (props.chat.id === targetChat.id) {
                nextTick(() => scrollToBottom())
              }
            })
          }
        }
        
        const response = await sendChatMessage(messages, props.selectedModel, handleChunk)
        
        // Final parsing after streaming completes
        const thinkingMatch = accumulatedContent.match(/<think>([\s\S]*?)<\/think>/i)
        let serverThinking = null
        let displayContent = accumulatedContent
        
        if (thinkingMatch) {
          serverThinking = thinkingMatch[1].trim()
          displayContent = accumulatedContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        }
        
        // Update chat message with final response
        chatMessage.content = accumulatedContent
        chatMessage.displayContent = displayContent
        
        // Store server thinking if present
        if (serverThinking) {
          chatMessage.thinking = serverThinking
        }
      } catch (error) {
        console.error('Error processing message:', error)
        
        // Don't show error for cancelled requests
        if (error.message !== 'Request cancelled') {
          chatMessage.content = `Error: ${error.message || 'Failed to get response from the model'}`
          chatMessage.displayContent = chatMessage.content
          chatMessage.thinking = null
        }
        chatMessage.isWaiting = false
      } finally {
        isLoading.value = false
        emit('loading-change', false)
        isStreaming.value = false
        scrollToBottom()
      }
    }

    const retryMessage = async (messageIndex) => {
      if (isLoading.value || !props.selectedModel) {
        return
      }

      // Remove messages after the retry point
      props.chat.messages.splice(messageIndex + 1)

      // Add loading message
      const chatMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        isWaiting: true
      }
      props.chat.messages.push(chatMessage)
      scrollToBottom()

      await sendMessageToAPI(chatMessage, props.chat)
    }

    const editMessage = async (messageIndex, newContent) => {
      if (isLoading.value || !props.selectedModel) {
        return
      }

      // Update the message content
      props.chat.messages[messageIndex].content = newContent
      props.chat.messages[messageIndex].displayContent = newContent

      // Remove messages after this point and retry
      props.chat.messages.splice(messageIndex + 1)

      // Add loading chat message
      const chatMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        isWaiting: true
      }
      props.chat.messages.push(chatMessage)
      scrollToBottom()

      await sendMessageToAPI(chatMessage, props.chat)
    }

    const compressConversation = async () => {
      if (isLoading.value || !props.selectedModel || props.chat.messages.length === 0) {
        return
      }

      const messageCount = props.chat.messages.filter(m => m.role !== 'system').length

      isLoading.value = true

      try {
        // Create a summary request
        const conversationText = props.chat.messages
          .filter(m => m.role !== 'system')
          .map(m => `${m.role === 'user' ? 'User' : 'Chat'}: ${m.content}`)
          .join('\n\n')

        const compressionPrompt = `Please provide a concise summary of the following conversation, capturing the key points and context:\n\n${conversationText}\n\nSummary:`

        const messages = [{ role: 'user', content: compressionPrompt }]
        const response = await sendChatMessage(messages, props.selectedModel)

        // Add compressed summary as an assistant message at the end with collapsible display
        const compressedMessage = {
          role: 'assistant',
          content: `[Previous conversation summary]: ${response}`,
          displayContent: response,
          compressed: true,
          compressedCount: messageCount,
          thinking: response, // Store summary in thinking so it uses the collapsible UI
          showThinking: false // Start collapsed
        }

        // Add to end of messages array
        props.chat.messages.push(compressedMessage)

        scrollToBottom()
      } catch (error) {
        console.error('Error compressing conversation:', error)
        alert('Failed to compress conversation: ' + error.message)
      } finally {
        isLoading.value = false
      }
    }

    const handleSendMessage = async (messageText) => {
      // Add user message immediately
      const userMessage = {
        role: 'user',
        content: messageText,
        displayContent: messageText
      }
      props.chat.messages.push(userMessage)

      // Update chat title with first message
      if (props.chat.messages.filter(m => m.role === 'user').length === 1) {
        const title = messageText.length > 30 
          ? messageText.substring(0, 30) + '...' 
          : messageText
        emit('update-title', props.chat.id, title)
      }

      scrollToBottom()

      // Add loading chat message
      const chatMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        isWaiting: true
      }
      props.chat.messages.push(chatMessage)
      scrollToBottom()

      await sendMessageToAPI(chatMessage, props.chat)
    }

    watch(() => props.chat.messages.length, () => {
      scrollToBottom()
    })

    return {
      isLoading,
      isStreaming,
      messagesContainer,
      retryMessage,
      editMessage,
      handleSendMessage,
      compressConversation,
      stopStreaming
    }
  }
}
</script>
