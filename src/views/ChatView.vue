<template>
  <AppLayout storage-key="notebook-layout">
    <template #side>
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <div class="tab-navigation">
            <button class="tab-button" :class="{ active: activeTab === 'questions' }" @click="activeTab = 'questions'">Questions</button>
            <button class="tab-button" :class="{ active: activeTab === 'playground' }" @click="activeTab = 'playground'">Chat</button>
          </div>
        </div>
        <div v-show="activeTab === 'questions'" class="sidebar-content">
          <ChatSidebar :chats="notebookStore.chatList" :current-chat-id="notebookStore.currentChatId" :current-message-id="isAddingNewQuestion ? null : treeStore.currentMessageId" :is-adding-new-question="isAddingNewQuestion" @select-question="handleSelectQuestion" @delete-question="handleDeleteQuestion" @rename-question="handleRenameQuestion" @new-question="handleNewQuestion" />
        </div>
        <div v-show="activeTab === 'playground'" class="sidebar-content playground-content"><SideChatPlayground /></div>
      </div>
    </template>
    <div class="chat-container">
      <div v-if="!showingOverview && treeStore.currentRootMessage && treeStore.currentMessage" class="fixed-nav-header">
        <div class="fixed-nav-content"><MessageNavigation v-if="treeStore.currentMessage" :current-message="treeStore.currentMessage" /></div>
      </div>
      <div class="messages-container" ref="messagesContainer">
        <SlideTransition>
          <div v-if="showingOverview" key="overview">
            <NotebookOverview
              :notebook-id="notebookStore.currentChatId!"
              :title="notebookTitle"
              :root-messages="notebookRootMessages"
              @select-question="handleOverviewSelectQuestion"
              @rename-notebook="handleNotebookRename"
              @delete-root="handleOverviewDeleteRoot"
              @delete-child="handleOverviewDeleteChild"
              @rename="handleOverviewRename"
              @drop="handleOverviewDrop"
            />
          </div>
          <div v-else-if="treeStore.rootMessages.length === 0 || isAddingNewQuestion" key="welcome" class="welcome-message">
            <h2>{{ isAddingNewQuestion ? 'Ask a new question' : 'Welcome to your Study Assistant!' }}</h2>
            <p>{{ isAddingNewQuestion ? 'Enter your question below to continue learning.' : 'Start by asking a question about any topic.' }}</p>
            <div v-if="!isAddingNewQuestion" class="example-prompts">
              <p>Try asking:</p>
              <ul><li v-for="q in prepopulatedQuestions" :key="q" @click="handleExampleClick(q)" class="clickable">"{{ q }}"</li></ul>
            </div>
          </div>
          <div v-else-if="treeStore.currentRootMessage" key="chat" class="root-message-container">
            <NotebookMessage :message="treeStore.currentRootMessage" :is-app-streaming="streamingStore.isStreaming && treeStore.currentRootIndex === treeStore.rootMessageIds.length - 1" />
            <div v-if="streamingStore.isStreaming" class="stop-streaming-container"><button class="stop-streaming-button" @click="handleStopStreaming">Stop generating</button></div>
          </div>
          <div v-else key="loading" class="welcome-message">
            <p>Loading...</p>
          </div>
        </SlideTransition>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
      <NotebookChatInput v-if="treeStore.rootMessages.length === 0 || isAddingNewQuestion || showingOverview" @send="handleSendMessage" :disabled="streamingStore.isStreaming" :is-loading="streamingStore.isStreaming" :autofocus="isAddingNewQuestion" />
    </div>
    <Scratchpad v-if="treeStore.rootMessages.length > 0" :content="notebookStore.currentScratchpad" :is-streaming="streamingStore.isStreaming" @update:content="handleScratchpadUpdate" @stop-streaming="handleStopStreaming" />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, provide, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import NotebookMessage from '@/components/NotebookMessage.vue'
import NotebookChatInput from '@/components/NotebookChatInput.vue'
import ChatSidebar from '@/components/ChatSidebar.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import MessageNavigation from '@/components/MessageNavigation.vue'
import Scratchpad from '@/components/Scratchpad.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import NotebookOverview from '@/components/NotebookOverview.vue'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'
import { useStreamingStore } from '@/stores/streaming'
import { getIsDev, getDefaultQuestions } from '@/composables/useEnvironment'
import lmService from '@/services/llm/LMService'
import { getMainPrompts } from '@/services/extraPrompt'

const route = useRoute()
const router = useRouter()
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()
const streamingStore = useStreamingStore()

const error = ref<string | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const isAddingNewQuestion = ref(false)
const showingOverview = ref(false)
const activeTab = ref('questions')

const effectiveNotebookId = computed(() => route.params.id as string)
const effectiveQuestionId = computed(() => route.params.questionId as string)

const prepopulatedQuestions = ref(getDefaultQuestions())

