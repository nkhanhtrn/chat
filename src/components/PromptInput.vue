<template>
  <div class="prompt-input-wrapper">
    <input
      ref="inputRef"
      v-model="inputText"
      :placeholder="placeholder"
      :disabled="disabled"
      class="prompt-input"
      @keydown.enter.ctrl="onCtrlEnter"
      @keydown.enter.exact="onEnter"
    />
    <button class="prompt-send-btn" :disabled="disabled || !inputText.trim()" @click="onEnter">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  placeholder?: string
  disabled?: boolean
  modelValue?: string
}>(), {
  placeholder: '',
  disabled: false,
  modelValue: '',
})

const emit = defineEmits<{
  submit: [value: string]
  'ctrl-enter-submit': [value: string]
  'update:modelValue': [value: string]
}>()

const inputText = ref(props.modelValue)
const inputRef = ref<HTMLInputElement | null>(null)

function onEnter() {
  if (props.disabled) return
  const text = inputText.value.trim()
  if (text) {
    emit('submit', text)
    inputText.value = ''
    emit('update:modelValue', '')
  }
}

function onCtrlEnter() {
  if (props.disabled) return
  const text = inputText.value.trim()
  if (text) {
    emit('ctrl-enter-submit', text)
    inputText.value = ''
    emit('update:modelValue', '')
  }
}

defineExpose({ inputRef })
</script>

<style scoped>
.prompt-input-wrapper {
  position: relative;
  border: 1px solid var(--color-border-context, #ddd);
  border-radius: 4px; background: var(--color-bg-base);
  font-family: system-ui, -apple-system, sans-serif;
}
.prompt-input-wrapper:focus-within { border-color: var(--color-primary); }
.prompt-input {
  width: 100%; padding: 0.3rem 28px 0.3rem 0.4rem; border: none; background: transparent;
  color: var(--color-text-base); font-size: 0.85rem; font-family: inherit; outline: none;
  box-sizing: border-box;
}
.prompt-input:disabled { opacity: 0.5; cursor: not-allowed; }
.prompt-send-btn {
  position: absolute; right: 2px; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0; border: none;
  background: transparent; color: var(--color-text-muted); cursor: pointer;
  transition: color 0.15s;
}
.prompt-send-btn:hover:not(:disabled) { color: var(--color-primary); }
.prompt-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
