<template>
  <div class="chat-container">
    <header class="chat-header">
      <h1>Study Assistant</h1>
      <p>Ask me anything you want to learn about</p>
    </header>

    <div class="messages-container" ref="messagesContainer">
      <div v-if="chatStore.rootMessages.length === 0" class="welcome-message">
        <h2>Welcome to your Study Assistant!</h2>
        <p>Start by asking a question about any topic you'd like to learn.</p>
        <div class="example-prompts">
          <p>Try asking:</p>
          <ul>
            <li>"Explain quantum physics in simple terms"</li>
            <li>"How does photosynthesis work?"</li>
            <li>"Teach me about the French Revolution"</li>
          </ul>
        </div>
      </div>

      <ChatMessage
        v-for="(message, index) in chatStore.rootMessages"
        :key="message.id"
        :message="message"
        :is-app-streaming="chatStore.isStreaming && index === chatStore.rootMessages.length - 1"
      />

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <ChatInput
      @send="handleSendMessage"
      :disabled="chatStore.isStreaming"
      :is-loading="chatStore.isStreaming"
    />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import { sendChatMessage, fetchModels } from './services/api.js'
import { useChatStore } from './stores/chat.js'

const error = ref(null)
const messagesContainer = ref(null)
const chatStore = useChatStore()

onMounted(async () => {
  try {
    const models = await fetchModels()
    if (models.length > 0) {
      chatStore.setCurrentModel(models[0].id)
      console.log('Using model:', models[0].id)
    } else {
      error.value = 'No models available. Please load a model in LM Studio.'
    }
  } catch (err) {
    error.value = err.message
  }
})

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const handleSendMessage = async (userMessage) => {
  if (!userMessage.trim() || chatStore.isStreaming) return

  error.value = null

  // Create and add message to store
  const msg = chatStore.addRootMessage({
    id: crypto.randomUUID(),
    question: userMessage,
    response: ''
  })

  scrollToBottom()

  chatStore.setIsStreaming(true)

  try {
    await sendChatMessage(
      userMessage,
      chatStore.currentModel,
      (chunk) => {
        // Update the message response through the store
        chatStore.appendToResponse(msg.id, chunk)
        scrollToBottom()
      }
    )
  } catch (err) {
    error.value = err.message
    // Remove message from store on error
    chatStore.removeRootMessage(msg.id)
  } finally {
    chatStore.setIsStreaming(false)
    scrollToBottom()
  }
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background-color: #ffffff;
}

.chat-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.chat-header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
}

.chat-header p {
  margin: 0.5rem 0 0 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: #f8f9fa;
}

.welcome-message {
  text-align: center;
  padding: 3rem 2rem;
  color: #495057;
}

.welcome-message h2 {
  color: #667eea;
  margin-bottom: 1rem;
}

.example-prompts {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.example-prompts p {
  font-weight: 600;
  color: #667eea;
  margin-bottom: 0.8rem;
}

.example-prompts ul {
  list-style: none;
  padding: 0;
  text-align: left;
}

.example-prompts li {
  padding: 0.5rem 0;
  color: #6c757d;
}

.example-prompts li::before {
  content: "💡 ";
  margin-right: 0.5rem;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  border: 1px solid #f5c6cb;
}
</style>