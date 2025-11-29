<template>
  <div class="markdown-renderer">
    <ASTNode
      v-for="(node, index) in astTree.children"
      :key="index"
      :node="node"
      @question-link-click="handleQuestionLinkClick"
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

const emit = defineEmits(['question-link-click'])

const astTree = computed(() => {
  return parseMarkdownToAST(props.content, props.customContent)
})

function handleQuestionLinkClick(childIndex) {
  emit('question-link-click', childIndex)
}
</script>

<style>
.markdown-renderer {
  font-size: 1rem;
  line-height: 1.7;
}
</style>
