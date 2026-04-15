<template>
  <div ref="containerRef" class="chat-input-container">
    <div class="input-wrapper">
      <textarea ref="inputRef" v-model="inputText" @keydown.enter.exact.prevent="handleSend" @input="adjustHeight" placeholder="Ask anything you want to learn..." :disabled="disabled" rows="1"></textarea>
      <button @click="handleSend" :disabled="!inputText.trim() || disabled" class="send-button">Send</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  isLoading?: boolean
  autofocus?: boolean
}>(), { disabled: false, isLoading: false, autofocus: false })

const emit = defineEmits<{ send: [text: string, context: Array<Record<string, unknown>>] }>()

const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const focus = () => { nextTick(() => inputRef.value?.focus()) }
const adjustHeight = () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 200) + 'px'
    }
  })
}

const handleSend = () => {
  if (inputText.value.trim() && !props.disabled) {
    emit('send', inputText.value, [])
    inputText.value = ''
    nextTick(() => { if (inputRef.value) inputRef.value.style.height = 'auto' })
  }
}

watch(() => props.autofocus, (val) => { if (val) focus() })
onMounted(() => { if (props.autofocus) focus() })
defineExpose({ focus })
</script>

<style scoped>
.chat-input-container { padding: 0.5rem 1rem; border-top: 1px solid var(--color-border-subtle); background: var(--color-bg-base); }
.input-wrapper { display: flex; gap: 0.5rem; max-width: 800px; margin: 0 auto; }
textarea { flex: 1; padding: 0.75rem; border: 1px solid var(--color-border-base); border-radius: 8px; background: var(--color-bg-page); color: var(--color-text-base); font-family: Georgia, serif; font-size: 1rem; resize: none; outline: none; }
textarea:focus { border-color: var(--color-primary); }
.send-button { padding: 0.75rem 1.25rem; background: var(--color-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.send-button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
