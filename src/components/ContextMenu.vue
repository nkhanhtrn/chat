<template>
  <teleport to="body">
    <template v-if="visible">
      <div class="context-menu-backdrop" @click="onClickOutside"></div>
      <div
        class="context-menu"
        :style="{ left: `${x}px`, top: `${y}px`, display: visible ? 'block' : 'none' }"
        @mousedown.stop
      >
        <Button class="context-menu-btn" @click="onKeepHighlight" :disabled="isStreaming" variant="tertiary">Add Highlight</Button>
        <Button class="context-menu-btn" @click="onAskQuestion" :disabled="isStreaming" variant="tertiary">Ask Question</Button>
      </div>
    </template>
  </teleport>
</template>

<script setup>
import { defineEmits, defineProps } from 'vue'
import Button from './Button.vue'

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
  background: var(--color-bg-context-menu);
  border: 1px solid var(--color-border-context);
  box-shadow: 0 4px 12px var(--shadow-md);
  border-radius: 4px;
  padding: 0.5rem 0.5rem;
  font-size: 1rem;
  color: var(--color-text-on-accent);
  z-index: 9999;
  user-select: none;
}
.context-menu-btn {
  width: 100%;
  text-align: left;
  font-size: 0.95rem;
  justify-content: flex-start;
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
