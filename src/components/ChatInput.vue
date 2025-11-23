<template>
  <div class="input-area">
    <div v-if="websiteContext" class="website-context-display">
      <div class="context-info">
        <span class="context-icon">🌐</span>
        <div class="context-details">
          <span class="context-title">{{ websiteContext.title }}</span>
          <a :href="websiteContext.url" target="_blank" rel="noopener noreferrer" class="context-url">{{ websiteContext.url }}</a>
        </div>
        <button @click="removeWebsiteContext" class="remove-context-btn" title="Remove website context">×</button>
      </div>
    </div>
    <div class="input-container">
      <textarea
        v-model="inputValue"
        @keydown.enter.exact.prevent="handleSend"
        placeholder="Type your message here (include URLs to load their content)..."
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
    },
    websiteContext: {
      type: Object,
      default: null
    }
  },
  emits: ['send', 'compress', 'website-removed'],
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

    const removeWebsiteContext = () => {
      emit('website-removed')
    }

    return {
      inputValue,
      handleSend,
      removeWebsiteContext
    }
  }
}
</script>