const notebookTitle = computed(() => {
  const chat = notebookStore.chatList.find(c => c.id === notebookStore.currentChatId)
  return chat?.title ?? 'Untitled Notebook'
})

const notebookRootMessages = computed(() => {
  return treeStore.rootMessages.map(m => ({
    id: m.id,
    question: m.question,
    questionSummarized: m.questionSummarized,
  }))
})

const getScrollPosition = () => messagesContainer.value?.scrollTop ?? 0
const setScrollPosition = (pos: number) => { nextTick(() => { if (messagesContainer.value) messagesContainer.value.scrollTop = pos }) }
provide('getScrollPosition', getScrollPosition)

onMounted(async () => {
  const notebookId = effectiveNotebookId.value
  const questionId = effectiveQuestionId.value

  if (notebookId && notebookStore.currentChatId !== notebookId) {
    const exists = notebookStore.chats.some(c => c.id === notebookId)
    if (exists) {
      await notebookStore.switchToChat(notebookId)
      if (questionId) {
        showingOverview.value = false
        if (!navigateToQuestion(questionId)) router.replace({ name: 'current-content', params: { type: 'notebook', id: notebookId } })
      } else if (treeStore.rootMessageIds.length > 0) showingOverview.value = true
    } else {
      router.push({ name: 'home' })
    }
  } else if (notebookId && treeStore.messagesById && Object.keys(treeStore.messagesById).length === 0) {
    await notebookStore.switchToChat(notebookId)
    if (questionId) {
      showingOverview.value = false
      if (!navigateToQuestion(questionId)) router.replace({ name: 'current-content', params: { type: 'notebook', id: notebookId } })
    } else if (treeStore.rootMessageIds.length > 0) {
      showingOverview.value = true
    }
  }
})

watch([effectiveNotebookId, effectiveQuestionId], async ([newId, questionId]) => {
  if (!newId) return
  if (notebookStore.currentChatId !== newId) {
    const exists = notebookStore.chats.some(c => c.id === newId)
    if (exists) {
      await notebookStore.switchToChat(newId)
      if (questionId) { showingOverview.value = false; navigateToQuestion(questionId) }
      else if (treeStore.rootMessageIds.length > 0) showingOverview.value = true
    } else { router.push({ name: 'home' }) }
  } else if (questionId) {
    showingOverview.value = false
    navigateToQuestion(questionId)
  } else if (treeStore.rootMessageIds.length > 0) {
    showingOverview.value = true
    treeStore.currentMessageId = null
  }
})

function navigateToQuestion(questionId: string): boolean {
  const chat = notebookStore.chats.find(c => c.id === notebookStore.currentChatId)
  if (!chat) return false
  const rootIndex = chat.rootMessageIds.indexOf(questionId)
  if (rootIndex !== -1) {
    treeStore.currentRootIndex = rootIndex
    treeStore.navigateToMessage(questionId, getScrollPosition())
    return true
  }
  const msg = treeStore.getMessageById(questionId)
  if (!msg) return false
  let rootMsg = msg
  while (rootMsg.parentId) rootMsg = treeStore.getMessageById(rootMsg.parentId)!
  const rootIdx = chat.rootMessageIds.indexOf(rootMsg.id)
  if (rootIdx !== -1) {
    treeStore.currentRootIndex = rootIdx
    treeStore.navigateToMessage(questionId, getScrollPosition())
    return true
  }
  return false
}

const scrollToBottom = () => { nextTick(() => { if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight }) }

const handleSendMessage = async (userMessage: string) => {
  if (!userMessage.trim() || streamingStore.isStreaming) return
  error.value = null
  isAddingNewQuestion.value = false
  showingOverview.value = false

  const msg = treeStore.addRootMessage({ id: crypto.randomUUID(), question: userMessage, response: '' }, notebookStore.currentChatId)
  notebookStore.syncCurrentChat()

  router.replace({ name: 'current-content-question', params: { type: 'notebook', id: notebookStore.currentChatId!, questionId: msg.id } })
  scrollToBottom()

  streamingStore.startStreaming(msg.id)

  const messages = getMainPrompts(msg.question)

  try {
    const sessionId = await lmService.ensureSession(msg.id, msg.openCodeSessionId, msg.question.slice(0, 80))
    if (!msg.openCodeSessionId) {
      msg.openCodeSessionId = sessionId
      notebookStore.syncCurrentChat()
    }
    await lmService.chat(
      sessionId,
      messages,
      (chunk) => { treeStore.appendToResponse(msg.id, chunk) }
    )
  } catch (err) {
    error.value = (err as Error).message
    treeStore.removeRootMessage(msg.id)
  } finally {
    streamingStore.stopStreaming()
    scrollToBottom()
  }
}

const handleStopStreaming = () => streamingStore.stopStreaming()
const handleExampleClick = (q: string) => handleSendMessage(q)

