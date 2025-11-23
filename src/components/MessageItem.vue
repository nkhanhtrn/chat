<template>
  <div :class="['message', message.role]">
    <div class="message-header" @click="toggleCollapse" style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
      <div class="message-role">
        {{ message.role === 'user' ? 'You' : 'Chat' }}
      </div>
      <span v-if="isCollapsed" class="collapse-icon">▶</span>
    </div>
    <div v-show="!isCollapsed" class="message-content">
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
      <div v-else-if="message.isWaiting" class="waiting-indicator">
        <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
      </div>
      <MessageContent v-else-if="!message.compressed && message.displayContent" :content="message.displayContent" />
    </div>
    <div v-if="message.role === 'user' && isLastUserMessage && !isEditing && !isCollapsed" class="message-actions">
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
    const isCollapsed = ref(false)

    const toggleCollapse = () => {
      if (!isEditing.value) {
        isCollapsed.value = !isCollapsed.value
      }
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
      isCollapsed,
      toggleCollapse,
      startEdit,
      saveEdit,
      cancelEdit
    }
  }
}
</script>
