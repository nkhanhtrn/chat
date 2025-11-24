import { ref } from 'vue'
import { sendChatMessage, abortChatMessage, saveChats } from '../services/api.js'

/**
 * Composable for chat message API and array manipulation logic.
 * Handles sending, retrying, editing, compressing, and deleting messages.
 */
export function useChatMessages(props, emit, scrollToBottom) {
  const isLoading = ref(false)
  const isStreaming = ref(false)

  // Send a message to the API
  const sendMessageToAPI = async (chatMessage, targetChat) => {
    isLoading.value = true
    emit('loading-change', true)
    isStreaming.value = false
    try {
      const messages = targetChat.messages.map(m => ({
        role: m.role,
        content: m.role === 'assistant' && m.displayContent ? m.displayContent : m.content
      }))
      let accumulatedContent = ''
      let accumulatedDisplayContent = ''
      let currentThinking = ''
      let insideThinkTag = false
      let thinkTagBuffer = ''
      let rafPending = false
      const messageIndex = targetChat.messages.length - 1
      const handleChunk = (chunk) => {
        if (!isStreaming.value) isStreaming.value = true
        if (targetChat.messages[messageIndex] && targetChat.messages[messageIndex].isWaiting) {
          targetChat.messages[messageIndex].isWaiting = false
        }
        accumulatedContent += chunk
        let tempContent = accumulatedContent
        const thinkStartMatch = tempContent.match(/<think>/i)
        const thinkEndMatch = tempContent.match(/<\/think>/i)
        if (thinkStartMatch && thinkEndMatch) {
          const fullThinkMatch = tempContent.match(/<think>([\s\S]*?)<\/think>/i)
          if (fullThinkMatch) {
            currentThinking = fullThinkMatch[1].trim()
            tempContent = tempContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
            insideThinkTag = false
            thinkTagBuffer = ''
          }
        } else if (thinkStartMatch && !insideThinkTag) {
          insideThinkTag = true
          const thinkStart = tempContent.indexOf('<think>')
          thinkTagBuffer = tempContent.substring(thinkStart + 7)
          tempContent = tempContent.substring(0, thinkStart)
        } else if (insideThinkTag) {
          thinkTagBuffer += chunk
          tempContent = tempContent.substring(0, tempContent.indexOf('<think>'))
        }
        accumulatedDisplayContent = tempContent.trim()
        if (!rafPending) {
          rafPending = true
          requestAnimationFrame(() => {
            rafPending = false
            if (targetChat.messages[messageIndex]) {
              targetChat.messages[messageIndex].displayContent = accumulatedDisplayContent
              if (currentThinking) {
                targetChat.messages[messageIndex].thinking = currentThinking
              }
            }
            if (props.chat.id === targetChat.id) {
              scrollToBottom()
            }
          })
        }
      }
      const response = await sendChatMessage(messages, props.selectedModel, handleChunk)
      const thinkingMatch = accumulatedContent.match(/<think>([\s\S]*?)<\/think>/i)
      let serverThinking = null
      let displayContent = accumulatedContent
      if (thinkingMatch) {
        serverThinking = thinkingMatch[1].trim()
        displayContent = accumulatedContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
      }
      chatMessage.content = accumulatedContent
      chatMessage.displayContent = displayContent
      if (serverThinking) {
        chatMessage.thinking = serverThinking
      }
    } catch (error) {
      if (error.message !== 'Request cancelled') {
        chatMessage.content = `Error: ${error.message || 'Failed to get response from the model'}`
        chatMessage.displayContent = chatMessage.content
        chatMessage.thinking = null
      }
      chatMessage.isWaiting = false
    } finally {
      isLoading.value = false
      emit('loading-change', false)
      isStreaming.value = false
      scrollToBottom()
    }
  }

  // Retry a message
  const retryMessage = async (messageIndex) => {
    if (isLoading.value || !props.selectedModel) return
    props.chat.messages.splice(messageIndex + 1)
    const chatMessage = {
      role: 'assistant',
      content: '',
      displayContent: '',
      isWaiting: true
    }
    props.chat.messages.push(chatMessage)
    scrollToBottom()
    await sendMessageToAPI(chatMessage, props.chat)
  }

  // Edit a message
  const editMessage = async (messageIndex, newContent) => {
    if (isLoading.value || !props.selectedModel) return
    if (!props.chat.messages[messageIndex]) return
    props.chat.messages[messageIndex].content = newContent
    props.chat.messages[messageIndex].displayContent = newContent
    props.chat.messages.splice(messageIndex + 1)
    const chatMessage = {
      role: 'assistant',
      content: '',
      displayContent: '',
      isWaiting: true
    }
    props.chat.messages.push(chatMessage)
    scrollToBottom()
    await sendMessageToAPI(chatMessage, props.chat)
  }

  // Compress conversation
  const compressConversation = async () => {
    if (isLoading.value || !props.selectedModel || props.chat.messages.length === 0) return
    const messageCount = props.chat.messages.filter(m => m.role !== 'system').length
    isLoading.value = true
    try {
      const conversationText = props.chat.messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Chat'}: ${m.content}`)
        .join('\n\n')
      const compressionPrompt = `Please provide a concise summary of the following conversation, capturing the key points and context:\n\n${conversationText}\n\nSummary:`
      const messages = [{ role: 'user', content: compressionPrompt }]
      const response = await sendChatMessage(messages, props.selectedModel)
      const compressedMessage = {
        role: 'assistant',
        content: `[Previous conversation summary]: ${response}`,
        displayContent: response,
        compressed: true,
        compressedCount: messageCount,
        thinking: response,
        showThinking: false
      }
      props.chat.messages.push(compressedMessage)
      scrollToBottom()
    } catch (error) {
      alert('Failed to compress conversation: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // Handle sending a new user message
  const handleSendMessage = async (messageText) => {
    const userMessage = {
      role: 'user',
      content: messageText,
      displayContent: messageText
    }
    props.chat.messages.push(userMessage)
    if (props.chat.messages.filter(m => m.role === 'user').length === 1) {
      const title = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText
      emit('update-title', props.chat.id, title)
    }
    scrollToBottom()
    const chatMessage = {
      role: 'assistant',
      content: '',
      displayContent: '',
      isWaiting: true
    }
    props.chat.messages.push(chatMessage)
    scrollToBottom()
    await sendMessageToAPI(chatMessage, props.chat)
  }

  // Stop streaming
  const stopStreaming = () => {
    abortChatMessage()
    isStreaming.value = false
    isLoading.value = false
    emit('loading-change', false)
  }

  // Delete a user message and its reply, then update localStorage
  const deleteMessage = (userMsgIndex) => {
    if (props.chat.messages[userMsgIndex]?.role !== 'user') return
    props.chat.messages.splice(userMsgIndex, 2)
    if (props.chat.chats) {
      const chatIdx = props.chat.chats.findIndex(c => c.id === props.chat.id)
      if (chatIdx !== -1) {
        props.chat.chats[chatIdx].messages = props.chat.messages
        saveChats(props.chat.chats)
      }
    } else {
      saveChats([props.chat])
    }
  }

  return {
    isLoading,
    isStreaming,
    sendMessageToAPI,
    retryMessage,
    editMessage,
    compressConversation,
    handleSendMessage,
    stopStreaming,
    deleteMessage
  }
}
