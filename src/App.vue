<template>
  <div class="app">
    <!-- API Configuration Modal -->
    <SettingModal 
      :show="showApiModal"
      :hostname="apiConfig.hostname"
      :port="apiConfig.port"
      @save="saveApiConfig"
      @close="showApiModal = false"
      @restore="handleRestoreChats"
      @download-chats="downloadChats"
    />
    <!-- Hidden download link for chat export -->
    <DownloadLink ref="downloadLink" :href="downloadUrl" :filename="downloadFilename" />

    <div :class="['sidebar', { collapsed: sidebarCollapsed }]">
      <button 
        @click="toggleSidebar" 
        class="sidebar-toggle-btn"
        :title="sidebarCollapsed ? 'Show chat list' : 'Hide chat list'"
      >
        {{ sidebarCollapsed ? '→' : '←' }}
      </button>
      <div class="sidebar-header">
        <h2>Chat</h2>
        <button @click="openApiModal" class="config-server-btn">
          <span v-if="!sidebarCollapsed">⚙ Configure Server</span>
          <span v-else>⚙</span>
        </button>
        <button @click="createNewChat" class="new-chat-btn">
          <span v-if="!sidebarCollapsed">+ New Chat</span>
          <span v-else>+</span>
        </button>
        <!-- Download Chats button moved to settings modal -->
      </div>
      
      <div class="model-selector">
        <label for="model-select">Model:</label>
        <select 
          id="model-select" 
          v-model="selectedModel" 
          @change="onModelChange"
          :disabled="loadingModels"
        >
          <option v-if="loadingModels" value="">Loading models...</option>
          <option v-else-if="models.length === 0" value="">No models available</option>
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.id }}
          </option>
        </select>
      </div>

      <div class="chat-tabs">
        <ChatThread
          v-for="(chat, index) in chats"
          :key="chat.id"
          :id="chat.id"
          :active="activeChatId === chat.id"
          :dragOver="dragOverChatIndex === index"
          :deleteChat="deleteChat"
          :onClick="() => switchChat(chat.id)"
          :onDragStart="(e) => handleDragStart(e, index)"
          :onDragEnd="handleDragEnd"
          :onDragOver="(e) => handleDragOver(e, index)"
          :onDragLeave="handleDragLeave"
          :onDrop="(e) => handleDrop(e, index)"
          :sidebarCollapsed="sidebarCollapsed"
          @question-click="handleQuestionClick"
        />
      </div>
    </div>

    <div class="main-content">
      <ChatView 
        v-if="activeChat"
        :selectedModel="selectedModel"
        :global-loading="isAnyLoading"
        :questionToScroll="questionToScroll"
        @update-title="updateChatTitle"
        @loading-change="isAnyLoading = $event"
        @scrolled-to-question="clearQuestionToScroll"
      />
      <div v-else class="empty-state">
        <p>Create a new chat to get started</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useChatStore } from './composables/useChatStore'
import ChatView from './components/ChatView.vue'
import SettingModal from './components/SettingModal.vue'
import ChatThread from './components/ChatThread.vue'
import DownloadLink from './components/DownloadLink.vue'
import { fetchModels, setApiBaseUrl } from './services/api.js'
import * as storage from './services/storage.js'
import { backupChats, restoreChats, createChatBackup } from './services/backupRestore.js'
// import { getChatBackupFilename } from './components/utils.js'

