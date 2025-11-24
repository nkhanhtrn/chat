
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
      <span class="chat-title-wrapper">
        <span v-if="!sidebarCollapsed" class="collapse-toggle" @click.stop="toggleQuestions" title="Collapse/Expand questions">
          <svg :style="{transform: questionsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}" width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="chat-title" v-if="!editingTitle" @click.stop="startEditingTitle" style="cursor:pointer;user-select:none;">
          {{ localTitle }}
        </span>
        <input v-else
          class="chat-title-input"
          v-model="editTitleValue"
          @blur="saveTitleEdit"
          @keyup.enter="saveTitleEdit"
          @keyup.esc="cancelTitleEdit"
          ref="titleInput"
          :maxlength="40"
          style="font-size:inherit;font-weight:inherit;width:120px;"
        />
      </span>
      <div class="chat-actions">
        <button 
          @click.stop="summarizeQuestions"
          class="summarize-btn"
          :disabled="syncing"
          title="Summarize questions"
        >
          <span v-if="syncing" class="sync-spinner" aria-label="Loading">
            <svg width="18" height="18" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke="#4f6fa5" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 94.2">
                <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </span>
          <span v-else>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style="vertical-align:middle;">
              <path d="M4.5 10a5.5 5.5 0 1 1 2.2 4.4" stroke="#4f6fa5" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="4.5,15 7,14.5 6.5,12" fill="none" stroke="#4f6fa5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>
        <button 
          @click.stop="deleteChat(id)" 
          class="delete-btn"
          title="Delete chat"
        >
          ×
        </button>
      </div>
    </div>
    <ul v-if="messageUnits.length && !questionsCollapsed" class="chat-questions-list chat-questions-list-separated">
      <li
        v-for="(unit, idx) in messageUnits"
        :key="idx"
        class="chat-question-item"
        @click="onQuestionClick(idx)"
        :title="capitalizeWords(unit.user.summarized || unit.user.content)"
        draggable="true"
        @dragstart="onQuestionDragStart(idx)"
        @dragover.prevent="onQuestionDragOver(idx)"
        @drop.prevent="onQuestionDrop(idx)"
        @dragend="onQuestionDragEnd"
        :class="['chat-question-item', { 'dragging': draggingIdx === idx, 'drag-over': dragOverIdx === idx }]"
      >
        <div><strong>{{ capitalizeWords(unit.user.summarized || unit.user.content) }}</strong></div>
      </li>
    </ul>
  </div>
</template>


<script>
import { useChatStore } from '../composables/useChatStore'
import { sendChatMessage } from '../services/api.js'
import { capitalizeWords } from './utils.js'

const chatStore = useChatStore()
const { setActiveChat, selectedModel, chats } = chatStore

