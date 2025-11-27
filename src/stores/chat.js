import Message from './Message.js'
import { defineStore } from 'pinia'

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: {}, // { [id]: { id, send, response, parentId, children: [] } }
    rootMessages: [], // [id, ...] for top-level display order
    isStreaming: false,
    error: null,
    currentModel: null,
  }),
  actions: {
    setMessages(messagesObj) {
      this.messages = messagesObj.messages || {}
      this.rootMessages = messagesObj.rootMessages || []
    },
    addMessage(message) {
      // Always store as a Message instance
      if (!(message instanceof Message)) {
        message = new Message(message)
      }
      this.messages[message.messageId] = message
    },
    removeMessage(id) {
      delete this.messages[id]
    },
    appendResponse(id, chunk) {
      if (this.messages[id]) {
        this.messages[id].response += chunk
      }
    },
    setIsStreaming(val) {
      this.isStreaming = val
    },
    setError(err) {
      this.error = err
    },
    setCurrentModel(model) {
      this.currentModel = model
    },
    // ...existing code...
  }
})
