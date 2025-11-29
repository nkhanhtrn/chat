<template>
  <teleport to="body">
    <div v-if="visible" class="note-backdrop" @click="onCancel"></div>
    <div v-if="visible" class="note-popup" :style="{ left: `${x}px`, top: `${y}px` }">
      <div class="note-header">
        <span class="note-title">Note</span>
        <div v-if="!isEditing && !isTemp" class="note-header-actions">
          <button class="note-icon-btn" @click="startEditing" title="Edit note">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="note-icon-btn note-delete-btn" @click="onDelete" title="Delete note">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- View mode: show text content -->
      <template v-if="!isEditing && !isTemp">
        <div class="note-content">
          {{ initialContent || (isStreaming ? '' : 'No content') }}<span v-if="isStreaming" class="streaming-cursor">▊</span>
        </div>

        <!-- Detail explain link (shown in view mode when not streaming) -->
        <a
          v-if="!isStreaming && highlightedText"
          class="detail-explain-link"
          href="#"
          @click.prevent="onDetailExplain"
        >
          Explain in detail →
        </a>
      </template>

      <!-- Edit mode: show textarea -->
      <template v-else>
        <textarea
          ref="textareaRef"
          v-model="content"
          class="note-textarea"
          placeholder="Write your note..."
          @keydown.escape="onCancel"
        ></textarea>
        <div class="note-actions">
          <Button variant="secondary" @click="onCancel">Cancel</Button>
          <Button variant="secondary" @click="onSave">Save</Button>
        </div>
      </template>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import Button from './Button.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  noteId: {
    type: String,
    default: ''
  },
  initialContent: {
    type: String,
    default: ''
  },
  highlightedText: {
    type: String,
    default: ''
  },
  isTemp: {
    type: Boolean,
    default: false
  },
  startInEditMode: {
    type: Boolean,
    default: false
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'cancel', 'delete', 'detail-explain'])

const content = ref('')
const textareaRef = ref(null)
const isEditing = ref(false)

// Reset state when popup opens
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    content.value = props.initialContent
    // Auto-enter edit mode for temp notes, empty notes, or when explicitly requested
    // But NOT when streaming (streaming shows view mode with cursor)
    isEditing.value = !props.isStreaming && (props.isTemp || !props.initialContent || props.startInEditMode)
    if (isEditing.value) {
      nextTick(() => {
        textareaRef.value?.focus()
      })
    }
  } else {
    isEditing.value = false
  }
})

function startEditing() {
  isEditing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function onSave() {
  emit('save', {
    noteId: props.noteId,
    content: content.value
  })
  isEditing.value = false
}

function onCancel() {
  emit('cancel')
  isEditing.value = false
}

function onDelete() {
  emit('delete', { noteId: props.noteId })
}

function onDetailExplain() {
  emit('detail-explain', { noteId: props.noteId, text: props.highlightedText })
}
</script>

<style scoped>
.note-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--color-backdrop, rgba(0, 0, 0, 0.3));
  z-index: 9998;
}

.note-popup {
  position: fixed;
  min-width: 300px;
  max-width: 400px;
  background: var(--color-bg-context-menu, #fff);
  border: 1px solid var(--color-border-context, #ddd);
  box-shadow: 0 4px 16px var(--shadow-lg, rgba(0, 0, 0, 0.15));
  border-radius: 8px;
  padding: 1rem;
  z-index: 9999;
  color: var(--color-text-base, #333);
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.note-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text-strong, #333);
}

.note-header-actions {
  display: flex;
  gap: 0.25rem;
}

.note-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted, #666);
  transition: all 0.15s ease;
}

.note-icon-btn:hover {
  background: var(--color-bg-hover, #f5f5f5);
  color: var(--color-text-strong, #333);
}

.note-delete-btn:hover {
  color: var(--color-danger, #dc3545);
}

.note-content {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-base, #333);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.note-textarea {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  border: 1px solid var(--color-border-input, #ddd);
  border-radius: 4px;
  resize: vertical;
  background: var(--color-bg-input, #fff);
  color: var(--color-text-base, #333);
}

.note-textarea:focus {
  outline: none;
  border-color: var(--color-accent, #007bff);
  box-shadow: 0 0 0 2px rgba(128, 128, 128, 0.15);
}

.note-textarea::placeholder {
  color: var(--color-text-placeholder, #999);
}

.note-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.streaming-cursor {
  animation: blink 1s infinite;
  color: var(--color-text-muted, #666);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.detail-explain-link {
  display: block;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border-input, #eee);
  font-size: 0.85rem;
  color: var(--color-accent, #007bff);
  text-decoration: none;
  cursor: pointer;
}

.detail-explain-link:hover {
  text-decoration: underline;
}
</style>