export default {
  name: 'ChatThread',
  props: {
    id: { type: [String, Number], required: true },
    sidebarCollapsed: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    dragOver: { type: Boolean, default: false },
    deleteChat: { type: Function, required: true },
    onClick: { type: Function, required: false },
    onDragStart: { type: Function, required: true },
    onDragEnd: { type: Function, required: true },
    onDragOver: { type: Function, required: true },
    onDragLeave: { type: Function, required: true },
    onDrop: { type: Function, required: true }
  },
  computed: {
    // Group user+assistant as units
    messageUnits() {
      const globalChat = chats.value.find(c => c.id === this.id)
      if (!globalChat || !Array.isArray(globalChat.messages)) return []
      const units = []
      const msgs = globalChat.messages
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].role === 'user') {
          const user = msgs[i]
          let assistant = null
          if (msgs[i+1] && msgs[i+1].role === 'assistant') {
            assistant = msgs[i+1]
          }
          units.push({ user, assistant })
        }
      }
      return units
    },
    globalChat() {
      return chats.value.find(c => c.id === this.id)
    },
    localTitle: {
      get() {
        return this.globalChat ? this.globalChat.title : ''
      },
      set(val) {
        if (this.globalChat) this.globalChat.title = val
      }
    }
  },
  data() {
    return {
      questionsCollapsed: true,
      editingTitle: false,
      editTitleValue: '',
      syncing: false,
      draggingIdx: null,
      dragOverIdx: null
    }
  },
  methods: {
    capitalizeWords,

      // Drag-and-drop reorder logic for questions
      onQuestionDragStart(idx) {
        this.draggingIdx = idx;
      },
      onQuestionDragOver(idx) {
        if (this.draggingIdx !== null && this.draggingIdx !== idx) {
          this.dragOverIdx = idx;
        }
      },
      onQuestionDrop(idx) {
        if (this.draggingIdx === null || this.draggingIdx === idx) {
          this.draggingIdx = null;
          this.dragOverIdx = null;
          return;
        }
        const globalChat = chats.value.find(c => c.id === this.id);
        if (!globalChat || !Array.isArray(globalChat.messages)) {
          this.draggingIdx = null;
          this.dragOverIdx = null;
          return;
        }
        // Build units for index mapping
        const units = []
        const msgs = globalChat.messages
        for (let i = 0; i < msgs.length; i++) {
          if (msgs[i].role === 'user') {
            const userIdx = i
            let assistantIdx = null
            if (msgs[i+1] && msgs[i+1].role === 'assistant') {
              assistantIdx = i+1
            }
            units.push({ userIdx, assistantIdx })
          }
        }
        const fromUnit = units[this.draggingIdx]
        const toUnit = units[idx]
        if (!fromUnit || !toUnit) {
          this.draggingIdx = null;
          this.dragOverIdx = null;
          return;
        }
        // Extract the user+assistant messages
        const moveCount = fromUnit.assistantIdx !== null ? 2 : 1
        const moved = msgs.splice(fromUnit.userIdx, moveCount)
        // Adjust to index if moving down
        let insertIdx = toUnit.userIdx
        if (fromUnit.userIdx < toUnit.userIdx) insertIdx = toUnit.userIdx - moveCount + (toUnit.assistantIdx !== null ? 2 : 1)
        msgs.splice(insertIdx, 0, ...moved)
        this.draggingIdx = null;
        this.dragOverIdx = null;
      },
      onQuestionDragEnd() {
        this.draggingIdx = null;
        this.dragOverIdx = null;
      },
    toggleQuestions() {
      this.questionsCollapsed = !this.questionsCollapsed
    },
    startEditingTitle() {
      this.editingTitle = true
      this.editTitleValue = this.localTitle
      this.$nextTick(() => {
        if (this.$refs.titleInput) this.$refs.titleInput.focus()
      })
    },
    saveTitleEdit() {
      const newTitle = this.editTitleValue.trim()
      if (newTitle && newTitle !== this.localTitle) {
        // Use global store updateChat for reactivity
        chatStore.updateChat(this.id, chat => { chat.title = newTitle })
      }
      this.editingTitle = false
    },
    cancelTitleEdit() {
      this.editingTitle = false
    },
    onQuestionClick(idx) {
      // Set global active chat id
      setActiveChat(this.id)
      // Emit event to parent with question index
      this.$emit('question-click', { chatId: this.id, questionIndex: idx })
    },
    async summarizeQuestions() {
      const userMessages = this.messageUnits.map(u => u.user)
      if (userMessages.length === 0) return;
      // Compose the prompt
      const questions = userMessages.map((msg, i) => `- ${msg.content}`).join('\n')
      const prompt = `here's the list of my question so far:\n${questions}\n\nplease summary the question into 2-4 words max per questions, then return them in a list of word separated by comma. Just give me the list of summarized questions only and nothing else. For example : question 1,question 2,question 3`;

      // Use selectedModel from global state
      const model = selectedModel.value
      if (!model) {
        alert('No model selected!')
        return
      }

      this.syncing = true
      try {
        const response = await sendChatMessage([
          { role: 'user', content: prompt }
        ], model)
        // Parse the response: should be a comma-separated list
        console.log('Summarized response:', response)
        const names = response.split(',').map(s => s.trim()).filter(Boolean)
        if (names.length !== userMessages.length) {
          alert('The number of summarized questions does not match the original. Please try again.')
          return
        }
        // Update the user message summaries in global state
        const globalChat = chats.value.find(c => c.id === this.id)
        if (globalChat && Array.isArray(globalChat.messages)) {
          let nameIdx = 0;
          globalChat.messages.forEach((msg) => {
            if (msg.role === 'user' && names[nameIdx]) {
              msg.summarized  = names[nameIdx];
              nameIdx++;
            }
          });
        }
      } catch (err) {
        alert('Failed to summarize questions: ' + (err.message || err))
      } finally {
        this.syncing = false
      }
    },
  }
}
</script>


<style scoped>
.chat-tab {
  margin-bottom: 0 !important;
  padding: 8px !important;
}
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
.chat-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.summarize-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  transition: background 0.15s, border 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 28px;
}
.summarize-btn:hover {
  background: #27212a9f;
}
.delete-btn {
  background: transparent;
  border: none;
  color: #c44;
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.delete-btn:hover {
  background: #27212a9f;
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
  margin-left: 32px;
  color: #4f6fa5;
  font-size: 15px;
  font-weight: 500;
  word-break: break-word;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s;
  user-select: none;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.chat-question-item:hover {
  color: #7a97c7;
  text-decoration: underline;
}
.chat-question-item.dragging {
  opacity: 0.5;
}
.chat-question-item.drag-over {
  border-top: 2px solid #10a37f;
  margin-top: 2px;
}
.sync-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
