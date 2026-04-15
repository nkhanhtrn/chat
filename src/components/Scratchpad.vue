<template>
  <div class="scratchpad-container">
    <Transition name="streaming-fade">
      <button v-if="isStreaming" class="streaming-toggle" @click="$emit('stop-streaming')" title="Stop generating">
        <svg class="streaming-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none"></rect></svg>
      </button>
    </Transition>
    <Transition name="scratchpad-slide">
      <div v-if="isOpen" class="scratchpad-panel" :style="{ width: panelWidth + 'px', height: panelHeight + 'px' }">
        <div class="scratchpad-header">
          <span class="scratchpad-title">Scratchpad</span>
          <button class="scratchpad-close" @click="isOpen = false" title="Close">&times;</button>
        </div>
        <textarea ref="textareaRef" v-model="localContent" @input="handleInput" placeholder="Write your thoughts here..." class="scratchpad-textarea"></textarea>
      </div>
    </Transition>
    <button class="scratchpad-toggle" :class="{ 'is-open': isOpen }" @click="isOpen = !isOpen" :title="isOpen ? 'Close' : 'Open scratchpad'">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  content?: string
  isStreaming?: boolean
}>(), { content: '', isStreaming: false })

const emit = defineEmits<{ 'update:content': [value: string]; 'stop-streaming': [] }>()

const isOpen = ref(false)
const localContent = ref(props.content)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const panelWidth = ref(320)
const panelHeight = ref(280)

let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.content, (val) => { localContent.value = val })
watch(isOpen, (val) => { if (val) nextTick(() => textareaRef.value?.focus()) })

const handleInput = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => emit('update:content', localContent.value), 300)
}
</script>

<style scoped>
.scratchpad-container { position: fixed; bottom: 24px; right: 24px; z-index: 1000; display: flex; flex-direction: column; align-items: flex-end; }
.scratchpad-toggle { width: 48px; height: 48px; border-radius: 50%; background-color: var(--color-text-base, #000); color: var(--color-bg-page, #fff); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px var(--shadow-md); transition: transform 0.2s; }
.scratchpad-toggle:hover { transform: scale(1.05); }
.scratchpad-toggle.is-open { background-color: var(--color-primary, #4a90a4); }
.streaming-toggle { width: 48px; height: 48px; border-radius: 50%; background-color: var(--color-primary); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px var(--shadow-md); margin-bottom: 12px; }
.streaming-spinner { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.scratchpad-panel { background-color: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; overflow: hidden; margin-bottom: 12px; }
.scratchpad-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background-color: var(--color-bg-primary-subtle, #f5f5f5); border-bottom: 1px solid var(--color-border-base); }
.scratchpad-title { font-size: 0.9rem; font-weight: 600; }
.scratchpad-close { background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 1.25rem; }
.scratchpad-textarea { flex: 1; padding: 12px 16px; border: none; resize: none; font-family: Georgia, serif; font-size: 0.9rem; line-height: 1.6; color: var(--color-text-message, #333); background-color: var(--color-bg-page); }
.scratchpad-textarea:focus { outline: none; }
.streaming-fade-enter-active, .streaming-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.streaming-fade-enter-from, .streaming-fade-leave-to { opacity: 0; transform: scale(0.8); }
.scratchpad-slide-enter-active, .scratchpad-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.scratchpad-slide-enter-from, .scratchpad-slide-leave-to { opacity: 0; transform: translateY(16px) scale(0.95); }
@media (max-width: 768px) { .scratchpad-container { top: 56px; bottom: auto; right: 12px; } }
</style>
