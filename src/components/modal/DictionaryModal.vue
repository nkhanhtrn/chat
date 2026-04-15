<template>
  <Modal :visible="visible" :title="title" size="medium" @close="$emit('close')">
    <div v-if="word" class="dict-content">
      <h3>{{ word }}</h3>
      <template v-if="editMode">
        <textarea
          ref="editArea"
          v-model="editText"
          class="dict-edit-area"
          placeholder="Write your note..."
        ></textarea>
        <div class="dict-actions">
          <button class="dict-save-btn" @click="onSave">Save</button>
        </div>
      </template>
      <template v-else>
        <div v-if="definition || isStreaming" class="dict-definition">
          <MarkdownRenderer :content="definition" />
          <span v-if="isStreaming" class="dict-cursor">▊</span>
        </div>
        <p v-else-if="!isStreaming" class="dict-empty">No definition found.</p>
        <div v-if="definition && !isStreaming && (showSave || showEdit)" class="dict-actions">
          <button v-if="showEdit" class="dict-edit-btn" @click="$emit('edit')">Edit</button>
          <button v-if="showSave" class="dict-save-btn" @click="$emit('save')">{{ saveLabel }}</button>
        </div>
      </template>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import Modal from './Modal.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  title?: string
  word?: string
  definition?: string
  isStreaming?: boolean
  showSave?: boolean
  saveLabel?: string
  editMode?: boolean
  showEdit?: boolean
}>(), { visible: false, title: 'Dictionary', word: '', definition: '', isStreaming: false, showSave: false, saveLabel: 'Save as Note', editMode: false, showEdit: false })

const emit = defineEmits<{ close: []; save: []; 'save-text': [text: string]; edit: [] }>()

const editText = ref('')
const editArea = ref<HTMLTextAreaElement | null>(null)

watch(() => props.visible, (v) => {
  if (v && props.editMode) {
    editText.value = props.definition ?? ''
    nextTick(() => editArea.value?.focus())
  }
})

function onSave() {
  emit('save-text', editText.value)
}
</script>

<style scoped>
.dict-content h3 { margin-bottom: 0.75rem; font-size: 1.1rem; color: var(--color-text-strong); }
.dict-definition { font-size: 0.95rem; line-height: 1.6; }
.dict-cursor { animation: blink 1s infinite; color: var(--color-text-muted); }
.dict-empty { color: var(--color-text-muted); font-style: italic; }
.dict-edit-area {
  width: 100%; min-height: 120px; padding: 0.5rem; font-size: 0.95rem; line-height: 1.5;
  border: 1px solid var(--color-border-base); border-radius: 4px;
  background: var(--color-bg-primary); color: var(--color-text-message);
  resize: vertical; font-family: inherit;
}
.dict-edit-area:focus { outline: none; border-color: var(--color-primary); }
.dict-actions { margin-top: 0.75rem; display: flex; justify-content: flex-end; gap: 0.5rem; }
.dict-edit-btn {
  padding: 0.3rem 0.75rem; border: 1px solid var(--color-border-base); border-radius: 4px;
  background: none; color: var(--color-text-strong); cursor: pointer; font-size: 0.85rem;
  transition: background-color 0.15s;
}
.dict-edit-btn:hover { background: var(--color-bg-hover); }
.dict-save-btn {
  padding: 0.3rem 0.75rem; border: 1px solid var(--color-border-base); border-radius: 4px;
  background: var(--color-primary); color: white; cursor: pointer; font-size: 0.85rem;
  transition: background-color 0.15s;
}
.dict-save-btn:hover { background: var(--color-primary-hover); }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
</style>
