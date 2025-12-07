<template>
  <span class="question-link-wrapper">
    <a
      :href="questionHref"
      class="question-link"
      :data-target-message-id="targetMessageId"
      :data-question-id="questionId"
      :data-md-start="startOffset"
      :data-md-end="endOffset"
      @click="handleClick"
    >
      <slot>{{ text }}</slot>
    </a>
    <button
      v-if="hasNote && isLastSegment"
      class="note-button"
      :data-note-id="questionId"
      @click.stop="handleNoteClick"
      title="Open note"
    >
      +
    </button>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../../stores/chat.js'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  targetMessageId: {
    type: String,
    required: true
  },
  questionId: {
    type: String,
    required: true
  },
  startOffset: {
    type: Number,
    required: true
  },
  endOffset: {
    type: Number,
    required: true
  },
  noteContent: {
    type: String,
    default: ''
  },
  hasNote: {
    type: Boolean,
    default: false
  },
  isLastSegment: {
    type: Boolean,
    default: true
  }
})

const router = useRouter()
const emit = defineEmits(['highlight-click', 'note-click'])

// Handle click - navigate via Vue Router, but Ctrl+click opens context menu
function handleClick(event) {
  // Ctrl+click: emit highlight-click to open context menu
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    event.stopPropagation()
    emit('highlight-click', {
      highlightId: props.questionId,
      text: props.text,
      colorIndex: 0,
      startOffset: props.startOffset,
      endOffset: props.endOffset,
      x: event.clientX,
      y: event.clientY
    })
    return
  }

  event.preventDefault()

  try {
    const chatStore = useChatStore()
    const notebookId = findNotebookForMessage(chatStore, props.targetMessageId)

    if (notebookId) {
      router.push({
        name: 'question',
        params: { id: notebookId, questionId: props.targetMessageId }
      })
    }
  } catch {
    // Fallback: if router fails, do nothing (link won't work in tests)
  }
}

function handleNoteClick(event) {
  emit('note-click', {
    noteId: props.questionId,
    text: props.text,
    noteContent: props.noteContent,
    startOffset: props.startOffset,
    endOffset: props.endOffset,
    x: event.clientX,
    y: event.clientY
  })
}

// Compute the href for the question link
const questionHref = computed(() => {
  try {
    const chatStore = useChatStore()

    // Find which notebook contains this message
    const notebookId = findNotebookForMessage(chatStore, props.targetMessageId)

    if (!notebookId) {
      return '#'
    }
    // TODO: Update URL structure if production doesn't contain /chat/
    return `/chat/#/notebook/${notebookId}/q/${props.targetMessageId}`
  } catch {
    // If store is not available (e.g., in tests), return a fallback
    return '#'
  }
})

// Find which notebook contains a given message
function findNotebookForMessage(chatStore, messageId) {
  for (const chat of chatStore.chats) {
    // Check if message is in this chat's root messages
    if (chat.rootMessageIds.includes(messageId)) {
      return chat.id
    }

    // Check if message is a descendant of any root message in this chat
    for (const rootId of chat.rootMessageIds) {
      if (isDescendantOf(chatStore, messageId, rootId)) {
        return chat.id
      }
    }
  }

  return null
}

// Check if a message is a descendant of another message
function isDescendantOf(chatStore, messageId, ancestorId) {
  const ancestor = chatStore.messagesById[ancestorId]
  if (!ancestor) return false

  // BFS to check all descendants
  const queue = [...(ancestor.childIds || [])]
  const visited = new Set()

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (visited.has(currentId)) continue
    visited.add(currentId)

    if (currentId === messageId) {
      return true
    }

    const current = chatStore.messagesById[currentId]
    if (current?.childIds) {
      queue.push(...current.childIds)
    }
  }

  return false
}
</script>

<style scoped>
.question-link-wrapper {
  position: relative;
  display: inline;
}

.question-link {
  color: var(--color-link-question);
  text-decoration: none;
  border-bottom: 1.5px solid red;
  cursor: pointer;
  font-weight: normal;
  transition: all 0.2s ease;
}

.question-link:hover {
  color: var(--color-link-question-hover);
  border-bottom: 1.5px solid var(--color-link-border-hover);
}

.note-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  margin-left: 1px;
  padding: 0;
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text-muted, #999);
  background-color: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  vertical-align: baseline;
  opacity: 0.4;
  user-select: none;
  -webkit-user-select: none;
}

.note-button:hover {
  opacity: 1;
  color: var(--color-text-strong, #333);
  background-color: var(--color-bg-active, rgba(0, 0, 0, 0.12));
}

.note-button:active {
  transform: scale(0.9);
}
</style>
