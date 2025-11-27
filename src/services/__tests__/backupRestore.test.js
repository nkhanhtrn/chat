import { createChatBackup, getChatBackupFilename } from '../backupRestore'

describe('getChatBackupFilename', () => {
  it('should return a filename with the correct format', () => {
    const filename = getChatBackupFilename()
    expect(filename).toMatch(/^chat-messages-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/)
  })

  it('should end with .json', () => {
    const filename = getChatBackupFilename()
    expect(filename.endsWith('.json')).toBe(true)
  })

  it('should be unique for different times', () => {
    // Mock Date to different values
    const RealDate = Date
    global.Date = class extends RealDate {
      static now() { return 1700000000000 }
      constructor() { return new RealDate(1700000000000) }
    }
    const filename1 = getChatBackupFilename()
    global.Date = class extends RealDate {
      static now() { return 1700000001000 }
      constructor() { return new RealDate(1700000001000) }
    }
    const filename2 = getChatBackupFilename()
    global.Date = RealDate
    expect(filename1).not.toBe(filename2)
  })
})

describe('createChatBackup', () => {
  const sampleData = {
    chats: [{ id: 1, title: 'Chat 1', messages: [] }],
    activeChatId: 1,
    selectedModel: 'gpt-4',
    chatIdCounter: 2
  }

  it('should return a blob URL and filename', () => {
    const getFilenameFn = () => 'test-filename.json'
    const { url, filename } = createChatBackup({
      ...sampleData,
      backupChatsFn: backupChats,
      getFilenameFn
    })
    expect(typeof url).toBe('string')
    expect(filename).toBe('test-filename.json')
    // Clean up
    URL.revokeObjectURL(url)
  })

  it('should call backupChatsFn with correct data', () => {
    const spy = vi.fn(() => '{"mock":true}')
    const { url, filename } = createChatBackup({
      ...sampleData,
      backupChatsFn: spy,
      getFilenameFn: () => 'file.json'
    })
    expect(spy).toHaveBeenCalledWith({
      chats: sampleData.chats,
      activeChat: sampleData.activeChatId,
      selectedModel: sampleData.selectedModel,
      chatCounter: sampleData.chatIdCounter
    })
    URL.revokeObjectURL(url)
  })

  it('should use default filename function when getFilenameFn is not provided', () => {
    const backupChats = (data) => JSON.stringify(data)
    const { url, filename } = createChatBackup({
      ...sampleData,
      backupChatsFn: backupChats
    })
    expect(filename).toMatch(/^chat-messages-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/)
    URL.revokeObjectURL(url)
  })
})
// src/services/__tests__/backupRestore.test.js
// Unit tests for backupRestore.js using Vitest
import { describe, it, expect } from 'vitest'
import { backupChats, restoreChats } from '../backupRestore'

describe('backupChats', () => {
  it('should serialize chat data to JSON', () => {
    const data = { chats: [{ id: 1, messages: [] }], activeChat: 1, selectedModel: 'gpt', chatCounter: 2 }
    const json = backupChats(data)
    expect(typeof json).toBe('string')
    expect(json).toContain('chats')
    expect(json).toContain('activeChat')
  })

  it('should throw on invalid input', () => {
    expect(() => backupChats(null)).toThrow()
    expect(() => backupChats(undefined)).toThrow()
    expect(() => backupChats('string')).toThrow()
  })
})

describe('restoreChats', () => {
  const validData = {
    chats: [{ id: 1, messages: [] }],
    activeChat: 1,
    selectedModel: 'gpt',
    chatCounter: 2
  }

  it('should restore from object', () => {
    const restored = restoreChats(validData)
    expect(restored.chats).toEqual(validData.chats)
    expect(restored.activeChat).toBe(1)
    expect(restored.selectedModel).toBe('gpt')
    expect(restored.chatCounter).toBe(2)
  })

  it('should restore from JSON string', () => {
    const json = JSON.stringify(validData)
    const restored = restoreChats(json)
    expect(restored.chats).toEqual(validData.chats)
    expect(restored.activeChat).toBe(1)
    expect(restored.selectedModel).toBe('gpt')
    expect(restored.chatCounter).toBe(2)
  })

  it('should set defaults if fields are missing', () => {
    const data = { chats: [{ id: 5, messages: [] }] }
    const restored = restoreChats(data)
    expect(restored.activeChat).toBe(5)
    expect(restored.selectedModel).toBe('')
    expect(restored.chatCounter).toBe(6)
  })

  it('should set defaults for empty chats array', () => {
    const data = { chats: [] }
    const restored = restoreChats(data)
    expect(restored.activeChat).toBe(null)
    expect(restored.selectedModel).toBe('')
    expect(restored.chatCounter).toBe(1)
  })

  it('should throw on invalid JSON', () => {
    expect(() => restoreChats('{bad json')).toThrow('Invalid JSON format')
  })

  it('should throw on missing chats', () => {
    expect(() => restoreChats({})).toThrow('Invalid chat data')
    expect(() => restoreChats('{"foo":1}')).toThrow('Invalid chat data')
  })
})
