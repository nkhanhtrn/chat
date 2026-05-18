<template>
  <div class="input-container">
    <div :class="['input-box', { expanded: isExpanded }]">
      <button class="expand-btn" @click="toggleExpand" :title="isExpanded ? 'Collapse' : 'Expand'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ rotated: isExpanded }">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <div class="input-row">
        <div class="textarea-wrap">
          <textarea
            ref="inputRef"
            :value="modelValue"
            @input="handleInput"
            @keydown="handleKeydown"
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
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  isStreaming?: boolean
  disabled?: boolean
}>(), {
  isStreaming: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const inputRef = ref<HTMLTextAreaElement | null>(null)
const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const handleInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  adjustHeight()
}

const handleKeydown = (e: KeyboardEvent) => {
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
}

.input-box.expanded .textarea-wrap {
  min-height: 120px;
  max-height: 280px;
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
  color: var(--color-text-base);
  line-height: 1.5;
  box-sizing: border-box;
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
}
</style>
