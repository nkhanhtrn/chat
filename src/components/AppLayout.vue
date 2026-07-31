<template>
  <div class="app-layout">
    <Transition name="fade">
      <div v-if="sideExpanded && isMobile" class="mobile-backdrop" @click="closeSide"></div>
    </Transition>
    <nav class="nav-bar">
      <button class="nav-btn back-nav-btn" @click="goBack" title="Back">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activePage === 'home' }" @click="goTo('home')" title="Home"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></button>
      <button class="nav-btn" :class="{ active: activePage === 'notebooks' }" @click="goTo('notebooks')" title="Notebooks"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg></button>
      <button class="nav-btn" :class="{ active: activePage === 'books' }" @click="goTo('books')" title="Books"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg></button>
      <button class="nav-btn" :class="{ active: activePage === 'papers' }" @click="goTo('papers')" title="Papers"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h8v2H8v-2zm0-4h8v2H8v-2zm0 8h5v2H8v-2z"/></svg></button>
      <button class="nav-btn" :class="{ active: activePage === 'projects' }" @click="goTo('projects')" title="Projects"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
      <button class="nav-btn" :class="{ active: activePage === 'calendar' }" @click="goTo('calendar')" title="Calendar"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg></button>
      <div class="nav-spacer"></div>
      <button class="nav-btn" @click="showVocab = true" title="Vocabulary">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>
        <span v-if="vocabDueCount > 0" class="nav-badge">{{ vocabDueCount }}</span>
      </button>
      <button class="nav-btn" @click="showSettings = true" title="Settings"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg></button>
    </nav>
    <div class="main-area">
      <main class="main-panel"><slot></slot></main>
      <Transition name="slide-side">
        <aside v-if="sideExpanded" class="side-panel" :class="{ 'is-mobile': isMobile }" :style="isMobile ? {} : { width: sideWidth + 'px' }">
        <div v-if="hasSideContent" class="side-tab-bar">
          <button class="side-tab" :class="{ active: activeSideTab === 'content' }" @click="activeSideTab = 'content'">{{ sideTabLabel }}</button>
          <button class="side-tab" :class="{ active: activeSideTab === 'chat' }" @click="activeSideTab = 'chat'">Chat</button>
        </div>
          <div v-if="$slots['side-header']" class="side-header-slot">
            <slot name="side-header"></slot>
          </div>
          <div v-show="hasSideContent && activeSideTab === 'content'" class="side-tab-body">
            <slot name="side"></slot>
          </div>
          <div v-show="!hasSideContent || activeSideTab === 'chat'" class="side-tab-body">
            <SideChatPlayground />
          </div>
        </aside>
      </Transition>
      <Transition name="fade">
        <div v-if="sideExpanded" class="divider" :class="{ 'is-dragging': isDragging }" :style="{ left: sideWidth + 'px' }" @pointerdown="startDrag">
          <div class="divider-handle"></div>
        </div>
      </Transition>
    </div>
    <SettingsModal v-model="showSettings" />
    <VocabReviewModal :visible="showVocab" @close="showVocab = false" />
  </div>
</template>

