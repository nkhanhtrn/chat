<template>
  <span
    v-if="!isEditing"
    :class="['inline-edit-text', textClass]"
    v-bind="attrs"
    @dblclick.stop="startEditing"
  >
    <slot>{{ modelValue }}</slot>
  </span>
  <div v-else ref="wrapperRef" class="inline-edit-wrapper">
    <input
      ref="inputRef"
      v-model="editText"
      @keydown.enter="finishEditing"
      @keydown.esc="cancelEditing"
      @blur="onBlur"
      @click.stop
      :class="['inline-edit-input', inputClass]"
      type="text"
    />
    <div class="inline-edit-buttons">
      <button
        class="inline-edit-btn save-btn"
        @click.stop="finishEditing"
        :disabled="!editText.trim()"
        title="Save"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
      <button
        class="inline-edit-btn cancel-btn"
        @click.stop="cancelEditing"
        title="Cancel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false
})

const attrs = useAttrs()

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  textClass: {
    type: String,
    default: ''
  },
  inputClass: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'save', 'editing-start', 'editing-end'])

const isEditing = ref(false)
const editText = ref('')
const inputRef = ref(null)
const wrapperRef = ref(null)

const startEditing = () => {
  isEditing.value = true
  editText.value = props.modelValue
  emit('editing-start')
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
      inputRef.value.select()
    }
  })
}

const finishEditing = () => {
  if (editText.value.trim() && editText.value.trim() !== props.modelValue) {
    emit('update:modelValue', editText.value.trim())
    emit('save', editText.value.trim())
  }
  isEditing.value = false
  editText.value = ''
  emit('editing-end')
}

const cancelEditing = () => {
  isEditing.value = false
  editText.value = ''
  emit('editing-end')
}

const onBlur = (event) => {
  // Check if focus is moving to an element within our wrapper (save/cancel buttons)
  if (wrapperRef.value?.contains(event.relatedTarget)) {
    return
  }
  cancelEditing()
}

defineExpose({ startEditing })
</script>

<style scoped>
.inline-edit-text {
  cursor: pointer;
}

.inline-edit-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.inline-edit-input {
  font-family: 'Georgia', serif;
  background-color: var(--color-bg-base);
  color: var(--color-text-base);
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
  flex: 1;
  min-width: 0;
  padding-right: 52px;
}

.inline-edit-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.inline-edit-buttons {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
}

.inline-edit-btn {
  background: none;
  border: none;
  padding: 3px;
  cursor: pointer;
  color: var(--color-text-muted);
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: opacity 0.15s ease;
}

.inline-edit-btn:hover:not(:disabled) {
  opacity: 1;
}

.inline-edit-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
