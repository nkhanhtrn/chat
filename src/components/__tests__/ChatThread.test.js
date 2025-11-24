import { mount } from '@vue/test-utils'
import ChatThread from '../ChatThread.vue'
import { useChatStore } from '../../composables/useChatStore.js'

describe('ChatThread', () => {
  let store
  let chat

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
  })

  it('sets global activeChatId when question is clicked', async () => {
    const wrapper = mount(ChatThread, {
      props: {
        chat,
        active: false,
        dragOver: false,
        finishEditingTitle: vi.fn(),
        startEditingTitle: vi.fn(),
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
})
