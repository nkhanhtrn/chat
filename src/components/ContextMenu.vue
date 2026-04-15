<template>
  <teleport to="body">
    <template v-if="visible">
      <div class="context-menu-backdrop" @click="onClickOutside" @touchend.prevent="onClickOutside"></div>
      <div class="context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @mousedown.stop @touchstart.stop>
        <template v-if="!readOnly">
          <div class="context-menu-row">
            <button class="context-menu-btn" @click="onCopy">Copy</button>
            <button v-if="hasExistingItem" class="context-menu-btn" @click="onRemove">Remove</button>
            <button v-else class="context-menu-btn" @click="onHighlight">Highlight</button>
          </div>
          <div class="context-menu-row highlight-row">
            <div class="color-picker">
              <button
                v-for="(_, index) in selectionColors"
                :key="index"
                class="color-circle"
                :class="{ selected: selectedColorIndex === index }"
                :style="{ backgroundColor: selectionColors[index] }"
                @click="selectColor(index)"
              ></button>
            </div>
          </div>
          <div class="context-menu-row">
            <button class="context-menu-btn" @click="onDictionary" :disabled="isStreaming">Dictionary</button>
            <button class="context-menu-btn" @click="onNote">{{ hasExistingItem ? (hasNote ? 'Edit Note' : 'Add Note') : 'Add Note' }}</button>
            <button class="context-menu-btn" @click="onLinkToQuestion">Link to Question</button>
          </div>
          <div class="context-menu-row">
            <button class="context-menu-btn" @click="onAskQuestion" :disabled="isStreaming">Deep Dive</button>
          </div>
          <div class="context-menu-row prompt-row">
            <PromptInput
              placeholder="Ask about selection..."
              :disabled="isStreaming"
              @submit="onSendCustomPrompt"
              @ctrl-enter-submit="onCtrlEnterCustomPrompt"
            />
          </div>
        </template>
        <template v-else>
          <div class="context-menu-row">
            <button class="context-menu-btn" @click="onDictionary" :disabled="isStreaming">Dictionary</button>
          </div>
        </template>
      </div>
    </template>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import PromptInput from './PromptInput.vue'

const selectionColors = [
  'var(--color-highlight-0)',
  'var(--color-highlight-1)',
  'var(--color-highlight-2)',
  'var(--color-highlight-3)',
  'var(--color-highlight-4)',
]

const props = withDefaults(defineProps<{
  visible?: boolean
  x?: number
  y?: number
  highlightedText?: string
  isStreaming?: boolean
  readOnly?: boolean
  colorIndex?: number
  highlightId?: string | null
  hasNote?: boolean
}>(), { visible: false, x: 0, y: 0, highlightedText: '', isStreaming: false, readOnly: false, colorIndex: 0, highlightId: null, hasNote: false })

const emit = defineEmits<{
  close: []
  'set-selection-color': [colorIndex: number]
  'ask-question': [text: string]
  'link-to-question': []
  dictionary: []
  'custom-prompt': [text: string]
  'custom-prompt-deep-dive': [text: string]
  remove: []
  note: []
  highlight: []
}>()

const hasExistingItem = computed(() => !!props.highlightId)
const selectedColorIndex = ref(0)

watch([() => props.colorIndex, () => props.visible], ([newIndex]) => {
  selectedColorIndex.value = newIndex ?? 0
}, { immediate: true })

function selectColor(index: number) {
  selectedColorIndex.value = index
  emit('set-selection-color', index)
}

function onAskQuestion() { emit('ask-question', props.highlightedText ?? '') }
function onLinkToQuestion() { emit('link-to-question') }
function onDictionary() { emit('dictionary') }
function onClickOutside() { emit('close') }
function onSendCustomPrompt(text: string) { emit('custom-prompt', text) }
function onCtrlEnterCustomPrompt(text: string) { emit('custom-prompt-deep-dive', text) }
function onRemove() { emit('remove') }
function onNote() { emit('note') }
function onHighlight() { emit('highlight') }

async function onCopy() {
  if (props.highlightedText) { try { await navigator.clipboard.writeText(props.highlightedText); emit('close') } catch (err) { console.error('Failed to copy:', err) } }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) emit('close')
  if ((event.ctrlKey || event.metaKey) && event.key === 'c' && props.visible) { event.preventDefault(); onCopy() }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.context-menu {
  position: absolute;
  width: 250px;
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
.context-menu-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: transparent; z-index: 9998; }
.context-menu-btn { width: 100%; text-align: left; font-size: 1.05rem; padding: 0.25rem 0.5rem; background: none; border: none; color: inherit; cursor: pointer; border-radius: 3px; }
.context-menu-btn:hover { background: var(--color-bg-hover); }
.context-menu-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.context-menu-row { padding: 0.5rem; border-bottom: 1px solid var(--color-border-context); }
.context-menu-row:last-child { border-bottom: none; }
.context-menu-separator { border-bottom: 1px solid var(--color-border-context); margin: 0.15rem 0; }
.highlight-row { display: flex; align-items: center; justify-content: flex-start; padding-left: 0.85rem; }
.action-buttons { display: flex; flex-wrap: wrap; gap: 0; flex: 1; }
.color-picker { display: flex; gap: 0.35rem; }
.color-circle {
  width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: all 0.15s ease; padding: 0; outline: none;
}
.color-circle:hover { transform: scale(1.15); }
.color-circle.selected { border-color: var(--color-text-strong); box-shadow: 0 0 0 1px var(--color-bg-context-menu); }
.prompt-row { padding: 0.35rem 0.5rem; }
</style>
