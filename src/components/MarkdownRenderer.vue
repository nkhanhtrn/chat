<template>
  <div class="markdown-renderer">
    <ASTNode
      v-for="(node, index) in astTree.children"
      :key="index"
      :node="node"
      @question-link-click="$emit('question-link-click', $event)"
      @highlight-click="$emit('highlight-click', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { parseMarkdownToAST } from '../services/ASTMarkdownRenderer.js'
import ASTNode from './ASTNode.vue'

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  customContent: {
    type: Array,
    default: () => []
  }
})

defineEmits(['question-link-click', 'highlight-click'])

const astTree = computed(() => {
  return parseMarkdownToAST(props.content, props.customContent)
})
</script>

<style>
.markdown-renderer {
  font-family: var(--message-font-family, Georgia, serif);
  font-size: var(--message-font-size, 18px);
  line-height: 1.7;
}
</style>
