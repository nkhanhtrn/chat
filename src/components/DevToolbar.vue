<template>
  <div class="dev-toolbar">
    <Button @click="handleClearCache" class="dev-button" title="Clear localStorage cache" variant="secondary">
      Reset localStorage
    </Button>
    <Button @click="handleClearDB" class="dev-button" title="Delete and recreate IndexedDB" variant="secondary">
      Reset IndexedDB
    </Button>
    <Button @click="handleDeleteAllBookFiles" class="dev-button" title="Delete all cached EPUB files from IndexedDB" variant="secondary">
      Delete Book Files ({{ bookFileCount }})
    </Button>
    <Button @click="handleCloudTools" class="dev-button" title="Manage tools in cloud storage" variant="secondary">
      Cloud Tools ({{ cloudToolCount }})
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
    <Button
      @click="handleTogglePublicAI"
      class="dev-button"
      :class="{ active: usePublicAI }"
      title="Toggle between local LM Studio and public AI (Cerebras) for feature-based requests"
      variant="secondary"
    >
      {{ usePublicAI ? 'Public AI ON' : 'Public AI OFF' }}
    </Button>

    <!-- Cloud Tools Modal -->
    <div v-if="showCloudToolsModal" class="cloud-tools-modal" @click.self="showCloudToolsModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Cloud Tools ({{ isAuthenticated ? cloudTools.length : '?' }})</h3>
          <button class="close-btn" @click="showCloudToolsModal = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="isLoading" class="loading">Loading tools from cloud...</div>
          <div v-else-if="!isAuthenticated" class="empty">
            <p>Not logged in</p>
            <p class="hint">You need to sign in to manage cloud tools. Click the account button in the top right to sign in.</p>
          </div>
          <div v-else-if="cloudTools.length === 0" class="empty">No tools found in cloud</div>
          <div v-else class="tools-list">
            <div v-for="tool in cloudTools" :key="tool.id" class="tool-item">
              <span class="tool-emoji">{{ tool.emoji || '🔧' }}</span>
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-type">{{ tool.type }}</span>
              <span class="tool-date">{{ formatDate(tool.updatedAt) }}</span>
              <button class="delete-btn" @click="handleDeleteCloudTool(tool)" title="Delete from cloud and local">
                🗑️
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <Button @click="showCloudToolsModal = false" variant="secondary">Close</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, onMounted } from 'vue'
import { clearAllStorage } from '../services/storage.js'
import { saveTool, deleteDatabase, deleteAllBookFilesFromIDB, loadBooksFromIDB, permanentlyDeleteTool, getAllTools } from '../services/indexedDB.js'
import { loadToolsFromFirestore, permanentlyDeleteToolFromFirestore } from '../services/firestore.js'
import { getFirebaseAuth } from '../services/firebase.js'
import { useChatStore } from '../stores/chat.js'
import { useBooksStore } from '../stores/books.js'
import { useStudioCanvas } from '../composables/studio/useStudioCanvas.js'
import Button from './Button.vue'

// Inject the trigger function from App.vue
const triggerStaleDataBanner = inject('triggerStaleDataBanner', null)
const staleDataTriggered = ref(false)

// Public AI toggle for development mode
const usePublicAI = ref(false)

// Book files count
const bookFileCount = ref(0)

// Cloud tools state
const showCloudToolsModal = ref(false)
const cloudTools = ref([])
const cloudToolCount = ref(0)
const isLoading = ref(false)
const isAuthChecked = ref(false)
const isAuthenticated = ref(false)

// Studio canvas
const { windows, removeLastWindow } = useStudioCanvas()
const canvasWindowCount = computed(() => windows.value.length)
const toolWindows = computed(() => windows.value.filter(w => w.type === 'tool'))
const toolWindowCount = computed(() => toolWindows.value.length)

const chatStore = useChatStore()
const booksStore = useBooksStore()

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

