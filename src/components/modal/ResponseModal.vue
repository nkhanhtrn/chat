<template>
  <Modal :visible="visible" size="medium" :close-on-outside-click="closeOnOutsideClick" :close-on-escape="closeOnEscape" :title-style="{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }" @close="$emit('close')">
    <template #header>
      <div class="resp-header-info">
        <span class="resp-title">{{ title }}</span>
      </div>
    </template>
    <template #header-actions>
      <button v-if="editMode" class="icon-btn" @click="onSave" title="Save">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
      <template v-else-if="!isStreaming">
        <button v-if="showEdit" class="icon-btn" @click="$emit('edit')" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
        </button>
        <button v-if="showSave" class="icon-btn" @click="$emit('save')" :title="saveLabel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </button>
      </template>
    </template>
    <div class="resp-content">
      <template v-if="editMode">
        <textarea
          ref="editArea"
          v-model="editText"
          class="resp-edit-area"
          placeholder="Write your note..."
        ></textarea>
      </template>
      <template v-else>
        <div v-if="isStreaming && !content" class="resp-streaming">
          <span class="resp-cursor">▊</span>
        </div>
        <div v-else-if="content" class="resp-body">
          <MarkdownRenderer :content="content" />
        </div>
      </template>
    </div>
    <template #footer>
      <slot name="footer"></slot>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import Modal from './Modal.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  title?: string
  content?: string
  isStreaming?: boolean
  showSave?: boolean
  saveLabel?: string
  editMode?: boolean
  showEdit?: boolean
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
}>(), { visible: false, title: '', content: '', isStreaming: false, showSave: false, saveLabel: 'Save as Note', editMode: false, showEdit: false, closeOnOutsideClick: false, closeOnEscape: false })

const emit = defineEmits<{ close: []; save: []; 'save-text': [text: string]; edit: [] }>()

const editText = ref('')
const editArea = ref<HTMLTextAreaElement | null>(null)

watch(() => props.visible, (v) => {
  if (v && props.editMode) {
    editText.value = props.content ?? ''
    nextTick(() => editArea.value?.focus())
  }
})

watch(() => props.editMode, (isEdit) => {
  if (isEdit && props.visible) {
    editText.value = props.content ?? ''
    nextTick(() => editArea.value?.focus())
  }
})

function onSave() {
  emit('save-text', editText.value)
}
</script>

<style scoped>
.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0;
  background: none; border: none; border-radius: 4px;
  cursor: pointer; color: var(--color-text-muted);
  transition: all 0.15s;
}
.icon-btn:hover { background: var(--color-bg-hover); color: var(--color-text-strong); }

.resp-header-info { text-align: left; flex: 1; min-width: 0; overflow: hidden; }
.resp-title {
  font-size: 1.05rem; font-weight: 600; color: var(--color-text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;
  text-align: left;
}

.resp-content { font-size: 0.95rem; line-height: 1.6; }
.resp-body { line-height: 1.6; }
.resp-streaming { margin-top: 0.25rem; }
.resp-cursor { animation: blink 1s infinite; color: var(--color-text-muted); }
.resp-edit-area {
  width: 100%; min-height: 120px; padding: 0.5rem; font-size: 0.95rem; line-height: 1.5;
  border: 1px solid var(--color-border-base); border-radius: 4px;
  background: var(--color-bg-primary); color: var(--color-text-message);
  resize: vertical; font-family: inherit;
}
.resp-edit-area:focus { outline: none; border-color: var(--color-primary); }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
</style>
