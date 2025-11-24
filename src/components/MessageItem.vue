<template>
  <div :class="['message', message.role, { collapsed: isCollapsed }]">
    <div class="message-header" @click="toggleCollapse">
      <div class="message-role" style="position: relative; display: flex; align-items: center;">
        <span style="z-index:1;">{{ message.role === 'user' ? 'You' : 'Chat' }}</span>
        <span v-if="isCollapsed" class="collapse-icon" style="position: absolute; left: 48px; top: 50%; transform: translateY(-50%); z-index:2;">▶</span>
      </div>
      <button
        v-if="message.role === 'user' && !isEditing"
        @click.stop="$emit('delete')"
        class="delete-btn"
        :disabled="isLoading"
        title="Delete this message and reply"
      >
        ×
      </button>
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

<style scoped>
/* Place at the end of the style block for correct specificity */
.message-header {
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #e74c3c;
  font-size: 18px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 2;
  padding: 2px 6px;
  line-height: 1;
}

.message:hover .delete-btn {
  opacity: 1;
}
</style>

<script>
import { ref, nextTick, watch } from 'vue'
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
    },
    forceCollapsed: {
      type: Boolean,
      default: false
    }
  },
  emits: ['retry', 'edit'],
  setup(props, { emit }) {
    const isEditing = ref(false)
    const editedContent = ref('')
    const editTextarea = ref(null)
    const isCollapsed = ref(props.forceCollapsed)

    // Watch for forceCollapsed prop changes
    watch(() => props.forceCollapsed, (val) => {
      isCollapsed.value = val
    })

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
