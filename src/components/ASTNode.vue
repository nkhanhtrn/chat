<template>
  <component
    :is="componentMap[node.type]"
    v-bind="getNodeProps(node)"
    @highlight-click="$emit('highlight-click', $event)"
    @note-click="$emit('note-click', $event)"
  >
    <template v-if="node.children">
      <ASTNode
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
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

<script setup lang="ts">
import type { ASTNodeType } from '@/services/ASTMarkdownRenderer'

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
import QuestionLinkSpan from './markdown/QuestionLinkSpan.vue'
import NoteSpan from './markdown/NoteSpan.vue'
import CodeBlock from './markdown/CodeBlock.vue'
import InlineCode from './markdown/InlineCode.vue'
import MathBlock from './markdown/MathBlock.vue'
import MathInline from './markdown/MathInline.vue'
import MermaidBlock from './markdown/MermaidBlock.vue'
import MarkdownTable from './markdown/MarkdownTable.vue'
import CollapsibleBlock from './markdown/CollapsibleBlock.vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const componentMap: Record<string, any> = {
  paragraph: MarkdownParagraph,
  heading: MarkdownHeading,
  list: MarkdownList,
  list_item: MarkdownListItem,
  blockquote: MarkdownBlockquote,
  link: MarkdownLink,
  strong: MarkdownStrong,
  em: MarkdownEmphasis,
  hr: MarkdownHorizontalRule,
  br: MarkdownBreak,
  text: TextSpan,
  'question-link': QuestionLinkSpan,
  note: NoteSpan,
  code_block: CodeBlock,
  code_inline: InlineCode,
  math_block: MathBlock,
  math_inline: MathInline,
  mermaid_block: MermaidBlock,
  table: MarkdownTable,
  collapsible_block: CollapsibleBlock,
}

const props = defineProps<{ node: ASTNodeType }>()
defineEmits<{ 'highlight-click': [event: unknown]; 'note-click': [event: unknown] }>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNodeProps(node: ASTNodeType): Record<string, any> {
  const n = node as Record<string, unknown>
  switch (node.type) {
    case 'heading':
      return { level: n.level }
    case 'list':
      return { ordered: n.ordered }
    case 'link':
      return { href: n.href, title: n.title }
    case 'text':
      return { content: n.content, startOffset: n.startOffset, endOffset: n.endOffset }
    case 'question-link':
      return {
        text: n.text, targetMessageId: n.targetMessageId, questionId: n.questionId,
        startOffset: n.startOffset, endOffset: n.endOffset,
        noteContent: n.noteContent || '', hasNote: !!n.hasNote,
        isLastSegment: n.isLastSegment !== false, colorIndex: n.colorIndex ?? 0,
      }
    case 'note':
      return {
        text: n.text, noteId: n.noteId,
        startOffset: n.startOffset, endOffset: n.endOffset,
        noteContent: n.noteContent || '',
        isLastSegment: n.isLastSegment !== false, colorIndex: n.colorIndex ?? 0,
      }
    case 'code_block':
      return { language: n.language, code: n.code }
    case 'mermaid_block':
      return { code: n.code }
    case 'code_inline':
      return { content: n.content, startOffset: n.startOffset, endOffset: n.endOffset }
    case 'math_block':
    case 'math_inline':
      return {
        content: n.content,
        startOffset: n.startOffset, endOffset: n.endOffset,
      }
    case 'table':
      return { node: props.node }
    default:
      return {}
  }
}
</script>
