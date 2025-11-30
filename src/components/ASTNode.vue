<template>
  <component
    :is="componentMap[node.type]"
    v-bind="getNodeProps(node)"
    @click="handleClick"
    @question-link-click="$emit('question-link-click', $event)"
    @highlight-click="$emit('highlight-click', $event)"
    @note-click="$emit('note-click', $event)"
  >
    <template v-if="node.children">
      <ASTNode
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        @question-link-click="$emit('question-link-click', $event)"
        @highlight-click="$emit('highlight-click', $event)"
        @note-click="$emit('note-click', $event)"
      />
    </template>
    <template v-else-if="node.content">
      {{ node.content }}
    </template>
    <template v-else-if="node.text">
      {{ node.text }}
    </template>
  </component>
</template>

<script setup>
// Import markdown components
import MarkdownParagraph from './markdown/MarkdownParagraph.vue'
import MarkdownHeading from './markdown/MarkdownHeading.vue'
import MarkdownList from './markdown/MarkdownList.vue'
import MarkdownListItem from './markdown/MarkdownListItem.vue'
import MarkdownBlockquote from './markdown/MarkdownBlockquote.vue'
import MarkdownLink from './markdown/MarkdownLink.vue'
import MarkdownStrong from './markdown/MarkdownStrong.vue'
import MarkdownEmphasis from './markdown/MarkdownEmphasis.vue'
import MarkdownHorizontalRule from './markdown/MarkdownHorizontalRule.vue'
import MarkdownBreak from './markdown/MarkdownBreak.vue'
import TextSpan from './markdown/TextSpan.vue'
import HighlightSpan from './markdown/HighlightSpan.vue'
import QuestionLinkSpan from './markdown/QuestionLinkSpan.vue'
import CodeBlock from './markdown/CodeBlock.vue'
import InlineCode from './markdown/InlineCode.vue'
import MathBlock from './markdown/MathBlock.vue'
import MathInline from './markdown/MathInline.vue'
import MarkdownTable from './markdown/MarkdownTable.vue'
import CollapsibleBlock from './markdown/CollapsibleBlock.vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['question-link-click', 'highlight-click', 'note-click'])

// Map AST node types to Vue components
const componentMap = {
  'paragraph': MarkdownParagraph,
  'heading': MarkdownHeading,
  'list': MarkdownList,
  'list_item': MarkdownListItem,
  'blockquote': MarkdownBlockquote,
  'link': MarkdownLink,
  'strong': MarkdownStrong,
  'em': MarkdownEmphasis,
  'hr': MarkdownHorizontalRule,
  'br': MarkdownBreak,
  'text': TextSpan,
  'highlight': HighlightSpan,
  'question-link': QuestionLinkSpan,
  'code_block': CodeBlock,
  'code_inline': InlineCode,
  'math_block': MathBlock,
  'math_inline': MathInline,
  'table': MarkdownTable,
  'collapsible_block': CollapsibleBlock
}

function getNodeProps(node) {
  switch (node.type) {
    case 'heading':
      return { level: node.level }

    case 'list':
      return { ordered: node.ordered }

    case 'link':
      return { href: node.href, title: node.title }

    case 'text':
      return {
        content: node.content,
        startOffset: node.startOffset,
        endOffset: node.endOffset
      }

    case 'highlight':
      return {
        text: node.text,
        colorIndex: node.colorIndex,
        highlightId: node.highlightId,
        startOffset: node.startOffset,
        endOffset: node.endOffset,
        noteContent: node.noteContent || '',
        hasNote: !!node.hasNote,
        isLastSegment: node.isLastSegment !== false
      }

    case 'question-link':
      return {
        text: node.text,
        targetMessageId: node.targetMessageId,
        questionId: node.questionId,
        startOffset: node.startOffset,
        endOffset: node.endOffset
      }

    case 'code_block':
      return {
        language: node.language,
        code: node.code
      }

    case 'code_inline':
      return {
        content: node.content,
        startOffset: node.startOffset,
        endOffset: node.endOffset
      }

    case 'math_block':
    case 'math_inline':
      return {
        content: node.content,
        highlighted: node.highlighted || false,
        colorIndex: node.colorIndex,
        highlightId: node.highlightId,
        startOffset: node.startOffset,
        endOffset: node.endOffset
      }

    case 'table':
      return {
        node: node
      }

    case 'collapsible_block':
      return {
        content: node.content
      }

    default:
      return {}
  }
}

function handleClick(targetMessageId) {
  if (props.node.type === 'question-link') {
    emit('question-link-click', targetMessageId)
  }
}
</script>
