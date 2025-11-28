<template>
  <teleport to="body">
    <template v-if="visible">
      <div class="context-menu-backdrop" @click="onClickOutside"></div>
      <div
        class="context-menu"
        :style="{ left: `${x}px`, top: `${y}px`, display: visible ? 'block' : 'none' }"
        @mousedown.stop
      >
        <button class="context-menu-btn" @click="onKeepHighlight" :disabled="isStreaming">Add Highlight</button>
        <button class="context-menu-btn" @click="onAskQuestion" :disabled="isStreaming">Ask Question</button>
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
const emit = defineEmits(['close', 'keep-highlight', 'ask-question'])

function onKeepHighlight() {
  emit('keep-highlight')
}

function onAskQuestion() {
  emit('ask-question', `${props.highlightedText}`)
}

function onClickOutside() {
  emit('close')
}


</script>

<style scoped>
.context-menu {
  position: absolute;
  min-width: 160px;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-context);
  box-shadow: 0 2px 8px var(--shadow-lg);
  border-radius: 6px;
  padding: 0.5em 0.25em;
  font-size: 1rem;
  color: var(--color-text-on-accent);
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
  color: var(--color-text-on-accent);
}
.context-menu-btn:hover:not(:disabled) {
  background: var(--color-bg-context-hover);
}

.context-menu-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  color: var(--color-text-context-disabled);
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
