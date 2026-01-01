<template>
  <AppLayout storage-key="notebook-layout">
    <template #side>
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <div class="tab-navigation">
            <button
              class="tab-button"
              :class="{ active: activeTab === 'questions' }"
              @click="activeTab = 'questions'"
            >
              Questions
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'playground' }"
              @click="activeTab = 'playground'"
            >
              Chat
            </button>
          </div>
        </div>

        <!-- Questions Tab -->
        <div v-show="activeTab === 'questions'" class="sidebar-content">
          <ChatSidebar
            :chats="chatStore.chatList"
            :current-chat-id="chatStore.currentChatId"
            :current-message-id="isAddingNewQuestion ? null : chatStore.currentMessageId"
            :is-adding-new-question="isAddingNewQuestion"
            @select-question="handleSelectQuestion"
            @delete-question="handleDeleteQuestion"
            @rename-question="handleRenameQuestion"
            @new-question="handleNewQuestion"
          />
        </div>

        <!-- Playground Tab -->
        <div v-show="activeTab === 'playground'" class="sidebar-content playground-content">
          <SideChatPlayground />
        </div>
      </div>
    </template>

    <div class="chat-container">
      <DevToolbar v-if="isDev" @reset="prepopulatedQuestions = $event" />

      <!-- Fixed Navigation Header -->
      <div v-if="!showingOverview && chatStore.currentRootMessage && chatStore.currentMessage" class="fixed-nav-header">
        <div class="fixed-nav-content">
          <MessageNavigation
            :current-message="chatStore.currentMessage"
          />
        </div>
      </div>

      <div class="messages-container" ref="messagesContainer">
        <SlideTransition>
          <!-- Notebook Overview -->
          <NotebookOverview
            v-if="showingOverview && chatStore.currentChatId"
            key="overview"
            :notebook-id="chatStore.currentChatId"
            :title="notebookTitle"
            :question-count="notebookQuestionCount"
            :root-messages="notebookRootMessages"
            :needs-delete-confirmation="needsDeleteConfirmation"
            @select-question="handleOverviewSelectQuestion"
            @rename-notebook="handleNotebookRename"
            @delete-root="handleOverviewDeleteRoot"
            @delete-child="handleOverviewDeleteChild"
            @rename="handleRenameQuestion"
            @drop="handleOverviewDrop"
          />

          <div v-else-if="chatStore.rootMessages.length === 0 || isAddingNewQuestion" key="welcome" class="welcome-message">
            <h2>{{ isAddingNewQuestion ? 'Ask a new question' : 'Welcome to your Study Assistant!' }}</h2>
            <p>{{ isAddingNewQuestion ? 'Enter your question below to continue learning.' : 'Start by asking a question about any topic you\'d like to learn.' }}</p>
            <div v-if="!isAddingNewQuestion" class="example-prompts">
              <p>Try asking:</p>
              <ul>
                <li v-for="q in prepopulatedQuestions" :key="q" @click="handleExampleClick(q)" class="clickable">
                  "{{ q }}"
                </li>
              </ul>
            </div>
          </div>

          <div v-else-if="chatStore.currentRootMessage" key="chat" class="root-message-container">
            <ChatMessage
              :message="chatStore.currentRootMessage"
              :is-app-streaming="chatStore.isStreaming && chatStore.currentRootIndex === chatStore.rootMessages.length - 1"
            />
            <div v-if="chatStore.isStreaming" class="stop-streaming-container">
              <button class="stop-streaming-button" @click="handleStopStreaming">
                Stop generating
              </button>
            </div>
          </div>
        </SlideTransition>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>

      <ChatInput
        v-if="chatStore.rootMessages.length === 0 || isAddingNewQuestion || showingOverview"
        @send="handleSendMessage"
        :disabled="chatStore.isStreaming"
        :is-loading="chatStore.isStreaming"
        :autofocus="isAddingNewQuestion"
      />
    </div>

    <!-- Scratchpad for taking notes while reading -->
    <Scratchpad
      v-if="chatStore.rootMessages.length > 0"
      :content="chatStore.currentScratchpad"
      :is-streaming="chatStore.isStreaming"
      @update:content="handleScratchpadUpdate"
      @stop-streaming="handleStopStreaming"
    />

  </AppLayout>
</template>

