<template>
  <div class="messages-wrapper">
    <div class="messages-container" ref="containerRef">
      <div v-if="messages.length === 0" class="empty-state">
        <p>What do you want to build today?</p>
        <p class="subtext">Describe your idea to get started</p>
      </div>
      <div v-for="turn in turns" :key="turn.id" class="turn">
        <CollapseToggle
          v-if="!isStreamingTurn(turn)"
          :collapsed="isTurnCollapsed(turn.id)"
          class="turn-toggle"
          @toggle="toggleTurn(turn.id)"
        />
        <div
          v-if="isTurnCollapsed(turn.id) && !isStreamingTurn(turn)"
          class="turn-preview"
          @click="toggleTurn(turn.id)"
        >
          {{ turnQuestion(turn) }}
        </div>
        <div v-else class="turn-body">
          <ProjectChatMessage
            v-for="item in turn.items"
            :key="item.msg.id"
            :msg="item.msg"
            :is-last-message="item.index === messages.length - 1"
            :is-last-user-message="item.index === lastUserMessageIndex"
            :is-streaming="isStreaming"
            @edit="(newContent: string) => $emit('edit', item.index, newContent)"
          />
        </div>
      </div>
    </div>

    <button
      v-if="messages.length > 0"
      class="scroll-to-bottom-btn"
      @click="scrollToBottom(true)"
      :class="{ 'is-visible': showScrollBtn }"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import ProjectChatMessage from './ProjectChatMessage.vue'
import CollapseToggle from '@/components/CollapseToggle.vue'
import type { ProjectMessage } from '@/types/project'

const props = defineProps<{
  messages: ProjectMessage[]
  isStreaming?: boolean
}>()

defineEmits<{
  edit: [index: number, content: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const showScrollBtn = ref(false)

const collapsedTurnIds = ref(new Set<string>())

const isTurnCollapsed = (id: string) => collapsedTurnIds.value.has(id)
const toggleTurn = (id: string) => {
  const next = new Set(collapsedTurnIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedTurnIds.value = next
}

interface Turn {
  id: string
  items: { msg: ProjectMessage; index: number }[]
}

const turns = computed<Turn[]>(() => {
  const list: Turn[] = []
  props.messages.forEach((msg, index) => {
    if (msg.role === 'user' || list.length === 0) {
      list.push({ id: msg.id, items: [{ msg, index }] })
    } else {
      list[list.length - 1].items.push({ msg, index })
    }
  })
  return list
})

const turnQuestion = (turn: Turn) => {
  const userItem = turn.items.find(i => i.msg.role === 'user') ?? turn.items[0]
  return userItem.msg.content
}

const isStreamingTurn = (turn: Turn) =>
  !!props.isStreaming && turn.items[turn.items.length - 1].index === props.messages.length - 1

const checkScroll = () => {
  const el = containerRef.value
  if (!el) return
  showScrollBtn.value = el.scrollHeight - el.scrollTop - el.clientHeight > 80
}

onMounted(() => {
  containerRef.value?.addEventListener('scroll', checkScroll)
})

onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('scroll', checkScroll)
})

const scrollToBottom = (smooth = false) => {
  nextTick(() => {
    if (!containerRef.value) return
    containerRef.value.scrollTo({
      top: containerRef.value.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    })
  })
}

watch(() => props.messages.length, () => scrollToBottom())

const lastUserMessageIndex = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    if (props.messages[i].role === 'user') return i
  }
  return -1
})

defineExpose({ containerRef, scrollToBottom })
</script>

<style scoped>
.messages-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}
.turn {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}
.turn-toggle {
  margin-top: 0.15rem;
  opacity: 0.4;
  transition: opacity 0.15s;
}
.turn:hover .turn-toggle { opacity: 0.8; }
.turn-toggle:hover { opacity: 1; }
.turn-preview {
  flex: 1;
  min-width: 0;
  font-family: Georgia, serif;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.15rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.turn-preview:hover { color: var(--color-text-base); }
.turn-body {
  flex: 1;
  min-width: 0;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
}
.empty-state p { margin: 0; }
.empty-state .subtext { font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.7; }
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 0.75rem;
  right: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--color-border-subtle);
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  z-index: 1;
  opacity: 0.5;
}
.scroll-to-bottom-btn:hover,
.scroll-to-bottom-btn.is-visible {
  color: var(--color-text-base);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  opacity: 1;
}
@media (max-width: 768px) { .messages-container { padding: 1rem; } }
</style>
