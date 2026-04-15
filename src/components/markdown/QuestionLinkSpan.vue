<template>
  <a
    href="#"
    class="question-link"
    :style="{ borderBottomColor: highlightColor }"
    :data-target-message-id="targetMessageId"
    :data-question-id="questionId"
    @click="handleClick"
  ><slot>{{ text }}</slot></a><button v-if="hasNote && isLastSegment" class="note-button" :data-note-id="questionId" @click.stop="handleNoteClick" title="Open note">+</button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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
  targetMessageId: string
  questionId: string
  startOffset: number
  endOffset: number
  noteContent?: string
  hasNote?: boolean
  isLastSegment?: boolean
  colorIndex?: number
}>(), { text: '', noteContent: '', hasNote: false, isLastSegment: true, colorIndex: 0 })

const highlightColor = computed(() => highlightColors[props.colorIndex] ?? highlightColors[0])

const emit = defineEmits<{
  'highlight-click': [data: Record<string, unknown>]
  'note-click': [data: Record<string, unknown>]
}>()

function handleClick(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    event.stopPropagation()
    emit('highlight-click', { highlightId: props.questionId, text: props.text, colorIndex: 0, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
    return
  }
  event.preventDefault()
}

function handleNoteClick(event: MouseEvent) {
  emit('note-click', { noteId: props.questionId, text: props.text, noteContent: props.noteContent, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
}
</script>

<style scoped>
.question-link { color: var(--color-link-question); text-decoration: none; border-bottom: 1.5px solid; cursor: pointer; font-weight: normal; transition: all 0.2s ease; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.question-link:hover { color: var(--color-link-question-hover); border-bottom: 1.5px solid var(--color-link-border-hover); }
.note-button { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; margin-left: 1px; padding: 0; font-size: 9px; font-weight: 500; line-height: 1; color: var(--color-text-muted, #999); background-color: transparent; border: none; border-radius: 50%; cursor: pointer; opacity: 0.4; user-select: none; vertical-align: middle; }
.note-button:hover { opacity: 1; color: var(--color-text-strong, #333); background-color: var(--color-bg-active, rgba(0, 0, 0, 0.12)); }
</style>
