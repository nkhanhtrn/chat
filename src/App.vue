<template>
  <div class="app">
    <!-- API Configuration Modal -->
    <ApiConfigModal 
      :show="showApiModal"
      :hostname="apiConfig.hostname"
      :port="apiConfig.port"
      @save="saveApiConfig"
      @close="showApiModal = false"
    />

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
          :chat="chat"
          :active="activeChatId === chat.id"
          :dragOver="dragOverChatIndex === index"
          :finishEditingTitle="finishEditingTitle"
          :startEditingTitle="startEditingTitle"
          :deleteChat="deleteChat"
          :onClick="() => switchChat(chat.id)"
          :onDragStart="(e) => handleDragStart(e, index)"
          :onDragEnd="handleDragEnd"
          :onDragOver="(e) => handleDragOver(e, index)"
          :onDragLeave="handleDragLeave"
          :onDrop="(e) => handleDrop(e, index)"
        />
      </div>
    </div>

    <div class="main-content">
      <ChatView 
        v-if="currentChat"
        :chat="currentChat"
        :selectedModel="selectedModel"
        :global-loading="isAnyLoading"
        @update-title="updateChatTitle"
        @loading-change="isAnyLoading = $event"
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
import ApiConfigModal from './components/ApiConfigModal.vue'
import ChatThread from './components/ChatThread.vue'
import { fetchModels, setApiBaseUrl } from './services/api.js'
import * as storage from './services/storage.js'

export default {
  name: 'App',
  components: {
    ChatView,
    ApiConfigModal,
    ChatThread,
  },
  setup() {
    const { chats, activeChatId, activeChat, setChats, setActiveChat, addChat, updateChat } = useChatStore()
    const models = ref([])
    const selectedModel = ref('')
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

    const updateChatTitle = (chatId, newTitle) => {
      updateChat(chatId, chat => { chat.title = newTitle })
    }

    const startEditingTitle = (chat) => {
      chat.editing = true
      nextTick(() => {
        const inputs = document.querySelectorAll('.chat-title-input')
        const input = inputs[inputs.length - 1]
        if (input) {
          input.focus()
          input.select()
        }
      })
    }

    const finishEditingTitle = (chat) => {
      chat.editing = false
      if (!chat.title.trim()) {
        chat.title = 'New Chat'
      }
    }

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
      updateChatTitle,
      startEditingTitle,
      finishEditingTitle,
      toggleSidebar,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDragLeave,
      handleDrop
    }
  }
}
</script>
