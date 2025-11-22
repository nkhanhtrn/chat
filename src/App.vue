<template>
  <div class="app">
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Chat</h2>
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
import { ref, computed, onMounted, watch } from 'vue'
import ChatView from './components/ChatView.vue'
import { fetchModels } from './services/api.js'

const STORAGE_KEY_CHATS = 'chat-chats'
const STORAGE_KEY_ACTIVE = 'chat-active'
const STORAGE_KEY_MODEL = 'chat-model'
const STORAGE_KEY_COUNTER = 'chat-counter'

export default {
  name: 'App',
  components: {
    ChatView
  },
  setup() {
    const chats = ref([])
    const activeChat = ref(null)
    const models = ref([])
    const selectedModel = ref('')
    const loadingModels = ref(false)
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
      saveToLocalStorage()
    }

    const switchChat = (chatId) => {
      activeChat.value = chatId
    }

    const deleteChat = (chatId) => {
      const index = chats.value.findIndex(chat => chat.id === chatId)
      if (index !== -1) {
        chats.value.splice(index, 1)
        
        if (activeChat.value === chatId) {
          if (chats.value.length > 0) {
            activeChat.value = chats.value[0].id
          } else {
            // Create a new empty chat when the last one is deleted
            createNewChat()
            return
          }
        }
        
        saveToLocalStorage()
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
    }

    const finishEditingTitle = (chat) => {
      chat.editing = false
      if (!chat.title.trim()) {
        chat.title = 'New Chat'
      }
      saveToLocalStorage()
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

    const onModelChange = () => {
      console.log('Model changed to:', selectedModel.value)
      saveToLocalStorage()
    }

    const saveToLocalStorage = () => {
      try {
        localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats.value))
        localStorage.setItem(STORAGE_KEY_ACTIVE, activeChat.value)
        localStorage.setItem(STORAGE_KEY_MODEL, selectedModel.value)
        localStorage.setItem(STORAGE_KEY_COUNTER, chatIdCounter)
      } catch (error) {
        console.error('Failed to save to localStorage:', error)
      }
    }

    const loadFromLocalStorage = () => {
      try {
        const savedChats = localStorage.getItem(STORAGE_KEY_CHATS)
        const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE)
        const savedModel = localStorage.getItem(STORAGE_KEY_MODEL)
        const savedCounter = localStorage.getItem(STORAGE_KEY_COUNTER)

        console.log('Loading from localStorage...')

        if (savedChats) {
          const parsedChats = JSON.parse(savedChats)
          
          // Ensure all messages have required properties
          chats.value = parsedChats.map(chat => ({
            ...chat,
            messages: chat.messages.map(msg => ({
              ...msg,
              displayContent: msg.displayContent || msg.content,
              thinking: msg.thinking || null,
              showThinking: msg.showThinking || false
            }))
          }))
          
          console.log('Loaded chats:', chats.value.length)
        }
        
        if (savedActive) {
          activeChat.value = parseInt(savedActive)
          console.log('Active chat:', activeChat.value)
        }
        
        if (savedModel) {
          selectedModel.value = savedModel
          console.log('Selected model:', selectedModel.value)
        }
        
        if (savedCounter) {
          chatIdCounter = parseInt(savedCounter)
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
      saveToLocalStorage()
    }, { deep: true })

    watch(activeChat, () => {
      saveToLocalStorage()
    })

    watch(selectedModel, () => {
      saveToLocalStorage()
    })

    onMounted(() => {
      loadFromLocalStorage()
      loadModels()
    })

    return {
      chats,
      activeChat,
      currentChat,
      models,
      selectedModel,
      loadingModels,
      createNewChat,
      switchChat,
      deleteChat,
      updateChatTitle,
      startEditingTitle,
      finishEditingTitle,
      onModelChange
    }
  }
}
</script>