const handleSelectQuestion = (question: { id: string; chatId: string }) => {
  isAddingNewQuestion.value = false
  showingOverview.value = false
  if (treeStore.currentMessageId) treeStore.saveScrollPosition(treeStore.currentMessageId, getScrollPosition())
  router.push({ name: 'current-content-question', params: { type: 'notebook', id: question.chatId, questionId: question.id } })
  nextTick(() => { const scrollPos = treeStore.getMessageById(question.id)?.scrollPosition ?? 0; setScrollPosition(scrollPos) })
}

const handleRenameQuestion = (messageId: string, newSummary: string) => treeStore.setQuestionSummarized(messageId, newSummary)
const handleDeleteQuestion = (messageId: string, chatId: string) => notebookStore.deleteQuestion(messageId, chatId)
const handleNewQuestion = () => { isAddingNewQuestion.value = true }
const handleScratchpadUpdate = (content: string) => notebookStore.updateScratchpad(content)

const handleOverviewSelectQuestion = (data: Record<string, unknown>) => {
  const id = data.id as string
  if (id && notebookStore.currentChatId) {
    showingOverview.value = false
    router.push({ name: 'current-content-question', params: { type: 'notebook', id: notebookStore.currentChatId, questionId: id } })
  }
}

const handleNotebookRename = (title: string) => {
  if (notebookStore.currentChatId) notebookStore.renameChat(notebookStore.currentChatId, title)
}

const handleOverviewDeleteRoot = (data: Record<string, unknown>) => {
  const id = data.id as string
  if (id && notebookStore.currentChatId) notebookStore.deleteQuestion(id, notebookStore.currentChatId)
}

const handleOverviewDeleteChild = (data: Record<string, unknown>) => {
  const id = data.id as string
  if (id) treeStore.removeMessageTree(id)
}

const handleOverviewRename = (data: Record<string, unknown>, text: string) => {
  const id = data.id as string
  if (id) treeStore.setQuestionSummarized(id, text)
}

const handleOverviewDrop = (dropData: { messageId: string; targetId: string; position: 'above' | 'below'; targetIndex: number; targetParentId: string | null }) => {
  const rootIds = [...treeStore.rootMessageIds]
  if (dropData.position === 'above') {
    treeStore.moveMessage(dropData.messageId, dropData.targetParentId, dropData.targetIndex, rootIds)
  } else {
    treeStore.moveMessage(dropData.messageId, dropData.targetId, 0, rootIds)
  }
  notebookStore.syncCurrentChat()
}
</script>

<style scoped>
.chat-sidebar { display: flex; flex-direction: column; height: 100%; }
.tab-navigation { display: flex; gap: 0.25rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border-base); }
.tab-button { flex: 1; padding: 0.4rem 0.6rem; font-size: 0.75rem; font-weight: 500; background: transparent; border: none; border-radius: 4px; color: var(--color-text-muted); cursor: pointer; }
.tab-button:hover { background: var(--color-bg-hover); }
.tab-button.active { background: var(--color-bg-hover); color: var(--color-primary); }
.sidebar-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.chat-container { display: flex; flex-direction: column; height: 100%; min-width: 0; font-family: Georgia, serif; }
.messages-container { flex: 1; overflow-y: auto; padding: 3rem 4rem; background-color: var(--color-bg-page); }
.welcome-message { text-align: center; padding: 4rem 2rem; color: var(--color-text-welcome); max-width: 800px; margin: 0 auto; }
.welcome-message h2 { color: var(--color-primary); margin-bottom: 1rem; font-weight: 400; font-size: 2rem; }
.welcome-message > p { font-size: 1.1rem; color: var(--color-text-muted); font-style: italic; }
.example-prompts { margin-top: 2.5rem; padding: 2rem; background: var(--color-bg-primary-subtle); border-radius: 2px; max-width: 600px; margin-left: auto; margin-right: auto; }
.example-prompts ul { list-style: none; padding: 0; text-align: left; }
.example-prompts li.clickable { cursor: pointer; padding: 0.75rem 1rem; margin: 0.25rem 0; border-radius: 2px; transition: all 0.2s; }
.example-prompts li.clickable:hover { background: var(--color-bg-hover); color: var(--color-primary); }
.root-message-container { max-width: 800px; margin: 0 auto; }
.stop-streaming-container { display: flex; justify-content: center; margin-top: 1rem; }
.stop-streaming-button { padding: 0.5rem 1.25rem; background: var(--color-bg-page); color: var(--color-text-muted); border: 1px solid var(--color-border-base); border-radius: 2px; font-family: Georgia, serif; cursor: pointer; }
.stop-streaming-button:hover { background: var(--color-bg-hover); }
.error-message { background: var(--color-error-bg); color: var(--color-error-text); padding: 1rem 1.5rem; border-radius: 2px; margin: 1.5rem 0; border-left: 3px solid var(--color-error-border); }
@media (max-width: 768px) { .messages-container { padding: 1.5rem 1rem; } .welcome-message { padding: 2rem 1rem; } }
</style>
