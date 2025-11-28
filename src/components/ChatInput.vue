<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <textarea
        ref="inputRef"
        v-model="inputText"
        @keydown.enter.exact.prevent="handleSend"
        @input="adjustHeight"
        placeholder="Ask anything you want to learn..."
        :disabled="disabled"
        rows="1"
      ></textarea>
      <button
        @click="handleSend"
        :disabled="!inputText.trim() || disabled"
        class="send-button"
        :class="{ 'loading': isLoading }"
      >
        <span v-if="!isLoading">Send</span>
        <span v-else class="spinner"></span>
      </button>
    </div>
    <div class="input-hint">
      Press Enter to send • Shift + Enter for new line
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send'])

const inputText = ref('')
const inputRef = ref(null)

const adjustHeight = () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 200) + 'px'
    }
  })
}

const handleSend = () => {
  if (inputText.value.trim() && !props.disabled) {
    emit('send', inputText.value)
    inputText.value = ''
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.style.height = 'auto'
      }
    })
  }
}
</script>

<style scoped>
.chat-input-container {
  padding: 1.5rem;
  background-color: var(--color-bg-base);
  border-top: 1px solid var(--color-border-input);
  box-shadow: 0 -2px 10px var(--shadow-sm);
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

textarea {
  flex: 1;
  padding: 0.875rem;
  border: 2px solid var(--color-border-input);
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  resize: none;
  transition: border-color 0.2s;
  min-height: 50px;
  max-height: 200px;
  overflow-y: auto;
}

textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

textarea:disabled {
  background-color: var(--color-bg-disabled);
  cursor: not-allowed;
}

.send-button {
  padding: 0.875rem 1.75rem;
  background: linear-gradient(135deg, var(--color-primary-gradient-start) 0%, var(--color-primary-gradient-end) 100%);
  color: var(--color-text-inverse);
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
  height: 50px;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-primary-strong);
}

.send-button:active:not(:disabled) {
  transform: translateY(0);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-button.loading {
  background: var(--color-primary);
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: var(--color-text-inverse);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-placeholder);
  text-align: center;
}
</style>