<script setup>
import { ref, nextTick, onMounted, provide, watch, computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatSidebar from '../components/ChatSidebar.vue'
import SideChatPlayground from '../components/SideChatPlayground.vue'
import MessageNavigation from '../components/MessageNavigation.vue'
const NotebookOverview = defineAsyncComponent(() => import('../components/NotebookOverview.vue'))
import Scratchpad from '../components/Scratchpad.vue'
import SlideTransition from '../components/SlideTransition.vue'
import { sendChatMessageForFeature, FeatureType, fetchModels } from '../services/api.js'
import { useChatStore } from '../stores/chat.js'
import DevToolbar from '../components/DevToolbar.vue'
import { getIsDev, getDefaultQuestions } from '../composables/useEnvironment.js'
import { getMainPrompts } from '../services/extraPrompt.js'
const props = defineProps({
  notebookId: {
    type: String,
    default: null
  },
  questionId: {
    type: String,
    default: null
  }
})

const route = useRoute()
const router = useRouter()
const error = ref(null)
const messagesContainer = ref(null)
const chatStore = useChatStore()
const isAddingNewQuestion = ref(false)
const showingOverview = ref(false)
const activeTab = ref('questions') // 'questions' or 'playground'

// Use props if provided, otherwise fall back to route params
const effectiveNotebookId = computed(() => props.notebookId || route.params.id)
const effectiveQuestionId = computed(() => props.questionId || route.params.questionId)

const isDev = getIsDev()
const prepopulatedQuestions = ref(getDefaultQuestions())

// Computed properties for NotebookOverview props
const notebookTitle = computed(() => {
  const notebook = chatStore.chatList.find(c => c.id === chatStore.currentChatId)
  return notebook?.title || 'Untitled Notebook'
})

const notebookQuestionCount = computed(() => {
  return chatStore.getTotalMessageCount(chatStore.currentChatId)
})

const notebookRootMessages = computed(() => {
  const notebook = chatStore.chatList.find(c => c.id === chatStore.currentChatId)
  if (!notebook?.questions) return []
  return notebook.questions.map(q => {
    const msg = chatStore.messagesById[q.id]
    return msg || { id: q.id, question: q.text, questionSummarized: q.text }
  })
})

const needsDeleteConfirmation = (messageId) => {
  const stats = chatStore.getMessageTreeStats(messageId)
  return stats.descendantCount > 0 || stats.customContentCount > 0
}

// Shared drag state for tree components (ChatSidebar and NotebookOverview)
const draggedItem = ref(null)
const dropTarget = ref(null)
provide('draggedItem', draggedItem)
provide('dropTarget', dropTarget)

// Helper to navigate to a question by ID within current notebook
const navigateToQuestion = (questionId) => {
  const chat = chatStore.chats.find(c => c.id === chatStore.currentChatId)
  if (!chat) return false

  const rootIndex = chat.rootMessageIds.indexOf(questionId)
  if (rootIndex !== -1) {
    // It's a root message
    chatStore.currentRootIndex = rootIndex
    const scrollPos = chatStore.navigateToMessage(questionId, getScrollPosition())
    setScrollPosition(scrollPos)
    return true
  }

  // Check if it's a child message - find its root
  const message = chatStore.messagesById[questionId]
  if (!message) return false

  let rootMsg = message
  while (rootMsg.parentId) {
    rootMsg = chatStore.messagesById[rootMsg.parentId]
  }

  const rootIdx = chat.rootMessageIds.indexOf(rootMsg.id)
  if (rootIdx !== -1) {
    chatStore.currentRootIndex = rootIdx
    const scrollPos = chatStore.navigateToMessage(questionId, getScrollPosition())
    setScrollPosition(scrollPos)
    return true
  }

  return false
}

onMounted(async () => {
  // Get notebook ID from effective source (prop or route)
  const notebookId = effectiveNotebookId.value
  const questionId = effectiveQuestionId.value

  // Switch to the specified notebook if it exists
  if (notebookId) {
    const chatExists = chatStore.chats.some(c => c.id === notebookId)
    if (chatExists) {
      chatStore.switchToChat(notebookId)

      // If a question ID is specified, navigate to it
      if (questionId) {
        showingOverview.value = false
        if (!navigateToQuestion(questionId)) {
          // Question doesn't exist, redirect to notebook
          router.replace({ name: 'notebook', params: { id: notebookId } })
        }
      } else if (chatStore.rootMessages.length > 0) {
        // No question specified but notebook has questions - show overview
        showingOverview.value = true
      }
    } else {
      // Notebook doesn't exist, redirect to home
      router.push({ name: 'home' })
      return
    }
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

// Watch for route changes to switch notebooks and questions
watch([effectiveNotebookId, effectiveQuestionId], ([newId, questionId]) => {
  if (newId && chatStore.currentChatId !== newId) {
    const chatExists = chatStore.chats.some(c => c.id === newId)
    if (chatExists) {
      chatStore.switchToChat(newId)
      // Navigate to question if specified
      if (questionId) {
        showingOverview.value = false
        navigateToQuestion(questionId)
      } else if (chatStore.rootMessages.length > 0) {
        // No question specified but notebook has questions - show overview
        showingOverview.value = true
      }
    } else {
      router.push({ name: 'home' })
    }
  } else if (newId && questionId) {
    // Same notebook, different question
    showingOverview.value = false
    navigateToQuestion(questionId)
  } else if (newId && !questionId && chatStore.rootMessages.length > 0) {
    // Same notebook, no question - show overview
    showingOverview.value = true
    chatStore.currentMessageId = null
  }
})

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const getScrollPosition = () => {
  return messagesContainer.value?.scrollTop || 0
}

const setScrollPosition = (position) => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = position
    }
  })
}

