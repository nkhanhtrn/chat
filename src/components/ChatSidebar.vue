<template>
  <div class="chat-sidebar">
    <div class="sidebar-header">
      <button @click="$emit('new-chat')" class="new-chat-button">
        <span class="icon">+</span>
        New Chat
      </button>
    </div>

    <div class="chat-list">
      <div
        v-for="chat in chats"
        :key="chat.id"
        :class="['chat-item', { active: chat.id === currentChatId }]"
      >
        <div class="chat-header">
          <div class="collapse-icon" @click="toggleCollapse(chat.id)" v-if="chat.questions.length > 0">
            {{ isCollapsed(chat.id) ? '▸' : '▾' }}
          </div>
          <div class="chat-title" @click="$emit('select-chat', chat.id)">{{ chat.title }}</div>
        </div>

        <div
          v-if="chat.questions.length > 0 && !isCollapsed(chat.id)"
          class="question-list"
        >
          <div
            v-for="question in chat.questions"
            :key="question.id"
            @click="$emit('select-question', question.id)"
            :class="['question-item', { active: question.id === currentMessageId }]"
          >
            <span class="question-text">{{ question.text }}</span>
          </div>
        </div>
      </div>

      <div v-if="chats.length === 0" class="empty-state">
        <p>No chats yet</p>
        <p class="empty-hint">Click "New Chat" to start</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  chats: {
    type: Array,
    required: true
  },
  currentChatId: {
    type: String,
    default: null
  },
  currentMessageId: {
    type: String,
    default: null
  }
})

defineEmits(['new-chat', 'select-chat', 'select-question'])

const collapsedChats = ref(new Set())

const toggleCollapse = (chatId) => {
  if (collapsedChats.value.has(chatId)) {
    collapsedChats.value.delete(chatId)
  } else {
    collapsedChats.value.add(chatId)
  }
}

const isCollapsed = (chatId) => {
  return collapsedChats.value.has(chatId)
}
</script>

<style scoped>
.chat-sidebar {
  width: 320px;
  height: 100vh;
  background-color: #fdfdf8;
  border-right: 1px solid #d4d4c8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Georgia', serif;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 2px solid #d4d4c8;
  background-color: #f5f5ef;
}

.new-chat-button {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: system-ui, -apple-system, sans-serif;
}

.new-chat-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.new-chat-button:active {
  transform: translateY(0);
}

.new-chat-button .icon {
  font-size: 1.5rem;
  line-height: 1;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0.5rem;
}

.chat-item {
  margin-bottom: 0.5rem;
}

.chat-item.active {
  background-color: #f9f9f3;
}

.chat-header {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid transparent;
  transition: all 0.2s;
  user-select: none;
}

.chat-header:hover {
  background-color: #f5f5ef;
}

.chat-item.active .chat-header {
  background-color: #f0f0ea;
  border-left-color: #667eea;
}

.chat-title {
  font-weight: 600;
  color: #2c2c2c;
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 1;
  cursor: pointer;
  padding: 0.1rem 0;
}

.chat-title:hover {
  color: #667eea;
}

.collapse-icon {
  font-size: 1.2rem;
  color: #6c6c68;
  transition: all 0.2s;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.collapse-icon:hover {
  background-color: #e8e8e0;
  color: #2c2c2c;
}

.question-list {
  margin-top: 0.25rem;
  padding-left: 2.25rem;
  border-left: 2px solid #e8e8e0;
  margin-left: 0.75rem;
}

.question-item {
  display: flex;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 2px solid transparent;
  margin-left: -2px;
}

.question-item:hover {
  background-color: #f5f5ef;
  border-left-color: #a0a098;
}

.question-item.active {
  background-color: #ededdf;
  border-left-color: #667eea;
}

.question-text {
  font-size: 0.9rem;
  color: #4a4a46;
  line-height: 1.5;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: #6c6c68;
}

.empty-state p {
  margin: 0.5rem 0;
  font-family: system-ui, -apple-system, sans-serif;
}

.empty-hint {
  font-size: 0.875rem;
  color: #a0a098;
}

/* Scrollbar styling */
.chat-list::-webkit-scrollbar {
  width: 8px;
}

.chat-list::-webkit-scrollbar-track {
  background: #f5f5ef;
}

.chat-list::-webkit-scrollbar-thumb {
  background: #d4d4c8;
  border-radius: 4px;
}

.chat-list::-webkit-scrollbar-thumb:hover {
  background: #a0a098;
}
</style>
