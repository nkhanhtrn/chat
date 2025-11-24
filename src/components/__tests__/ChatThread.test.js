import { vi } from 'vitest'
import * as api from '../../services/api.js'
import { mount } from '@vue/test-utils'
import ChatThread from '../ChatThread.vue'
import { useChatStore } from '../../composables/useChatStore.js'

describe('ChatThread', () => {
      it('messageUnits covers assistant=null branch', () => {
        chat.messages = [
          { role: 'user', content: 'Q1' },
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' }
        ]
        const wrapper = mount(ChatThread, {
          props: {
            id: chat.id,
            active: false,
            dragOver: false,
            deleteChat: vi.fn(),
            onClick: vi.fn(),
            onDragStart: vi.fn(),
            onDragEnd: vi.fn(),
            onDragOver: vi.fn(),
            onDragLeave: vi.fn(),
            onDrop: vi.fn(),
            sidebarCollapsed: false
          }
        })
        const units = wrapper.vm.messageUnits
        expect(units.length).toBe(2)
        expect(units[0].assistant).toBe(null)
        expect(units[1].assistant.content).toBe('A2')
        wrapper.unmount()
      })

      it('localTitle setter sets globalChat title', () => {
        const wrapper = mount(ChatThread, {
          props: {
            id: chat.id,
            active: false,
            dragOver: false,
            deleteChat: vi.fn(),
            onClick: vi.fn(),
            onDragStart: vi.fn(),
            onDragEnd: vi.fn(),
            onDragOver: vi.fn(),
            onDragLeave: vi.fn(),
            onDrop: vi.fn(),
            sidebarCollapsed: false
          }
        })
        wrapper.vm.localTitle = 'Setter Title'
        expect(wrapper.vm.globalChat.title).toBe('Setter Title')
        wrapper.unmount()
      })

      it('capitalizeWords method is covered', () => {
        const wrapper = mount(ChatThread, {
          props: {
            id: chat.id,
            active: false,
            dragOver: false,
            deleteChat: vi.fn(),
            onClick: vi.fn(),
            onDragStart: vi.fn(),
            onDragEnd: vi.fn(),
            onDragOver: vi.fn(),
            onDragLeave: vi.fn(),
            onDrop: vi.fn(),
            sidebarCollapsed: false
          }
        })
        expect(wrapper.vm.capitalizeWords('foo bar')).toBe('Foo Bar')
        wrapper.unmount()
      })

      it('onQuestionDragOver covers branch', () => {
        const wrapper = mount(ChatThread, {
          props: {
            id: chat.id,
            active: false,
            dragOver: false,
            deleteChat: vi.fn(),
            onClick: vi.fn(),
            onDragStart: vi.fn(),
            onDragEnd: vi.fn(),
            onDragOver: vi.fn(),
            onDragLeave: vi.fn(),
            onDrop: vi.fn(),
            sidebarCollapsed: false
          }
        })
        wrapper.vm.draggingIdx = 0
        wrapper.vm.onQuestionDragOver(1)
        expect(wrapper.vm.dragOverIdx).toBe(1)
        wrapper.unmount()
      })

      it('onQuestionDragEnd sets draggingIdx and dragOverIdx to null', () => {
        const wrapper = mount(ChatThread, {
          props: {
            id: chat.id,
            active: false,
            dragOver: false,
            deleteChat: vi.fn(),
            onClick: vi.fn(),
            onDragStart: vi.fn(),
            onDragEnd: vi.fn(),
            onDragOver: vi.fn(),
            onDragLeave: vi.fn(),
            onDrop: vi.fn(),
            sidebarCollapsed: false
          }
        })
        wrapper.vm.draggingIdx = 2
        wrapper.vm.dragOverIdx = 3
        wrapper.vm.onQuestionDragEnd()
        expect(wrapper.vm.draggingIdx).toBe(null)
        expect(wrapper.vm.dragOverIdx).toBe(null)
        wrapper.unmount()
      })
    it('does nothing onQuestionDrop if draggingIdx is null or same as idx', async () => {
      const wrapper = mount(ChatThread, {
        props: {
          id: chat.id,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        }
      })
      wrapper.vm.draggingIdx = null
      wrapper.vm.onQuestionDrop(0)
      expect(wrapper.vm.draggingIdx).toBe(null)
      wrapper.vm.draggingIdx = 1
      wrapper.vm.onQuestionDrop(1)
      expect(wrapper.vm.draggingIdx).toBe(null)
      wrapper.unmount()
    })

    it('does nothing onQuestionDrop if no globalChat or messages', async () => {
      store.chats.value = [{ id: 999, messages: null }]
      const wrapper = mount(ChatThread, {
        props: {
          id: 999,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        }
      })
      wrapper.vm.draggingIdx = 0
      wrapper.vm.onQuestionDrop(0)
      expect(wrapper.vm.draggingIdx).toBe(null)
      wrapper.unmount()
    })

    it('does nothing onQuestionDrop if fromUnit or toUnit is missing', async () => {
      chat.messages = [{ role: 'user', content: 'Q1' }]
      const wrapper = mount(ChatThread, {
        props: {
          id: chat.id,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        }
      })
      wrapper.vm.draggingIdx = 1
      wrapper.vm.onQuestionDrop(0)
      expect(wrapper.vm.draggingIdx).toBe(null)
      wrapper.unmount()
    })

    it('saveTitleEdit does nothing if title unchanged or empty', async () => {
      const wrapper = mount(ChatThread, {
        props: {
          id: chat.id,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        }
      })
      wrapper.vm.editingTitle = true
      wrapper.vm.editTitleValue = ''
      wrapper.vm.saveTitleEdit()
      expect(wrapper.vm.editingTitle).toBe(false)
      wrapper.vm.editTitleValue = wrapper.vm.localTitle
      wrapper.vm.editingTitle = true
      wrapper.vm.saveTitleEdit()
      expect(wrapper.vm.editingTitle).toBe(false)
      wrapper.unmount()
    })

    it('onQuestionClick emits and sets active even if no globalChat', async () => {
      store.chats.value = []
      const wrapper = mount(ChatThread, {
        props: {
          id: 999,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        }
      })
      wrapper.vm.onQuestionClick(0)
      expect(wrapper.emitted('question-click')).toBeTruthy()
      wrapper.unmount()
    })

    it('summarizeQuestions handles empty/invalid API response', async () => {
      const sendChatMessage = vi.spyOn(api, 'sendChatMessage').mockResolvedValue('')
      store.selectedModel.value = 'test-model'
      const wrapper = mount(ChatThread, {
        props: {
          id: chat.id,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        }
      })
      window.alert = vi.fn()
      await wrapper.find('.summarize-btn').trigger('click')
      expect(window.alert).toHaveBeenCalled()
      sendChatMessage.mockResolvedValue('a,b,c,d')
      await wrapper.find('.summarize-btn').trigger('click')
      expect(window.alert).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('keyboard events on title input: Enter saves, Escape cancels', async () => {
      const wrapper = mount(ChatThread, {
        props: {
          id: chat.id,
          active: false,
          dragOver: false,
          deleteChat: vi.fn(),
          onClick: vi.fn(),
          onDragStart: vi.fn(),
          onDragEnd: vi.fn(),
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
          sidebarCollapsed: false
        },
        attachTo: document.body
      })
      await wrapper.find('.chat-title').trigger('click')
      await wrapper.vm.$nextTick()
      const input = wrapper.find('input.chat-title-input')
      await input.setValue('New Title 2')
      await input.trigger('keyup.enter')
      expect(wrapper.vm.editingTitle).toBe(false)
      await wrapper.find('.chat-title').trigger('click')
      await wrapper.vm.$nextTick()
      await input.setValue('Another Title')
      await input.trigger('keyup.esc')
      expect(wrapper.vm.editingTitle).toBe(false)
      wrapper.unmount()
    })
  let store
  let chat

  beforeAll(() => {
    vi.useFakeTimers()
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    store = useChatStore()
    store.chats.value = []
    store.activeChatId.value = null
    chat = {
      id: 123,
      title: 'Test Chat',
      messages: [
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Question 2' }
      ]
    }
    store.chats.value.push(chat)
    vi.restoreAllMocks()
  })

  it('sets global activeChatId when question is clicked', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    // Expand questions
    await wrapper.vm.toggleQuestions()
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('.chat-question-item')
    expect(items.length).toBe(2)
    // Click the first question
    await items[0].trigger('click')
    expect(store.activeChatId.value).toBe(chat.id)
  })

  it('emits question-click event with correct payload when a question is clicked', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    // Expand questions
    await wrapper.vm.toggleQuestions()
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('.chat-question-item')
    // Click the second question (index 1)
    await items[1].trigger('click')
    // Should emit question-click with chatId and questionIndex
    expect(wrapper.emitted('question-click')).toBeTruthy()
    const eventPayload = wrapper.emitted('question-click')[0][0]
    expect(eventPayload).toEqual({ chatId: chat.id, questionIndex: 1 })
  })

  it('allows editing the chat title and updates global store', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      },
      attachTo: document.body
    })
    // Click the title to start editing
    const titleSpan = wrapper.find('.chat-title')
    await titleSpan.trigger('click')
    await wrapper.vm.$nextTick()
    // Input should appear
    const input = wrapper.find('input.chat-title-input')
    expect(input.exists()).toBe(true)
    // Change value and blur
    await input.setValue('New Title')
    await input.trigger('blur')
    // Title should update in global store
    expect(store.chats.value[0].title).toBe('New Title')
    // UI should show new title
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.chat-title').text()).toBe('New Title')
    wrapper.unmount()
  })

  it('shows the sync button always, and spinner when syncing', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    const btn = wrapper.find('.summarize-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.isVisible()).toBe(true)
    // Initially, spinner should not be visible
    expect(wrapper.find('.sync-spinner').exists()).toBe(false)
    // Set syncing to true
    await wrapper.setData({ syncing: true })
    expect(wrapper.find('.sync-spinner').exists()).toBe(true)
    wrapper.unmount()
  })

  it('calls API to summarize only if there are user messages', async () => {
    const sendChatMessage = vi.spyOn(api, 'sendChatMessage').mockResolvedValue('foo,bar')
    store.selectedModel.value = 'test-model'
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    // Click sync button
    await wrapper.find('.summarize-btn').trigger('click')
    expect(sendChatMessage).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not call API if there are no user messages', async () => {
    // Remove all user messages
    chat.messages = []
    const sendChatMessage = vi.spyOn(api, 'sendChatMessage').mockResolvedValue('')
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.find('.summarize-btn').trigger('click')
    expect(sendChatMessage).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('calls deleteChat when delete button is clicked', async () => {
    const deleteChat = vi.fn()
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat,
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.find('.delete-btn').trigger('click')
    expect(deleteChat).toHaveBeenCalledWith(chat.id)
    wrapper.unmount()
  })

  it('handles drag and drop events', async () => {
    const onDragStart = vi.fn()
    const onDragEnd = vi.fn()
    const onDragOver = vi.fn()
    const onDragLeave = vi.fn()
    const onDrop = vi.fn()
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart,
        onDragEnd,
        onDragOver,
        onDragLeave,
        onDrop,
        sidebarCollapsed: false
      }
    })
    await wrapper.find('.chat-tab').trigger('dragstart')
    expect(onDragStart).toHaveBeenCalled()
    await wrapper.find('.chat-tab').trigger('dragend')
    expect(onDragEnd).toHaveBeenCalled()
    await wrapper.find('.chat-tab').trigger('dragover')
    expect(onDragOver).toHaveBeenCalled()
    await wrapper.find('.chat-tab').trigger('dragleave')
    expect(onDragLeave).toHaveBeenCalled()
    await wrapper.find('.chat-tab').trigger('drop')
    expect(onDrop).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows alert if no model is selected when summarizing', async () => {
    window.alert = vi.fn()
    store.selectedModel.value = ''
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.find('.summarize-btn').trigger('click')
    expect(window.alert).toHaveBeenCalledWith('No model selected!')
    wrapper.unmount()
  })

  it('shows alert if API returns mismatched summary count', async () => {
    vi.spyOn(api, 'sendChatMessage').mockResolvedValue('foo')
    window.alert = vi.fn()
    store.selectedModel.value = 'test-model'
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.find('.summarize-btn').trigger('click')
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('does not match'))
    wrapper.unmount()
  })

  it('shows alert if API throws error', async () => {
    vi.spyOn(api, 'sendChatMessage').mockRejectedValue(new Error('fail'))
    window.alert = vi.fn()
    store.selectedModel.value = 'test-model'
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.find('.summarize-btn').trigger('click')
    // Wait for async error
    await wrapper.vm.$nextTick()
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to summarize questions'))
    wrapper.unmount()
  })

  it('cancels editing title with Escape key', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      },
      attachTo: document.body
    })
    await wrapper.find('.chat-title').trigger('click')
    await wrapper.vm.$nextTick()
    const input = wrapper.find('input.chat-title-input')
    await input.setValue('Should Not Save')
    await input.trigger('keyup.esc')
    expect(wrapper.vm.editingTitle).toBe(false)
    expect(store.chats.value[0].title).not.toBe('Should Not Save')
    wrapper.unmount()
  })

  it('toggles questions collapsed/expanded', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    expect(wrapper.vm.questionsCollapsed).toBe(true)
    await wrapper.find('.collapse-toggle').trigger('click')
    expect(wrapper.vm.questionsCollapsed).toBe(false)
    await wrapper.find('.collapse-toggle').trigger('click')
    expect(wrapper.vm.questionsCollapsed).toBe(true)
    wrapper.unmount()
  })

  it('renders correctly with sidebarCollapsed true', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: true
      }
    })
    expect(wrapper.props('sidebarCollapsed')).toBe(true)
    wrapper.unmount()
  })

  it('does not start editing title if already editing', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      },
      attachTo: document.body
    })
    wrapper.vm.editingTitle = true
    await wrapper.find('.chat-title').trigger('click')
    // Should remain editing
    expect(wrapper.vm.editingTitle).toBe(true)
    wrapper.unmount()
  })

  it('messageUnits computed returns [] if no chat', () => {
    store.chats.value = []
    const wrapper = mount(ChatThread, {
      props: {
        id: 999,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    expect(wrapper.vm.messageUnits).toEqual([])
    wrapper.unmount()
  })

  it('renders only questions (not answers) in the list', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.vm.toggleQuestions()
    await wrapper.vm.$nextTick()
    const items = wrapper.findAll('.chat-question-item')
    expect(items.length).toBe(2)
    expect(items[0].text()).toContain('Question 1')
    expect(items[0].text()).not.toContain('Answer 1')
    expect(items[1].text()).toContain('Question 2')
    wrapper.unmount()
  })

  it('reorders both question and answer in data when a question is moved', async () => {
    // Add a second answer for the second question
    chat.messages = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: 'A2' }
    ]
    const wrapper = mount(ChatThread, {
      props: {
        id: chat.id,
        active: false,
        dragOver: false,
        deleteChat: vi.fn(),
        onClick: vi.fn(),
        onDragStart: vi.fn(),
        onDragEnd: vi.fn(),
        onDragOver: vi.fn(),
        onDragLeave: vi.fn(),
        onDrop: vi.fn(),
        sidebarCollapsed: false
      }
    })
    await wrapper.vm.toggleQuestions()
    await wrapper.vm.$nextTick()
    // Simulate drag Q2 (idx 1) to idx 0
    wrapper.vm.onQuestionDragStart(1)
    wrapper.vm.onQuestionDrop(0)
    // Now Q2/A2 should be first, Q1/A1 second
    expect(chat.messages[0].content).toBe('Q2')
    expect(chat.messages[1].content).toBe('A2')
    expect(chat.messages[2].content).toBe('Q1')
    expect(chat.messages[3].content).toBe('A1')
    wrapper.unmount()
  })
})
