<template>
  <div :class="['message', message.role, { loading: message.loading }]">
    <div class="message-role">
      {{ message.role === 'user' ? 'You' : 'Assistant' }}
    </div>
    <div class="message-content">
      <div v-if="message.thinking" class="thinking-section">
        <div 
          class="thinking-header" 
          @click="toggleThinking(message)"
        >
          <span class="thinking-icon">{{ message.showThinking ? '▼' : '▶' }}</span>
          <span class="thinking-label">
            {{ message.compressed ? `Compressed previous conversation (${message.compressedCount} messages)` : 'Thinking...' }}
          </span>
        </div>
        <div v-if="message.showThinking" class="thinking-content">
          {{ message.thinking }}
        </div>
      </div>
      <div v-if="isEditing" class="edit-section">
        <textarea 
          v-model="editedContent"
          class="edit-textarea"
          @keydown.enter.ctrl="saveEdit"
          @keydown.enter.meta="saveEdit"
          ref="editTextarea"
        ></textarea>
        <div class="edit-actions">
          <button @click="saveEdit" class="save-btn" title="Save and retry (Ctrl+Enter)">
            Save
          </button>
          <button @click="cancelEdit" class="cancel-btn" title="Cancel editing">
            Cancel
          </button>
        </div>
      </div>
      <MessageContent v-else-if="!message.compressed || !message.thinking" :content="message.displayContent" />
    </div>
    <div v-if="message.role === 'user' && isLastUserMessage && !isEditing" class="message-actions">
      <button 
        @click="startEdit" 
        class="edit-btn"
        :disabled="isLoading"
        title="Edit this message"
      >
        ✎
      </button>
      <button 
        @click="$emit('retry')" 
        class="retry-btn"
        :disabled="isLoading"
        title="Retry this message"
      >
        ↻
      </button>
    </div>
  </div>
</template>

<script>
import { ref, nextTick } from 'vue'
import MessageContent from './MessageContent.vue'

export default {
  name: 'MessageItem',
  components: {
    MessageContent
  },
  props: {
    message: {
      type: Object,
      required: true
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    isLastUserMessage: {
      type: Boolean,
      default: false
    }
  },
  emits: ['retry', 'edit'],
  setup(props, { emit }) {
    const isEditing = ref(false)
    const editedContent = ref('')
    const editTextarea = ref(null)

    const toggleThinking = (message) => {
      message.showThinking = !message.showThinking
    }

    const startEdit = async () => {
      editedContent.value = props.message.content
      isEditing.value = true
      await nextTick()
      if (editTextarea.value) {
        editTextarea.value.focus()
      }
    }

    const saveEdit = () => {
      if (editedContent.value.trim() === '') {
        return
      }
      emit('edit', editedContent.value)
      isEditing.value = false
    }

    const cancelEdit = () => {
      isEditing.value = false
      editedContent.value = ''
    }

    return {
      isEditing,
      editedContent,
      editTextarea,
      toggleThinking,
      startEdit,
      saveEdit,
      cancelEdit
    }
  }
}
</script>
