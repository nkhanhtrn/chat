<template>
  <div :class="['message', msg.role]">
    <div class="message-role">
      {{ msg.role === 'user' ? 'You' : 'AI' }}
      <span v-if="msg.role === 'user' && msg.targetToolName" class="target-badge">{{ msg.targetToolName }}</span>
      <template v-if="msg.role === 'user' && msg.toolRefs?.length">
        <span v-for="name in msg.toolRefs" :key="name" class="tool-ref-badge">{{ name }}</span>
      </template>
      <button
        v-if="msg.role === 'user' && !isStreaming && isLastUserMessage"
        class="retry-icon-btn"
        @click="$emit('edit', msg.content)"
        title="Retry this message"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>
    </div>
    <div v-if="msg.webSearchResults && msg.webSearchResults.length > 0" class="search-sources">
      <div class="source-icons">
        <button
          v-for="(result, i) in msg.webSearchResults"
          :key="i"
          class="source-icon"
          :title="result.title"
          @click.stop="sourcesOpen = !sourcesOpen"
        >
          <img
            :src="faviconUrl(result.url)"
            alt=""
            class="source-favicon"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span class="source-fallback">{{ getDomain(result.url).charAt(0).toUpperCase() }}</span>
        </button>
      </div>
      <div v-if="sourcesOpen" class="source-list">
        <a
          v-for="(result, i) in msg.webSearchResults"
          :key="i"
          :href="result.url"
          target="_blank"
          rel="noopener"
          class="source-item"
        >
          <img
            :src="faviconUrl(result.url)"
            alt=""
            class="source-item-favicon"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span class="source-fallback-small">{{ getDomain(result.url).charAt(0).toUpperCase() }}</span>
          <span class="source-title">{{ result.title }}</span>
          <span class="source-domain">{{ getDomain(result.url) }}</span>
        </a>
      </div>
    </div>
    <div class="message-content">
      <MarkdownRenderer
        v-if="msg.role === 'assistant' && msg.content"
        :content="msg.content"
      />
      <div v-else class="user-message-wrapper">
        <div :class="['user-message-block', { collapsed: isUserCollapsed }]">
          <InlineEdit
            :modelValue="msg.content"
            textClass="user-message-text"
            inputClass="user-message-input"
            @save="(newContent: string) => $emit('edit', newContent)"
          />
        </div>
        <button v-if="isUserLong" class="collapse-toggle" @click="isUserCollapsed = !isUserCollapsed">
          {{ isUserCollapsed ? 'Show more' : 'Show less' }}
        </button>
      </div>
      <span v-if="showCursor" class="cursor">|</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import InlineEdit from '@/components/InlineEdit.vue'
import type { ProjectMessage } from '@/types/project'

const props = defineProps<{
  msg: ProjectMessage
  isLastMessage?: boolean
  isLastUserMessage?: boolean
  isStreaming?: boolean
}>()

defineEmits<{
  edit: [content: string]
}>()

const sourcesOpen = ref(false)
const isUserCollapsed = ref(true)

const isUserLong = computed(() => props.msg.role === 'user' && props.msg.content.length > 300)

const showCursor = computed(() =>
  props.isStreaming && props.isLastMessage && props.msg.role === 'assistant'
)

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function faviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}
</script>

<style scoped>
.message { margin-bottom: 1.25rem; }
.message-role { font-size: 0.65rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 0.35rem; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.05em; }
.message.user .message-role { color: var(--color-primary, #6366f1); }
.message-content { font-family: Georgia, serif; font-size: 0.95rem; line-height: 1.6; color: var(--color-text-base); }
.message.user .message-content { background-color: var(--color-bg-base); border: 1px solid var(--color-border-subtle); padding: 0.75rem 1rem; }
.user-message-wrapper { width: 100%; }
.user-message-block { max-height: none; overflow: hidden; transition: max-height 0.2s ease; }
.user-message-block.collapsed { max-height: 150px; position: relative; }
.user-message-block.collapsed::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 40px; background: linear-gradient(transparent, var(--color-bg-base)); pointer-events: none; }
.collapse-toggle { display: block; width: 100%; padding: 0.3rem 0; margin-top: 0.25rem; background: none; border: none; border-top: 1px solid var(--color-border-subtle); color: var(--color-text-muted); cursor: pointer; font-family: system-ui, sans-serif; font-size: 0.75rem; text-align: center; transition: color 0.15s; }
.collapse-toggle:hover { color: var(--color-primary, #6366f1); }
.message.user .message-content :deep(.user-message-text) { display: block; white-space: pre-wrap; word-break: break-word; }
.message.user .message-content :deep(.user-message-input) { font-family: Georgia, serif; font-size: 0.95rem; width: 100%; padding: 0.5rem 0.75rem; }
.message.user .message-content :deep(.inline-edit-wrapper) { width: 100%; }
.message.assistant .message-content { padding: 0.25rem 0; }
.cursor { animation: blink 0.7s infinite; color: var(--color-primary); font-weight: bold; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
.retry-icon-btn { display: inline-flex; align-items: center; justify-content: center; margin-left: 0.35rem; padding: 2px; background: none; border: none; border-radius: 3px; color: var(--color-text-muted); cursor: pointer; opacity: 0; transition: all 0.15s; }
.message:hover .retry-icon-btn { opacity: 0.6; }
.retry-icon-btn:hover { opacity: 1; background-color: var(--color-bg-hover); color: var(--color-text-base); }

.search-sources { margin-bottom: 0.4rem; }
.source-icons { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.source-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--color-border-subtle); background: var(--color-bg-elevated); transition: all 0.15s; cursor: pointer; text-decoration: none; }
.source-icon:hover { border-color: var(--color-border-base); background: var(--color-bg-hover); transform: scale(1.15); }
.source-favicon { width: 16px; height: 16px; border-radius: 2px; position: absolute; }
.source-fallback { font-size: 0.65rem; font-weight: 600; color: var(--color-text-muted); font-family: system-ui, sans-serif; }
.source-icon:hover .source-fallback { color: var(--color-text-base); }

.source-list { display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.35rem; }
.source-item { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: var(--color-text-muted); text-decoration: none; font-family: system-ui, sans-serif; transition: all 0.15s; position: relative; }
.source-item:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.source-item-favicon { width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0; position: absolute; left: 0.5rem; }
.source-fallback-small { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 600; color: var(--color-text-muted); flex-shrink: 0; border-radius: 2px; background: var(--color-bg-elevated); }
.source-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; color: var(--color-text-base); }
.source-domain { color: var(--color-text-muted); font-size: 0.65rem; flex-shrink: 0; }

.target-badge, .tool-ref-badge { display: inline-block; padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600; font-family: system-ui, sans-serif; margin-left: 0.3rem; vertical-align: middle; }
.target-badge { background: var(--color-primary-subtle, color-mix(in srgb, var(--color-primary) 15%, transparent)); color: var(--color-primary); }
.tool-ref-badge { background: var(--color-bg-hover); color: var(--color-text-muted); border: 1px solid var(--color-border-subtle); }
</style>