// Provide scroll functions to child components
provide('getScrollPosition', getScrollPosition)
provide('setScrollPosition', setScrollPosition)

const handleSendMessage = async (userMessage, contextQuestions = []) => {
  if (!userMessage.trim() || chatStore.isStreaming) return false

  error.value = null
  isAddingNewQuestion.value = false
  showingOverview.value = false

  // Create and add message to store
  const msg = chatStore.addRootMessage({
    id: crypto.randomUUID(),
    question: userMessage,
    response: ''
  })

  // Update URL to reflect the new question
  router.replace({
    name: 'question',
    params: { id: chatStore.currentChatId, questionId: msg.id }
  })

  scrollToBottom()

  const signal = chatStore.startStreaming(msg.id)

  // Build previous messages for context (all root messages except the current one)
  const previousMessages = chatStore.rootMessages
    .slice(0, -1) // Exclude the current message we just added
    .map(m => ({ question: m.question }));

  // check if this is the first message in the chat to set as summary
  let messages;
  let featureType;
  if (chatStore.rootMessageIds.length === 1) {
    messages = getMainPrompts(`[NEWTOPIC] ${msg.question}`, [], contextQuestions)
    featureType = FeatureType.QUESTION
  } else {
    messages = getMainPrompts(`[DEEPDIVE] ${msg.question}`, previousMessages, contextQuestions);
    featureType = FeatureType.DEEP_DIVE
  }
  console.log("Final message to send:", messages);
  try {
    // Use feature-based provider selection (Google AI preferred for question/deep dive)
    await sendChatMessageForFeature(
      featureType,
      messages,
      (chunk) => {
        // Update the message response through the store
        chatStore.appendToResponse(msg.id, chunk)
      },
      signal
    )
  } catch (err) {
    error.value = err.message
    // Remove message from store on error
    chatStore.removeRootMessage(msg.id)
  } finally {
    chatStore.stopStreaming()
    scrollToBottom()
  }
}

const handleStopStreaming = () => {
  chatStore.stopStreaming()
}

const handleExampleClick = (question) => {
  handleSendMessage(question)
}

const handleSelectQuestion = (question) => {
  isAddingNewQuestion.value = false
  showingOverview.value = false

  // Save scroll position of current message before switching
  const currentScrollPos = getScrollPosition()
  if (chatStore.currentMessageId) {
    chatStore.saveScrollPosition(chatStore.currentMessageId, currentScrollPos)
  }

  const chatId = question.chatId || chatStore.currentChatId

  // Navigate via router - this will trigger the watch that handles the actual navigation
  router.push({
    name: 'question',
    params: { id: chatId, questionId: question.id }
  })

  // Restore scroll position after navigation
  nextTick(() => {
    const scrollPos = chatStore.messagesById[question.id]?.scrollPosition || 0
    setScrollPosition(scrollPos)
  })
}

const handleRenameQuestion = (itemOrId, newSummary) => {
  // Handle both: (item, newSummary) from NotebookOverview and (messageId, newSummary) from ChatSidebar
  const messageId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id
  chatStore.setQuestionSummarized(messageId, newSummary)
}

const handleDeleteQuestion = (messageId, chatId) => {
  chatStore.deleteQuestion(messageId, chatId)
}

