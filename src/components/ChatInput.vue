<template>
  <div class="input-area">
    <div class="input-container">
      <textarea
        ref="textareaRef"
        v-model="inputValue"
        @keydown.enter.exact.prevent="handleSend"
        placeholder="Type your message here..."
        :disabled="isLoading"
      ></textarea>
      <div class="button-group">
        <button 
          v-if="isStreaming"
          @click="$emit('stop')"
          class="stop-btn"
          title="Stop generating"
        >
          Stop
        </button>
        <button 
          v-else
          @click="handleSend"
          :disabled="!inputValue.trim() || isLoading || !selectedModel"
          class="send-btn"
          title="Send message"
        >
          Send
        </button>
        <button 
          v-if="showCompress"
          @click="$emit('compress')"
          class="compress-btn"
          :disabled="isLoading"
          title="Compress conversation"
        >
          Compress
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'ChatInput',
  props: {
    isLoading: {
      type: Boolean,
      default: false
    },
    isStreaming: {
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
  emits: ['send', 'compress', 'stop'],
  setup(props, { emit }) {
    const inputValue = ref('')
    const textareaRef = ref(null)

    const handleSend = () => {
      if (!inputValue.value.trim() || props.isLoading || !props.selectedModel) {
        return
      }

      const message = inputValue.value.trim()
      inputValue.value = ''
      emit('send', message)
    }

    onMounted(() => {
      if (textareaRef.value) {
        textareaRef.value.focus()
      }
    })

    return {
      inputValue,
      textareaRef,
      handleSend
    }
  }
}
</script>
