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

  it('should have an empty string as the default selectedModel', () => {
    expect(typeof store.selectedModel.value).toBe('string')
    expect(store.selectedModel.value).toBe('')
  })

  it('should update selectedModel and be reactive', () => {
    const testValue1 = 'model-a'
    const testValue2 = 'model-b'
    store.selectedModel.value = testValue1
    expect(store.selectedModel.value).toBe(testValue1)
    store.selectedModel.value = testValue2
    expect(store.selectedModel.value).toBe(testValue2)
  })

  it('should have an empty string as the default hostname', () => {
    expect(typeof store.hostname.value).toBe('string')
    expect(store.hostname.value).toBe('')
  })

  it('should update hostname and be reactive', () => {
    const testHost1 = 'localhost'
    const testHost2 = '192.168.1.1'
    store.hostname.value = testHost1
    expect(store.hostname.value).toBe(testHost1)
    store.hostname.value = testHost2
    expect(store.hostname.value).toBe(testHost2)
  })

  it('should have an empty string as the default port', () => {
    expect(typeof store.port.value).toBe('string')
    expect(store.port.value).toBe('')
  })

  it('should update port and be reactive', () => {
    const testPort1 = '1234'
    const testPort2 = '8080'
    store.port.value = testPort1
    expect(store.port.value).toBe(testPort1)
    store.port.value = testPort2
    expect(store.port.value).toBe(testPort2)
  })
})
