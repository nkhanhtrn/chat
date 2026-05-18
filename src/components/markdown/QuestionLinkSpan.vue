<template>
  <a
    href="#"
    class="question-link"
    :data-target-message-id="targetMessageId"
    :data-question-id="questionId"
    @click="handleClick"
  ><slot>{{ text }}</slot></a><button v-if="hasNote && isLastSegment" class="note-button" :data-note-id="questionId" @click.stop="handleNoteClick" title="Open note">+</button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'

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
}>(), { text: '', noteContent: '', hasNote: false, isLastSegment: true })

const emit = defineEmits<{
  'highlight-click': [data: Record<string, unknown>]
  'note-click': [data: Record<string, unknown>]
}>()

const router = useRouter()
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()

function handleClick(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    event.stopPropagation()
    emit('highlight-click', { highlightId: props.questionId, text: props.text, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
    return
  }
  event.preventDefault()

  const notebookId = findNotebookForMessage(props.targetMessageId)
  if (notebookId) {
    router.push({ name: 'question', params: { id: notebookId, questionId: props.targetMessageId } })
  }
}

function handleNoteClick(event: MouseEvent) {
  emit('note-click', { noteId: props.questionId, text: props.text, noteContent: props.noteContent, startOffset: props.startOffset, endOffset: props.endOffset, x: event.clientX, y: event.clientY })
}

function findNotebookForMessage(messageId: string): string | null {
  for (const chat of notebookStore.chats) {
    if (chat.rootMessageIds.includes(messageId)) return chat.id
    for (const rootId of chat.rootMessageIds) {
      if (isDescendantOf(messageId, rootId)) return chat.id
    }
  }
  return null
}

function isDescendantOf(messageId: string, ancestorId: string): boolean {
  const msg = treeStore.getMessageById(ancestorId)
  if (!msg?.childIds?.length) return false
  for (const cid of msg.childIds) {
    if (cid === messageId) return true
    if (isDescendantOf(messageId, cid)) return true
  }
  return false
}
</script>

<style scoped>
.question-link { color: var(--color-link-question); text-decoration: none; border-bottom: 1.5px solid red; cursor: pointer; font-weight: normal; transition: all 0.2s ease; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.question-link:hover { color: var(--color-link-question-hover); border-bottom: 1.5px solid var(--color-link-border-hover); }
.note-button { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; margin-left: 1px; padding: 0; font-size: 9px; font-weight: 500; line-height: 1; color: var(--color-text-muted, #999); background-color: transparent; border: none; border-radius: 50%; cursor: pointer; opacity: 0.4; user-select: none; vertical-align: middle; }
.note-button:hover { opacity: 1; color: var(--color-text-strong, #333); background-color: var(--color-bg-active, rgba(0, 0, 0, 0.12)); }
</style>
