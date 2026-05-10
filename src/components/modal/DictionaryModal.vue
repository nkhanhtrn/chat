<template>
  <Modal :visible="visible" size="medium" :title-style="{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }" @close="$emit('close')">
    <template #header>
      <div class="dict-header-info">
        <span class="dict-title-word">{{ word }}</span>
        <span v-if="effectivePronunciation || word" class="dict-title-pron-row">
          <span v-if="effectivePronunciation" class="dict-title-pron">{{ effectivePronunciation }}</span>
          <button v-if="word" class="dict-speak-btn" @click="speak" title="Pronounce">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          </button>
        </span>
      </div>
    </template>
    <div v-if="word" class="dict-content">
      <div v-if="context" class="dict-context">"{{ context }}"</div>
      <div v-if="entries.length" class="dict-entries">
        <div v-for="(entry, i) in entries" :key="i" class="dict-entry">
          <div class="dict-pos">{{ entry.pos }}</div>
          <div class="dict-def">{{ entry.def }}</div>
          <div v-for="(ex, j) in entry.examples" :key="j" class="dict-example">"{{ ex }}"</div>
        </div>
      </div>
      <div v-else-if="loading" class="dict-loading">
        <span class="dict-cursor">▊</span>
      </div>
      <p v-else class="dict-empty">No definition found.</p>
    </div>
    <template #footer>
      <slot name="footer"></slot>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Modal from './Modal.vue'
import { dictionaryLookup } from '@/services/offlineDictionary'

const props = withDefaults(defineProps<{
  visible?: boolean
  word?: string
  definition?: string
  pronunciation?: string
  context?: string
}>(), { visible: false, word: '', definition: '', pronunciation: '', context: '' })

const emit = defineEmits<{ close: []; lookup: [result: { definition: string; pronunciation: string }] }>()

const localDefinition = ref('')
const localPronunciation = ref('')
const loading = ref(false)

const effectiveDefinition = computed(() => props.definition || localDefinition.value)
const effectivePronunciation = computed(() => props.pronunciation || localPronunciation.value)

const entries = computed(() => {
  if (!effectiveDefinition.value) return []
  const parts = effectiveDefinition.value.split(/\n\n+/)
  const result: { pos: string; def: string; examples: string[] }[] = []
  for (const part of parts) {
    const m = part.match(/^\*\*(.+?)\*\*\s*/)
    if (!m) {
      if (part.trim()) result.push({ pos: '', def: part.trim(), examples: [] })
      continue
    }
    const raw = part.slice(m[0].length)
    const examples: string[] = []
    const def = raw.replace(/^> "(.+)"$/gm, (_, ex) => { examples.push(ex); return '' }).trim()
    result.push({ pos: m[1], def, examples })
  }
  return result
})

watch(() => props.visible, async (v) => {
  if (v && props.word && !props.definition) {
    loading.value = true
    localDefinition.value = ''
    localPronunciation.value = ''
    try {
      const result = await dictionaryLookup(props.word)
      if (result) {
        localDefinition.value = result.definition
        localPronunciation.value = result.pronunciation
        emit('lookup', { definition: result.definition, pronunciation: result.pronunciation })
      }
    } catch {}
    loading.value = false
  }
}, { immediate: true })

function speak() {
  if (!props.word || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(props.word)
  u.lang = 'en-US'
  window.speechSynthesis.speak(u)
}
</script>

<style scoped>
.dict-header-info { text-align: left; }
.dict-title-word {
  font-size: 1.05rem; font-weight: 600; color: var(--color-text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;
  text-align: left;
}
.dict-title-pron-row {
  display: flex; align-items: center; gap: 0.35rem; justify-content: flex-start;
  margin-top: 0.1rem;
}
.dict-title-pron {
  font-size: 0.85rem; font-weight: 400; font-style: italic;
  color: var(--color-text-muted);
}
.dict-speak-btn {
  background: none; border: none; padding: 0; cursor: pointer;
  color: var(--color-text-muted); display: flex; align-items: center;
  transition: color 0.15s;
}
.dict-speak-btn:hover { color: var(--color-text-strong); }

.dict-context {
  font-size: 0.85rem; font-style: italic; color: var(--color-text-muted);
  padding: 0.4rem 0.6rem; margin-bottom: 0.75rem;
  background: var(--color-bg-primary-subtle, rgba(0,0,0,0.02)); border-radius: 4px;
  line-height: 1.4;
}
.dict-entries { display: flex; flex-direction: column; gap: 0.75rem; }
.dict-pos { font-size: 0.8rem; font-style: italic; color: var(--color-text-muted); margin-bottom: 0.15rem; }
.dict-def { font-size: 0.95rem; line-height: 1.6; }
.dict-example {
  font-size: 0.85rem; font-style: italic; color: var(--color-text-muted);
  margin-top: 0.25rem; padding-left: 0.5rem; border-left: 2px solid var(--color-border-subtle);
}
.dict-loading { margin-top: 0.25rem; }
.dict-cursor { animation: blink 1s infinite; color: var(--color-text-muted); }
.dict-empty { color: var(--color-text-muted); font-style: italic; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
</style>
