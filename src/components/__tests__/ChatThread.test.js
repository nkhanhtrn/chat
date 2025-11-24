import { vi } from 'vitest'
import * as api from '../../services/api.js'
import { mount } from '@vue/test-utils'
import ChatThread from '../ChatThread.vue'
import { useChatStore } from '../../composables/useChatStore.js'

describe('ChatThread', () => {
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

  it('userMessages computed returns [] if no chat', () => {
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
    expect(wrapper.vm.userMessages).toEqual([])
    wrapper.unmount()
  })
})
