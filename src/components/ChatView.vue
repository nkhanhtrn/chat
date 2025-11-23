<template>
  <div class="chat-view">
    <div class="messages-container" ref="messagesContainer">
      <MessageItem
        v-for="(message, index) in chat.messages" 
        :key="index"
        :message="message"
        :is-loading="isLoading"
        :is-last-user-message="message.role === 'user' && index === chat.messages.map(m => m.role).lastIndexOf('user')"
        @retry="retryMessage(index)"
        @edit="editMessage(index, $event)"
      />
    </div>

    <ChatInput 
      :is-loading="isLoading"
      :selected-model="selectedModel"
      :show-compress="chat.messages.length > 0"
      :website-context="websiteContext"
      @send="handleSendMessage"
      @compress="compressConversation"
      @website-removed="handleWebsiteRemoved"
    />
  </div>
</template>

<script>
import { ref, watch, nextTick, onMounted } from 'vue'
import { sendChatMessage } from '../services/api.js'
import { fetchWebsiteContent } from '../services/websiteContent.js'
import { loadWebsiteContext, saveWebsiteContext, deleteWebsiteContext } from '../services/storage.js'
import MessageItem from './MessageItem.vue'
import ChatInput from './ChatInput.vue'

export default {
  name: 'ChatView',
  components: {
    MessageItem,
    ChatInput
  },
  props: {
    chat: {
      type: Object,
      required: true
    },
    selectedModel: {
      type: String,
      required: true
    }
  },
  emits: ['update-title'],
  setup(props, { emit }) {
    const isLoading = ref(false)
    const messagesContainer = ref(null)
    const websiteContext = ref(null)

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    // Function to extract URLs from text
    const extractUrls = (text) => {
      const urlRegex = /(https?:\/\/[^\s]+)/gi
      return text.match(urlRegex) || []
    }

    // Function to fetch content from URLs in message
    const fetchUrlsContent = async (text) => {
      const urls = extractUrls(text)
      if (urls.length === 0) return null

      try {
        // Fetch content from the first URL found
        const url = urls[0]
        const websiteData = await fetchWebsiteContent(url)
        return websiteData
      } catch (error) {
        console.error('Error fetching URL content:', error)
        return null
      }
    }

    const sendMessageToAPI = async (assistantMessage) => {
      isLoading.value = true
      
      try {
        // Prepare messages for API - use displayContent to exclude thinking tags
        const messages = props.chat.messages
          .filter(m => !m.loading)
          .map(m => ({ 
            role: m.role, 
            // Use displayContent for assistant messages to exclude thinking,
            // use content for user messages (they don't have displayContent distinction)
            content: m.role === 'assistant' && m.displayContent ? m.displayContent : m.content 
          }))

        // Prepend website context if available
        if (websiteContext.value) {
          const contextMessage = {
            role: 'system',
            content: `The user has provided the following website content for context:\n\nTitle: ${websiteContext.value.title}\nURL: ${websiteContext.value.url}\n\nThe website content is:\n${websiteContext.value.content}\n\nPlease use this information to answer the user's questions when relevant.`
          }
          messages.unshift(contextMessage)
        }

        let accumulatedContent = ''
        let accumulatedDisplayContent = ''
        let currentThinking = ''
        let insideThinkTag = false
        let thinkTagBuffer = ''
        let rafPending = false
        
        // Get the message index once at the start
        const messageIndex = props.chat.messages.length - 1
        
        // Callback to handle streaming chunks
        const handleChunk = (chunk) => {
          accumulatedContent += chunk
          
          // Parse for <think> tags incrementally
          let tempContent = accumulatedContent
          const thinkStartMatch = tempContent.match(/<think>/i)
          const thinkEndMatch = tempContent.match(/<\/think>/i)
          
          if (thinkStartMatch && thinkEndMatch) {
            // Complete think tag found
            const fullThinkMatch = tempContent.match(/<think>([\s\S]*?)<\/think>/i)
            if (fullThinkMatch) {
              currentThinking = fullThinkMatch[1].trim()
              tempContent = tempContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
              insideThinkTag = false
              thinkTagBuffer = ''
            }
          } else if (thinkStartMatch && !insideThinkTag) {
            // Think tag started but not finished
            insideThinkTag = true
            const thinkStart = tempContent.indexOf('<think>')
            thinkTagBuffer = tempContent.substring(thinkStart + 7) // After <think>
            tempContent = tempContent.substring(0, thinkStart)
          } else if (insideThinkTag) {
            // Accumulating content inside think tag
            thinkTagBuffer += chunk
            tempContent = tempContent.substring(0, tempContent.indexOf('<think>'))
          }
          
          accumulatedDisplayContent = tempContent.trim()
          
          // Use requestAnimationFrame to batch updates
          if (!rafPending) {
            rafPending = true
            requestAnimationFrame(() => {
              rafPending = false
              
              // Update the message directly by index
              props.chat.messages[messageIndex].displayContent = accumulatedDisplayContent
              if (currentThinking) {
                props.chat.messages[messageIndex].thinking = currentThinking
              }
              
              // Keep scrolling as content arrives
              nextTick(() => scrollToBottom())
            })
          }
        }
        
        const response = await sendChatMessage(messages, props.selectedModel, handleChunk)
        
        // Final parsing after streaming completes
        const thinkingMatch = accumulatedContent.match(/<think>([\s\S]*?)<\/think>/i)
        let serverThinking = null
        let displayContent = accumulatedContent
        
        if (thinkingMatch) {
          serverThinking = thinkingMatch[1].trim()
          displayContent = accumulatedContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        }
        
        // Update assistant message with final response
        assistantMessage.content = accumulatedContent
        assistantMessage.displayContent = displayContent
        
        // Preserve existing thinking array if it exists, otherwise use server thinking
        if (!Array.isArray(assistantMessage.thinking) && serverThinking) {
          assistantMessage.thinking = serverThinking
        } else if (Array.isArray(assistantMessage.thinking)) {
          // Update the last task (analyzing) with a checkmark
          const updatedThinking = assistantMessage.thinking.map((task, index) => {
            // Mark the last task as complete (the analyzing task)
            if (index === assistantMessage.thinking.length - 1 && !task.startsWith('✓') && !task.startsWith('✗')) {
              return '✓ ' + task.replace(/^⟳\s*/, '')
            }
            return task
          })
          assistantMessage.thinking = updatedThinking
        }
        
        // Keep thinking block visible but collapsed after completion
        assistantMessage.loading = false
      } catch (error) {
        console.error('Error processing message:', error)
        assistantMessage.content = `Error: ${error.message || 'Failed to get response from the model'}`
        assistantMessage.displayContent = assistantMessage.content
        // Keep existing thinking array if present, don't overwrite with null
        if (!Array.isArray(assistantMessage.thinking)) {
          assistantMessage.thinking = null
        }
        assistantMessage.loading = false
      } finally {
        isLoading.value = false
        scrollToBottom()
      }
    }

    const retryMessage = async (messageIndex) => {
      if (isLoading.value || !props.selectedModel) {
        return
      }

      // Remove messages after the retry point
      props.chat.messages.splice(messageIndex + 1)

      // Add loading assistant message
      const assistantMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        thinking: ['⟳ Analyzing your question and generating a response...'],
        showThinking: true,
        loading: true
      }
      props.chat.messages.push(assistantMessage)
      scrollToBottom()

      await sendMessageToAPI(assistantMessage)
    }

    const editMessage = async (messageIndex, newContent) => {
      if (isLoading.value || !props.selectedModel) {
        return
      }

      // Update the message content
      props.chat.messages[messageIndex].content = newContent
      props.chat.messages[messageIndex].displayContent = newContent

      // Remove messages after this point and retry
      props.chat.messages.splice(messageIndex + 1)

      // Add loading assistant message
      const assistantMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        thinking: ['⟳ Analyzing your question and generating a response...'],
        showThinking: true,
        loading: true
      }
      props.chat.messages.push(assistantMessage)
      scrollToBottom()

      await sendMessageToAPI(assistantMessage)
    }

    const compressConversation = async () => {
      if (isLoading.value || !props.selectedModel || props.chat.messages.length === 0) {
        return
      }

      const messageCount = props.chat.messages.filter(m => !m.loading && m.role !== 'system').length

      isLoading.value = true

      try {
        // Create a summary request
        const conversationText = props.chat.messages
          .filter(m => !m.loading && m.role !== 'system')
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n')

        const compressionPrompt = `Please provide a concise summary of the following conversation, capturing the key points and context:\n\n${conversationText}\n\nSummary:`

        const messages = [{ role: 'user', content: compressionPrompt }]
        const response = await sendChatMessage(messages, props.selectedModel)

        // Add compressed summary as an assistant message at the end with collapsible display
        const compressedMessage = {
          role: 'assistant',
          content: `[Previous conversation summary]: ${response}`,
          displayContent: response,
          compressed: true,
          compressedCount: messageCount,
          thinking: response, // Store summary in thinking so it uses the collapsible UI
          showThinking: false // Start collapsed
        }

        // Add to end of messages array
        props.chat.messages.push(compressedMessage)

        scrollToBottom()
      } catch (error) {
        console.error('Error compressing conversation:', error)
        alert('Failed to compress conversation: ' + error.message)
      } finally {
        isLoading.value = false
      }
    }

    const handleSendMessage = async (messageText) => {
      // Add user message immediately
      const userMessage = {
        role: 'user',
        content: messageText,
        displayContent: messageText
      }
      props.chat.messages.push(userMessage)

      // Update chat title with first message
      if (props.chat.messages.filter(m => m.role === 'user').length === 1) {
        const title = messageText.length > 30 
          ? messageText.substring(0, 30) + '...' 
          : messageText
        emit('update-title', props.chat.id, title)
      }

      scrollToBottom()

      // Check for URLs in the message
      const urls = extractUrls(messageText)
      const hasUrls = urls.length > 0

      // Initialize thinking array with analyzing message
      const thinkingArray = ['⟳ Analyzing your question and generating a response...']
      
      // Add URL fetching message if URLs present
      if (hasUrls) {
        thinkingArray.unshift(`⟳ Fetching content from ${urls[0]}...`)
      }

      // Add loading assistant message
      const assistantMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        thinking: thinkingArray,
        showThinking: true,
        loading: true
      }
      props.chat.messages.push(assistantMessage)
      scrollToBottom()

      // Fetch URL content if URLs are present
      if (hasUrls) {
        const urlContent = await fetchUrlsContent(messageText)
        
        const messageIndex = props.chat.messages.length - 1
        
        if (urlContent) {
          // Save the website context
          websiteContext.value = urlContent
          saveWebsiteContext(props.chat.id, urlContent)
          
          // Update thinking to show URL was fetched successfully
          props.chat.messages[messageIndex].thinking = [
            `✓ Fetched content from ${urls[0]}`,
            'Analyzing your question and generating a response...'
          ]
        } else {
          // Update thinking to show URL fetch failed
          props.chat.messages[messageIndex].thinking = [
            `✗ Failed to fetch content from ${urls[0]}`,
            'Analyzing your question and generating a response...'
          ]
        }
      }

      await sendMessageToAPI(assistantMessage)
    }

    const handleWebsiteRemoved = () => {
      websiteContext.value = null
      deleteWebsiteContext(props.chat.id)
    }

    // Load website context when chat is mounted
    onMounted(() => {
      const savedContext = loadWebsiteContext(props.chat.id)
      if (savedContext) {
        websiteContext.value = savedContext
      }
    })

    // Watch for chat changes and load context
    watch(() => props.chat.id, (newChatId) => {
      const savedContext = loadWebsiteContext(newChatId)
      websiteContext.value = savedContext
    })

    watch(() => props.chat.messages.length, () => {
      scrollToBottom()
    })

    return {
      isLoading,
      messagesContainer,
      websiteContext,
      retryMessage,
      editMessage,
      handleSendMessage,
      compressConversation,
      handleWebsiteRemoved
    }
  }
}
</script>
