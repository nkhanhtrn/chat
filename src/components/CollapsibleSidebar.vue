<template>
  <div class="collapsible-sidebar-wrapper">
    <!-- Collapsed navigation bar -->
    <div v-if="!isVisible" class="collapsed-nav">
      <button class="nav-btn expand-btn" @click="toggle" title="Expand">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activePage === 'home' }" @click="goTo('home')" title="Home">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activePage === 'notebook' }" :disabled="!hasCurrentQuestion" @click="goTo('notebook')" title="Current Notebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activePage === 'calendar' }" @click="goTo('calendar')" title="Calendar">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activePage === 'studio' }" @click="goTo('studio')" title="Studio">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>
      </button>
      <div class="nav-spacer"></div>
      <button class="nav-btn" @click="showSettings = true" title="Settings">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>
      </button>
    </div>

    <!-- Content panel -->
    <div v-else class="sidebar-content" :class="{ 'full-width': fullWidth }" :style="fullWidth ? {} : { width: width + 'px' }">
      <slot></slot>
    </div>

    <SettingsModal v-model="showSettings" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import SettingsModal from './Modal/SettingsModal.vue'

const props = defineProps({
  storageKey: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: 500
  },
  defaultVisible: {
    type: Boolean,
    default: false
  },
  fullWidth: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()

const isVisible = ref(props.defaultVisible)
const showSettings = ref(false)

const activePage = computed(() => {
  const name = route.name
  if (name === 'home') return 'home'
  if (name === 'notebook' || name === 'question') return 'notebook'
  if (name === 'calendar') return 'calendar'
  if (name === 'studio') return 'studio'
  return ''
})

const hasCurrentQuestion = computed(() => Boolean(chatStore.currentChatId))

onMounted(() => {
  const stored = localStorage.getItem(props.storageKey)
  if (stored !== null) {
    isVisible.value = stored === 'true'
  }
})

function toggle() {
  isVisible.value = !isVisible.value
  localStorage.setItem(props.storageKey, isVisible.value.toString())
}

function goTo(page) {
  if (page === 'home') {
    router.push({ name: 'home' })
  } else if (page === 'notebook' && chatStore.currentChatId) {
    if (chatStore.currentMessageId) {
      router.push({ name: 'question', params: { id: chatStore.currentChatId, questionId: chatStore.currentMessageId } })
    } else {
      router.push({ name: 'notebook', params: { id: chatStore.currentChatId } })
    }
  } else if (page === 'calendar') {
    router.push({ name: 'calendar' })
  } else if (page === 'studio') {
    router.push({ name: 'studio' })
  }
}

defineExpose({ isVisible, toggle })
</script>

<style scoped>
.collapsible-sidebar-wrapper {
  display: flex;
  height: 100%;
}

.collapsed-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-bg-base);
  border-right: 1px solid var(--color-border-subtle);
}

.nav-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.nav-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.nav-btn.active {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-btn:disabled:hover {
  background: transparent;
  color: var(--color-text-muted);
}

.nav-btn svg {
  width: 20px;
  height: 20px;
}

.expand-btn {
  margin-bottom: 0.5rem;
}

.nav-spacer {
  flex: 1;
}

.sidebar-content {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 300px;
  max-width: 800px;
  height: 100%;
  background: var(--color-bg-base);
  border-right: 1px solid var(--color-border-subtle);
  overflow: hidden;
}

.sidebar-content.full-width {
  flex: 1;
  min-width: 0;
  max-width: none;
  border-right: none;
}
</style>
