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
.prompt-input-wrapper { display: flex; align-items: center; gap: 0.35rem; }
.prompt-input {
  flex: 1; padding: 0.35rem 0.5rem; border: 1px solid var(--color-border-context, #ddd);
  border-radius: 4px; background: var(--color-bg-base); color: var(--color-text-base);
  font-size: 0.9rem; outline: none;
}
.prompt-input:focus { border-color: var(--color-primary); }
.prompt-input:disabled { opacity: 0.5; cursor: not-allowed; }
.prompt-send-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; padding: 0; border: none; border-radius: 4px;
  background: var(--color-primary); color: white; cursor: pointer;
  transition: background-color 0.15s; flex-shrink: 0;
}
.prompt-send-btn:hover:not(:disabled) { background: var(--color-primary-hover); }
.prompt-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
