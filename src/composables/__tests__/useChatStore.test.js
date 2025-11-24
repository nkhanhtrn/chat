import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../useChatStore.js'

// Helper to reset state between tests
function resetStore(store) {
  store.setChats([])
  store.setActiveChat(null)
}

describe('useChatStore', () => {
  let store

  beforeEach(() => {
    store = useChatStore()
    resetStore(store)
  })

  it('should add a chat and set it as active', () => {
    store.addChat({ id: 1, title: 'Chat 1', messages: [] })
    store.setActiveChat(1)
    expect(store.chats.value).toHaveLength(1)
    expect(store.activeChatId.value).toBe(1)
    expect(store.activeChat.value.id).toBe(1)
  })

  it('should update a chat title', () => {
    store.addChat({ id: 2, title: 'Old Title', messages: [] })
    store.updateChat(2, chat => { chat.title = 'New Title' })
    expect(store.chats.value[0].title).toBe('New Title')
  })

  it('should set chats and active chat', () => {
    const chats = [
      { id: 3, title: 'A', messages: [] },
      { id: 4, title: 'B', messages: [] }
    ]
    store.setChats(chats)
    store.setActiveChat(4)
    expect(store.chats.value).toHaveLength(2)
    expect(store.activeChatId.value).toBe(4)
    expect(store.activeChat.value.title).toBe('B')
  })

  it('should return undefined for activeChat if not found', () => {
    store.setChats([{ id: 5, title: 'Only', messages: [] }])
    store.setActiveChat(999)
    expect(store.activeChat.value).toBeUndefined()
  })
})
