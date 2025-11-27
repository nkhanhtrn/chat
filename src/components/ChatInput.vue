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
  background-color: white;
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

textarea {
  flex: 1;
  padding: 0.875rem;
  border: 2px solid #e2e8f0;
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
  border-color: #667eea;
}

textarea:disabled {
  background-color: #f7fafc;
  cursor: not-allowed;
}

.send-button {
  padding: 0.875rem 1.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
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
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-button:active:not(:disabled) {
  transform: translateY(0);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-button.loading {
  background: #667eea;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
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
  color: #a0aec0;
  text-align: center;
}
</style>
