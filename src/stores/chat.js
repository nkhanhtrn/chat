import Message from './Message.js'
import { defineStore } from 'pinia'

export const useChatStore = defineStore('chat', {
  state: () => ({
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
  }),

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
      if (!parent.childIds) {
        parent.childIds = []
      }
      parent.childIds.push(childMessage.id)

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

    navigateToRoot(messageId = this.currentMessageId) {
      let current = this.messagesById[messageId]
      while (current?.parentId) {
        current = this.messagesById[current.parentId]
      }
      if (current) {
        this.currentMessageId = current.id
      }
    },

    navigateToLastChild(messageId = this.currentMessageId) {
      const message = this.messagesById[messageId]
      if (message?.childIds?.length > 0) {
        const lastChildId = message.childIds[message.childIds.length - 1]
        this.currentMessageId = lastChildId
      }
    },

    navigateToChild(messageId, childIndex) {
      const message = this.messagesById[messageId]
      if (message?.childIds?.[childIndex]) {
        this.currentMessageId = message.childIds[childIndex]
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

    // Persistence helpers
    toJSON() {
      return {
        messagesById: this.messagesById,
        rootMessageIds: this.rootMessageIds,
        currentMessageId: this.currentMessageId,
      }
    },

    fromJSON(data) {
      this.messagesById = data.messagesById || {}
      this.rootMessageIds = data.rootMessageIds || []
      this.currentMessageId = data.currentMessageId || null
    },
  }
})
