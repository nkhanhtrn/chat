<template>
  <div class="chat-view">
    <div class="collapse-all-btn-wrapper">
      <button class="collapse-all-btn" @click="toggleCollapseAll">
        <span v-if="!allCollapsed">▼ Collapse All</span>
        <span v-else>▲ Expand All</span>
      </button>
    </div>
    <div class="messages-container" ref="messagesContainer">
      <template v-if="activeChat && activeChat.messages" v-for="(message, index) in activeChat.messages" :key="index">
        <MessageItem
          v-if="message.role === 'user'"
          :message="message"
          :is-loading="isLoading"
          :is-last-user-message="index === activeChat.messages.map(m => m.role).lastIndexOf('user')"
          :force-collapsed="getCollapsed(index)"
          @retry="retryMessage(index)"
          @edit="editMessage(index, $event)"
          @delete="deleteMessage(index)"
          @collapse="onUserCollapse(index, $event)"
        />
        <MessageItem
          v-else
          :message="message"
          :is-loading="isLoading"
          :is-last-user-message="false"
          :force-collapsed="getCollapsed(index)"
          @expand-associated-user="expandAssociatedUser(index)"
        />
      </template>
    </div>

    <ChatInput 
      :is-loading="globalLoading"
      :is-streaming="isStreaming"
      :selected-model="selectedModel"
      :show-compress="activeChat && activeChat.messages && activeChat.messages.length > 0"
      @send="handleSendMessage"
      @compress="compressConversation"
      @stop="stopStreaming"
    />
  </div>
</template>

<style scoped>
.chat-view {
  position: relative;
}
.collapse-all-btn-wrapper {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
  width: max-content;
  margin-top: 16px;
}
.collapse-all-btn {
  pointer-events: auto;
}
.collapse-all-btn {
  background-color: rgba(52, 53, 65, 0.7);
  color: #ececf1;
  border: 1px solid #565869;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  padding: 7px 16px;
  cursor: pointer;
  box-shadow: none;
  opacity: 1;
  pointer-events: auto;
  transition: background-color 0.2s, color 0.2s, border 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(2px);
}
.collapse-all-btn:hover {
  background-color: rgba(64, 65, 79, 0.95);
  color: #fff;
  border: 1px solid #676879;
}
</style>

<script>


import { ref, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../composables/useChatStore'

import MessageItem from './MessageItem.vue'
import ChatInput from './ChatInput.vue'
import { useCollapseMessages } from '../composables/useCollapseMessages'
import { useChatMessages } from '../composables/useChatMessages'


export default {
  name: 'ChatView',
  components: {
    MessageItem,
    ChatInput
  },
  props: {
    chat: {
      type: Object,
      required: false
    },
    selectedModel: {
      type: String,
      required: true
    },
    globalLoading: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { emit }) {
    const { activeChat } = useChatStore()
    const messagesContainer = ref(null)

    // Use composable for collapse logic
    const chatRef = ref(activeChat)
    const {
      allCollapsed,
      collapsedMap,
      toggleCollapseAll,
      getCollapsed,
      onUserCollapse,
      expandAssociatedUser
    } = useCollapseMessages(chatRef)

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }

    onMounted(() => {
      scrollToBottom()
    })

    // Use composable for chat message logic
    // Always pass a snapshot of the current chat, not a reactive reference
    const { selectedModel: globalSelectedModel } = useChatStore()
    const getChatSnapshot = () => props.chat || activeChat.value
    // Use the prop if provided, otherwise fallback to global state
    const selectedModelValue = props.selectedModel ?? globalSelectedModel.value
    const chatMessages = useChatMessages({ getChat: getChatSnapshot, selectedModel: selectedModelValue }, emit, scrollToBottom)
    const {
      isLoading,
      isStreaming,
      sendMessageToAPI,
      retryMessage,
      editMessage,
      compressConversation,
      handleSendMessage,
      stopStreaming,
      deleteMessage
    } = chatMessages

    watch(() => activeChat.value?.messages?.length, () => {
      scrollToBottom()
    })

    return {
      isLoading,
      isStreaming,
      messagesContainer,
      retryMessage,
      editMessage,
      handleSendMessage,
      compressConversation,
      stopStreaming,
      allCollapsed,
      toggleCollapseAll,
      deleteMessage,
      getCollapsed,
      onUserCollapse,
      expandAssociatedUser,
      activeChat,
      // Use the prop value for selectedModel so ChatInput receives the correct prop
      selectedModel: props.selectedModel ?? globalSelectedModel.value
    }
  }
}
</script>
