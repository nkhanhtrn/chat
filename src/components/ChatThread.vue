<template>
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
    <span v-else class="chat-title">{{ chat.title }}</span>
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
</template>

<script>
export default {
  name: 'ChatThread',
  props: {
    chat: { type: Object, required: true },
    active: { type: Boolean, default: false },
    dragOver: { type: Boolean, default: false },
    finishEditingTitle: { type: Function, required: true },
    startEditingTitle: { type: Function, required: true },
    deleteChat: { type: Function, required: true },
    onClick: { type: Function, required: true },
    onDragStart: { type: Function, required: true },
    onDragEnd: { type: Function, required: true },
    onDragOver: { type: Function, required: true },
    onDragLeave: { type: Function, required: true },
    onDrop: { type: Function, required: true }
  }
}
</script>

<style scoped>
/* Add any ChatThread-specific styles here if needed */
</style>
