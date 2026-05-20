<template>
  <div class="input-container" ref="containerRef">
    <div v-if="suggestions.length && showSuggestions" class="cmd-suggestions">
      <template v-for="(item, i) in suggestions" :key="item.key">
        <div v-if="i > 0 && item.kind !== suggestions[i - 1].kind" class="cmd-separator" />
        <div
          :class="['cmd-item', { active: i === activeIndex }]"
          @mousedown.prevent="applySuggestion(item)"
          @mouseenter="activeIndex = i"
        >
          <span :class="['cmd-name', { 'cmd-tool': item.kind === 'tool' }]">{{ item.label }}</span>
          <span class="cmd-desc">{{ item.description }}</span>
        </div>
      </template>
    </div>
    <div :class="['input-box', { expanded: isExpanded }]">
      <button class="expand-btn" @click="toggleExpand" :title="isExpanded ? 'Collapse' : 'Expand'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: isExpanded }">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <div class="input-row">
        <div class="textarea-wrap">
          <div class="input-backdrop" ref="backdropRef" v-html="highlightedHtml"></div>
          <textarea
            ref="inputRef"
            :value="modelValue"
            @input="handleInput"
            @keydown="handleKeydown"
            @click="updateCursor"
            @keyup="updateCursor"
            placeholder="Message..."
            :disabled="disabled || isStreaming"
            rows="1"
          ></textarea>
        </div>
        <div class="input-actions">
          <slot name="before-send" />
          <button
            v-if="!isStreaming"
            @click="$emit('send')"
            :disabled="!modelValue.trim()"
            class="action-btn send-btn"
            title="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
          <button
            v-else
            @click="$emit('stop')"
            class="action-btn stop-btn"
            title="Stop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { matchAll, type SuggestionItem, type ToolRef } from '@/utils/chatCommands'

