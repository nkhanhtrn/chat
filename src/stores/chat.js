import Message from './Message.js'
import VocabCard from './VocabCard.js'
import { defineStore } from 'pinia'
import { saveChatState, loadChatState, resolveConflict as resolveStorageConflict } from '../services/storage.js'

export const useChatStore = defineStore('chat', {
  state: () => {
    // Default state - will be populated by initializeStore()
    return {
      // Normalized storage: flat object keyed by message ID
      messagesById: {}, // { [id]: Message }

      // Root-level messages (top-level questions) - legacy, kept for current chat
      rootMessageIds: [], // [id1, id2, ...]

      // Current navigation state
      currentMessageId: null, // Which message is currently being viewed
      currentRootIndex: 0, // Which root message is currently displayed

      // App state
      isStreaming: false,
      streamingMessageId: null, // ID of the message currently being streamed
      streamAbortController: null,
      error: null,
      currentModel: null,

      // Chat sessions
      chats: [], // [{ id, rootMessageIds }]
      currentChatId: null,

      // Back navigation - tracks previous location for back button
      previousLocation: null, // { messageId, chatId } or null

      // Last viewed content for cross-device sync
      lastViewedContentType: null, // 'book' | 'notebook' | null
      lastViewedContentId: null, // string | null

      // Initialization state
      isInitialized: false,

      // Vocabulary cards for spaced repetition: { [vocabId]: VocabCard }
      vocabData: {},
    }
  },

  getters: {
    // Count all messages recursively including children
    countMessagesWithChildren: (state) => (messageId) => {
      const msg = state.messagesById[messageId]
      if (!msg) return 1
      let count = 1
      if (msg.childIds?.length) {
        for (const childId of msg.childIds) {
          const countFn = (id) => {
            const m = state.messagesById[id]
            if (!m) return 1
            let c = 1
            if (m.childIds?.length) {
              for (const cid of m.childIds) {
                c += countFn(cid)
              }
            }
            return c
          }
          count += countFn(childId)
        }
      }
      return count
    },

    // Get total message count for a chat (including all children)
    getTotalMessageCount: (state) => (chatId) => {
      const chat = state.chats.find(c => c.id === chatId)
      if (!chat) return 0

      const countWithChildren = (messageId) => {
        const msg = state.messagesById[messageId]
        if (!msg) return 1
        let count = 1
        if (msg.childIds?.length) {
          for (const childId of msg.childIds) {
            count += countWithChildren(childId)
          }
        }
        return count
      }

      let total = 0
      for (const rootId of chat.rootMessageIds) {
        total += countWithChildren(rootId)
      }
      return total
    },

    // Get all chats with computed title and questions from messages
    chatList: (state) => {
      return state.chats.map(chat => {
        const questions = chat.rootMessageIds
          .map(id => state.messagesById[id])
          .filter(Boolean)
          .map(msg => ({
            id: msg.id,
            text: msg.questionSummarized || msg.question || 'Untitled',
            chatId: chat.id,
            rootIndex: chat.rootMessageIds.indexOf(msg.id)
          }))

        // Use cached messageCount if available, otherwise compute and cache it
        if (chat.messageCount === undefined) {
          const countWithChildren = (messageId) => {
            const msg = state.messagesById[messageId]
            if (!msg) return 1
            let count = 1
            if (msg.childIds?.length) {
              for (const childId of msg.childIds) {
                count += countWithChildren(childId)
              }
            }
            return count
          }

          let totalMessageCount = 0
          for (const rootId of chat.rootMessageIds) {
            totalMessageCount += countWithChildren(rootId)
          }
          chat.messageCount = totalMessageCount
        }

        return {
          id: chat.id,
          title: chat.name || 'New Subject',
          messageCount: chat.messageCount,
          questions
        }
      })
    },

    // Get root messages as array
    rootMessages: (state) => {
      return state.rootMessageIds.map(id => state.messagesById[id]).filter(Boolean)
    },

    // Get the currently displayed root message
    currentRootMessage: (state) => {
      const id = state.rootMessageIds[state.currentRootIndex]
      return id ? state.messagesById[id] : null
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

    // Get current chat's scratchpad
    currentScratchpad: (state) => {
      const chat = state.chats.find(c => c.id === state.currentChatId)
      return chat?.scratchpad || ''
    },

    // Get all vocabulary cards due for review
    vocabCardsDueForReview: (state) => {
      const now = Date.now()
      const dueCards = []

      for (const [vocabId, vocabCard] of Object.entries(state.vocabData)) {
        if (!vocabCard.nextReviewDate || vocabCard.nextReviewDate <= now) {
          dueCards.push({
            ...vocabCard,
            id: vocabId
          })
        }
      }

      // Sort by nextReviewDate (oldest first, then new cards)
      // Use id as secondary sort key for stable ordering
      return dueCards.sort((a, b) => {
        if (!a.nextReviewDate && !b.nextReviewDate) {
          return a.id.localeCompare(b.id)
        }
        if (!a.nextReviewDate) return -1
        if (!b.nextReviewDate) return 1
        if (a.nextReviewDate !== b.nextReviewDate) {
          return a.nextReviewDate - b.nextReviewDate
        }
        return a.id.localeCompare(b.id)
      })
    },

    // Get count of vocab cards due for review
    vocabCardsDueCount: (state) => {
      const now = Date.now()
      let count = 0

      for (const vocabCard of Object.values(state.vocabData)) {
        if (!vocabCard.nextReviewDate || vocabCard.nextReviewDate <= now) {
          count++
        }
      }

      return count
    },

    // Get all vocabulary cards
    allVocabCards: (state) => {
      return Object.values(state.vocabData).sort((a, b) => b.createdAt - a.createdAt)
    },
  },

  actions: {
    // Initialize store with saved state from Firestore/localStorage
    // Returns conflict info if there's a sync conflict
    async initializeStore() {
      if (this.isInitialized) {
        console.log('Store already initialized')
        return { hasConflict: false }
      }

      try {
        const result = await loadChatState()

        // If there's a conflict, return it for the UI to handle
        if (result.hasConflict) {
          console.log('Sync conflict detected, waiting for user resolution')
          return result
        }

        const savedState = result.state
        if (savedState) {
          this._applyState(savedState)
          console.log('Chat store initialized from saved state')
        } else {
          console.log('No saved state found, using default state')
        }

        this.isInitialized = true
        return { hasConflict: false }
      } catch (error) {
        console.error('Failed to initialize store:', error)
        this.isInitialized = true // Mark as initialized even on error to prevent retry loops
        return { hasConflict: false }
      }
    },

    // Apply a state object to the store
    _applyState(savedState) {
      // Reconstruct Message objects from plain objects
      const messagesById = {}
      for (const [id, msgData] of Object.entries(savedState.messagesById || {})) {
        messagesById[id] = new Message(msgData)
      }

      // Reconstruct VocabCard objects from plain objects
      const vocabData = {}
      for (const [id, cardData] of Object.entries(savedState.vocabData || {})) {
        vocabData[id] = new VocabCard(cardData)
      }

      // Restore state
      this.messagesById = messagesById
      this.vocabData = vocabData
      this.currentModel = savedState.currentModel || null
      this.chats = savedState.chats || []
      this.currentChatId = savedState.currentChatId || null

      // Ensure rootMessageIds matches the current chat to prevent cache issues
      // where notes from another notebook appear in the wrong one
      const currentChat = this.chats.find(c => c.id === this.currentChatId)
      if (currentChat) {
        this.rootMessageIds = [...currentChat.rootMessageIds]
      } else {
        this.rootMessageIds = []
      }

      this.currentMessageId = savedState.currentMessageId || null
      this.currentRootIndex = savedState.currentRootIndex || 0

      // Restore last viewed content for cross-device sync
      this.lastViewedContentType = savedState.lastViewedContentType || null
      this.lastViewedContentId = savedState.lastViewedContentId || null
    },

    // Resolve a sync conflict and apply the chosen state
    async resolveConflict(choice, localData, cloudData) {
      const chosenState = await resolveStorageConflict(choice, localData, cloudData)
      this._applyState(chosenState)
      this.isInitialized = true
      console.log(`Conflict resolved, applied ${choice} data`)
    },

    // Add a new root message
    addRootMessage(message) {
      if (!(message instanceof Message)) {
        // Set createdAt if not provided (new messages)
        if (!message.createdAt) {
          message.createdAt = Date.now()
        }
        message = new Message(message)
      }
      this.messagesById[message.id] = message
      this.rootMessageIds.push(message.id)
      this.currentMessageId = message.id
      this.currentRootIndex = this.rootMessageIds.length - 1 // Navigate to new message

      // Set chat name from first question if not already set
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat && !chat.name && message.question) {
        chat.name = message.question
      }

      // Update cached message count
      if (chat) {
        chat.messageCount = (chat.messageCount || 0) + 1
      }

      this._syncCurrentChat()
      this._persistState()
      return message
    },

    // Add a child message to a parent
    addChildMessage(parentId, childMessage) {
      if (!(childMessage instanceof Message)) {
        // Set createdAt if not provided (new messages)
        if (!childMessage.createdAt) {
          childMessage.createdAt = Date.now()
        }
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

      // Update cached message count
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat) {
        chat.messageCount = (chat.messageCount || 0) + 1
      }

      this._persistState()
      return childMessage
    },

    // Update message response (for streaming)
    appendToResponse(messageId, chunk) {
      const message = this.messagesById[messageId]
      if (message) {
        message.response += chunk
        this._persistState()
      }
    },

    setQuestionSummarized(messageId, summary) {
      const message = this.messagesById[messageId]
      if (message) {
        message.updateQuestionSummarized(summary)
        this._persistState()
      }
    },

    // Update message properties
    updateMessage(messageId, updates) {
      const message = this.messagesById[messageId]
      if (message) {
        Object.assign(message, updates)
        this._persistState()
      }
    },

    // Add custom content (highlight or question link) to a message
    addCustomContent(messageId, content) {
      const message = this.messagesById[messageId]
      if (!message) return null

      if (!message.customContent) {
        message.customContent = []
      }

      // Check for overlapping highlights and merge them
      if (content.type === 'highlight') {
        const overlapping = message.customContent.filter(
          item => item.type === 'highlight' &&
            item.startOffset < content.endOffset &&
            item.endOffset > content.startOffset
        )

        if (overlapping.length > 0) {
          // Calculate merged range (smallest startOffset, biggest endOffset)
          let mergedStart = content.startOffset
          let mergedEnd = content.endOffset
          let mergedNoteContent = content.noteContent || ''
          let mergedHasNote = content.hasNote || false

          overlapping.forEach(item => {
            mergedStart = Math.min(mergedStart, item.startOffset)
            mergedEnd = Math.max(mergedEnd, item.endOffset)
            // Combine notes if any
            if (item.noteContent) {
              mergedHasNote = true
              if (mergedNoteContent) {
                mergedNoteContent += '\n\n---\n\n' + item.noteContent
              } else {
                mergedNoteContent = item.noteContent
              }
            }
          })

          // Remove all overlapping highlights
          overlapping.forEach(item => {
            const index = message.customContent.findIndex(c => c.id === item.id)
            if (index !== -1) {
              message.customContent.splice(index, 1)
            }
          })

          // Extract merged text from the response
          const mergedText = message.response.substring(mergedStart, mergedEnd)

          // Update content with merged values
          content.startOffset = mergedStart
          content.endOffset = mergedEnd
          content.text = mergedText
          if (mergedHasNote) {
            content.hasNote = true
            content.noteContent = mergedNoteContent
          }
        }
      }

      message.customContent.push(content)

      // For question-links, add a backlink to the target message for efficient cleanup
      if (content.type === 'question-link' && content.targetMessageId) {
        const targetMessage = this.messagesById[content.targetMessageId]
        if (targetMessage) {
          if (!targetMessage.linkedFrom) {
            targetMessage.linkedFrom = []
          }
          targetMessage.linkedFrom.push({ sourceMessageId: messageId, linkId: content.id })
        }
      }

      this._persistState()
      return content.id
    },

    // Remove custom content by ID from a message
    removeCustomContent(messageId, contentId) {
      const message = this.messagesById[messageId]
      if (!message?.customContent) return

      const index = message.customContent.findIndex(item => item.id === contentId)
      if (index !== -1) {
        const item = message.customContent[index]

        // If removing a question-link, also remove the backlink from the target message
        if (item.type === 'question-link' && item.targetMessageId) {
          const targetMessage = this.messagesById[item.targetMessageId]
          if (targetMessage?.linkedFrom) {
            const backLinkIndex = targetMessage.linkedFrom.findIndex(
              link => link.sourceMessageId === messageId && link.linkId === contentId
            )
            if (backLinkIndex !== -1) {
              targetMessage.linkedFrom.splice(backLinkIndex, 1)
            }
          }
        }

        message.customContent.splice(index, 1)
        this._persistState()
      }
    },

    // Update custom content by ID
    updateCustomContent(messageId, contentId, updates) {
      const message = this.messagesById[messageId]
      if (!message?.customContent) return

      const item = message.customContent.find(item => item.id === contentId)
      if (item) {
        Object.assign(item, updates)
        this._persistState()
      }
    },

    // Save scroll position for a message
    saveScrollPosition(messageId, scrollPosition) {
      const message = this.messagesById[messageId]
      if (message) {
        message.scrollPosition = scrollPosition
        this._persistState()
      }
    },

    // Update scratchpad content for current chat
    updateScratchpad(content) {
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat) {
        chat.scratchpad = content
        this._persistState()
      }
    },

    // Navigation actions
    // Returns the scroll position of the target message
    navigateToMessage(messageId, currentScrollPosition = null, { skipHistory = false } = {}) {
      if (this.messagesById[messageId]) {
        // Track previous location for back button (unless skipping history)
        if (!skipHistory && this.currentMessageId && this.currentMessageId !== messageId) {
          this.previousLocation = { messageId: this.currentMessageId, chatId: this.currentChatId }
        }
        // Save scroll position of current message before navigating
        if (currentScrollPosition !== null && this.currentMessageId) {
          this.messagesById[this.currentMessageId].scrollPosition = currentScrollPosition
        }
        this.currentMessageId = messageId
        this._persistState()
        return this.messagesById[messageId].scrollPosition || 0
      }
      return 0
    },

    // Navigate back to previous location
    navigateBack() {
      if (!this.previousLocation) return null

      const { messageId, chatId } = this.previousLocation
      this.previousLocation = null

      return { messageId, chatId }
    },

    navigateToParent(messageId = this.currentMessageId, currentScrollPosition = null) {
      const message = this.messagesById[messageId]
      if (message?.parentId) {
        // Save scroll position of current message before navigating
        if (currentScrollPosition !== null && this.currentMessageId) {
          this.messagesById[this.currentMessageId].scrollPosition = currentScrollPosition
        }
        this.currentMessageId = message.parentId
        this._persistState()
        return this.messagesById[message.parentId].scrollPosition || 0
      }
      return 0
    },

    navigateToLastVisitedChild(messageId = this.currentMessageId, currentScrollPosition = null) {
      const message = this.messagesById[messageId]
      if (message && message.lastVisitedChild) {
        // Save scroll position of current message before navigating
        if (currentScrollPosition !== null && this.currentMessageId) {
          this.messagesById[this.currentMessageId].scrollPosition = currentScrollPosition
        }
        this.currentMessageId = message.lastVisitedChild
        this._persistState()
        return this.messagesById[message.lastVisitedChild].scrollPosition || 0
      }
      return 0
    },

    navigateToChild(messageId, childIndex, currentScrollPosition = null) {
      const message = this.messagesById[messageId]
      if (message?.childIds?.[childIndex]) {
        // Save scroll position of current message before navigating
        if (currentScrollPosition !== null && this.currentMessageId) {
          this.messagesById[this.currentMessageId].scrollPosition = currentScrollPosition
        }
        this.currentMessageId = message.childIds[childIndex]
        this.messagesById[messageId].lastVisitedChild = this.currentMessageId
        this._persistState()
        return this.messagesById[this.currentMessageId].scrollPosition || 0
      }
      return 0
    },

    // Remove a root message and its entire tree
    removeRootMessage(messageId) {
      const index = this.rootMessageIds.indexOf(messageId)
      if (index === -1) return

      // Count messages to be removed before deletion
      const removedCount = this._countMessageTree(messageId)

      // Remove from root array
      this.rootMessageIds.splice(index, 1)

      // Remove message and all its descendants
      this._removeMessageTree(messageId)

      // Update cached message count
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat && chat.messageCount !== undefined) {
        chat.messageCount = Math.max(0, chat.messageCount - removedCount)
      }

      // Clear current message if it was removed
      if (this.currentMessageId === messageId) {
        this.currentMessageId = null
      }

      // Adjust currentRootIndex if needed
      if (this.currentRootIndex >= this.rootMessageIds.length) {
        this.currentRootIndex = Math.max(0, this.rootMessageIds.length - 1)
      }

      this._persistState()
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

    // Helper to count messages in a tree
    _countMessageTree(messageId) {
      const message = this.messagesById[messageId]
      if (!message) return 0

      let count = 1
      if (message.childIds && message.childIds.length > 0) {
        for (const childId of message.childIds) {
          count += this._countMessageTree(childId)
        }
      }
      return count
    },

    /**
     * Delete a child message and all its descendants, including cleanup of question links
     * @param {string} messageId - ID of the message to delete
     * @param {string|null} currentMessageId - Current message ID (to handle navigation)
     * @returns {{ navigateTo: string|null }} - Object with navigateTo ID if navigation needed
     */
    deleteChildMessage(messageId) {
      const message = this.messagesById[messageId]
      if (!message) return { navigateTo: null }

      const parentId = message.parentId
      const shouldNavigateToParent = this.currentMessageId === messageId && parentId

      // Count messages to be removed before deletion
      const removedCount = this._countMessageTree(messageId)

      // Remove from parent's childIds
      if (parentId) {
        const parent = this.messagesById[parentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) {
            parent.childIds.splice(idx, 1)
          }
        }
      }

      // Remove questionLinks that point to the message being deleted (and its children)
      this._removeLinksToMessageTree(messageId)

      // Recursively delete the message and its children
      this._removeMessageTree(messageId)

      // Update cached message count
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat && chat.messageCount !== undefined) {
        chat.messageCount = Math.max(0, chat.messageCount - removedCount)
      }

      this._persistState()

      return { navigateTo: shouldNavigateToParent ? parentId : null }
    },

    /**
     * Helper to remove all questionLinks pointing to a message tree
     * @param {string} messageId - Root of the tree to remove links to
     */
    _removeLinksToMessageTree(messageId) {
      const msg = this.messagesById[messageId]
      if (!msg) return

      // Use backlinks to find and remove questionLinks pointing to this message
      if (msg.linkedFrom) {
        msg.linkedFrom.forEach(({ sourceMessageId, linkId }) => {
          const sourceMsg = this.messagesById[sourceMessageId]
          if (sourceMsg?.customContent) {
            const index = sourceMsg.customContent.findIndex(item => item.id === linkId)
            if (index !== -1) {
              sourceMsg.customContent.splice(index, 1)
            }
          }
        })
      }

      // Process children recursively
      if (msg.childIds) {
        msg.childIds.forEach(childId => this._removeLinksToMessageTree(childId))
      }
    },

    /**
     * Move a message tree to a new notebook
     * @param {string} messageId - ID of the message to move
     * @param {string} sourceChatId - ID of the source chat/notebook
     * @returns {{ newChatId: string, messageId: string }|null} - New chat info or null if failed
     */
    moveMessageToNewNotebook(messageId, sourceChatId) {
      const message = this.messagesById[messageId]
      if (!message) return null

      const sourceChat = this.chats.find(c => c.id === sourceChatId)
      if (!sourceChat) return null

      // Create new notebook
      const newChat = this.createNewChat()

      // Set the notebook name to the summarized question name
      const notebookName = message.questionSummarized || message.question || 'New Notebook'
      this.renameChat(newChat.id, notebookName)

      const targetChat = this.chats.find(c => c.id === newChat.id)
      if (!targetChat) return null

      // Remove from current location
      if (message.parentId) {
        // Remove from parent's childIds
        const parent = this.messagesById[message.parentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) {
            parent.childIds.splice(idx, 1)
          }
        }
      } else {
        // Remove from source chat's root messages
        const idx = sourceChat.rootMessageIds.indexOf(messageId)
        if (idx !== -1) {
          sourceChat.rootMessageIds.splice(idx, 1)
        }
      }

      // Clear parentId since it's now a root in the new notebook
      message.parentId = null

      // Add to target chat's root messages
      targetChat.rootMessageIds.push(messageId)

      // Update store state
      this.currentChatId = newChat.id
      this.currentMessageId = messageId
      this.rootMessageIds = [...targetChat.rootMessageIds]

      this._persistState()

      return { newChatId: newChat.id, messageId }
    },

    /**
     * Move a message tree to an existing notebook
     * @param {string} messageId - ID of the message to move
     * @param {string} sourceChatId - ID of the source chat/notebook
     * @param {string} targetChatId - ID of the target chat/notebook
     * @returns {{ targetChatId: string, messageId: string }|null} - Target chat info or null if failed
     */
    moveMessageToExistingNotebook(messageId, sourceChatId, targetChatId) {
      const message = this.messagesById[messageId]
      if (!message) return null

      const sourceChat = this.chats.find(c => c.id === sourceChatId)
      if (!sourceChat) return null

      const targetChat = this.chats.find(c => c.id === targetChatId)
      if (!targetChat) return null

      // Can't move to the same notebook
      if (sourceChatId === targetChatId) return null

      // Remove from current location
      if (message.parentId) {
        // Remove from parent's childIds
        const parent = this.messagesById[message.parentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) {
            parent.childIds.splice(idx, 1)
          }
        }
      } else {
        // Remove from source chat's root messages
        const idx = sourceChat.rootMessageIds.indexOf(messageId)
        if (idx !== -1) {
          sourceChat.rootMessageIds.splice(idx, 1)
        }
      }

      // Clear parentId since it's now a root in the target notebook
      message.parentId = null

      // Add to target chat's root messages
      targetChat.rootMessageIds.push(messageId)

      // Update store state
      this.currentChatId = targetChatId
      this.currentMessageId = messageId
      this.rootMessageIds = [...targetChat.rootMessageIds]

      this._persistState()

      return { targetChatId, messageId }
    },

    // Streaming control actions
    startStreaming(messageId = null) {
      this.streamAbortController = new AbortController()
      this.isStreaming = true
      this.streamingMessageId = messageId
      return this.streamAbortController.signal
    },

    stopStreaming() {
      if (this.streamAbortController) {
        this.streamAbortController.abort()
        this.streamAbortController = null
      }
      this.isStreaming = false
      this.streamingMessageId = null
    },

    // Legacy actions for compatibility
    setIsStreaming(val) {
      this.isStreaming = val
      if (!val) {
        this.streamAbortController = null
        this.streamingMessageId = null
      }
    },

    setError(err) {
      this.error = err
    },

    setCurrentModel(model) {
      this.currentModel = model
      this._persistState()
    },

    // Save state to localStorage (called by $subscribe)
    _persistState() {
      const state = {
        messagesById: this.messagesById,
        rootMessageIds: this.rootMessageIds,
        currentMessageId: this.currentMessageId,
        currentRootIndex: this.currentRootIndex,
        currentModel: this.currentModel,
        chats: this.chats,
        currentChatId: this.currentChatId,
        isStreaming: this.isStreaming,
        vocabData: this.vocabData,
      }
      saveChatState(state)
    },

    // Create a new chat session
    createNewChat() {
      const chatId = crypto.randomUUID()
      const newChat = {
        id: chatId,
        name: '',
        rootMessageIds: [],
        scratchpad: ''
      }
      this.chats.push(newChat)
      this.currentChatId = chatId
      this.rootMessageIds = []
      this.currentMessageId = null
      this._persistState()
      return newChat
    },

    // Switch to a different chat
    switchToChat(chatId) {
      const chat = this.chats.find(c => c.id === chatId)
      if (chat) {
        // Save current chat's messages
        if (this.currentChatId) {
          const currentChat = this.chats.find(c => c.id === this.currentChatId)
          if (currentChat) {
            currentChat.rootMessageIds = this.rootMessageIds
          }
        }
        // Load new chat
        this.currentChatId = chatId
        this.rootMessageIds = [...chat.rootMessageIds]
        this.currentMessageId = null
        this.currentRootIndex = 0 // Reset to first root message
        this._persistState()
      }
    },

    // Update current chat's message list
    _syncCurrentChat() {
      if (this.currentChatId) {
        const chat = this.chats.find(c => c.id === this.currentChatId)
        if (chat) {
          chat.rootMessageIds = this.rootMessageIds
        }
      }
    },

    // Delete a chat session
    deleteChat(chatId) {
      const chatIndex = this.chats.findIndex(c => c.id === chatId)
      if (chatIndex === -1) return

      const chat = this.chats[chatIndex]

      // Remove all messages from this chat
      chat.rootMessageIds.forEach(messageId => {
        this._removeMessageTree(messageId)
      })

      // Remove the chat from the list
      this.chats.splice(chatIndex, 1)

      // If we deleted the current chat, switch to another or create new
      if (this.currentChatId === chatId) {
        if (this.chats.length > 0) {
          // Switch to the chat above (or below if it was the first one)
          const newIndex = chatIndex > 0 ? chatIndex - 1 : 0
          this.switchToChat(this.chats[newIndex].id)
        } else {
          // No chats left, create a new one
          this.createNewChat()
        }
      }

      this._persistState()
    },

    // Rename a chat session
    renameChat(chatId, newTitle) {
      const chat = this.chats.find(c => c.id === chatId)
      if (!chat) return

      chat.name = newTitle
      this._persistState()
    },

    // Reorder notebooks (chats) on the home page
    reorderChats(newOrder) {
      // newOrder is an array of chat IDs in the desired order
      const reorderedChats = newOrder
        .map(id => this.chats.find(c => c.id === id))
        .filter(Boolean)

      // Add any chats that weren't in newOrder (safety measure)
      const existingIds = new Set(newOrder)
      for (const chat of this.chats) {
        if (!existingIds.has(chat.id)) {
          reorderedChats.push(chat)
        }
      }

      this.chats = reorderedChats
      this._persistState()
    },

    // Set the last viewed content type and ID (for cross-device sync)
    setLastViewedContent(type, id) {
      this.lastViewedContentType = type
      this.lastViewedContentId = id
      this._persistState()
    },

    // Reorder root messages in the current chat
    reorderRootMessages(newOrder) {
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (!chat) return

      chat.rootMessageIds = newOrder
      this.rootMessageIds = [...newOrder]
      this._persistState()
    },

    // Reorder children of a parent message
    reorderChildren(parentId, newChildIds) {
      const parent = this.messagesById[parentId]
      if (!parent) return

      parent.childIds = newChildIds
      this._persistState()
    },

    // Get statistics about a message tree (for delete confirmation)
    // Returns { descendantCount, customContentCount }
    getMessageTreeStats(messageId) {
      const message = this.messagesById[messageId]
      if (!message) return { descendantCount: 0, customContentCount: 0 }

      let descendantCount = 0
      let customContentCount = message.customContent?.length || 0

      const countDescendants = (id) => {
        const msg = this.messagesById[id]
        if (!msg?.childIds) return
        for (const childId of msg.childIds) {
          descendantCount++
          const childMsg = this.messagesById[childId]
          if (childMsg?.customContent) {
            customContentCount += childMsg.customContent.length
          }
          countDescendants(childId)
        }
      }

      countDescendants(messageId)
      return { descendantCount, customContentCount }
    },

    // Check if potentialDescendantId is a descendant of ancestorId
    _isDescendantOf(potentialDescendantId, ancestorId) {
      if (!potentialDescendantId || !ancestorId) return false
      if (potentialDescendantId === ancestorId) return true

      const ancestor = this.messagesById[ancestorId]
      if (!ancestor?.childIds?.length) return false

      for (const childId of ancestor.childIds) {
        if (childId === potentialDescendantId) return true
        if (this._isDescendantOf(potentialDescendantId, childId)) return true
      }
      return false
    },

    // Move a message to a new parent (or to root level)
    // targetParentId: null means move to root level
    // targetIndex: position in the target's children array (or root array)
    moveMessage(messageId, targetParentId, targetIndex) {
      const message = this.messagesById[messageId]
      if (!message) return

      // Prevent circular reference: can't move a message to become a child of its own descendant
      if (targetParentId && this._isDescendantOf(targetParentId, messageId)) {
        console.warn('Cannot move a message to become a child of its own descendant')
        return
      }

      const currentParentId = message.parentId
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (!chat) return

      // Remove from current location
      if (currentParentId) {
        // Remove from parent's childIds
        const parent = this.messagesById[currentParentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) {
            parent.childIds.splice(idx, 1)
          }
        }
      } else {
        // Remove from root level
        const idx = chat.rootMessageIds.indexOf(messageId)
        if (idx !== -1) {
          chat.rootMessageIds.splice(idx, 1)
          this.rootMessageIds = [...chat.rootMessageIds]
        }
      }

      // Add to new location
      if (targetParentId) {
        // Moving to a child position
        const newParent = this.messagesById[targetParentId]
        if (!newParent) return

        if (!newParent.childIds) {
          newParent.childIds = []
        }
        newParent.childIds.splice(targetIndex, 0, messageId)
        message.parentId = targetParentId
      } else {
        // Moving to root level
        chat.rootMessageIds.splice(targetIndex, 0, messageId)
        this.rootMessageIds = [...chat.rootMessageIds]
        message.parentId = null
      }

      this._persistState()
    },

    // Delete a question (root message) from a chat
    deleteQuestion(messageId, chatId) {
      const chat = this.chats.find(c => c.id === chatId)
      if (!chat) return

      const messageIndex = chat.rootMessageIds.indexOf(messageId)
      if (messageIndex === -1) return

      // Count messages to be removed before deletion
      const removedCount = this._countMessageTree(messageId)

      // Check if this is the current chat
      const isCurrentChat = this.currentChatId === chatId

      // Remove from rootMessageIds
      chat.rootMessageIds.splice(messageIndex, 1)

      // Sync rootMessageIds if this is the current chat
      if (isCurrentChat) {
        this.rootMessageIds = [...chat.rootMessageIds]
      }

      // Remove questionLinks that point to any message in the tree being deleted
      const removeLinksToMessage = (id) => {
        const msg = this.messagesById[id]
        if (!msg) return

        // Use backlinks to efficiently find and remove questionLinks pointing to this message
        if (msg.linkedFrom) {
          msg.linkedFrom.forEach(({ sourceMessageId, linkId }) => {
            const sourceMsg = this.messagesById[sourceMessageId]
            if (sourceMsg?.customContent) {
              const index = sourceMsg.customContent.findIndex(item => item.id === linkId)
              if (index !== -1) {
                sourceMsg.customContent.splice(index, 1)
              }
            }
          })
        }

        // Process children recursively
        if (msg.childIds) {
          msg.childIds.forEach(childId => removeLinksToMessage(childId))
        }
      }
      removeLinksToMessage(messageId)

      // Helper to recursively delete a message and all its children
      const deleteMessageTree = (id) => {
        const msg = this.messagesById[id]
        if (!msg) return
        // Delete all children first
        if (msg.childIds) {
          msg.childIds.forEach(childId => deleteMessageTree(childId))
        }
        delete this.messagesById[id]
      }

      // Delete the message and its children
      deleteMessageTree(messageId)

      // Update cached message count
      if (chat.messageCount !== undefined) {
        chat.messageCount = Math.max(0, chat.messageCount - removedCount)
      }

      // If we deleted the currently viewed message, switch to another
      if (this.currentMessageId === messageId) {
        if (chat.rootMessageIds.length > 0) {
          // Switch to the previous or first root message
          const newIndex = Math.min(messageIndex, chat.rootMessageIds.length - 1)
          this.currentMessageId = chat.rootMessageIds[newIndex]
          this.currentRootIndex = newIndex
        } else {
          // No more questions in this chat, delete the chat
          this.deleteChat(chatId)
          return
        }
      } else if (isCurrentChat && messageIndex < this.currentRootIndex) {
        // Adjust currentRootIndex when deleting a question before the current one
        this.currentRootIndex--
      }

      this._persistState()
    },

    // Update response summary on message object
    updateResponseSummary(messageId, responseSummary) {
      const message = this.messagesById[messageId]
      if (message) {
        message.responseSummary = responseSummary
        this._persistState()
      }
    },

    // ============================================
    // Vocabulary Card Actions
    // ============================================

    // Add a new vocabulary card
    addVocabCard({ word, definition = '', context = '', messageId = null }) {
      const card = new VocabCard({
        word,
        definition,
        context,
        messageId
      })
      this.vocabData[card.id] = card
      this._persistState()
      return card.id
    },

    // Update vocabulary card definition (for streaming)
    appendToVocabDefinition(vocabId, chunk) {
      const card = this.vocabData[vocabId]
      if (card) {
        card.definition += chunk
        this._persistState()
      }
    },

    // Update vocabulary card definition completely
    updateVocabDefinition(vocabId, definition) {
      const card = this.vocabData[vocabId]
      if (card) {
        card.definition = definition
        this._persistState()
      }
    },

    // Record a vocabulary review result
    // quality: 0 = Again, 2 = Hard, 4 = Good, 5 = Easy
    recordVocabReview(vocabId, quality) {
      const card = this.vocabData[vocabId]
      if (!card) return

      card.recordReview(quality)
      this._persistState()
    },

    // Remove a vocabulary card
    removeVocabCard(vocabId) {
      if (this.vocabData[vocabId]) {
        delete this.vocabData[vocabId]
        this._persistState()
      }
    },

    // Get a vocabulary card by ID
    getVocabCard(vocabId) {
      return this.vocabData[vocabId] || null
    },

    // Check if a word already exists in vocab cards
    findVocabCardByWord(word) {
      const normalizedWord = word.toLowerCase().trim()
      for (const card of Object.values(this.vocabData)) {
        if (card.word.toLowerCase().trim() === normalizedWord) {
          return card
        }
      }
      return null
    },

  }
})
