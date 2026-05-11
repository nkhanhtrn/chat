<template>
  <Modal :visible="visible" size="large" @close="$emit('close')">
    <template #header>
      <div class="vocab-tabs">
        <button :class="['tab-button', { active: activeTab === 'cards' }]" @click="activeTab = 'cards'">Cards</button>
        <button :class="['tab-button', { active: activeTab === 'scratchpad' }]" @click="activeTab = 'scratchpad'">Scratchpad</button>
      </div>
    </template>
    <Transition name="tab-fade" mode="out-in">
      <div v-if="activeTab === 'cards'" key="cards" class="tab-body">
        <div v-if="cards.length === 0" class="vocab-empty">
          <p>No vocabulary cards yet.</p>
          <p class="vocab-empty-hint">Select text in a notebook or book and use Dictionary to save words.</p>
        </div>
        <div v-else class="vocab-cards-view">
          <DictionaryModal
            :visible="true"
            :word="currentCard?.word || ''"
            :definition="currentCard?.definition || ''"
            :context="currentCard?.context || ''"
            :embedded="true"
          />
        </div>
      </div>
      <div v-else-if="activeTab === 'scratchpad'" key="scratchpad" class="tab-body">
        <textarea
          ref="textareaRef"
          v-model="localScratchpad"
          @input="handleScratchpadInput"
          placeholder="Write your vocabulary notes here..."
          class="scratchpad-textarea"
        ></textarea>
      </div>
    </Transition>
    <template #footer>
      <div v-if="activeTab === 'cards' && cards.length > 0" class="vocab-card-actions">
        <div class="vocab-card-meta">
          <span class="vocab-card-counter">{{ index + 1 }} / {{ cards.length }}</span>
          <span v-if="currentCard" class="vocab-card-date">{{ formatDate(currentCard.createdAt) }}</span>
          <button v-if="currentCard" class="vocab-card-delete" @click="handleRemove(currentCard.id)" title="Remove">&times;</button>
        </div>
        <div class="vocab-nav">
          <button class="vocab-nav-btn" :disabled="index === 0" @click="index--">&larr; Previous</button>
          <button class="vocab-nav-btn" :disabled="index >= cards.length - 1" @click="index++">Next &rarr;</button>
        </div>
      </div>
      <div v-else-if="activeTab === 'scratchpad'" class="scratchpad-footer">
        <span class="scratchpad-hint">Notes are synced with your vocabulary data</span>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import Modal from './Modal.vue'
import DictionaryModal from './DictionaryModal.vue'
import { useVocabulary } from '@/composables/useVocabulary'

defineProps<{ visible?: boolean }>()
defineEmits<{ close: [] }>()

const { allVocabCards, removeCard, scratchpad, updateScratchpad } = useVocabulary()

const activeTab = ref('cards')
const cards = computed(() => allVocabCards.value)
const index = ref(0)
const currentCard = computed(() => cards.value[index.value] ?? cards.value[0])

const localScratchpad = ref(scratchpad.value)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(() => scratchpad.value, (val) => { localScratchpad.value = val })

watch(cards, (c) => {
  if (index.value >= c.length) index.value = Math.max(0, c.length - 1)
})

watch(activeTab, (tab) => {
  if (tab === 'scratchpad') {
    nextTick(() => textareaRef.value?.focus())
  }
})

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleRemove(id: string) {
  removeCard(id)
}

function handleScratchpadInput() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => updateScratchpad(localScratchpad.value), 300)
}
</script>

<style scoped>
.vocab-tabs { display: flex; gap: 0; }
.tab-button { padding: 0.4rem 1rem; background: transparent; border: none; cursor: pointer; font-size: 0.95rem; font-family: system-ui, -apple-system, sans-serif; color: var(--color-text-muted); transition: all 0.15s ease; }
.tab-button:hover { color: var(--color-text-base); }
.tab-button.active { color: var(--color-text-strong); font-weight: 600; }

.tab-body { min-height: 300px; }

.tab-fade-enter-active, .tab-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tab-fade-enter-from { opacity: 0; transform: translateX(10px); }
.tab-fade-leave-to { opacity: 0; transform: translateX(-10px); }

.vocab-empty { text-align: center; padding: 3rem 1rem; color: var(--color-text-muted); }
.vocab-empty-hint { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }

.vocab-cards-view { padding: 0; }

.vocab-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.vocab-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vocab-card-counter {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.vocab-card-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.vocab-card-delete {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0.25rem;
  border-radius: 3px;
  transition: all 0.15s;
}
.vocab-card-delete:hover {
  color: var(--color-error-text, #c00);
  background: var(--color-error-bg, rgba(255,0,0,0.05));
}

.vocab-nav {
  display: flex;
  gap: 0.5rem;
}

.vocab-nav-btn {
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.vocab-nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.vocab-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.scratchpad-textarea {
  width: 100%;
  min-height: 300px;
  padding: 0.75rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  resize: vertical;
  font-family: Georgia, serif;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--color-text-message, #333);
  background-color: var(--color-bg-page);
  box-sizing: border-box;
}
.scratchpad-textarea:focus { outline: none; border-color: var(--color-border-strong); }

.scratchpad-footer { width: 100%; display: flex; align-items: center; }
.scratchpad-hint { font-size: 0.75rem; color: var(--color-text-muted); }
</style>
