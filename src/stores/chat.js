import Message from './Message.js'
import { defineStore } from 'pinia'
import { saveChatState, loadChatState } from '../services/storage.js'

export const useChatStore = defineStore('chat', {
  state: () => {
    // Try to load saved state from localStorage
    const savedState = loadChatState()

    if (savedState) {
      // Reconstruct Message objects from plain objects
      const messagesById = {}
      for (const [id, msgData] of Object.entries(savedState.messagesById || {})) {
        messagesById[id] = new Message(msgData)
      }

      return {
        messagesById,
        rootMessageIds: savedState.rootMessageIds || [],
        currentMessageId: savedState.currentMessageId || null,
        isStreaming: false,
        error: null,
        currentModel: savedState.currentModel || null,
      }
    }

    // Default state if nothing is saved
    return {
      // Normalized storage: flat object keyed by message ID
      messagesById: {}, // { [id]: Message }

      // Root-level messages (top-level questions)
      rootMessageIds: [], // [id1, id2, ...]

      // Current navigation state
      currentMessageId: null, // Which message is currently being viewed

      // App state
      isStreaming: false,
      error: null,
      currentModel: null,
    }
  },

  getters: {
    // Get root messages as array
    rootMessages: (state) => {
      return state.rootMessageIds.map(id => state.messagesById[id]).filter(Boolean)
    },

    // Get currently viewed message
    currentMessage: (state) => {
      return state.currentMessageId ? state.messagesById[state.currentMessageId] : null
    },

    // Get message by ID
    getMessageById: (state) => (id) => {
      return state.messagesById[id]
    },

    // Get all children of a message (returns actual Message objects)
    getChildren: (state) => (messageId) => {
      const message = state.messagesById[messageId]
      if (!message?.childIds) return []
      return message.childIds.map(childId => state.messagesById[childId]).filter(Boolean)
    },

    // Get parent of a message
    getParent: (state) => (messageId) => {
      const message = state.messagesById[messageId]
      if (message?.parentId) {
        return state.messagesById[message.parentId]
      }
      return null
    },
  },

  actions: {
    // Add a new root message
    addRootMessage(message) {
      if (!(message instanceof Message)) {
        message = new Message(message)
      }
      this.messagesById[message.id] = message
      this.rootMessageIds.push(message.id)
      this.currentMessageId = message.id
      return message
    },

    // Add a child message to a parent
    addChildMessage(parentId, childMessage) {
      if (!(childMessage instanceof Message)) {
        childMessage = new Message(childMessage)
      }

      const parent = this.messagesById[parentId]
      if (!parent) {
        throw new Error(`Parent message ${parentId} not found`)
      }

      // Store the child
      this.messagesById[childMessage.id] = childMessage

      // Update parent's childIds array
      parent.addNewChild = childMessage.id

      // Set navigation to new child
      this.currentMessageId = childMessage.id

      return childMessage
    },

    // Update message response (for streaming)
    appendToResponse(messageId, chunk) {
      const message = this.messagesById[messageId]
      if (message) {
        message.response += chunk
      }
    },

    setQuestionSummarized(messageId, summary) {
      const message = this.messagesById[messageId]
      if (message) {
        message.updateQuestionSummarized(summary)
        this._persistState()
      }
    },

    // Navigation actions
    navigateToMessage(messageId) {
      if (this.messagesById[messageId]) {
        this.currentMessageId = messageId
      }
    },

    navigateToParent(messageId = this.currentMessageId) {
      const message = this.messagesById[messageId]
      if (message?.parentId) {
        this.currentMessageId = message.parentId
      }
    },

    navigateToLastVisitedChild(messageId = this.currentMessageId) {
      const message = this.messagesById[messageId]
      if (message && message.lastVisitedChild) {
        this.currentMessageId = message.lastVisitedChild
      }
    },

    navigateToChild(messageId, childIndex) {
      const message = this.messagesById[messageId]
      if (message?.childIds?.[childIndex]) {
        this.currentMessageId = message.childIds[childIndex]
        this.messagesById[messageId].lastVisitedChild = this.currentMessageId
        this._persistState()
      }
    },

    // Remove a root message and its entire tree
    removeRootMessage(messageId) {
      const index = this.rootMessageIds.indexOf(messageId)
      if (index === -1) return

      // Remove from root array
      this.rootMessageIds.splice(index, 1)

      // Remove message and all its descendants
      this._removeMessageTree(messageId)

      // Clear current message if it was removed
      if (this.currentMessageId === messageId) {
        this.currentMessageId = null
      }
    },

    // Helper to recursively remove a message and all its children
    _removeMessageTree(messageId) {
      const message = this.messagesById[messageId]
      if (!message) return

      // Recursively remove all children first
      if (message.childIds && message.childIds.length > 0) {
        message.childIds.forEach(childId => {
          this._removeMessageTree(childId)
        })
      }

      // Remove the message itself
      delete this.messagesById[messageId]
    },

    // Legacy actions for compatibility
    setIsStreaming(val) {
      this.isStreaming = val
    },

    setError(err) {
      this.error = err
    },

    setCurrentModel(model) {
      this.currentModel = model
    },

    // Save state to localStorage (called by $subscribe)
    _persistState() {
      const state = {
        messagesById: this.messagesById,
        rootMessageIds: this.rootMessageIds,
        currentMessageId: this.currentMessageId,
        currentModel: this.currentModel,
      }
      saveChatState(state)
    },
  }
})