// Format timestamp for display
function formatDate(timestamp) {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

// Load tools from cloud and display in modal
async function handleCloudTools() {
  showCloudToolsModal.value = true
  isLoading.value = true
  cloudTools.value = []
  isAuthChecked.value = false
  isAuthenticated.value = false

  try {
    // Check authentication status first
    const auth = getFirebaseAuth()
    isAuthenticated.value = !!auth.currentUser
    isAuthChecked.value = true

    if (!isAuthenticated.value) {
      // Not authenticated - show empty state with message
      cloudTools.value = []
      cloudToolCount.value = 0
      return
    }

    // Load tools from cloud
    const tools = await loadToolsFromFirestore()
    // Filter out deleted tools (those with deletedAt)
    cloudTools.value = tools.filter(t => !t.deletedAt).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    cloudToolCount.value = cloudTools.value.length
  } catch (err) {
    console.error('Failed to load cloud tools:', err)
    alert('Failed to load tools from cloud: ' + err.message)
  } finally {
    isLoading.value = false
  }
}

// Delete a tool from both cloud and local storage
async function handleDeleteCloudTool(tool) {
  if (!confirm(`Delete "${tool.name}" from both cloud and local storage?\n\nThis action cannot be undone.`)) {
    return
  }

  try {
    // Delete from cloud (Firestore)
    await permanentlyDeleteToolFromFirestore(tool.id)
    console.log(`Deleted tool "${tool.name}" from cloud`)

    // Delete from local (IndexedDB) - check if it exists first
    const localTools = await getAllTools()
    const localTool = localTools.find(t => t.id === tool.id)
    if (localTool) {
      await permanentlyDeleteTool(tool.id)
      console.log(`Deleted tool "${tool.name}" from local storage`)
    }

    // Remove from the list
    cloudTools.value = cloudTools.value.filter(t => t.id !== tool.id)
    cloudToolCount.value = cloudTools.value.length

    // Refresh the tool library if it exists in the DOM
    const toolLibrary = document.querySelector('.tool-library')
    if (toolLibrary && toolLibrary.__vueParentComponent?.ctx?.loadTools) {
      toolLibrary.__vueParentComponent.ctx.loadTools()
    }
  } catch (err) {
    console.error('Failed to delete tool:', err)
    alert('Failed to delete tool: ' + err.message)
  }
}


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

// Count book files on mount
onMounted(async () => {
  try {
    const books = await loadBooksFromIDB()
    bookFileCount.value = books.filter(b => b.fileData).length
  } catch (err) {
    console.error('Failed to count book files:', err)
  }
})

const handleDeleteAllBookFiles = async () => {
  if (bookFileCount.value === 0) {
    console.log('No cached book files to delete.')
    return
  }

  try {
    const result = await deleteAllBookFilesFromIDB()
    bookFileCount.value = 0
    // Clear preloaded books data from store
    booksStore.preloadedBooks = {}
    booksStore.preloadProgress = {}
    booksStore.preloadingIds.clear()
    console.log(`Deleted ${result.deletedCount} book files from IndexedDB`)
  } catch (err) {
    console.error('Failed to delete book files:', err)
  }
}

const handleTogglePublicAI = () => {
  usePublicAI.value = !usePublicAI.value
  // Set global flag that LLM service can check
  window.__devUsePublicAI = usePublicAI.value
  console.log(`[DevToolbar] Public AI for features: ${usePublicAI.value ? 'ENABLED (will use Cerebras)' : 'DISABLED (will use LM Studio)'}`)
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

.dev-button.active {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

/* Cloud Tools Modal */
.cloud-tools-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  min-height: 0;
}

.loading, .empty {
  text-align: center;
  color: #888;
  padding: 2rem;
}

.empty p {
  margin: 0.5rem 0;
}

.empty .hint {
  font-size: 0.85rem;
  color: #666;
  max-width: 400px;
  margin: 1rem auto 0;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #252540;
  border-radius: 6px;
  border: 1px solid #333;
}

.tool-item:hover {
  background: #2a2a4a;
}

.tool-emoji {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.tool-name {
  flex: 1;
  color: #fff;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-type {
  font-size: 0.75rem;
  color: #888;
  background: #333;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.tool-date {
  font-size: 0.75rem;
  color: #666;
  flex-shrink: 0;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 4px;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid #333;
  display: flex;
  justify-content: flex-end;
}
</style>
