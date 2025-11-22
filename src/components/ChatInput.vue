<template>
  <div class="input-area">
    <div class="input-container">
      <textarea
        v-model="inputValue"
        @keydown.enter.exact.prevent="handleSend"
        placeholder="Type your message here..."
        :disabled="isLoading"
      ></textarea>
      <div class="button-group">
        <button 
          v-if="showCompress"
          @click="$emit('compress')"
          class="compress-btn"
          :disabled="isLoading"
          title="Compress conversation"
        >
          🗜️
        </button>
        <button 
          @click="handleSend"
          :disabled="!inputValue.trim() || isLoading || !selectedModel"
          class="send-btn"
        >
          {{ isLoading ? 'Sending...' : 'Send' }}
        </button>
      </div>
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
    },
    showCompress: {
      type: Boolean,
      default: false
    }
  },
  emits: ['send', 'compress'],
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