const props = withDefaults(defineProps<{
  modelValue: string
  isStreaming?: boolean
  disabled?: boolean
  tools?: ToolRef[]
}>(), {
  isStreaming: false,
  disabled: false,
  tools: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const inputRef = ref<HTMLTextAreaElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const isExpanded = ref(false)
const activeIndex = ref(0)
const showSuggestions = ref(false)
const cursorPos = ref(0)
const slashRange = ref<{ start: number; prefix: string } | null>(null)
const backdropRef = ref<HTMLElement | null>(null)

const detectedToolNames = computed(() => {
  if (!props.tools.length) return []
  const lower = props.modelValue.toLowerCase()
  return props.tools
    .filter(t => lower.includes(`/${t.title.toLowerCase()}`))
    .map(t => t.title)
})

const highlightedHtml = computed(() => {
  const val = props.modelValue
  if (!detectedToolNames.value.length) return escapeHtml(val) + '\n'
  const escaped = detectedToolNames.value.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.map(e => `\\/?${e}`).join('|')})`, 'gi')
  return escapeHtml(val).replace(
    new RegExp(`(${escaped.map(e => `\\/?${e}`).join('|')})`, 'gi'),
    '<span class="hl-tool">$1</span>',
  ) + '\n'
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function updateCursor() {
  if (inputRef.value) {
    cursorPos.value = inputRef.value.selectionStart ?? 0
  }
  detectSlash()
}

function detectSlash() {
  const val = props.modelValue
  const pos = cursorPos.value
  if (pos < 1) {
    slashRange.value = null
    showSuggestions.value = false
    return
  }

  let slashIdx = -1
  for (let i = pos - 1; i >= 0; i--) {
    if (val[i] === ' ' || val[i] === '\n') break
    if (val[i] === '/') {
      slashIdx = i
      break
    }
  }

  if (slashIdx === -1) {
    slashRange.value = null
    showSuggestions.value = false
    return
  }

  const prefix = val.slice(slashIdx, pos)
  if (prefix.includes(' ') || prefix.includes('\n')) {
    slashRange.value = null
    showSuggestions.value = false
    return
  }

  slashRange.value = { start: slashIdx, prefix }
}

const suggestions = computed(() => {
  if (!slashRange.value) return []
  return matchAll(slashRange.value.prefix, props.tools)
})

watch(suggestions, (v) => {
  if (v.length !== suggestions.value.length || v.length === 0) activeIndex.value = 0
  showSuggestions.value = v.length > 0
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const handleInput = (e: Event) => {
  const val = (e.target as HTMLTextAreaElement).value
  emit('update:modelValue', val)
  cursorPos.value = (e.target as HTMLTextAreaElement).selectionStart ?? val.length
  nextTick(() => detectSlash())
  adjustHeight()
}

function applySuggestion(item: SuggestionItem) {
  if (!slashRange.value || !inputRef.value) return
  const before = props.modelValue.slice(0, slashRange.value.start)
  const after = props.modelValue.slice(cursorPos.value)
  const newVal = before + item.replaceText + after
  emit('update:modelValue', newVal)
  showSuggestions.value = false
  slashRange.value = null
  nextTick(() => {
    if (inputRef.value) {
      const newPos = before.length + item.replaceText.length
      inputRef.value.focus()
      inputRef.value.setSelectionRange(newPos, newPos)
    }
  })
}

const handleKeydown = (e: KeyboardEvent) => {
  if (showSuggestions.value && suggestions.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length
      return
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        applySuggestion(suggestions.value[activeIndex.value])
        return
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      showSuggestions.value = false
      return
    }
  }

  if (e.key !== 'Enter') return

  if (isExpanded.value) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault()
      emit('send')
    }
  } else {
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      emit('send')
    }
  }
}

const adjustHeight = () => {
  nextTick(() => {
    const wrap = inputRef.value?.parentElement
    if (!wrap || !inputRef.value) return
    inputRef.value.style.height = 'auto'
    const maxH = isExpanded.value ? 280 : 120
    const h = Math.min(inputRef.value.scrollHeight, maxH)
    wrap.style.height = h + 'px'
    inputRef.value.style.height = h + 'px'
  })
}

const resetHeight = () => {
  nextTick(() => {
    if (inputRef.value) inputRef.value.style.height = 'auto'
    const wrap = inputRef.value?.parentElement
    if (wrap) wrap.style.height = ''
  })
}

defineExpose({ inputRef, resetHeight })
</script>

<style scoped>
.input-container {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-bg-base);
  position: relative;
}

.cmd-suggestions {
  position: absolute;
  bottom: 100%;
  left: 1.25rem;
  right: 1.25rem;
  background: var(--color-bg-elevated, var(--color-bg-base));
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
  max-height: 280px;
  overflow-y: auto;
  z-index: 50;
  padding: 0.25rem 0;
}

.cmd-separator {
  height: 1px;
  background: var(--color-border-subtle);
  margin: 0.25rem 0.75rem;
}

.cmd-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 0.82rem;
}

.cmd-item:hover,
.cmd-item.active {
  background: var(--color-bg-hover);
}

.cmd-name {
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.8rem;
}

.cmd-name.cmd-tool {
  color: var(--color-success, #10b981);
}

.cmd-desc {
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-box {
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  padding: 0.4rem;
  transition: border-color 0.15s;
  position: relative;
}

.input-box:focus-within {
  border-color: var(--color-border-strong);
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  background-color: var(--color-bg-base);
}

.expand-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
}

.expand-btn svg {
  transition: transform 0.2s ease;
}

.expand-btn svg.rotated {
  transform: rotate(180deg);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
}

.textarea-wrap {
  flex: 1;
  min-height: 24px;
  max-height: 120px;
  overflow-y: auto;
  transition: min-height 0.25s ease, max-height 0.25s ease;
  position: relative;
}

.input-box.expanded .textarea-wrap {
  min-height: 120px;
  max-height: 280px;
}

.input-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0.3rem 0.5rem;
  font-size: 0.9rem;
  font-family: Georgia, serif;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--color-text-base);
  pointer-events: none;
  overflow: hidden;
}

.input-backdrop :deep(.hl-tool) {
  display: inline;
  padding: 0.1rem 0.25rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-subtle);
}

textarea {
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: none;
  font-size: 0.9rem;
  font-family: Georgia, serif;
  resize: none;
  height: 100%;
  min-height: 24px;
  overflow-y: auto;
  background-color: transparent;
  color: transparent;
  line-height: 1.5;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  caret-color: var(--color-text-base);
}

textarea:focus { outline: none; }
textarea:disabled { opacity: 0.6; cursor: not-allowed; }
textarea::placeholder { color: var(--color-text-muted); }

.input-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--color-border-subtle);
  margin: 0 0.25rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn {
  background-color: var(--color-primary);
  color: white;
}

.send-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  color: white;
}

.send-btn:disabled {
  background-color: var(--color-bg-hover);
  color: var(--color-text-muted);
  opacity: 1;
}

.stop-btn {
  background-color: var(--color-error-subtle, #fee2e2);
  color: var(--color-error, #ef4444);
}

.stop-btn:hover {
  background-color: var(--color-error, #ef4444);
  color: white;
}

@media (max-width: 768px) {
  .input-container { padding: 0.75rem 1rem; }
  .cmd-suggestions { left: 1rem; right: 1rem; }
}
</style>
