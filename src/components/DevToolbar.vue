<template>
  <div class="dev-toolbar">
    <Button @click="handleClearCache" class="dev-button" title="Clear localStorage cache" variant="secondary">
      Reset localStorage
    </Button>
    <Button @click="handleClearDB" class="dev-button" title="Delete and recreate IndexedDB" variant="secondary">
      Reset IndexedDB
    </Button>
    <Button @click="handleTriggerStaleData" class="dev-button" title="Trigger stale data banner" variant="secondary">
      {{ staleDataTriggered ? 'Stale Data Active' : 'Trigger Stale Data' }}
    </Button>
    <Button
      @click="handleSetCreatedAt"
      class="dev-button"
      :disabled="missingCreatedAtCount === 0"
      title="Set createdAt for questions missing it, spread over 1 week"
      variant="secondary"
    >
      Set createdAt ({{ missingCreatedAtCount }})
    </Button>
    <Button
      @click="handleAddHighlightsToVocab"
      class="dev-button"
      :disabled="highlightsWithoutVocabCount === 0"
      title="Add all highlights to vocabulary cards"
      variant="secondary"
    >
      Highlights → Vocab ({{ highlightsWithoutVocabCount }})
    </Button>
    <Button
      @click="handleRemoveLastTool"
      class="dev-button"
      :disabled="canvasWindowCount === 0"
      title="Remove last tool added to Studio canvas"
      variant="secondary"
    >
      Remove Last Tool ({{ canvasWindowCount }})
    </Button>
    <Button
      @click="handleSaveAllTools"
      class="dev-button"
      :disabled="toolWindowCount === 0"
      title="Save all tool windows to library"
      variant="secondary"
    >
      Save Tools ({{ toolWindowCount }})
    </Button>
  </div>
</template>

<script setup>
import { ref, inject, computed } from 'vue'
import { clearAllStorage } from '../services/storage.js'
import { saveTool, deleteDatabase } from '../services/indexedDB.js'
import { useChatStore } from '../stores/chat.js'
import { useStudioCanvas } from '../composables/studio/useStudioCanvas.js'
import Button from './Button.vue'

// Inject the trigger function from App.vue
const triggerStaleDataBanner = inject('triggerStaleDataBanner', null)
const staleDataTriggered = ref(false)

// Studio canvas
const { windows, removeLastWindow } = useStudioCanvas()
const canvasWindowCount = computed(() => windows.value.length)
const toolWindows = computed(() => windows.value.filter(w => w.type === 'tool'))
const toolWindowCount = computed(() => toolWindows.value.length)

const chatStore = useChatStore()

// Count of messages missing createdAt
const missingCreatedAtCount = computed(() => {
  return Object.values(chatStore.messagesById).filter(msg => !msg.createdAt).length
})

// Count of highlights/question-links with notes that don't have vocab cards
const highlightsWithoutVocabCount = computed(() => {
  let count = 0
  for (const message of Object.values(chatStore.messagesById)) {
    if (!message.customContent) continue
    for (const content of message.customContent) {
      if ((content.type === 'highlight' || content.type === 'question-link') && content.hasNote) {
        const existingCard = chatStore.findVocabCardByWord(content.text)
        if (!existingCard) count++
      }
    }
  }
  return count
})


const handleClearCache = () => {
  if (confirm('Are you sure you want to clear all localStorage cache? This will delete all your chat history.')) {
    clearAllStorage()
    window.location.reload()
  }
}

const handleClearDB = async () => {
  if (confirm('Are you sure you want to delete and recreate IndexedDB? This will delete all saved tools.')) {
    try {
      await deleteDatabase()
      window.location.reload()
    } catch (err) {
      console.error('Failed to delete database:', err)
      alert('Failed to delete database: ' + err.message)
    }
  }
}

const handleTriggerStaleData = () => {
  if (triggerStaleDataBanner) {
    triggerStaleDataBanner()
    staleDataTriggered.value = true
  }
}

const handleSetCreatedAt = () => {
  const messagesWithoutCreatedAt = Object.values(chatStore.messagesById).filter(msg => !msg.createdAt)
  if (messagesWithoutCreatedAt.length === 0) return

  const count = messagesWithoutCreatedAt.length
  if (!confirm(`Set createdAt for ${count} questions, spread over the past week?`)) return

  const now = Date.now()
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  const startTime = now - oneWeekMs

  // Spread messages evenly over the week
  const interval = oneWeekMs / count

  messagesWithoutCreatedAt.forEach((msg, index) => {
    msg.createdAt = Math.floor(startTime + (index * interval))
  })

  chatStore._persistState()
}

const handleAddHighlightsToVocab = () => {
  const count = highlightsWithoutVocabCount.value
  if (count === 0) return

  let added = 0
  for (const message of Object.values(chatStore.messagesById)) {
    if (!message.customContent) continue
    for (const content of message.customContent) {
      if ((content.type === 'highlight' || content.type === 'question-link') && content.hasNote) {
        const existingCard = chatStore.findVocabCardByWord(content.text)
        if (!existingCard) {
          chatStore.addVocabCard({
            word: content.text,
            definition: '',
            context: '',
            messageId: message.id,
            highlightId: content.id
          })
          added++
        }
      }
    }
  }

  console.log(`Added ${added} highlights with notes to vocabulary`)
}

const handleRemoveLastTool = () => {
  if (canvasWindowCount.value === 0) return
  const removed = removeLastWindow()
  if (removed) {
    console.log(`Removed tool: ${removed.title}`)
  }
}

const handleSaveAllTools = async () => {
  const tools = toolWindows.value
  if (tools.length === 0) return

  let saved = 0
  for (const window of tools) {
    const content = window.content
    if (content?.code) {
      await saveTool({
        name: content.name || window.title || 'Tool',
        emoji: content.emoji || null,
        type: content.type || 'vue-sfc',
        code: content.code,
        position: window.position,
        size: window.size
      })
      saved++
    }
  }
  console.log(`Saved ${saved} tools to library`)
}

</script>

<style scoped>
.dev-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
  box-sizing: border-box;
}
</style>
