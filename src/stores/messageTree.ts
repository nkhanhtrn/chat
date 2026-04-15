import { defineStore } from 'pinia'
import { Message } from '@/models/Message'
import type {
  CustomContent,
  MessageData,
  MessageCreateParams,
} from '@/types/message'

export const useMessageTreeStore = defineStore('messageTree', {
  state: () => ({
    /** Flat lookup of all messages by ID */
    messagesById: {} as Record<string, Message>,

    /** Root-level message IDs for the current chat */
    rootMessageIds: [] as string[],

    /** Currently viewed message */
    currentMessageId: null as string | null,

    /** Index of currently displayed root message */
    currentRootIndex: 0,

    /** Navigation back-reference */
    previousLocation: null as { messageId: string; chatId: string } | null,
  }),

  getters: {
    rootMessages(state): Message[] {
      return state.rootMessageIds
        .map(id => state.messagesById[id])
        .filter((m): m is Message => m != null)
    },

    currentRootMessage(state): Message | null {
      const id = state.rootMessageIds[state.currentRootIndex]
      return id ? state.messagesById[id] ?? null : null
    },

    currentMessage(state): Message | null {
      return state.currentMessageId
        ? state.messagesById[state.currentMessageId] ?? null
        : null
    },

    getMessageById(state) {
      return (id: string): Message | null => state.messagesById[id] ?? null
    },

    getChildren(state) {
      return (messageId: string): Message[] => {
        const msg = state.messagesById[messageId]
        if (!msg?.childIds) return []
        return msg.childIds
          .map(childId => state.messagesById[childId])
          .filter((m): m is Message => m != null)
      }
    },

    getParent(state) {
      return (messageId: string): Message | null => {
        const msg = state.messagesById[messageId]
        return msg?.parentId ? state.messagesById[msg.parentId] ?? null : null
      }
    },

    countMessagesWithChildren(state) {
      return (messageId: string): number => {
        const countRecursive = (id: string): number => {
          const m = state.messagesById[id]
          if (!m) return 0
          let c = 1
          if (m.childIds?.length) {
            for (const childId of m.childIds) c += countRecursive(childId)
          }
          return c
        }
        return countRecursive(messageId)
      }
    },
  },

  actions: {
    // ── Message CRUD ──────────────────────────────────────────

    addRootMessage(params: MessageCreateParams, chatId: string | null): Message {
      const message = new Message({
        ...params,
        chatId: chatId ?? undefined,
        createdAt: params.createdAt ?? Date.now(),
      })

      this.messagesById[message.id] = message
      this.rootMessageIds.push(message.id)
      this.currentMessageId = message.id
      this.currentRootIndex = this.rootMessageIds.length - 1

      return message
    },

    addChildMessage(parentId: string, params: MessageCreateParams, chatId: string | null): Message {
      const parent = this.messagesById[parentId]
      if (!parent) throw new Error(`Parent message ${parentId} not found`)

      const child = new Message({
        ...params,
        parentId,
        chatId: chatId ?? undefined,
        createdAt: params.createdAt ?? Date.now(),
      })

      this.messagesById[child.id] = child
      parent.addChild(child.id)
      this.currentMessageId = child.id

      return child
    },

    appendToResponse(messageId: string, chunk: string): void {
      const msg = this.messagesById[messageId]
      if (msg) msg.response += chunk
    },

    setQuestionSummarized(messageId: string, summary: string): void {
      const msg = this.messagesById[messageId]
      if (msg) msg.updateQuestionSummarized(summary)
    },

    updateMessage(messageId: string, updates: Partial<MessageData>): void {
      const msg = this.messagesById[messageId]
      if (msg) Object.assign(msg, updates)
    },

    updateResponseSummary(messageId: string, responseSummary: string): void {
      const msg = this.messagesById[messageId]
      if (msg) msg.responseSummary = responseSummary
    },

    // ── Custom Content ────────────────────────────────────────

    addCustomContent(messageId: string, content: CustomContent): string | null {
      const message = this.messagesById[messageId]
      if (!message) return null

      if (!message.customContent) message.customContent = []

      message.customContent.push(content)

      // Add backlink for question-links
      if (content.type === 'question-link' && content.targetMessageId) {
        const target = this.messagesById[content.targetMessageId]
        if (target) {
          if (!target.linkedFrom) target.linkedFrom = []
          target.linkedFrom.push({ sourceMessageId: messageId, linkId: content.id })
        }
      }

      return content.id
    },

    removeCustomContent(messageId: string, contentId: string): void {
      const message = this.messagesById[messageId]
      if (!message?.customContent) return

      const index = message.customContent.findIndex(item => item.id === contentId)
      if (index === -1) return

      const item = message.customContent[index]

      // Remove backlink
      if (item.type === 'question-link' && item.targetMessageId) {
        const target = this.messagesById[item.targetMessageId]
        if (target?.linkedFrom) {
          const backIdx = target.linkedFrom.findIndex(
            link => link.sourceMessageId === messageId && link.linkId === contentId
          )
          if (backIdx !== -1) target.linkedFrom.splice(backIdx, 1)
        }
      }

      message.customContent.splice(index, 1)
    },

    updateCustomContent(messageId: string, contentId: string, updates: Partial<CustomContent>): void {
      const message = this.messagesById[messageId]
      if (!message?.customContent) return

      const item = message.customContent.find(c => c.id === contentId)
      if (item) Object.assign(item, updates)
    },

    saveScrollPosition(messageId: string, scrollPosition: number): void {
      const msg = this.messagesById[messageId]
      if (msg) msg.scrollPosition = scrollPosition
    },

    // ── Navigation ────────────────────────────────────────────

    navigateToMessage(
      messageId: string,
      currentScrollPosition: number | null = null,
      { skipHistory = false }: { skipHistory?: boolean } = {}
    ): number {
      if (!this.messagesById[messageId]) return 0

      if (!skipHistory && this.currentMessageId && this.currentMessageId !== messageId) {
        this.previousLocation = { messageId: this.currentMessageId, chatId: '' }
      }

      if (currentScrollPosition !== null && this.currentMessageId) {
        const cur = this.messagesById[this.currentMessageId]
        if (cur) cur.scrollPosition = currentScrollPosition
      }

      this.currentMessageId = messageId
      return this.messagesById[messageId]?.scrollPosition ?? 0
    },

    navigateBack(): { messageId: string; chatId: string } | null {
      if (!this.previousLocation) return null
      const loc = this.previousLocation
      this.previousLocation = null
      return loc
    },

    navigateToParent(currentScrollPosition: number | null = null): number {
      const msg = this.currentMessageId ? this.messagesById[this.currentMessageId] : null
      if (!msg?.parentId) return 0

      if (currentScrollPosition !== null && this.currentMessageId) {
        const cur = this.messagesById[this.currentMessageId]
        if (cur) cur.scrollPosition = currentScrollPosition
      }

      this.currentMessageId = msg.parentId
      return this.messagesById[msg.parentId]?.scrollPosition ?? 0
    },

    navigateToLastVisitedChild(currentScrollPosition: number | null = null): number {
      const msg = this.currentMessageId ? this.messagesById[this.currentMessageId] : null
      if (!msg?.lastVisitedChild) return 0

      if (currentScrollPosition !== null && this.currentMessageId) {
        const cur = this.messagesById[this.currentMessageId]
        if (cur) cur.scrollPosition = currentScrollPosition
      }

      this.currentMessageId = msg.lastVisitedChild
      return this.messagesById[msg.lastVisitedChild]?.scrollPosition ?? 0
    },

    navigateToChild(childIndex: number, currentScrollPosition: number | null = null): number {
      const msg = this.currentMessageId ? this.messagesById[this.currentMessageId] : null
      if (!msg?.childIds?.[childIndex]) return 0

      if (currentScrollPosition !== null && this.currentMessageId) {
        const cur = this.messagesById[this.currentMessageId]
        if (cur) cur.scrollPosition = currentScrollPosition
      }

      const childId = msg.childIds[childIndex]
      this.currentMessageId = childId
      if (msg) msg.lastVisitedChild = childId
      return this.messagesById[childId]?.scrollPosition ?? 0
    },

    // ── Delete / Remove ───────────────────────────────────────

    removeRootMessage(messageId: string): void {
      const index = this.rootMessageIds.indexOf(messageId)
      if (index === -1) return

      this.rootMessageIds.splice(index, 1)
      this._removeMessageTree(messageId)

      if (this.currentMessageId === messageId) this.currentMessageId = null
      if (this.currentRootIndex >= this.rootMessageIds.length) {
        this.currentRootIndex = Math.max(0, this.rootMessageIds.length - 1)
      }
    },

    deleteChildMessage(messageId: string): { navigateTo: string | null } {
      const message = this.messagesById[messageId]
      if (!message) return { navigateTo: null }

      const parentId = message.parentId
      const shouldNavigateToParent = this.currentMessageId === messageId && !!parentId

      // Remove from parent's childIds
      if (parentId) {
        const parent = this.messagesById[parentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) parent.childIds.splice(idx, 1)
        }
      }

      this._removeLinksToMessageTree(messageId)
      this._removeMessageTree(messageId)

      return { navigateTo: shouldNavigateToParent ? parentId : null }
    },

    deleteQuestion(messageId: string, chatId: string, chatRootIds: string[]): string | null {
      const messageIndex = chatRootIds.indexOf(messageId)
      if (messageIndex === -1) return null

      this._removeLinksToMessageTree(messageId)
      this._removeMessageTree(messageId)

      return messageIndex < this.currentRootIndex ? 'decrement' : null
    },

    // ── Move / Reorder ────────────────────────────────────────

    reorderRootMessages(newOrder: string[]): void {
      this.rootMessageIds = [...newOrder]
    },

    reorderChildren(parentId: string, newChildIds: string[]): void {
      const parent = this.messagesById[parentId]
      if (parent) parent.childIds = newChildIds
    },

    moveMessage(
      messageId: string,
      targetParentId: string | null,
      targetIndex: number,
      currentChatRootIds: string[]
    ): void {
      const message = this.messagesById[messageId]
      if (!message) return

      if (targetParentId && this._isDescendantOf(targetParentId, messageId)) return

      const currentParentId = message.parentId

      // Remove from current location
      if (currentParentId) {
        const parent = this.messagesById[currentParentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) parent.childIds.splice(idx, 1)
        }
      } else {
        const idx = currentChatRootIds.indexOf(messageId)
        if (idx !== -1) {
          currentChatRootIds.splice(idx, 1)
          this.rootMessageIds = [...currentChatRootIds]
        }
      }

      // Add to new location
      if (targetParentId) {
        const newParent = this.messagesById[targetParentId]
        if (!newParent) return
        if (!newParent.childIds) newParent.childIds = []
        newParent.childIds.splice(targetIndex, 0, messageId)
        message.parentId = targetParentId
      } else {
        currentChatRootIds.splice(targetIndex, 0, messageId)
        this.rootMessageIds = [...currentChatRootIds]
        message.parentId = null
      }
    },

    getMessageTreeStats(messageId: string): { descendantCount: number; customContentCount: number } {
      const message = this.messagesById[messageId]
      if (!message) return { descendantCount: 0, customContentCount: 0 }

      let descendantCount = 0
      let customContentCount = message.customContent?.length ?? 0

      const countDescendants = (id: string): void => {
        const msg = this.messagesById[id]
        if (!msg?.childIds) return
        for (const childId of msg.childIds) {
          descendantCount++
          const childMsg = this.messagesById[childId]
          if (childMsg?.customContent) customContentCount += childMsg.customContent.length
          countDescendants(childId)
        }
      }

      countDescendants(messageId)
      return { descendantCount, customContentCount }
    },

    // ── Bulk operations ───────────────────────────────────────

    loadMessages(messagesById: Record<string, MessageData>): void {
      this.messagesById = {}
      for (const [id, msgData] of Object.entries(messagesById)) {
        this.messagesById[id] = new Message(msgData)
      }
    },

    clearMessages(): void {
      this.messagesById = {}
      this.rootMessageIds = []
      this.currentMessageId = null
      this.currentRootIndex = 0
      this.previousLocation = null
    },

    removeMessageTrees(rootIds: string[]): void {
      for (const id of rootIds) this._removeMessageTree(id)
    },

    setRootMessageIds(ids: string[]): void {
      this.rootMessageIds = [...ids]
      this.currentMessageId = null
      this.currentRootIndex = 0
    },

    // ── Internal helpers ──────────────────────────────────────

    _removeMessageTree(messageId: string): void {
      const msg = this.messagesById[messageId]
      if (!msg) return

      if (msg.childIds?.length) {
        for (const childId of msg.childIds) this._removeMessageTree(childId)
      }

      delete this.messagesById[messageId]
    },

    _removeLinksToMessageTree(messageId: string): void {
      const msg = this.messagesById[messageId]
      if (!msg) return

      if (msg.linkedFrom) {
        for (const { sourceMessageId, linkId } of msg.linkedFrom) {
          const sourceMsg = this.messagesById[sourceMessageId]
          if (sourceMsg?.customContent) {
            const idx = sourceMsg.customContent.findIndex(item => item.id === linkId)
            if (idx !== -1) sourceMsg.customContent.splice(idx, 1)
          }
        }
      }

      if (msg.childIds) {
        for (const childId of msg.childIds) this._removeLinksToMessageTree(childId)
      }
    },

    _isDescendantOf(potentialDescendantId: string, ancestorId: string): boolean {
      if (potentialDescendantId === ancestorId) return true
      const ancestor = this.messagesById[ancestorId]
      if (!ancestor?.childIds?.length) return false

      for (const childId of ancestor.childIds) {
        if (childId === potentialDescendantId) return true
        if (this._isDescendantOf(potentialDescendantId, childId)) return true
      }
      return false
    },
  },
})
