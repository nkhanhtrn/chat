<template>
  <Modal :visible="open" :title="subprojects.length > 1 ? 'Project Context' : 'Project Context'" size="small" @close="$emit('update:open', false)">
    <div v-if="subprojects.length > 1" class="scratchpad-tabs">
      <button
        v-for="sub in subprojects"
        :key="sub.id"
        :class="['scratchpad-tab', { active: activeSubId === sub.id }]"
        @click="activeSubId = sub.id"
      >
        <span class="tab-label">{{ sub.name }}</span>
        <span v-if="getScratchpad(sub.id).trim()" class="tab-dot"></span>
      </button>
    </div>
    <div class="scratchpad-body">
      <textarea
        ref="textareaRef"
        :value="currentValue"
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
import { ref, watch, nextTick, computed } from 'vue'
import Modal from '@/components/modal/Modal.vue'
import type { SubProject } from '@/types/project'

const props = withDefaults(defineProps<{
  open: boolean
  modelValue: string
  dataKey: string
  subprojects?: SubProject[]
  getScratchpadFn?: (dataKey: string) => string
  updateScratchpadFn?: (dataKey: string, content: string) => void
}>(), {
  subprojects: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const activeSubId = ref<string | null>(null)

watch(() => props.open, (val) => {
  if (val) {
    activeSubId.value = props.subprojects.length > 0 ? props.subprojects[0].id : null
    nextTick(() => textareaRef.value?.focus())
  }
})

watch(() => props.dataKey, () => { emit('update:open', false) })

function getSubDataKey(subId: string): string {
  if (!props.dataKey) return ''
  if (props.subprojects.length > 0) {
    const baseProjectId = props.dataKey.replace(/-$/, '')
    return `${baseProjectId}-${subId}`
  }
  return props.dataKey
}

function getScratchpad(subId: string): string {
  const key = getSubDataKey(subId)
  if (!key) return ''
  if (props.getScratchpadFn) return props.getScratchpadFn(key)
  return ''
}

const currentValue = computed(() => {
  if (!activeSubId.value) return props.modelValue
  return getScratchpad(activeSubId.value)
})

let saveTimer: ReturnType<typeof setTimeout> | null = null

function handleInput(event: Event) {
  const val = (event.target as HTMLTextAreaElement).value
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (activeSubId.value && props.subprojects.length > 0) {
      const key = getSubDataKey(activeSubId.value)
      if (props.updateScratchpadFn) props.updateScratchpadFn(key, val)
    } else {
      emit('update:modelValue', val)
    }
  }, 200)
}
</script>

<style scoped>
.scratchpad-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-border-subtle);
  padding: 0 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.scratchpad-tabs::-webkit-scrollbar { display: none; }
.scratchpad-tab {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.6rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
  transition: all 0.15s;
}
.scratchpad-tab:hover { color: var(--color-text-base); }
.scratchpad-tab.active {
  color: var(--color-text-base);
  border-bottom-color: var(--color-primary);
}
.tab-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-primary);
  flex-shrink: 0;
}
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