export default {
  name: 'App',
  components: {
    ChatView,
    SettingModal,
    ChatThread,
    DownloadLink,
  },
  setup() {
    const { chats, activeChatId, activeChat, setChats, setActiveChat, addChat, updateChat, selectedModel } = useChatStore()
    const models = ref([])
    const loadingModels = ref(false)
    const showApiModal = ref(false)
    const apiConfig = ref({
      hostname: '',
      port: ''
    })
    const sidebarCollapsed = ref(false)
    const draggedChatIndex = ref(null)
    const dragOverChatIndex = ref(null)
    const isAnyLoading = ref(false)
    let chatIdCounter = 1
    // For scrolling to a question
    const questionToScroll = ref(null)
    // Handle question click from ChatThread
    const handleQuestionClick = ({ chatId, questionIndex }) => {
      // Only scroll if the chat is active
      if (activeChatId.value === chatId) {
        questionToScroll.value = questionIndex
      } else {
        setActiveChat(chatId)
        // Wait for ChatView to mount
        nextTick(() => {
          questionToScroll.value = questionIndex
        })
      }
    }

    // Clear after scroll
    const clearQuestionToScroll = () => {
      questionToScroll.value = null
    }

    const currentChat = activeChat

    const createNewChat = () => {
      const newChat = {
        id: chatIdCounter++,
        title: `New Chat`,
        messages: []
      }
      addChat(newChat)
      setActiveChat(newChat.id)
      storage.saveChatCounter(chatIdCounter)
    }

    const switchChat = (chatId) => {
      setActiveChat(chatId)
    }

    const deleteChat = (chatId) => {
      const index = chats.value.findIndex(chat => chat.id === chatId)
      if (index !== -1) {
        let newActiveChatId = null
        if (activeChatId.value === chatId && chats.value.length > 1) {
          const newIndex = index > 0 ? index - 1 : 1
          newActiveChatId = chats.value[newIndex].id
        }
        chats.value.splice(index, 1)
        storage.deleteWebsiteContext(chatId)
        if (activeChatId.value === chatId) {
          if (newActiveChatId) {
            setActiveChat(newActiveChatId)
          } else if (chats.value.length === 0) {
            createNewChat()
          }
        }
      }
    }

    // ...existing code...

    const toggleSidebar = () => {
      sidebarCollapsed.value = !sidebarCollapsed.value
      storage.saveSidebarState(sidebarCollapsed.value)
    }

    const handleDragStart = (event, index) => {
      draggedChatIndex.value = index
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/html', event.target.innerHTML)
      event.target.classList.add('dragging')
    }

    const handleDragEnd = (event) => {
      event.target.classList.remove('dragging')
      draggedChatIndex.value = null
      dragOverChatIndex.value = null
    }

    const handleDragOver = (event, index) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      dragOverChatIndex.value = index
    }

    const handleDragLeave = () => {
      dragOverChatIndex.value = null
    }

    const handleDrop = (event, dropIndex) => {
      event.preventDefault()
      
      if (draggedChatIndex.value === null || draggedChatIndex.value === dropIndex) {
        dragOverChatIndex.value = null
        return
      }

      const draggedChat = chats.value[draggedChatIndex.value]
      const newChats = [...chats.value]
      
      // Remove the dragged chat
      newChats.splice(draggedChatIndex.value, 1)
      
      // Insert at new position
      // Adjust drop index if dragging from above
      const insertIndex = draggedChatIndex.value < dropIndex ? dropIndex - 1 : dropIndex
      newChats.splice(insertIndex, 0, draggedChat)
      
      chats.value = newChats
      dragOverChatIndex.value = null
    }

    const saveApiConfig = (config) => {
      // Use default values if inputs are empty
      const hostname = config.hostname.trim() || 'localhost'
      const port = config.port.trim() || '1234'
      
      const url = `http://${hostname}:${port}`
      setApiBaseUrl(url)
      
      // Save the actual values used (including defaults)
      const configToSave = { hostname, port }
      storage.saveApiConfig(configToSave)
      apiConfig.value = configToSave
      
      showApiModal.value = false
      loadModels()
    }

    const openApiModal = () => {
      showApiModal.value = true
    }

    const loadApiConfig = () => {
      const saved = storage.loadApiConfig()
      if (saved) {
        apiConfig.value = saved
        const url = `http://${apiConfig.value.hostname}:${apiConfig.value.port}`
        setApiBaseUrl(url)
        return true
      }
      return false
    }

    const loadModels = async () => {
      loadingModels.value = true
      try {
        console.log('Fetching models from LM Studio...')
        const modelList = await fetchModels()
        console.log('Models loaded:', modelList)
        
        models.value = modelList
        
        // Set selected model if none is set or if saved model is not available
        if (modelList.length > 0) {
          if (!selectedModel.value || !modelList.find(m => m.id === selectedModel.value)) {
            selectedModel.value = modelList[0].id
            console.log('Selected model:', selectedModel.value)
          }
        } else {
          console.warn('No models available. Please load a model in LM Studio.')
        }
      } catch (error) {
        console.error('Failed to load models:', error.message)
        models.value = []
        // Show error in UI
        alert(`Failed to load models: ${error.message}\n\nPlease make sure:\n1. LM Studio is running\n2. Local server is started in LM Studio\n3. At least one model is loaded`)
      } finally {
        loadingModels.value = false
      }
    }

    const loadFromLocalStorage = () => {
      try {
        console.log('Loading from localStorage...')
        const data = storage.loadAllData()

        if (data.chats) {
          chats.value = data.chats
          console.log('Loaded chats:', chats.value.length)
        }
        
        if (data.activeChat) {
          activeChatId.value = data.activeChat
          console.log('Active chat ID:', activeChatId.value)
        }
        
        if (data.selectedModel) {
          selectedModel.value = data.selectedModel
          console.log('Selected model:', selectedModel.value)
        }
        
        if (data.chatCounter) {
          chatIdCounter = data.chatCounter
          console.log('Chat counter:', chatIdCounter)
        }

        if (data.sidebarCollapsed !== undefined) {
          sidebarCollapsed.value = data.sidebarCollapsed
        } else {
          // If no saved state, collapse sidebar by default on small screens
          sidebarCollapsed.value = window.innerWidth < 1024
        }

        // If no chats were loaded, create a new one
        if (chats.value.length === 0) {
          console.log('No saved chats, creating new one')
          createNewChat()
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error)
        createNewChat()
      }
    }

    // Watch for changes and save to localStorage
    watch(chats, () => {
      storage.saveChats(chats.value)
    }, { deep: true })

    watch(activeChatId, (newId) => {
      storage.saveActiveChat(newId)
    })

    watch(selectedModel, (newModel) => {
      console.log('Model changed to:', newModel)
      storage.saveSelectedModel(newModel)
    })

    onMounted(() => {
      loadFromLocalStorage()
      // Check if API config exists, otherwise show modal
      if (loadApiConfig()) {
        loadModels()
      } else {
        showApiModal.value = true
      }
    })

    // Add updateChatTitle handler for ChatView
    // Accept chatId and newTitle to match event signature
    const updateChatTitle = (chatId, newTitle) => {
      updateChat(chatId, chat => { chat.title = newTitle })
    }


    // Download all chats as JSON using a hidden <a> element
    const downloadLink = ref(null)
    const downloadUrl = ref('')
    const downloadFilename = ref('')
    const downloadChats = () => {
      // Clean up previous URL if any
      if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value)
      const { url, filename } = createChatBackup({
        chats: chats.value,
        activeChatId: activeChatId.value,
        selectedModel: selectedModel.value,
        chatIdCounter
      })
      downloadUrl.value = url
      downloadFilename.value = filename
      // Wait for DOM update, then trigger download
      nextTick(() => {
        if (downloadLink.value && downloadLink.value.triggerDownload) {
          downloadLink.value.triggerDownload()
        }
      })
    }

    // Restore chats from uploaded JSON
    const handleRestoreChats = (data) => {
      try {
        const restored = restoreChats(data)
        chats.value = restored.chats
        activeChatId.value = restored.activeChat
        selectedModel.value = restored.selectedModel
        chatIdCounter = restored.chatCounter
        // Persist to storage
        storage.saveAllData({
          chats: chats.value,
          activeChat: activeChatId.value,
          selectedModel: selectedModel.value,
          chatCounter: chatIdCounter
        })
        alert('Chats restored successfully!')
      } catch (err) {
        alert('Failed to restore chats: ' + (err.message || err))
      }
    }

    return {
      chats,
      activeChat,
      activeChatId,
      currentChat,
      models,
      selectedModel,
      loadingModels,
      showApiModal,
      apiConfig,
      sidebarCollapsed,
      draggedChatIndex,
      dragOverChatIndex,
      isAnyLoading,
      saveApiConfig,
      openApiModal,
      createNewChat,
      switchChat,
      deleteChat,
      toggleSidebar,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      updateChatTitle,
      questionToScroll,
      handleQuestionClick,
      clearQuestionToScroll,
      downloadChats,
      downloadLink,
      downloadUrl,
      downloadFilename,
      handleRestoreChats,
      createChatBackup // for testing
    }
  }
}
</script>
