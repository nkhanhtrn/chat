<template>
  <div class="app-container">
    <ChatSidebar
      :chats="chatStore.chatList"
      :current-chat-id="chatStore.currentChatId"
      :current-message-id="chatStore.currentMessageId"
      @new-chat="handleNewChat"
      @select-chat="handleSelectChat"
      @select-question="handleSelectQuestion"
      @delete-chat="handleDeleteChat"
    />

    <div class="chat-container">
      <DevToolbar v-if="isDev" @reset="prepopulatedQuestions = $event" />

      <div class="messages-container" ref="messagesContainer">
        <div v-if="chatStore.rootMessages.length === 0" class="welcome-message">
          <h2>Welcome to your Study Assistant!</h2>
          <p>Start by asking a question about any topic you'd like to learn.</p>
          <div class="example-prompts">
            <p>Try asking:</p>
            <ul>
              <li v-for="q in prepopulatedQuestions" :key="q" @click="handleExampleClick(q)" class="clickable">
                "{{ q }}"
              </li>
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
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import ChatSidebar from './components/ChatSidebar.vue'
import { sendChatMessage, fetchModels } from './services/api.js'
import { useChatStore } from './stores/chat.js'
import DevToolbar from './components/DevToolbar.vue'
import { getIsDev, getDefaultQuestions } from './composables/useEnvironment.js'

const error = ref(null)
const messagesContainer = ref(null)
const chatStore = useChatStore()

const isDev = getIsDev()
const prepopulatedQuestions = ref(getDefaultQuestions())

onMounted(async () => {
  // Initialize first chat if none exists
  if (chatStore.chats.length === 0) {
    chatStore.createNewChat()
  } else if (!chatStore.currentChatId && chatStore.chats.length > 0) {
    // Load first chat if no current chat selected
    chatStore.switchToChat(chatStore.chats[0].id)
  }

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
  if (!userMessage.trim() || chatStore.isStreaming) return false

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

const handleExampleClick = (question) => {
  handleSendMessage(question)
}

const handleNewChat = () => {
  chatStore.createNewChat()
  error.value = null
}

const handleSelectChat = (chatId) => {
  chatStore.switchToChat(chatId)
  scrollToBottom()
}

const handleSelectQuestion = (questionId) => {
  chatStore.navigateToMessage(questionId)
  scrollToBottom()
}

const handleDeleteChat = (chatId) => {
  chatStore.deleteChat(chatId)
  scrollToBottom()
}

</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  background-color: var(--color-bg-base);
}

.chat-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  background-color: var(--color-bg-base);
  font-family: 'Georgia', serif;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: var(--color-bg-secondary);
}

.welcome-message {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--color-text-welcome);
}

.welcome-message h2 {
  color: var(--color-primary);
  margin-bottom: 1rem;
}

.example-prompts {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: var(--color-bg-base);
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-sm);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.example-prompts p {
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 0.8rem;
}

.example-prompts ul {
  list-style: none;
  padding: 0;
  text-align: left;
}

.example-prompts li {
  padding: 0.5rem 0;
  color: var(--color-text-subtle);
}

.example-prompts li.clickable {
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.75rem;
  margin: 0.25rem 0;
  border-radius: 8px;
}

.example-prompts li.clickable:hover {
  background-color: var(--color-bg-primary-subtle);
  color: var(--color-primary);
  transform: translateX(5px);
}

.example-prompts li::before {
  content: "💡 ";
  margin-right: 0.5rem;
}

.error-message {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  border: 1px solid var(--color-error-border);
}
</style>