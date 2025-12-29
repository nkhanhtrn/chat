import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStudioSessions } from '../useStudioSessions.js'

describe('useStudioSessions', () => {
  let sessions

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()

    // Create fresh instance
    sessions = useStudioSessions()

    // Reset state for testing
    sessions.resetStateForTesting()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('session initialization', () => {
    it('should create a default session on initialization', async () => {
      await sessions.initializeSessions()

      expect(sessions.sortedSessions.value).toHaveLength(1)
      expect(sessions.activeSessionId.value).toBeTruthy()
    })

    it('should migrate legacy data to first session', async () => {
      // Simulate legacy data
      localStorage.setItem('studio-chat', JSON.stringify({
        messages: [{ id: 1, role: 'user', content: 'old message' }],
        nextMessageId: 2
      }))
      localStorage.setItem('studio-canvas-windows', JSON.stringify({
        windows: [],
        nextWindowId: 1
      }))

      await sessions.initializeSessions()

      // Should have migrated to session-based storage
      expect(localStorage.getItem('studio-chat')).toBeNull()
      expect(sessions.sortedSessions.value).toHaveLength(1)
    })
  })

  describe('session management', () => {
    beforeEach(async () => {
      await sessions.initializeSessions()
    })

    it('should create a new session', () => {
      const initialCount = sessions.sortedSessions.value.length
      sessions.createNewSession()

      expect(sessions.sortedSessions.value).toHaveLength(initialCount + 1)
    })

    it('should rename a session', () => {
      const session = sessions.sortedSessions.value[0]
      sessions.renameSession(session.id, 'New Name')

      expect(sessions.sortedSessions.value[0].name).toBe('New Name')
    })

    it('should hide a session', () => {
      const session = sessions.sortedSessions.value[0]
      sessions.hideSession(session.id)

      // sortedSessions only shows sessions with showInTabs = true
      expect(sessions.sortedSessions.value.find(s => s.id === session.id)).toBeUndefined()
      // allSessions shows all sessions
      expect(sessions.allSessions.value.find(s => s.id === session.id)?.showInTabs).toBe(false)
    })

    it('should show a hidden session', () => {
      const session = sessions.sortedSessions.value[0]
      sessions.hideSession(session.id)
      sessions.showSession(session.id)

      expect(sessions.sortedSessions.value.find(s => s.id === session.id)?.showInTabs).toBe(true)
    })
  })

  describe('deleteSession', () => {
    beforeEach(async () => {
      await sessions.initializeSessions()
    })

    it('should not delete the only session', async () => {
      const result = await sessions.deleteSession(sessions.activeSessionId.value)

      expect(result).toBeNull()
      expect(sessions.sortedSessions.value).toHaveLength(1)
    })

    it('should not delete the active session', async () => {
      // Create a second session
      sessions.createNewSession()
      const activeId = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== activeId)

      const result = await sessions.deleteSession(activeId)

      expect(result).toBeNull()
      expect(sessions.sortedSessions.value).toHaveLength(2)
    })

    it('should delete a non-active session', async () => {
      // Create two additional sessions
      sessions.createNewSession()
      sessions.createNewSession()

      const initialCount = sessions.sortedSessions.value.length
      const activeId = sessions.activeSessionId.value
      const sessionToDelete = sessions.sortedSessions.value.find(s => s.id !== activeId)

      const result = await sessions.deleteSession(sessionToDelete.id)

      expect(result).not.toBeNull()
      expect(sessions.sortedSessions.value).toHaveLength(initialCount - 1)
      expect(sessions.sortedSessions.value.find(s => s.id === sessionToDelete.id)).toBeUndefined()
    })

    it('should clean up chat storage when deleting a session', async () => {
      // Create additional session
      sessions.createNewSession()
      const activeId = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== activeId)

      // Add some chat data for the other session
      localStorage.setItem(`studio-chat-${otherSession.id}`, JSON.stringify({
        messages: [{ id: 1, role: 'user', content: 'test' }]
      }))

      await sessions.deleteSession(otherSession.id)

      expect(localStorage.getItem(`studio-chat-${otherSession.id}`)).toBeNull()
    })

    it('should clean up canvas storage when deleting a session', async () => {
      // Create additional session
      sessions.createNewSession()
      const activeId = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== activeId)

      // Add some canvas data for the other session
      localStorage.setItem(`studio-canvas-windows-${otherSession.id}`, JSON.stringify({
        windows: [{ id: 'window-1', type: 'tool', content: {} }]
      }))

      await sessions.deleteSession(otherSession.id)

      expect(localStorage.getItem(`studio-canvas-windows-${otherSession.id}`)).toBeNull()
    })

    it('should clean up tool instance data when deleting a session', async () => {
      // Create additional session
      sessions.createNewSession()
      const activeId = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== activeId)

      // Add some tool instance data for the other session
      localStorage.setItem(`tool-instance-${otherSession.id}-tool-1`, JSON.stringify({ count: 5 }))
      localStorage.setItem(`tool-instance-${otherSession.id}-tool-2`, JSON.stringify({ items: [] }))
      // Add tool data for active session (should NOT be deleted)
      localStorage.setItem(`tool-instance-${activeId}-tool-1`, JSON.stringify({ count: 10 }))

      await sessions.deleteSession(otherSession.id)

      // Other session's tool data should be deleted
      expect(localStorage.getItem(`tool-instance-${otherSession.id}-tool-1`)).toBeNull()
      expect(localStorage.getItem(`tool-instance-${otherSession.id}-tool-2`)).toBeNull()
      // Active session's tool data should remain
      expect(localStorage.getItem(`tool-instance-${activeId}-tool-1`)).not.toBeNull()
    })

    it('should clean up all tool instance data including partial matches', async () => {
      // Create additional session with an ID that might be a substring
      sessions.createNewSession()
      const activeId = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== activeId)

      // Add tool data with various patterns
      localStorage.setItem(`tool-instance-${otherSession.id}-abc`, JSON.stringify({}))
      localStorage.setItem(`tool-instance-${otherSession.id}-xyz-123`, JSON.stringify({}))
      localStorage.setItem(`tool-instance-${otherSession.id}-${otherSession.id}`, JSON.stringify({}))
      // Add similar keys for active session
      localStorage.setItem(`tool-instance-${activeId}-abc`, JSON.stringify({}))

      await sessions.deleteSession(otherSession.id)

      // All other session's tool data should be deleted
      expect(localStorage.getItem(`tool-instance-${otherSession.id}-abc`)).toBeNull()
      expect(localStorage.getItem(`tool-instance-${otherSession.id}-xyz-123`)).toBeNull()
      expect(localStorage.getItem(`tool-instance-${otherSession.id}-${otherSession.id}`)).toBeNull()
      // Active session's tool data should remain
      expect(localStorage.getItem(`tool-instance-${activeId}-abc`)).not.toBeNull()
    })

    it('should handle localStorage errors gracefully when deleting session', async () => {
      // Create additional session
      sessions.createNewSession()
      const activeId = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== activeId)

      // Mock localStorage.removeItem to throw error
      const originalRemove = localStorage.removeItem
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error')
      })

      // Should not throw, should just log warning
      await expect(sessions.deleteSession(otherSession.id)).resolves.not.toThrow()

      // Restore original
      localStorage.removeItem = originalRemove
    })
  })

  describe('session switching', () => {
    beforeEach(async () => {
      await sessions.initializeSessions()
      sessions.createNewSession()
    })

    it('should switch to another session', () => {
      const currentActive = sessions.activeSessionId.value
      const otherSession = sessions.sortedSessions.value.find(s => s.id !== currentActive)

      const result = sessions.switchToSession(otherSession.id)

      expect(result).not.toBeNull()
      expect(sessions.activeSessionId.value).toBe(otherSession.id)
    })

    it('should load session data when switching', () => {
      const session1 = sessions.sortedSessions.value[0]
      const session2 = sessions.sortedSessions.value[1]

      // Add data to session 2
      const chatData = { messages: [{ id: 1, role: 'user', content: 'hello' }], nextMessageId: 2 }
      localStorage.setItem(`studio-chat-${session2.id}`, JSON.stringify(chatData))

      const result = sessions.switchToSession(session2.id)

      expect(result.chat).toEqual(chatData)
    })
  })
})
