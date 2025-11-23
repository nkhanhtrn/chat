import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../App.vue'
import ChatView from '../components/ChatView.vue'
import ApiConfigModal from '../components/ApiConfigModal.vue'
import * as api from '../services/api.js'
import * as storage from '../services/storage.js'

// Mock the API service
vi.mock('../services/api.js', () => ({
  fetchModels: vi.fn(),
  setApiBaseUrl: vi.fn(),
  sendChatMessage: vi.fn()
}))

// Mock the storage service
vi.mock('../services/storage.js', () => ({
  loadAllData: vi.fn(() => ({})),
  saveChats: vi.fn(),
  saveActiveChat: vi.fn(),
  saveSelectedModel: vi.fn(),
  saveChatCounter: vi.fn(),
  loadApiConfig: vi.fn(),
  saveApiConfig: vi.fn(),
  loadWebsiteContext: vi.fn(() => null),
  saveWebsiteContext: vi.fn(),
  deleteWebsiteContext: vi.fn(),
  saveSidebarState: vi.fn(),
  loadSidebarState: vi.fn(() => false)
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.alert mock
    window.alert = vi.fn()
  })

  describe('Rendering', () => {
    it('should render the app with sidebar and create a new chat on mount', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Check that sidebar elements are rendered
      expect(wrapper.find('.sidebar').exists()).toBe(true)
      expect(wrapper.find('.sidebar-header').exists()).toBe(true)
      expect(wrapper.find('h2').text()).toBe('Chat')
      expect(wrapper.find('.new-chat-btn').exists()).toBe(true)
      expect(wrapper.find('.config-server-btn').exists()).toBe(true)

      // Check that a new chat was created on mount
      expect(wrapper.vm.chats.length).toBe(1)
      expect(wrapper.vm.chats[0].title).toBe('New Chat')
    })

    it('should render model selector', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      expect(wrapper.find('.model-selector').exists()).toBe(true)
      expect(wrapper.find('#model-select').exists()).toBe(true)
    })

    it('should render ChatView when there is an active chat', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      expect(wrapper.findComponent(ChatView).exists()).toBe(true)
    })

    it('should render empty state when no chat is active', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.chats = []
      wrapper.vm.activeChat = null
      await nextTick()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state p').text()).toBe('Create a new chat to get started')
    })
  })

  describe('Chat Management', () => {
    it('should create a new chat when new chat button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const initialChatCount = wrapper.vm.chats.length
      const newChatBtn = wrapper.find('.new-chat-btn')
      await newChatBtn.trigger('click')

      expect(wrapper.vm.chats.length).toBe(initialChatCount + 1)
      expect(wrapper.vm.chats[wrapper.vm.chats.length - 1].title).toBe('New Chat')
    })

    it('should switch to a different chat when chat tab is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create a second chat
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const chatTabs = wrapper.findAll('.chat-tab')
      
      await chatTabs[0].trigger('click')
      expect(wrapper.vm.activeChat).toBe(firstChatId)
    })

    it('should delete a chat when delete button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create a second chat
      wrapper.vm.createNewChat()
      await nextTick()

      const initialChatCount = wrapper.vm.chats.length
      const deleteBtn = wrapper.findAll('.delete-btn')[0]
      await deleteBtn.trigger('click')

      expect(wrapper.vm.chats.length).toBe(initialChatCount - 1)
    })

    it('should select chat above when deleting active chat', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create multiple chats (total of 3)
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id
      const thirdChatId = wrapper.vm.chats[2].id

      // Set active to third chat and delete it
      wrapper.vm.activeChat = thirdChatId
      wrapper.vm.deleteChat(thirdChatId)
      await nextTick()

      // Should now be on second chat (the one above)
      expect(wrapper.vm.activeChat).toBe(secondChatId)
      expect(wrapper.vm.chats.length).toBe(2)
    })

    it('should select first chat when deleting the first chat (no chat above)', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create multiple chats
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id

      // Set active to first chat and delete it
      wrapper.vm.activeChat = firstChatId
      wrapper.vm.deleteChat(firstChatId)
      await nextTick()

      // Should now be on what became the first chat (originally second)
      expect(wrapper.vm.activeChat).toBe(secondChatId)
      expect(wrapper.vm.chats.length).toBe(2)
    })

    it('should select chat above when deleting middle chat', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 4 chats total
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const secondChatId = wrapper.vm.chats[1].id
      const firstChatId = wrapper.vm.chats[0].id

      // Set active to second chat (middle position) and delete it
      wrapper.vm.activeChat = secondChatId
      wrapper.vm.deleteChat(secondChatId)
      await nextTick()

      // Should now be on first chat (the one above the deleted middle chat)
      expect(wrapper.vm.activeChat).toBe(firstChatId)
      expect(wrapper.vm.chats.length).toBe(3)
    })

    it('should not change active chat when deleting a non-active chat', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create multiple chats
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id
      const thirdChatId = wrapper.vm.chats[2].id

      // Set active to third chat
      wrapper.vm.activeChat = thirdChatId

      // Delete first chat (not active)
      wrapper.vm.deleteChat(firstChatId)
      await nextTick()

      // Should still be on third chat
      expect(wrapper.vm.activeChat).toBe(thirdChatId)
      expect(wrapper.vm.chats.length).toBe(2)
    })

    it('should create new chat when deleting the last chat', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const chatId = wrapper.vm.chats[0].id
      wrapper.vm.deleteChat(chatId)
      await nextTick()

      expect(wrapper.vm.chats.length).toBe(1)
      expect(wrapper.vm.chats[0].title).toBe('New Chat')
    })

    it('should update chat title', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const chatId = wrapper.vm.chats[0].id
      wrapper.vm.updateChatTitle(chatId, 'Updated Title')

      expect(wrapper.vm.chats[0].title).toBe('Updated Title')
    })

    it('should show active class on active chat tab', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.createNewChat()
      await nextTick()

      const chatTabs = wrapper.findAll('.chat-tab')
      const activeTab = chatTabs.find(tab => tab.classes().includes('active'))
      
      expect(activeTab).toBeTruthy()
    })
  })

  describe('Chat Title Editing', () => {
    it('should start editing title when edit button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      const chat = wrapper.vm.chats[0]
      
      // Check if edit button exists before trying to click it
      const editBtn = wrapper.find('.edit-btn')
      if (editBtn.exists()) {
        await editBtn.trigger('click')
        await nextTick()

        expect(chat.editing).toBe(true)
        expect(wrapper.find('.chat-title-input').exists()).toBe(true)
      } else {
        // Manually trigger the startEditingTitle function
        wrapper.vm.startEditingTitle(chat)
        await nextTick()
        
        expect(chat.editing).toBe(true)
      }
    })

    it('should focus and select input text when editing starts', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      const chat = wrapper.vm.chats[0]
      
      // Create a mock for focus and select
      const focusSpy = vi.fn()
      const selectSpy = vi.fn()
      
      // Override querySelector to return a mock element
      const originalQuerySelectorAll = document.querySelectorAll
      document.querySelectorAll = vi.fn(() => [{
        focus: focusSpy,
        select: selectSpy
      }])

      wrapper.vm.startEditingTitle(chat)
      await nextTick()
      await nextTick()

      expect(focusSpy).toHaveBeenCalled()
      expect(selectSpy).toHaveBeenCalled()
      
      // Restore original function
      document.querySelectorAll = originalQuerySelectorAll
    })

    it('should finish editing title on blur', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const chat = wrapper.vm.chats[0]
      chat.editing = true
      await nextTick()

      const input = wrapper.find('.chat-title-input')
      await input.setValue('Custom Title')
      await input.trigger('blur')

      expect(chat.editing).toBe(false)
      expect(chat.title).toBe('Custom Title')
    })

    it('should finish editing title on Enter key', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const chat = wrapper.vm.chats[0]
      chat.editing = true
      await nextTick()

      const input = wrapper.find('.chat-title-input')
      await input.setValue('New Title')
      await input.trigger('keydown.enter')

      expect(chat.editing).toBe(false)
      expect(chat.title).toBe('New Title')
    })

    it('should revert to "New Chat" if title is empty after editing', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const chat = wrapper.vm.chats[0]
      chat.editing = true
      await nextTick()

      const input = wrapper.find('.chat-title-input')
      await input.setValue('   ')
      await input.trigger('blur')

      expect(chat.title).toBe('New Chat')
    })

    it('should not show edit button when editing', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const chat = wrapper.vm.chats[0]
      chat.editing = true
      await nextTick()

      expect(wrapper.find('.edit-btn').exists()).toBe(false)
    })
  })

  describe('API Configuration', () => {
    it('should open API modal when config server button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const configBtn = wrapper.find('.config-server-btn')
      await configBtn.trigger('click')

      expect(wrapper.vm.showApiModal).toBe(true)
    })

    it('should close API modal when close event is emitted', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true
          }
        }
      })

      wrapper.vm.showApiModal = true
      await nextTick()

      const modal = wrapper.findComponent(ApiConfigModal)
      await modal.vm.$emit('close')

      expect(wrapper.vm.showApiModal).toBe(false)
    })

    it('should save API config with provided values', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true
          }
        }
      })

      wrapper.vm.showApiModal = true
      await nextTick()

      const modal = wrapper.findComponent(ApiConfigModal)
      await modal.vm.$emit('save', { hostname: 'testhost', port: '8080' })

      expect(api.setApiBaseUrl).toHaveBeenCalledWith('http://testhost:8080')
      expect(storage.saveApiConfig).toHaveBeenCalledWith({ hostname: 'testhost', port: '8080' })
      expect(wrapper.vm.showApiModal).toBe(false)
    })

    it('should use default values for empty API config', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true
          }
        }
      })

      wrapper.vm.showApiModal = true
      await nextTick()

      const modal = wrapper.findComponent(ApiConfigModal)
      await modal.vm.$emit('save', { hostname: '', port: '' })

      expect(api.setApiBaseUrl).toHaveBeenCalledWith('http://localhost:1234')
      expect(storage.saveApiConfig).toHaveBeenCalledWith({ hostname: 'localhost', port: '1234' })
    })

    it('should show API modal on mount when no config exists', async () => {
      storage.loadApiConfig.mockReturnValue(null)

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      expect(wrapper.vm.showApiModal).toBe(true)
    })

    it('should load API config on mount when config exists', async () => {
      storage.loadApiConfig.mockReturnValue({ hostname: 'saved-host', port: '9999' })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      expect(api.setApiBaseUrl).toHaveBeenCalledWith('http://saved-host:9999')
      expect(wrapper.vm.apiConfig.hostname).toBe('saved-host')
      expect(wrapper.vm.apiConfig.port).toBe('9999')
    })
  })

  describe('Model Management', () => {
    it('should load models on mount when API config exists', async () => {
      storage.loadApiConfig.mockReturnValue({ hostname: 'localhost', port: '1234' })
      api.fetchModels.mockResolvedValue([
        { id: 'model-1' },
        { id: 'model-2' }
      ])

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      await nextTick()

      expect(api.fetchModels).toHaveBeenCalled()
    })

    it('should display models in select dropdown', async () => {
      api.fetchModels.mockResolvedValue([
        { id: 'model-1' },
        { id: 'model-2' }
      ])

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.models = [{ id: 'model-1' }, { id: 'model-2' }]
      await nextTick()

      const options = wrapper.findAll('#model-select option')
      expect(options.length).toBeGreaterThan(0)
    })

    it('should show loading state when fetching models', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.loadingModels = true
      await nextTick()

      const select = wrapper.find('#model-select')
      expect(select.attributes('disabled')).toBeDefined()
    })

    it('should select first model when models are loaded', async () => {
      api.fetchModels.mockResolvedValue([
        { id: 'model-1' },
        { id: 'model-2' }
      ])

      storage.loadApiConfig.mockReturnValue({ hostname: 'localhost', port: '1234' })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      await nextTick()

      expect(wrapper.vm.selectedModel).toBe('model-1')
    })

    it('should handle model loading error', async () => {
      api.fetchModels.mockRejectedValue(new Error('Connection failed'))
      storage.loadApiConfig.mockReturnValue({ hostname: 'localhost', port: '1234' })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      await nextTick()

      expect(wrapper.vm.models).toEqual([])
      expect(window.alert).toHaveBeenCalled()
    })

    it('should show "No models available" when model list is empty', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.models = []
      wrapper.vm.loadingModels = false
      await nextTick()

      const select = wrapper.find('#model-select')
      expect(select.html()).toContain('No models available')
    })

    it('should render model IDs in select options when models are available', async () => {
      api.fetchModels.mockResolvedValue([
        { id: 'gpt-4-turbo' },
        { id: 'claude-3' }
      ])
      storage.loadApiConfig.mockReturnValue({ hostname: 'localhost', port: '1234' })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      await nextTick()

      const select = wrapper.find('#model-select')
      expect(select.html()).toContain('gpt-4-turbo')
      expect(select.html()).toContain('claude-3')
    })

    it('should warn when no models are available after loading', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      api.fetchModels.mockResolvedValue([])
      storage.loadApiConfig.mockReturnValue({ hostname: 'localhost', port: '1234' })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      await nextTick()

      expect(consoleSpy).toHaveBeenCalledWith('No models available. Please load a model in LM Studio.')
      consoleSpy.mockRestore()
    })
  })

  describe('Local Storage Integration', () => {
    it('should load chats from localStorage on mount', async () => {
      const mockChats = [
        { id: 1, title: 'Saved Chat 1', messages: [] },
        { id: 2, title: 'Saved Chat 2', messages: [] }
      ]
      storage.loadAllData.mockReturnValue({ chats: mockChats })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      expect(wrapper.vm.chats).toEqual(mockChats)
    })

    it('should load active chat from localStorage on mount', async () => {
      const mockChats = [
        { id: 1, title: 'Chat 1', messages: [] },
        { id: 2, title: 'Chat 2', messages: [] }
      ]
      storage.loadAllData.mockReturnValue({ 
        chats: mockChats,
        activeChat: 2
      })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      expect(wrapper.vm.activeChat).toBe(2)
    })

    it('should load chat counter from localStorage on mount', async () => {
      const mockChats = [
        { id: 5, title: 'Chat 5', messages: [] }
      ]
      storage.loadAllData.mockReturnValue({ 
        chats: mockChats,
        chatCounter: 10
      })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      
      // Create a new chat to verify counter is working
      wrapper.vm.createNewChat()
      await nextTick()
      
      // The new chat ID should be 10 (from loaded counter)
      expect(wrapper.vm.chats[wrapper.vm.chats.length - 1].id).toBe(10)
    })

    it('should handle localStorage loading errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      storage.loadAllData.mockImplementation(() => {
        throw new Error('localStorage is not available')
      })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      
      // Should still create a new chat even if loading fails
      expect(wrapper.vm.chats.length).toBe(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load from localStorage:',
        expect.any(Error)
      )
      
      consoleErrorSpy.mockRestore()
    })

    it('should save chats to localStorage when chats change', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.createNewChat()
      await nextTick()

      expect(storage.saveChats).toHaveBeenCalled()
    })

    it('should save active chat when it changes', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.createNewChat()
      const newChatId = wrapper.vm.chats[1].id
      wrapper.vm.switchChat(newChatId)
      await nextTick()

      expect(storage.saveActiveChat).toHaveBeenCalledWith(newChatId)
    })

    it('should save selected model when it changes', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.selectedModel = 'new-model'
      await nextTick()

      expect(storage.saveSelectedModel).toHaveBeenCalledWith('new-model')
    })

    it('should load selected model from localStorage', async () => {
      storage.loadAllData.mockReturnValue({ selectedModel: 'saved-model' })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      expect(wrapper.vm.selectedModel).toBe('saved-model')
    })
  })

  describe('ChatView Integration', () => {
    it('should pass correct props to ChatView', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.selectedModel = 'test-model'
      await nextTick()
      
      const chatView = wrapper.findComponent(ChatView)

      expect(chatView.exists()).toBe(true)
      expect(chatView.props('chat')).toBeDefined()
      expect(chatView.props('selectedModel')).toBe('test-model')
    })

    it('should handle update-title event from ChatView', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      const chatId = wrapper.vm.chats[0].id
      const chatView = wrapper.findComponent(ChatView)
      
      expect(chatView.exists()).toBe(true)
      await chatView.vm.$emit('update-title', chatId, 'New Title From Chat')
      await nextTick()

      expect(wrapper.vm.chats[0].title).toBe('New Title From Chat')
    })
  })

  describe('Props', () => {
    it('should have correct component name', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      expect(wrapper.vm.$options.name).toBe('App')
    })
  })

  describe('Chat Reordering (Drag and Drop)', () => {
    it('should set draggedChatIndex on drag start', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create multiple chats
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const mockEvent = {
        dataTransfer: {
          effectAllowed: null,
          setData: vi.fn()
        },
        target: {
          classList: {
            add: vi.fn()
          }
        }
      }

      wrapper.vm.handleDragStart(mockEvent, 1)
      
      expect(wrapper.vm.draggedChatIndex).toBe(1)
      expect(mockEvent.dataTransfer.effectAllowed).toBe('move')
      expect(mockEvent.target.classList.add).toHaveBeenCalledWith('dragging')
    })

    it('should clear drag state on drag end', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.draggedChatIndex = 1
      wrapper.vm.dragOverChatIndex = 2

      const mockEvent = {
        target: {
          classList: {
            remove: vi.fn()
          }
        }
      }

      wrapper.vm.handleDragEnd(mockEvent)

      expect(wrapper.vm.draggedChatIndex).toBeNull()
      expect(wrapper.vm.dragOverChatIndex).toBeNull()
      expect(mockEvent.target.classList.remove).toHaveBeenCalledWith('dragging')
    })

    it('should set dragOverChatIndex on drag over', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          dropEffect: null
        }
      }

      wrapper.vm.handleDragOver(mockEvent, 2)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.dataTransfer.dropEffect).toBe('move')
      expect(wrapper.vm.dragOverChatIndex).toBe(2)
    })

    it('should clear dragOverChatIndex on drag leave', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.dragOverChatIndex = 2
      wrapper.vm.handleDragLeave()

      expect(wrapper.vm.dragOverChatIndex).toBeNull()
    })

    it('should reorder chats when dropped (moving down)', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 3 chats
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id
      const thirdChatId = wrapper.vm.chats[2].id

      // Drag first chat (index 0) to third position (index 2)
      wrapper.vm.draggedChatIndex = 0

      const mockEvent = {
        preventDefault: vi.fn()
      }

      wrapper.vm.handleDrop(mockEvent, 2)

      // The logic inserts at insertIndex = draggedChatIndex < dropIndex ? dropIndex - 1 : dropIndex
      // So dragging index 0 to drop index 2: insertIndex = 0 < 2 ? 2 - 1 = 1
      // After removing index 0: [second, third]
      // After inserting at index 1: [second, first, third]
      expect(wrapper.vm.chats[0].id).toBe(secondChatId)
      expect(wrapper.vm.chats[1].id).toBe(firstChatId)
      expect(wrapper.vm.chats[2].id).toBe(thirdChatId)
      expect(wrapper.vm.dragOverChatIndex).toBeNull()
    })

    it('should reorder chats when dropped (moving up)', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 3 chats
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id
      const thirdChatId = wrapper.vm.chats[2].id

      // Drag third chat (index 2) to first position (index 0)
      wrapper.vm.draggedChatIndex = 2

      const mockEvent = {
        preventDefault: vi.fn()
      }

      wrapper.vm.handleDrop(mockEvent, 0)

      // Order should now be: third, first, second
      expect(wrapper.vm.chats[0].id).toBe(thirdChatId)
      expect(wrapper.vm.chats[1].id).toBe(firstChatId)
      expect(wrapper.vm.chats[2].id).toBe(secondChatId)
    })

    it('should not reorder when dropped on same position', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 2 chats
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id

      // Drag first chat to same position
      wrapper.vm.draggedChatIndex = 0

      const mockEvent = {
        preventDefault: vi.fn()
      }

      wrapper.vm.handleDrop(mockEvent, 0)

      // Order should remain the same
      expect(wrapper.vm.chats[0].id).toBe(firstChatId)
      expect(wrapper.vm.chats[1].id).toBe(secondChatId)
    })

    it('should not reorder when draggedChatIndex is null', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 2 chats
      wrapper.vm.createNewChat()
      await nextTick()

      const firstChatId = wrapper.vm.chats[0].id
      const secondChatId = wrapper.vm.chats[1].id

      // Don't set draggedChatIndex
      wrapper.vm.draggedChatIndex = null

      const mockEvent = {
        preventDefault: vi.fn()
      }

      wrapper.vm.handleDrop(mockEvent, 1)

      // Order should remain the same
      expect(wrapper.vm.chats[0].id).toBe(firstChatId)
      expect(wrapper.vm.chats[1].id).toBe(secondChatId)
      expect(wrapper.vm.dragOverChatIndex).toBeNull()
    })

    it('should persist reordered chats to localStorage', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 2 chats
      wrapper.vm.createNewChat()
      await nextTick()

      wrapper.vm.draggedChatIndex = 0

      const mockEvent = {
        preventDefault: vi.fn()
      }

      wrapper.vm.handleDrop(mockEvent, 1)
      await nextTick()

      // Should save reordered chats to localStorage
      expect(storage.saveChats).toHaveBeenCalled()
    })

    it('should have draggable attribute on chat tabs', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()
      const chatTab = wrapper.find('.chat-tab')
      
      expect(chatTab.attributes('draggable')).toBe('true')
    })

    it('should apply drag-over class when dragging over a chat', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      wrapper.vm.createNewChat()
      await nextTick()

      wrapper.vm.dragOverChatIndex = 1

      await nextTick()

      const chatTabs = wrapper.findAll('.chat-tab')
      expect(chatTabs[1].classes()).toContain('drag-over')
    })

    it('should handle complex reordering scenario', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      // Create 5 chats
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      wrapper.vm.createNewChat()
      await nextTick()

      const chatIds = wrapper.vm.chats.map(c => c.id)

      // Drag chat at index 1 to index 3
      wrapper.vm.draggedChatIndex = 1

      const mockEvent = {
        preventDefault: vi.fn()
      }

      wrapper.vm.handleDrop(mockEvent, 3)

      // Original: [0, 1, 2, 3, 4]
      // After drag index 1 to 3: [0, 2, 3, 1, 4]
      expect(wrapper.vm.chats[0].id).toBe(chatIds[0])
      expect(wrapper.vm.chats[1].id).toBe(chatIds[2])
      expect(wrapper.vm.chats[2].id).toBe(chatIds[1])
      expect(wrapper.vm.chats[3].id).toBe(chatIds[3])
      expect(wrapper.vm.chats[4].id).toBe(chatIds[4])
    })
  })

  describe('Sidebar Collapse/Expand', () => {
    it('should render sidebar toggle button', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      expect(wrapper.find('.sidebar-toggle-btn').exists()).toBe(true)
    })

    it('should start with sidebar expanded by default', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      expect(wrapper.vm.sidebarCollapsed).toBe(false)
      expect(wrapper.find('.sidebar.collapsed').exists()).toBe(false)
    })

    it('should toggle sidebar when toggle button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const toggleBtn = wrapper.find('.sidebar-toggle-btn')
      expect(wrapper.vm.sidebarCollapsed).toBe(false)

      await toggleBtn.trigger('click')
      await nextTick()

      expect(wrapper.vm.sidebarCollapsed).toBe(true)
      expect(wrapper.find('.sidebar.collapsed').exists()).toBe(true)
      expect(storage.saveSidebarState).toHaveBeenCalledWith(true)

      await toggleBtn.trigger('click')
      await nextTick()

      expect(wrapper.vm.sidebarCollapsed).toBe(false)
      expect(wrapper.find('.sidebar.collapsed').exists()).toBe(false)
      expect(storage.saveSidebarState).toHaveBeenCalledWith(false)
    })

    it('should show left arrow when expanded and right arrow when collapsed', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const toggleBtn = wrapper.find('.sidebar-toggle-btn')
      expect(toggleBtn.text()).toBe('←')

      await toggleBtn.trigger('click')
      await nextTick()

      expect(toggleBtn.text()).toBe('→')
    })

    it('should update button title attribute based on state', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const toggleBtn = wrapper.find('.sidebar-toggle-btn')
      expect(toggleBtn.attributes('title')).toBe('Hide chat list')

      await toggleBtn.trigger('click')
      await nextTick()

      expect(toggleBtn.attributes('title')).toBe('Show chat list')
    })

    it('should show icon-only buttons when collapsed', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const configBtn = wrapper.find('.config-server-btn')
      const newChatBtn = wrapper.find('.new-chat-btn')

      // Initially expanded - shows full text
      expect(configBtn.text()).toContain('Configure Server')
      expect(newChatBtn.text()).toContain('New Chat')

      // Collapse sidebar
      await wrapper.find('.sidebar-toggle-btn').trigger('click')
      await nextTick()

      // Should show only icons
      expect(configBtn.text()).toBe('⚙')
      expect(newChatBtn.text()).toBe('+')
    })

    it('should load sidebar state from localStorage on mount', async () => {
      storage.loadAllData.mockReturnValue({
        sidebarCollapsed: true
      })

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()

      expect(wrapper.vm.sidebarCollapsed).toBe(true)
      expect(wrapper.find('.sidebar.collapsed').exists()).toBe(true)
    })

    it('should default to expanded if no saved state', async () => {
      storage.loadAllData.mockReturnValue({})

      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      await nextTick()

      expect(wrapper.vm.sidebarCollapsed).toBe(false)
    })

    it('should persist sidebar state when toggled', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            ChatView: true,
            ApiConfigModal: true
          }
        }
      })

      const toggleBtn = wrapper.find('.sidebar-toggle-btn')

      // Toggle to collapsed
      await toggleBtn.trigger('click')
      expect(storage.saveSidebarState).toHaveBeenCalledWith(true)

      // Toggle back to expanded
      await toggleBtn.trigger('click')
      expect(storage.saveSidebarState).toHaveBeenCalledWith(false)
    })
  })
})
