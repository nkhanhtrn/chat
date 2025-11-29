<template>
  <teleport to="body">
    <template v-if="visible">
      <div class="context-menu-backdrop" @click="onClickOutside"></div>
      <div
        class="context-menu"
        :style="{ left: `${x}px`, top: `${y}px`, display: visible ? 'block' : 'none' }"
        @mousedown.stop
      >
        <div class="context-menu-row">
          <Button class="context-menu-btn" @click="onHighlightAction" variant="tertiary">{{ hasExistingHighlight ? 'Remove' : 'Highlight' }}</Button>
          <div class="color-picker">
            <button
              v-for="(color, index) in highlightColors"
              :key="index"
              class="color-circle"
              :class="{ selected: selectedColorIndex === index }"
              :style="{ backgroundColor: color }"su
              @click="selectColor(index)"
            ></button>
          </div>
        </div>
        <Button class="context-menu-btn" @click="onCopy" variant="tertiary">Copy</Button>
        <div class="context-menu-row">
          <Button class="context-menu-btn" @click="onAddNote" variant="tertiary">{{ hasExistingNote ? 'Edit Note' : 'Add Note' }}</Button>
          <span class="separator">|</span>
          <Button class="context-menu-btn" @click="onQuickExplain" :disabled="isStreaming" variant="tertiary">Quick Explain</Button>
        </div>
        <Button class="context-menu-btn" @click="onAskQuestion" :disabled="isStreaming" variant="tertiary">Details Explain</Button>
        <Button class="context-menu-btn" @click="onAddChapter" :disabled="isStreaming" variant="tertiary">New chapter from this</Button>
        <PromptInput
          placeholder="Custom prompt..."
          :disabled="isStreaming"
          @submit="onSendCustomPrompt"
        />
      </div>
    </template>
  </teleport>
</template>

<script setup>
import { defineEmits, defineProps, ref, watch, onMounted, onUnmounted } from 'vue'
import Button from './Button.vue'
import PromptInput from './PromptInput.vue'
import { highlightColors } from '../constants/highlightColors.js'

const props = defineProps({
  visible: Boolean,
  x: Number,
  y: Number,
  highlightedText: String,
  isStreaming: {
    type: Boolean,
    default: false
  },
  colorIndex: {
    type: Number,
    default: 0
  },
  hasExistingHighlight: {
    type: Boolean,
    default: false
  },
  hasExistingNote: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['close', 'keep-highlight', 'ask-question', 'change-color', 'remove-highlight', 'add-chapter', 'add-note', 'quick-explain'])

const selectedColorIndex = ref(0)

// Update selected color index when colorIndex prop changes or menu becomes visible
watch([() => props.colorIndex, () => props.visible], ([newIndex]) => {
  selectedColorIndex.value = newIndex ?? 0
}, { immediate: true })

function selectColor(index) {
  selectedColorIndex.value = index
  if (props.hasExistingHighlight) {
    // Just change color of existing highlight
    emit('change-color', index)
  } else {
    // Create new highlight with this color
    emit('keep-highlight', index)
  }
}

function onHighlightAction() {
  if (props.hasExistingHighlight) {
    emit('remove-highlight')
  } else {
    emit('keep-highlight', selectedColorIndex.value)
  }
}

function onAskQuestion() {
  emit('ask-question', `${props.highlightedText}`)
}

function onAddChapter() {
  emit('add-chapter', `${props.highlightedText}`)
}

function onAddNote() {
  emit('add-note')
}

function onQuickExplain() {
  emit('quick-explain')
}

function onSendCustomPrompt(customPrompt) {
  const prompt = `${customPrompt}\nfor more context: ${props.highlightedText}`
  emit('ask-question', prompt)
}

function onClickOutside() {
  emit('close')
}

async function onCopy() {
  if (props.highlightedText) {
    try {
      await navigator.clipboard.writeText(props.highlightedText)
      emit('close')
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }
}

function onKeyDown(event) {
  if (event.key === 'Escape' && props.visible) {
    emit('close')
  }
  // Ctrl+C or Cmd+C to copy
  if ((event.ctrlKey || event.metaKey) && event.key === 'c' && props.visible) {
    event.preventDefault()
    onCopy()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.context-menu {
  position: absolute;
  width: 300px;
  background: var(--color-bg-context-menu);
  border: 1px solid var(--color-border-context);
  box-shadow: 0 4px 12px var(--shadow-md);
  border-radius: 4px;
  padding: 0.25rem 0.35rem;
  font-size: 1.1rem;
  color: var(--color-text-on-accent);
  z-index: 9999;
  user-select: none;
}
.context-menu-btn {
  width: 100%;
  text-align: left;
  font-size: 1.05rem;
  justify-content: flex-start;
  padding: 0.25rem 0.5rem;
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

.context-menu-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem;
}

.color-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
  outline: none;
}

.color-circle:hover {
  transform: scale(1.15);
}

.color-circle.selected {
  border-color: var(--color-text-strong);
  box-shadow: 0 0 0 1px var(--color-bg-context-menu);
}

.color-circle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

</style>
