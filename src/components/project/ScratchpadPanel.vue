<template>
  <Modal :visible="open" title="Project Context" size="small" @close="$emit('update:open', false)">
    <div class="scratchpad-body">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        @input="handleInput"
        placeholder="Notes, instructions, context for the AI...&#10;Persists across chat clears."
        class="scratchpad-textarea"
      ></textarea>
    </div>
    <template #footer>
      <span class="scratchpad-hint">Included in AI context on first message after clear</span>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import Modal from '@/components/modal/Modal.vue'

const props = defineProps<{
  open: boolean
  modelValue: string
  dataKey: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.open, (val) => { if (val) nextTick(() => textareaRef.value?.focus()) })
watch(() => props.dataKey, () => { emit('update:open', false) })

function handleInput(event: Event) {
  const val = (event.target as HTMLTextAreaElement).value
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => emit('update:modelValue', val), 200)
}
</script>

<style scoped>
.scratchpad-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0;
}

.scratchpad-textarea {
  flex: 1;
  min-height: 200px;
  padding: 0;
  border: none;
  font-size: 0.9rem;
  font-family: Georgia, serif;
  line-height: 1.6;
  color: var(--color-text-base);
  background: transparent;
  resize: none;
}

.scratchpad-textarea:focus { outline: none; }
.scratchpad-textarea::placeholder { color: var(--color-text-muted); font-style: italic; }

.scratchpad-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
}
</style>
