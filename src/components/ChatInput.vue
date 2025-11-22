<template>
  <div class="input-area">
    <div class="input-container">
      <textarea
        v-model="inputValue"
        @keydown.enter.exact.prevent="handleSend"
        placeholder="Type your message here..."
        :disabled="isLoading"
      ></textarea>
      <button 
        @click="handleSend"
        :disabled="!inputValue.trim() || isLoading || !selectedModel"
      >
        {{ isLoading ? 'Sending...' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ChatInput',
  props: {
    isLoading: {
      type: Boolean,
      default: false
    },
    selectedModel: {
      type: String,
      required: true
    }
  },
  emits: ['send'],
  setup(props, { emit }) {
    const inputValue = ref('')

    const handleSend = () => {
      if (!inputValue.value.trim() || props.isLoading || !props.selectedModel) {
        return
      }

      const message = inputValue.value.trim()
      inputValue.value = ''
      emit('send', message)
    }

    return {
      inputValue,
      handleSend
    }
  }
}
</script>
