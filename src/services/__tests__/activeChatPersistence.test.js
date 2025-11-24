import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as storage from '../storage.js'

describe('Active chat ID persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should save and load active chat ID', () => {
    storage.saveActiveChat(42)
    expect(storage.loadActiveChat()).toBe(42)
  })

  it('should persist and restore active chat ID with saveAllData/loadAllData', () => {
    storage.saveAllData({ activeChat: 123 })
    const all = storage.loadAllData()
    expect(all.activeChat).toBe(123)
  })

  it('should return null if no active chat is saved', () => {
    expect(storage.loadActiveChat()).toBeNull()
  })
})
