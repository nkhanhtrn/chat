<template>
  <span class="note-text" :style="{ backgroundColor: highlightColor }" :data-md-start="startOffset" :data-md-end="endOffset" @click="handleTextClick">{{ text }}</span><button v-if="isLastSegment && noteContent" class="note-button" :data-note-id="noteId" @click.stop="handleNoteClick" title="Open note">+</button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const highlightColors = [
  'var(--color-highlight-0)',
  'var(--color-highlight-1)',
  'var(--color-highlight-2)',
  'var(--color-highlight-3)',
  'var(--color-highlight-4)',
]

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  text?: string
  noteId: string
  startOffset: number
  endOffset: number
  noteContent?: string
  isLastSegment?: boolean
  colorIndex?: number
}>(), { text: '', noteContent: '', isLastSegment: true, colorIndex: 0 })

const highlightColor = computed(() => highlightColors[props.colorIndex] ?? highlightColors[0])

const emit = defineEmits<{
  'highlight-click': [data: Record<string, unknown>]
  'note-click': [data: Record<string, unknown>]
}>()

function handleTextClick(event: MouseEvent) {
  event.stopPropagation()
  if (event.ctrlKey || event.metaKey || !props.noteContent) {
    emit('highlight-click', { highlightId: props.noteId, contentType: 'note', text: props.text, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
  } else {
    emit('note-click', { noteId: props.noteId, text: props.text, noteContent: props.noteContent, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
  }
}

function handleNoteClick(event: MouseEvent) {
  emit('note-click', { noteId: props.noteId, text: props.text, noteContent: props.noteContent, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
}
</script>

<style scoped>
.note-text {
  cursor: pointer;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.note-text:hover { filter: brightness(0.92); }
.note-button {
  display: inline-flex; align-items: center; justify-content: center;
  width: 12px; height: 12px; margin-left: 1px; padding: 0;
  font-size: 9px; font-weight: 500; line-height: 1;
  color: var(--color-text-muted, #999); background-color: transparent;
  border: none; border-radius: 50%; cursor: pointer; opacity: 0.4; user-select: none;
  vertical-align: middle;
}
.note-button:hover { opacity: 1; color: var(--color-text-strong, #333); background-color: var(--color-bg-active, rgba(0, 0, 0, 0.12)); }
</style>
