<template>
  <div class="markdown-renderer">
    <ASTNode
      v-for="(node, index) in astTree.children"
      :key="index"
      :node="node"
      @highlight-click="$emit('highlight-click', $event)"
      @note-click="$emit('note-click', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdownToAST } from '@/services/ASTMarkdownRenderer'
import ASTNode from './ASTNode.vue'
import type { CustomContent } from '@/types/message'

const props = withDefaults(defineProps<{
  content?: string
  customContent?: CustomContent[]
}>(), {
  content: '',
  customContent: () => [],
})

defineEmits<{ 'highlight-click': [event: unknown]; 'note-click': [event: unknown] }>()

const astTree = computed(() => parseMarkdownToAST(props.content, props.customContent))
</script>

<style>
.markdown-renderer {
  font-family: var(--message-font-family, Georgia, serif);
  font-size: var(--message-font-size, 18px);
  line-height: var(--message-line-height, 1.7);
}
</style>
