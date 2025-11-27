<template>
  <teleport to="body">
    <template v-if="visible">
      <div class="context-menu-backdrop" @click="onClickOutside"></div>
      <div
        class="context-menu"
        :style="{ left: `${x}px`, top: `${y}px`, display: visible ? 'block' : 'none' }"
        @mousedown.stop
      >
        <button class="context-menu-btn" @click="onAddHighlight" :disabled="isStreaming">Add Highlight</button>
        <button class="context-menu-btn" @click="onClick" :disabled="isStreaming">Ask Question</button>
      </div>
    </template>
  </teleport>
</template>

<script setup>
import { defineEmits, defineProps } from 'vue'

const props = defineProps({
  visible: Boolean,
  x: Number,
  y: Number,
  highlightedText: String,
  isStreaming: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['close', 'highlight', 'add-highlight'])

function onClick() {
  emit('highlight', `${props.highlightedText}`)
  emit('close')
}

function onAddHighlight() {
  emit('add-highlight', props.highlightedText)
  emit('close')
}

function onClickOutside() {
  emit('close')
}


</script>

<style scoped>
.context-menu {
  position: absolute;
  min-width: 160px;
  background: #fff;
  border: 1px solid #d1d5db;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border-radius: 6px;
  padding: 0.5em 0.25em;
  font-size: 1rem;
  color: #222;
  z-index: 9999;
  user-select: none;
}
.context-menu-btn {
  background: none;
  border: none;
  width: 100%;
  padding: 0.5em 1em;
  text-align: left;
  cursor: pointer;
  font-size: 1rem;
  color: #222;
}
.context-menu-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.context-menu-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  color: #999;
}

.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: transparent;
  z-index: 9998;
}
</style>
