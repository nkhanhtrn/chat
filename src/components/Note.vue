<template>
  <Modal :visible="visible" title="Note" size="small" @close="$emit('cancel')">
    <div class="note-content">
      <p>{{ highlightedText }}</p>
      <textarea v-model="localContent" :disabled="isStreaming" class="note-textarea" placeholder="Write your note..."></textarea>
      <div class="note-actions">
        <button @click="$emit('save', { noteId, content: localContent })" :disabled="!localContent.trim()">Save</button>
        <button @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from './modal/Modal.vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  noteId?: string | null
  initialContent?: string
  highlightedText?: string
  isTemp?: boolean
  startInEditMode?: boolean
  isStreaming?: boolean
  isCustomPrompt?: boolean
  customPromptText?: string
}>(), { visible: false, noteId: null, initialContent: '', highlightedText: '', isTemp: false, startInEditMode: false, isStreaming: false, isCustomPrompt: false, customPromptText: '' })

const emit = defineEmits<{
  save: [data: { noteId: string | null; content: string }]
  cancel: []
  delete: [data: { noteId: string | null }]
  'detail-explain': [data: { text: string }]
  explore: [data: { text: string }]
}>()

const localContent = ref(props.initialContent)
watch(() => props.initialContent, (val) => { localContent.value = val })
</script>

<style scoped>
.note-textarea { width: 100%; min-height: 80px; padding: 8px; border: 1px solid var(--color-border-subtle); border-radius: 4px; font-family: inherit; resize: vertical; }
.note-actions { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
</style>
