<template>
  <div>
    <div :class="['chat-tab', { active, 'drag-over': dragOver }]" draggable="true"
      @click="onClick"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <input
        v-if="chat.editing"
        v-model="chat.title"
        @click.stop
        @keydown.enter="finishEditingTitle(chat)"
        @blur="finishEditingTitle(chat)"
        class="chat-title-input"
        ref="titleInput"
      />
      <span v-else class="chat-title-wrapper">
        <span v-if="!sidebarCollapsed" class="collapse-toggle" @click.stop="toggleQuestions" title="Collapse/Expand questions">
          <svg :style="{transform: questionsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="chat-title" @click="onClick" style="cursor:pointer;user-select:none;">{{ chat.title }}</span>
      </span>
      <div class="chat-actions">
        <button 
          v-if="!chat.editing"
          @click.stop="startEditingTitle(chat)" 
          class="edit-btn"
        >
          ✎
        </button>
        <button 
          @click.stop="deleteChat(chat.id)" 
          class="delete-btn"
        >
          ×
        </button>
      </div>
    </div>
    <ul v-if="userMessages.length && !questionsCollapsed" class="chat-questions-list chat-questions-list-separated">
      <li v-for="(msg, idx) in userMessages" :key="idx" class="chat-question-item" @click="onQuestionClick(idx)">
        {{ msg.content }}
      </li>
    </ul>
  </div>
</template>

<script>
import { useChatStore } from '../composables/useChatStore'
const { setActiveChat } = useChatStore()

export default {
  name: 'ChatThread',
  props: {
    chat: { type: Object, required: true },
    active: { type: Boolean, default: false },
    dragOver: { type: Boolean, default: false },
    finishEditingTitle: { type: Function, required: true },
    startEditingTitle: { type: Function, required: true },
    deleteChat: { type: Function, required: true },
    onClick: { type: Function, required: false },
    onDragStart: { type: Function, required: true },
    onDragEnd: { type: Function, required: true },
    onDragOver: { type: Function, required: true },
    onDragLeave: { type: Function, required: true },
    onDrop: { type: Function, required: true },
    sidebarCollapsed: { type: Boolean, default: false }
  },
  computed: {
    userMessages() {
      return Array.isArray(this.chat.messages)
        ? this.chat.messages.filter(msg => msg && msg.role === 'user' && msg.content)
        : []
    }
  },
  data() {
    return {
      questionsCollapsed: true
    }
  },
  methods: {
    toggleQuestions() {
      this.questionsCollapsed = !this.questionsCollapsed
    },
    onQuestionClick(idx) {
      // Set global active chat id
      setActiveChat(this.chat.id)
    }
  }
}
</script>

<style scoped>
.chat-title-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}
.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
  border-radius: 50%;
}
.collapse-toggle:hover {
  background: rgba(60, 60, 90, 0.09);
}
.chat-questions-list-separated {
  margin-top: 16px;
}
.chat-questions-list {
  margin: 10px 0 0 0;
  padding: 0;
  list-style: none;
}
.chat-question-item {
  margin-bottom: 8px;
  margin-left: 18px;
  color: #4f6fa5;
  font-size: 15px;
  font-weight: 500;
  word-break: break-word;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s;
  user-select: none;
}
.chat-question-item:hover {
  color: #7a97c7;
  text-decoration: underline;
}
</style>
