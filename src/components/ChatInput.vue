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
      <Button
        @click="handleSend"
        :disabled="!inputText.trim() || disabled"
        :loading="isLoading"
        class="send-button"
        variant="primary"
      >
        Send
      </Button>
    </div>
    <div class="input-hint">
      Press Enter to send • Shift + Enter for new line
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import Button from './Button.vue'

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
  padding: 1.5rem 4rem;
  background-color: var(--color-bg-page);
  border-top: 2px solid var(--color-border-base);
  box-shadow: 0 -4px 20px var(--shadow-primary);
  margin: 0;
  border-radius: 0;
}

.input-wrapper {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

textarea {
  flex: 1;
  padding: 0.875rem 1.125rem;
  border: 1px solid var(--color-border-input);
  border-radius: 2px;
  font-size: 1.05rem;
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', serif;
  resize: none;
  transition: all 0.2s;
  min-height: 50px;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  letter-spacing: 0.01em;
  line-height: 1.6;
}

textarea:focus {
  outline: none;
  border-color: var(--color-border-strong);
  box-shadow: 0 0 0 2px rgba(112, 112, 112, 0.2);
}

textarea:disabled {
  background-color: var(--color-bg-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}

textarea::placeholder {
  color: var(--color-text-placeholder);
  font-style: italic;
}

.send-button {
  padding: 0.875rem 1.75rem;
  border-radius: 2px;
  font-size: 1rem;
  min-width: 80px;
  height: 50px;
  font-family: 'Georgia', serif;
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  text-align: center;
  font-style: italic;
  font-family: 'Georgia', serif;
}
</style>
