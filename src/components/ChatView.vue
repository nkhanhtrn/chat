<template>
  <div class="chat-view">
    <div class="messages-container" ref="messagesContainer">
      <div 
        v-for="(message, index) in chat.messages" 
        :key="index"
        :class="['message', message.role, { loading: message.loading }]"
      >
        <div class="message-role">
          {{ message.role === 'user' ? 'You' : 'Assistant' }}
        </div>
        <div class="message-content">
          <div v-if="message.thinking" class="thinking-section">
            <div 
              class="thinking-header" 
              @click="message.showThinking = !message.showThinking"
            >
              <span class="thinking-icon">{{ message.showThinking ? '▼' : '▶' }}</span>
              <span class="thinking-label">Thinking...</span>
            </div>
            <div v-if="message.showThinking" class="thinking-content">
              {{ message.thinking }}
            </div>
          </div>
          <div class="message-text">{{ message.displayContent }}</div>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="input-container">
        <textarea
          v-model="userInput"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Type your message here..."
          :disabled="isLoading"
        ></textarea>
        <button 
          @click="sendMessage"
          :disabled="!userInput.trim() || isLoading || !selectedModel"
        >
          {{ isLoading ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick } from 'vue'
import { sendChatMessage } from '../services/api.js'

export default {
  name: 'ChatView',
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
    const userInput = ref('')
    const isLoading = ref(false)
    const messagesContainer = ref(null)

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    const sendMessage = async () => {
      if (!userInput.value.trim() || isLoading.value || !props.selectedModel) {
        return
      }

      const messageText = userInput.value.trim()
      userInput.value = ''

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

      isLoading.value = true

      try {
        // Get all messages for context
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
        console.error('Error sending message:', error)
        assistantMessage.content = `Error: ${error.message || 'Failed to get response from the model'}`
        assistantMessage.loading = false
      } finally {
        isLoading.value = false
        scrollToBottom()
      }
    }

    watch(() => props.chat.messages.length, () => {
      scrollToBottom()
    })

    return {
      userInput,
      isLoading,
      messagesContainer,
      sendMessage
    }
  }
}
</script>
