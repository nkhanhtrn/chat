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
      />
    </div>

    <ChatInput 
      :is-loading="isLoading"
      :selected-model="selectedModel"
      :show-compress="chat.messages.length > 0"
      @send="handleSendMessage"
      @compress="compressConversation"
    />
  </div>
</template>

<script>
import { ref, watch, nextTick } from 'vue'
import { sendChatMessage } from '../services/api.js'
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
    }
  },
  emits: ['update-title'],
  setup(props, { emit }) {
    const isLoading = ref(false)
    const messagesContainer = ref(null)

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    const sendMessageToAPI = async (assistantMessage) => {
      isLoading.value = true
      
      try {
        const messages = props.chat.messages
          .filter(m => !m.loading)
          .map(m => ({ role: m.role, content: m.content }))

        const response = await sendChatMessage(messages, props.selectedModel)
        
        // Parse thinking tags
        const thinkingMatch = response.match(/<think>([\s\S]*?)<\/think>/i)
        let thinking = null
        let displayContent = response
        
        if (thinkingMatch) {
          thinking = thinkingMatch[1].trim()
          displayContent = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        }
        
        // Update assistant message with response
        assistantMessage.content = response
        assistantMessage.displayContent = displayContent
        assistantMessage.thinking = thinking
        assistantMessage.showThinking = false
        assistantMessage.loading = false
      } catch (error) {
        console.error('Error processing message:', error)
        assistantMessage.content = `Error: ${error.message || 'Failed to get response from the model'}`
        assistantMessage.displayContent = assistantMessage.content
        assistantMessage.thinking = null
        assistantMessage.loading = false
      } finally {
        isLoading.value = false
        scrollToBottom()
      }
    }

    const retryMessage = async (messageIndex) => {
      if (isLoading.value || !props.selectedModel) {
        return
      }

      // Remove messages after the retry point
      props.chat.messages.splice(messageIndex + 1)

      // Add loading assistant message
      const assistantMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        thinking: 'Analyzing your question and generating a response...',
        showThinking: true,
        loading: true
      }
      props.chat.messages.push(assistantMessage)
      scrollToBottom()

      await sendMessageToAPI(assistantMessage)
    }

    const compressConversation = async () => {
      if (isLoading.value || !props.selectedModel || props.chat.messages.length === 0) {
        return
      }

      const messageCount = props.chat.messages.filter(m => !m.loading && m.role !== 'system').length

      isLoading.value = true

      try {
        // Create a summary request
        const conversationText = props.chat.messages
          .filter(m => !m.loading && m.role !== 'system')
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
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
      // Add user message
      const userMessage = {
        role: 'user',
        content: messageText,
        displayContent: messageText
      }
      props.chat.messages.push(userMessage)

      // Update chat title with first message
      if (props.chat.messages.length === 1) {
        const title = messageText.length > 30 
          ? messageText.substring(0, 30) + '...' 
          : messageText
        emit('update-title', props.chat.id, title)
      }

      scrollToBottom()

      // Add loading assistant message
      const assistantMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        thinking: 'Analyzing your question and generating a response...',
        showThinking: true,
        loading: true
      }
      props.chat.messages.push(assistantMessage)
      scrollToBottom()

      await sendMessageToAPI(assistantMessage)
    }

    watch(() => props.chat.messages.length, () => {
      scrollToBottom()
    })

    return {
      isLoading,
      messagesContainer,
      retryMessage,
      handleSendMessage,
      compressConversation
    }
  }
}
</script>
