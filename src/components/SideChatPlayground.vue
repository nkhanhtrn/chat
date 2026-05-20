<template>
  <div class="side-chat">
    <div ref="messagesContainer" class="side-chat-messages">
      <div v-if="store.messages.length === 0 && !store.isStreaming" class="empty-state">
        <p>Ask me anything</p>
        <p class="subtext">Quick questions while you work</p>
      </div>

      <div
        v-for="msg in store.messages"
        :key="msg.id"
        :class="['message', msg.role]"
      >
        <div v-if="msg.role === 'user'" class="bubble user-bubble">
          {{ msg.content }}
        </div>
        <div v-else class="bubble assistant-bubble">
          <MarkdownRenderer :content="msg.content" />
        </div>
      </div>

      <div v-if="store.isStreaming" class="message assistant">
        <div class="bubble assistant-bubble">
          <MarkdownRenderer v-if="store.streamingContent" :content="store.streamingContent" />
          <span class="cursor">|</span>
        </div>
      </div>

      <div v-if="store.error" class="error-msg">{{ store.error }}</div>
      <div v-if="commandFeedback" class="command-feedback">{{ commandFeedback }}</div>
    </div>

    <ExpandableInput
      v-model="inputText"
      :is-streaming="store.isStreaming"
      @send="handleSend"
      @stop="store.clearChat"
    >
      <template #before-send>
        <button
          v-if="store.messages.length > 0 && !store.isStreaming"
          @click="store.clearChat"
          class="action-btn clear-btn"
          title="Clear chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <div v-if="store.messages.length > 0 && !store.isStreaming" class="divider"></div>
      </template>
    </ExpandableInput>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useSideChatStore } from '@/stores/sideChat'
import { handleCommand, type CommandContext } from '@/utils/chatCommands'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ExpandableInput from './ExpandableInput.vue'

const store = useSideChatStore()

const inputText = ref('')
const commandFeedback = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const cmdCtx: CommandContext = {
  clearChat: () => store.clearChat(),
}

const handleSend = async () => {
  const text = inputText.value
  if (!text.trim() || store.isStreaming) return

  inputText.value = ''

  const result = await handleCommand(text.trim(), cmdCtx)
  if (result) {
    if (result.type === 'handled') {
      if (result.feedback) {
        commandFeedback.value = result.feedback
        setTimeout(() => { commandFeedback.value = '' }, 3000)
      }
    } else if (result.type === 'message') {
      await store.sendMessage(result.text)
    } else if (result.type === 'search') {
      commandFeedback.value = 'Web search is only available in project chat.'
      setTimeout(() => { commandFeedback.value = '' }, 3000)
    } else if (result.type === 'error') {
      commandFeedback.value = result.message
      setTimeout(() => { commandFeedback.value = '' }, 3000)
    }
    scrollToBottom()
    return
  }

  await store.sendMessage(text)
  scrollToBottom()
}

watch(() => store.streamingContent, () => scrollToBottom())
watch(() => store.messages.length, () => scrollToBottom())
</script>

<style scoped>
.side-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.side-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
}

.empty-state p { margin: 0; }
.empty-state .subtext { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

.message { margin-bottom: 1.25rem; }

.message.user {
  display: flex;
  justify-content: flex-start;
}

.message.assistant {
  display: flex;
  justify-content: flex-end;
}

.message-content {
  max-width: 88%;
  font-family: Georgia, serif;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-base);
}

.bubble {
  max-width: 88%;
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  font-family: Georgia, serif;
  font-size: 0.95rem;
  line-height: 1.6;
  word-break: break-word;
}

.user-bubble {
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  border-bottom-left-radius: 3px;
  color: var(--color-text-base);
  white-space: pre-wrap;
}

.assistant-bubble {
  background: var(--color-bg-hover);
  border-bottom-right-radius: 3px;
  color: var(--color-text-base);
}

.assistant-bubble :deep(.markdown-renderer) {
  font-size: 0.95rem;
  line-height: 1.6;
}

.assistant-bubble :deep(.markdown-renderer p) {
  margin: 0 0 0.4rem;
}

.assistant-bubble :deep(.markdown-renderer p:last-child) {
  margin-bottom: 0;
}

.cursor {
  animation: blink 0.7s infinite;
  color: var(--color-primary);
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.error-msg {
  background: var(--color-error-bg);
  color: var(--color-error-text);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid var(--color-error-border);
}

.command-feedback {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  border-left: 3px solid var(--color-primary);
  white-space: pre-wrap;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
}

.clear-btn:hover:not(:disabled) {
  color: var(--color-error, #ef4444);
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--color-border-subtle);
  margin: 0 0.25rem;
}

@media (max-width: 768px) {
  .side-chat-messages { padding: 1rem; }
}
</style>
