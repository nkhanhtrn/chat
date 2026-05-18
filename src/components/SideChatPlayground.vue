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
    </div>

    <div class="input-container">
      <div class="input-box">
        <textarea
          ref="inputRef"
          v-model="inputText"
          @keydown.enter.exact.prevent="handleSend"
          @input="adjustHeight"
          placeholder="Message..."
          :disabled="store.isStreaming"
          rows="1"
        ></textarea>
        <div class="input-actions">
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
          <button
            v-if="!store.isStreaming"
            @click="handleSend"
            :disabled="!inputText.trim()"
            class="action-btn send-btn"
            title="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
          <button
            v-else
            @click="store.clearChat"
            class="action-btn stop-btn"
            title="Stop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useSideChatStore } from '@/stores/sideChat'
import MarkdownRenderer from './MarkdownRenderer.vue'

const store = useSideChatStore()

const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const adjustHeight = () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 160) + 'px'
    }
  })
}

const handleSend = async () => {
  const text = inputText.value
  if (!text.trim() || store.isStreaming) return

  inputText.value = ''
  nextTick(() => {
    if (inputRef.value) inputRef.value.style.height = 'auto'
  })

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

.input-container {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-bg-base);
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  padding: 0.5rem;
  transition: border-color 0.15s;
}

.input-box:focus-within {
  border-color: var(--color-border-strong);
}

textarea {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  font-size: 0.95rem;
  font-family: Georgia, serif;
  resize: none;
  min-height: 24px;
  max-height: 160px;
  overflow-y: auto;
  background-color: transparent;
  color: var(--color-text-base);
  line-height: 1.5;
}

textarea:focus { outline: none; }
textarea:disabled { opacity: 0.6; cursor: not-allowed; }
textarea::placeholder { color: var(--color-text-muted); }

.input-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--color-border-subtle);
  margin: 0 0.25rem;
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

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn {
  background-color: var(--color-primary);
  color: white;
}

.send-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  color: white;
}

.send-btn:disabled {
  background-color: var(--color-bg-hover);
  color: var(--color-text-muted);
  opacity: 1;
}

.stop-btn {
  background-color: var(--color-error-subtle, #fee2e2);
  color: var(--color-error, #ef4444);
}

.stop-btn:hover {
  background-color: var(--color-error, #ef4444);
  color: white;
}

.clear-btn:hover:not(:disabled) {
  color: var(--color-error, #ef4444);
}

@media (max-width: 768px) {
  .side-chat-messages { padding: 1rem; }
  .input-container { padding: 0.75rem 1rem; }
}
</style>