const handleNewQuestion = () => {
  isAddingNewQuestion.value = true
}

const handleOverviewSelectQuestion = (question) => {
  showingOverview.value = false
  handleSelectQuestion(question)
}

const handleNotebookRename = (newTitle) => {
  chatStore.renameChat(chatStore.currentChatId, newTitle)
}

const handleOverviewDeleteRoot = (rootMsg) => {
  chatStore.deleteQuestion(rootMsg.id, chatStore.currentChatId)
}

const handleOverviewDeleteChild = (childMsg) => {
  chatStore.deleteChildMessage(childMsg.id)
}

const handleOverviewDrop = (dropData) => {
  const { messageId, targetId, position, targetIndex } = dropData
  if (position === 'above') {
    chatStore.moveMessage(messageId, null, targetIndex)
  } else {
    chatStore.moveMessage(messageId, targetId, 0)
  }
}

const handleScratchpadUpdate = (content) => {
  chatStore.updateScratchpad(content)
}

</script>

<style scoped>
.chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  flex-shrink: 0;
}

.tab-navigation {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border-base);
}

.tab-button {
  flex: 1;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.tab-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.tab-button.active {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.playground-content {
  height: 100%;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background-color: transparent;
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 3rem 4rem;
  background-color: var(--color-bg-page);
  box-shadow:
    0 0 40px var(--shadow-primary),
    inset 0 0 80px var(--shadow-inset);
  margin: 0;
  border-radius: 0;
}

.messages-container::-webkit-scrollbar {
  width: 10px;
}

.messages-container::-webkit-scrollbar-track {
  background: var(--color-scrollbar-track);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

.welcome-message {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--color-text-welcome);
  max-width: var(--content-max-width, 800px);
  margin: 0 auto;
}

.welcome-message h2 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-weight: 400;
  font-size: 2rem;
  letter-spacing: 0.02em;
  font-family: 'Georgia', 'Palatino Linotype', serif;
}

.welcome-message > p {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  font-style: italic;
  line-height: 1.8;
}

.example-prompts {
  margin-top: 2.5rem;
  padding: 2rem;
  background-color: var(--color-bg-primary-subtle);
  border-radius: 2px;
  border: 1px solid var(--color-border-base);
  box-shadow: 0 2px 12px var(--shadow-primary);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.example-prompts p {
  font-weight: 400;
  color: var(--color-text-welcome);
  margin-bottom: 1rem;
  font-size: 1rem;
  font-style: italic;
}

.example-prompts ul {
  list-style: none;
  padding: 0;
  text-align: left;
}

.example-prompts li {
  padding: 0.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

.example-prompts li.clickable {
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.75rem 1rem;
  margin: 0.25rem 0;
  border-radius: 2px;
  border-left: 2px solid transparent;
}

.example-prompts li.clickable:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-primary);
  border-left-color: var(--color-border-accent);
  padding-left: 1.25rem;
}

.example-prompts li::before {
  content: "• ";
  margin-right: 0.5rem;
  color: var(--color-border-accent);
  font-weight: bold;
}

.error-message {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
  padding: 1rem 1.5rem;
  border-radius: 2px;
  margin: 1.5rem 0;
  border-left: 3px solid var(--color-error-border);
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  line-height: 1.6;
}

.root-message-container {
  position: relative;
  max-width: var(--content-max-width, 800px);
  margin: 0 auto;
}

.stop-streaming-container {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.stop-streaming-button {
  padding: 0.5rem 1.25rem;
  background-color: var(--color-bg-page);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-base);
  border-radius: 2px;
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-streaming-button:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-strong);
}

/* Fixed Navigation Header */
.fixed-nav-header {
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.fixed-question-summary {
  font-family: var(--message-font-family, Georgia, serif);
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--color-text-message);
  text-align: center;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.fixed-question-summary::first-letter {
  text-transform: uppercase;
}

.fixed-nav-content {
  align-items: center;
  gap: 1.5rem;
  max-width: 100%;
}

/* Mobile/small screen responsive styles */
@media (max-width: 768px) {
  .messages-container {
    padding: 1.5rem 1rem;
  }

  .welcome-message {
    padding: 2rem 1rem;
  }

  .welcome-message h2 {
    font-size: 1.5rem;
  }

  .example-prompts {
    padding: 1.5rem 1rem;
    margin-top: 1.5rem;
  }
}

</style>
