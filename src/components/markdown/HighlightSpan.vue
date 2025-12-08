<template>
  <span class="highlight-wrapper">
    <mark
      class="custom-highlight"
      :style="{ backgroundColor: highlightColor }"
      :data-highlight-id="highlightId"
      :data-md-start="startOffset"
      :data-md-end="endOffset"
      @click="handleClick"
      @touchstart.passive="handleTouchStart"
      @touchend="handleTouchEnd"
      @touchmove.passive="handleTouchMove"
    >
      <slot>{{ text }}</slot>
    </mark>
    <button
      v-if="hasNote && isLastSegment"
      class="note-button"
      :data-note-id="highlightId"
      @click.stop="handleNoteClick"
      title="Open note"
    >
      +
    </button>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue'
import { highlightColors } from '../../constants/highlightColors.js'

const LONG_PRESS_DURATION = 500

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  colorIndex: {
    type: Number,
    default: 0
  },
  highlightId: {
    type: String,
    required: true
  },
  startOffset: {
    type: Number,
    required: true
  },
  endOffset: {
    type: Number,
    required: true
  },
  noteContent: {
    type: String,
    default: ''
  },
  hasNote: {
    type: Boolean,
    default: false
  },
  isLastSegment: {
    type: Boolean,
    default: true
  }
})

const highlightColor = computed(() => highlightColors[props.colorIndex] || highlightColors[0])

const emit = defineEmits(['highlight-click', 'note-click'])

function handleClick(event) {
  event.stopPropagation()

  // Ctrl+click (or Cmd+click on Mac) shows context menu
  if (event.ctrlKey || event.metaKey) {
    emit('highlight-click', {
      highlightId: props.highlightId,
      text: props.text,
      colorIndex: props.colorIndex,
      startOffset: props.startOffset,
      endOffset: props.endOffset,
      x: event.clientX,
      y: event.clientY
    })
    return
  }

  // Normal click: show note if available, otherwise show context menu
  if (props.hasNote) {
    emit('note-click', {
      noteId: props.highlightId,
      text: props.text,
      noteContent: props.noteContent,
      startOffset: props.startOffset,
      endOffset: props.endOffset,
      x: event.clientX,
      y: event.clientY
    })
  } else {
    emit('highlight-click', {
      highlightId: props.highlightId,
      text: props.text,
      colorIndex: props.colorIndex,
      startOffset: props.startOffset,
      endOffset: props.endOffset,
      x: event.clientX,
      y: event.clientY
    })
  }
}

function handleNoteClick(event) {
  emit('note-click', {
    noteId: props.highlightId,
    text: props.text,
    noteContent: props.noteContent,
    startOffset: props.startOffset,
    endOffset: props.endOffset,
    x: event.clientX,
    y: event.clientY
  })
}

// Long-press handling for mobile
const longPressTimer = ref(null)
const touchMoved = ref(false)

function handleTouchStart(event) {
  touchMoved.value = false
  const touch = event.touches[0]

  longPressTimer.value = setTimeout(() => {
    if (!touchMoved.value) {
      emit('highlight-click', {
        highlightId: props.highlightId,
        text: props.text,
        colorIndex: props.colorIndex,
        startOffset: props.startOffset,
        endOffset: props.endOffset,
        x: touch.clientX,
        y: touch.clientY
      })
    }
  }, LONG_PRESS_DURATION)
}

function handleTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function handleTouchMove() {
  touchMoved.value = true
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}
</script>

<style scoped>
.highlight-wrapper {
  position: relative;
  display: inline;
}

.custom-highlight {
  padding: 0;
  border-radius: 0;
  background-color: var(--color-highlight);
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.custom-highlight:hover {
  filter: brightness(0.9);
}

.note-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  margin-left: 1px;
  padding: 0;
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text-muted, #999);
  background-color: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  vertical-align: baseline;
  opacity: 0.4;
  user-select: none;
  -webkit-user-select: none;
}

.note-button:hover {
  opacity: 1;
  color: var(--color-text-strong, #333);
  background-color: var(--color-bg-active, rgba(0, 0, 0, 0.12));
}

.note-button:active {
  transform: scale(0.9);
}
</style>
