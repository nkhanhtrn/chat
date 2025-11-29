<template>
  <span class="highlight-wrapper">
    <mark
      class="custom-highlight"
      :style="{ backgroundColor: highlightColor }"
      :data-highlight-id="highlightId"
      :data-md-start="startOffset"
      :data-md-end="endOffset"
      @click="handleClick"
    >
      <slot>{{ text }}</slot>
    </mark>
    <button
      v-if="hasNote"
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
import { computed } from 'vue'
import { highlightColors } from '../../constants/highlightColors.js'

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
  }
})

const highlightColor = computed(() => highlightColors[props.colorIndex] || highlightColors[0])

const emit = defineEmits(['highlight-click', 'note-click'])

function handleClick(event) {
  event.stopPropagation()
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
</script>

<style scoped>
.highlight-wrapper {
  position: relative;
  display: inline;
}

.custom-highlight {
  padding: 2px 0;
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
  width: 14px;
  height: 14px;
  margin-left: 2px;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-text-muted, #888);
  background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.06));
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  vertical-align: super;
  opacity: 0.7;
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
