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

    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Chat</h2>
        <button @click="openApiModal" class="config-server-btn">⚙ Configure Server</button>
        <button @click="createNewChat" class="new-chat-btn">+ New Chat</button>
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
        <div 
          v-for="(chat, index) in chats" 
          :key="chat.id"
          :class="['chat-tab', { active: activeChat === chat.id }]"
          @click="switchChat(chat.id)"
        >
          <input
            v-if="chat.editing"
            v-model="chat.title"
            @click.stop
            @keydown.enter="finishEditingTitle(chat)"
            @blur="finishEditingTitle(chat)"
            class="chat-title-input"
            ref="titleInput"
          />
          <span v-else class="chat-title">{{ chat.title }}</span>
          <div class="chat-actions">
            <button 
              v-if="!chat.editing"
              @click.stop="startEditingTitle(chat)" 
              class="edit-btn"
            >
              ✎
            </button>
            <button 
              @click.stop="deleteChat(chat.id)" 
              class="delete-btn"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <ChatView 
        v-if="currentChat"
        :chat="currentChat"
        :selectedModel="selectedModel"
        @update-title="updateChatTitle"
      />
      <div v-else class="empty-state">
        <p>Create a new chat to get started</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import ChatView from './components/ChatView.vue'
import ApiConfigModal from './components/ApiConfigModal.vue'
import { fetchModels, setApiBaseUrl } from './services/api.js'
import * as storage from './services/storage.js'

export default {
  name: 'App',
  components: {
    ChatView,
    ApiConfigModal
  },
  setup() {
    const chats = ref([])
    const activeChat = ref(null)
    const models = ref([])
    const selectedModel = ref('')
    const loadingModels = ref(false)
    const showApiModal = ref(false)
    const apiConfig = ref({
      hostname: '',
      port: ''
    })
    let chatIdCounter = 1

    const currentChat = computed(() => {
      return chats.value.find(chat => chat.id === activeChat.value)
    })

    const createNewChat = () => {
      const newChat = {
        id: chatIdCounter++,
        title: `New Chat`,
        messages: []
      }
      chats.value.push(newChat)
      activeChat.value = newChat.id
      storage.saveChatCounter(chatIdCounter)
    }

    const switchChat = (chatId) => {
      activeChat.value = chatId
    }

    const deleteChat = (chatId) => {
      const index = chats.value.findIndex(chat => chat.id === chatId)
      if (index !== -1) {
        chats.value.splice(index, 1)
        
        // Delete associated website context
        storage.deleteWebsiteContext(chatId)
        
        if (activeChat.value === chatId) {
          if (chats.value.length > 0) {
            activeChat.value = chats.value[0].id
          } else {
            // Create a new empty chat when the last one is deleted
            createNewChat()
            return
          }
        }
      }
    }

    const updateChatTitle = (chatId, newTitle) => {
      const chat = chats.value.find(c => c.id === chatId)
      if (chat) {
        chat.title = newTitle
      }
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
          activeChat.value = data.activeChat
          console.log('Active chat:', activeChat.value)
        }
        
        if (data.selectedModel) {
          selectedModel.value = data.selectedModel
          console.log('Selected model:', selectedModel.value)
        }
        
        if (data.chatCounter) {
          chatIdCounter = data.chatCounter
          console.log('Chat counter:', chatIdCounter)
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

    watch(activeChat, () => {
      storage.saveActiveChat(activeChat.value)
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
      currentChat,
      models,
      selectedModel,
      loadingModels,
      showApiModal,
      apiConfig,
      saveApiConfig,
      openApiModal,
      createNewChat,
      switchChat,
      deleteChat,
      updateChatTitle,
      startEditingTitle,
      finishEditingTitle
    }
  }
}
</script>
