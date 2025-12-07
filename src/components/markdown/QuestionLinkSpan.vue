<template>
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
  }
})

const router = useRouter()
const emit = defineEmits(['highlight-click'])

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
</style>