<script setup lang="ts">
import { debugLog } from '@/utils/debug'
import { ref, computed, onMounted, onUnmounted, useSlots, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SettingsModal from './modal/SettingsModal.vue'
import VocabReviewModal from './modal/VocabReviewModal.vue'
import SideChatPlayground from './SideChatPlayground.vue'
import { useVocabulary } from '@/composables/useVocabulary'
import { useBooksStore } from '@/stores/books'

const props = withDefaults(defineProps<{
  storageKey?: string
  defaultSideWidth?: number
  minSideWidth?: number
  maxSideWidth?: number
  sideTabLabel?: string
}>(), { storageKey: 'app-layout-side', defaultSideWidth: 500, minSideWidth: 300, maxSideWidth: 800, sideTabLabel: 'View' })

const router = useRouter()
const route = useRoute()
const slots = useSlots()
const booksStore = useBooksStore()

const sideExpanded = ref(false)
const sideWidth = ref(props.defaultSideWidth)
const showSettings = ref(false)
const showVocab = ref(false)
const isDragging = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const isMobile = ref(false)

function checkMobile() { isMobile.value = window.innerWidth <= 768 }

const hasSideContent = computed(() => !!slots.side)
const activeSideTab = ref<'content' | 'chat'>(hasSideContent.value ? 'content' : 'chat')

const activePage = computed(() => {
  const name = route.name as string
  if (name === 'home') return 'home'
  if (name === 'notebooks') return 'notebooks'
  if (name === 'notebook' || name === 'question') return 'notebooks'
  if (name === 'calendar') return 'calendar'
  if (name === 'projects' || name === 'project-detail' || name === 'project-subproject') return 'projects'
  if (name === 'books' || name === 'book-viewer') return 'books'
  if (name === 'papers') return 'papers'
  return ''
})

const backTarget = computed<string>(() => {
  const name = route.name as string
  if (name === 'notebook' || name === 'question') return 'notebooks'
  if (name === 'book-viewer') {
    const id = route.params.bookId as string
    return booksStore.papers.some(p => p.id === id) ? 'papers' : 'books'
  }
  if (name === 'project-detail' || name === 'project-subproject') return 'projects'
  return 'home'
})

const pageKey = computed(() => {
  const name = route.name as string
  if (name === 'home') return 'home'
  if (name === 'notebooks') return 'notebooks-list'
  if (name === 'notebook' || name === 'question') return 'notebook-detail'
  if (name === 'books') return 'books-list'
  if (name === 'book-viewer') return 'book-viewer'
  if (name === 'papers') return 'papers-list'
  if (name === 'projects') return 'projects-list'
  if (name === 'project-detail' || name === 'project-subproject') return 'project-detail'
  if (name === 'calendar') return 'calendar'
  return name ?? ''
})

watch(pageKey, () => {
  sideExpanded.value = false
})

const { vocabDueCount } = useVocabulary()

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  const storedWidth = localStorage.getItem(`${props.storageKey}-width`)
  if (storedWidth !== null) sideWidth.value = parseInt(storedWidth, 10)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

function toggleSide() {
  sideExpanded.value = !sideExpanded.value
}

function closeSide() {
  sideExpanded.value = false
}

function goBack() {
  sideExpanded.value = false
  router.push({ name: backTarget.value })
}

function goTo(page: string) {
  if (page === activePage.value) { toggleSide(); return }
  if (page === 'home') router.push({ name: 'home' })
  else if (page === 'notebooks') router.push({ name: 'notebooks' })
  else if (page === 'books') router.push({ name: 'books' })
  else if (page === 'papers') router.push({ name: 'papers' })
  else if (page === 'calendar') router.push({ name: 'calendar' })
  else if (page === 'projects') router.push({ name: 'projects' })
}

function startDrag(e: PointerEvent) {
  isDragging.value = true
  startX.value = e.clientX
  startWidth.value = sideWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  function onMove(ev: PointerEvent) {
    const delta = ev.clientX - startX.value
    sideWidth.value = Math.min(props.maxSideWidth, Math.max(props.minSideWidth, startWidth.value + delta))
  }

  function onUp() {
    isDragging.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    localStorage.setItem(`${props.storageKey}-width`, sideWidth.value.toString())
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}

defineExpose({ sideExpanded, toggleSide })
</script>

<style scoped>
.app-layout { display: flex; height: 100vh; overflow: hidden; }
.nav-bar { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--color-bg-base); border-right: 1px solid var(--color-border-subtle); flex-shrink: 0; }
.nav-btn { width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 6px; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s ease; position: relative; }
.nav-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); transform: scale(1.05); }
.nav-btn:active { transform: scale(0.95); }
.nav-btn.active { background: var(--color-bg-hover); color: var(--color-primary, var(--color-text-base)); border-color: var(--color-border-accent); }
.nav-btn.active::after { content: ''; position: absolute; left: -0.5rem; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; background: var(--color-primary, var(--color-border-accent)); border-radius: 0 2px 2px 0; animation: slideIn 0.2s ease-out; }
@keyframes slideIn { from { opacity: 0; transform: translateY(-50%) translateX(-4px); } to { opacity: 1; transform: translateY(-50%) translateX(0); } }
.nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.nav-btn:disabled:hover { background: transparent; color: var(--color-text-muted); transform: none; }
.nav-btn svg { width: 20px; height: 20px; }
.nav-badge { position: absolute; top: 2px; right: 2px; background: var(--color-primary, var(--color-border-accent)); color: #fff; font-size: 0.6rem; font-weight: 700; min-width: 14px; height: 14px; border-radius: 7px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
.back-nav-btn { margin-bottom: 0.5rem; }
.nav-spacer { flex: 1; }
.main-area { flex: 1; min-width: 0; position: relative; display: flex; }
.main-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--color-bg-page); }
.side-panel { position: absolute; top: 0; left: 0; bottom: 0; z-index: 20; display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--color-bg-base); box-shadow: 2px 0 10px rgba(0, 0, 0, 0.12); }
.side-header-slot { flex-shrink: 0; }
.side-tab-bar { display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem; border-bottom: 1px solid var(--color-border-subtle); flex-shrink: 0; }
.side-tab { flex: 1; padding: 0.4rem 0.6rem; font-size: 0.75rem; font-weight: 500; background: transparent; border: none; border-radius: 4px; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
.side-tab:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.side-tab.active { background: var(--color-bg-hover); color: var(--color-primary, var(--color-text-base)); }
.side-tab-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.divider { position: absolute; top: 0; bottom: 0; width: 6px; z-index: 21; background-color: transparent; cursor: col-resize; display: flex; align-items: center; justify-content: center; transition: background-color 0.15s; touch-action: none; }
.divider:hover, .divider.is-dragging { background-color: var(--color-bg-hover); }
.divider-handle { width: 3px; height: 40px; background-color: var(--color-border-subtle); border-radius: 2px; transition: background-color 0.15s; }
.divider:hover .divider-handle, .divider.is-dragging .divider-handle { background-color: var(--color-border-strong); }
.slide-side-enter-active, .slide-side-leave-active { transition: width 0.25s ease, opacity 0.25s ease; overflow: hidden; }
.slide-side-enter-from, .slide-side-leave-to { width: 0 !important; opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.mobile-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 999; }
@media (max-width: 768px) {
  .app-layout { flex-direction: column; }
  .nav-bar { flex-direction: row; order: 2; width: 100%; border-right: none; border-top: 1px solid var(--color-border-subtle); padding: 0.75rem 0.5rem; justify-content: space-around; }
  .nav-spacer, .divider { display: none; }
  .nav-btn.active::after { left: 50%; top: auto; bottom: -0.5rem; transform: translateX(-50%); width: 20px; height: 3px; border-radius: 2px 2px 0 0; }
  .nav-btn.active svg { transform: none; }
  .nav-btn { width: 44px; height: 44px; }
  .nav-btn svg { width: 24px; height: 24px; }
  .side-panel.is-mobile { position: fixed; top: 0; left: 0; height: calc(100% - 70px); width: 90vw !important; max-width: none; z-index: 1000; background: var(--color-bg-base); box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15); }
  .slide-side-enter-active, .slide-side-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
  .slide-side-enter-from, .slide-side-leave-to { transform: translateX(-100%); opacity: 0; }
}
</style>
