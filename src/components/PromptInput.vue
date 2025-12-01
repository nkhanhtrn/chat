<template>
  <div :class="['prompt-input-wrapper', wrapperClass]">
    <input
      ref="inputRef"
      v-model="inputValue"
      :class="['prompt-input', inputClass]"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      @keydown.enter.exact="onSubmit"
      @keydown.enter.ctrl.exact="handleCtrlEnter"
      @keydown.enter.meta.exact="handleCtrlEnter"
      @keydown.esc="onCancel"
      @click.stop
    />
    <button
      class="prompt-send-btn"
      @click="onSubmit"
      :disabled="disabled || !inputValue.trim()"
    >
      <slot name="icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </slot>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  wrapperClass: {
    type: String,
    default: ''
  },
  inputClass: {
    type: String,
    default: ''
  },
  clearOnSubmit: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['submit', 'cancel', 'ctrl-enter-submit'])

const inputValue = ref('')
const inputRef = ref(null)

const onSubmit = () => {
  if (!inputValue.value.trim()) return
  emit('submit', inputValue.value.trim())
  if (props.clearOnSubmit) {
    inputValue.value = ''
  }
}

const handleCtrlEnter = () => {
  if (!inputValue.value.trim()) return
  emit('ctrl-enter-submit', inputValue.value.trim())
  if (props.clearOnSubmit) {
    inputValue.value = ''
  }
}

const onCancel = () => {
  emit('cancel')
}

const focus = () => {
  inputRef.value?.focus()
}

const clear = () => {
  inputValue.value = ''
}

defineExpose({ focus, clear })
</script>

<style scoped>
.prompt-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.prompt-input {
  width: 100%;
  padding: 0.4rem 2rem 0.4rem 0.6rem;
  font-size: 0.9rem;
  border: 1px solid var(--color-border-context);
  border-radius: 4px;
  background: var(--color-bg-input, var(--color-bg-context-menu));
  color: var(--color-text-on-accent);
  outline: none;
  box-sizing: border-box;
}

.prompt-input:focus {
  border-color: var(--color-accent, #007bff);
}

.prompt-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prompt-send-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-on-accent);
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: opacity 0.15s ease;
}

.prompt-send-btn:hover:not(:disabled) {
  opacity: 1;
}

.prompt-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
