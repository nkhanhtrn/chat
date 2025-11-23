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
        // Prepare messages for API
        const messages = props.chat.messages
          .filter(m => !m.loading)
          .map(m => ({ role: m.role, content: m.content }))

        // Prepend website context if available
        if (websiteContext.value) {
          const contextMessage = {
            role: 'system',
            content: `The user has provided the following website content for context:\n\nTitle: ${websiteContext.value.title}\nURL: ${websiteContext.value.url}\n\nThe website content is:\n${websiteContext.value.content}\n\nPlease use this information to answer the user's questions when relevant.`
          }
          messages.unshift(contextMessage)
        }

        const response = await sendChatMessage(messages, props.selectedModel)
        
        // Parse thinking tags
        const thinkingMatch = response.match(/<think>([\s\S]*?)<\/think>/i)
        let thinking = null
        let displayContent = response
        
        if (thinkingMatch) {
          thinking = thinkingMatch[1].trim()
          displayContent = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        }
        
        // Update assistant message with response
        assistantMessage.content = response
        assistantMessage.displayContent = displayContent
        assistantMessage.thinking = thinking
        assistantMessage.showThinking = false
        assistantMessage.loading = false
      } catch (error) {
        console.error('Error processing message:', error)
        assistantMessage.content = `Error: ${error.message || 'Failed to get response from the model'}`
        assistantMessage.displayContent = assistantMessage.content
        assistantMessage.thinking = null
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
        thinking: 'Analyzing your question and generating a response...',
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
        thinking: 'Analyzing your question and generating a response...',
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
      // Check for URLs in the message and fetch content
      const urls = extractUrls(messageText)
      if (urls.length > 0) {
        // Update the loading message to indicate URL fetching
        const assistantMessage = {
          role: 'assistant',
          content: '',
          displayContent: '',
          thinking: 'Fetching content from URL...',
          showThinking: true,
          loading: true
        }
        
        // Add temporary loading message
        props.chat.messages.push(assistantMessage)
        scrollToBottom()
        
        // Fetch URL content
        const urlContent = await fetchUrlsContent(messageText)
        
        // Remove the temporary loading message
        props.chat.messages.pop()
        
        if (urlContent) {
          // Save the website context
          websiteContext.value = urlContent
          saveWebsiteContext(props.chat.id, urlContent)
        }
      }

      // Add user message
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

      // Add loading assistant message
      const assistantMessage = {
        role: 'assistant',
        content: '',
        displayContent: '',
        thinking: 'Analyzing your question and generating a response...',
        showThinking: true,
        loading: true
      }
      props.chat.messages.push(assistantMessage)
      scrollToBottom()

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
