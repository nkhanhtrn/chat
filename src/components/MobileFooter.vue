<template>
  <div class="mobile-footer" :class="{ 'mobile-only': mobileOnly }">
    <button
      v-if="showNewNotebook"
      class="footer-btn"
      @click="$emit('new-notebook')"
      title="New Notebook"
    >
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    </button>
    <button
      v-if="showHome"
      class="footer-btn"
      :class="{ active: activePage === 'home' }"
      @click="goHome"
      title="Home"
    >
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    </button>
    <button
      class="footer-btn"
      :class="{ active: activePage === 'question' }"
      :disabled="!hasCurrentQuestion"
      @click="goCurrentQuestion"
      title="Current Question"
    >
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>
    </button>
    <button
      class="footer-btn"
      :class="{ active: activePage === 'calendar' }"
      @click="goCalendar"
      title="Calendar"
    >
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
    </button>
    <button class="footer-btn" @click="showReviewModal = true" title="Review cards">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      <span v-if="dueCount > 0" class="review-badge">{{ dueCount }}</span>
    </button>
    <button class="footer-btn" @click="showVocabReviewModal = true" title="Review vocabulary">
      <span class="footer-letter dict-letter">Dd</span>
      <span v-if="vocabDueCount > 0" class="review-badge">{{ vocabDueCount }}</span>
    </button>
    <button class="footer-btn" @click="showSettingsModal = true" title="Settings">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>
    </button>

    <SettingsModal
      :visible="showSettingsModal"
      @close="showSettingsModal = false"
    />
    <ReviewModal
      :visible="showReviewModal"
      @close="showReviewModal = false"
    />
    <VocabReviewModal
      :visible="showVocabReviewModal"
      @close="showVocabReviewModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import SettingsModal from './Modal/SettingsModal.vue'
import ReviewModal from './Modal/ReviewModal.vue'
import VocabReviewModal from './Modal/VocabReviewModal.vue'

defineProps({
  activePage: {
    type: String,
    default: ''
  },
  showNewNotebook: {
    type: Boolean,
    default: false
  },
  showHome: {
    type: Boolean,
    default: false
  },
  mobileOnly: {
    type: Boolean,
    default: false
  }
})

defineEmits(['new-notebook'])

const router = useRouter()
const chatStore = useChatStore()

const showSettingsModal = ref(false)
const showReviewModal = ref(false)
const showVocabReviewModal = ref(false)

const dueCount = computed(() => chatStore.cardsDueCount)
const vocabDueCount = computed(() => chatStore.vocabCardsDueCount)
const hasCurrentQuestion = computed(() => Boolean(chatStore.currentChatId))

function goHome() {
  router.push({ name: 'home' })
}

function goCalendar() {
  router.push({ name: 'calendar' })
}

function goCurrentQuestion() {
  if (chatStore.currentChatId) {
    if (chatStore.currentMessageId) {
      router.push({
        name: 'question',
        params: {
          id: chatStore.currentChatId,
          questionId: chatStore.currentMessageId
        }
      })
    } else {
      router.push({
        name: 'notebook',
        params: {
          id: chatStore.currentChatId
        }
      })
    }
  }
}
</script>

<style scoped>
.mobile-footer {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mobile-footer.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-footer,
  .mobile-footer.mobile-only {
    display: flex;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.75rem 1rem;
    background: var(--color-bg-base);
    border-top: 1px solid var(--color-border-base);
    justify-content: center;
    gap: 0.75rem;
  }
}

.footer-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.footer-btn:hover,
.footer-btn.active {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.footer-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.footer-btn:disabled:hover {
  background: var(--color-bg-page);
  color: var(--color-text-muted);
  border-color: var(--color-border-base);
}

.footer-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.footer-letter {
  font-size: 1.125rem;
  font-weight: 600;
}

.dict-letter {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-style: italic;
  font-size: 1rem;
  letter-spacing: -0.5px;
}

.review-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  background: var(--color-accent);
  color: white;
  border-radius: 9px;
}
</style>
