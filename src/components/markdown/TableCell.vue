<template>
  <span>
    <template v-for="(node, index) in children" :key="index">
      <component
        :is="getComponent(node.type)"
        v-bind="getNodeProps(node)"
        @click="handleClick(node, $event)"
        @highlight-click="$emit('highlight-click', $event)"
        @note-click="$emit('note-click', $event)"
      >
        <template v-if="node.children">
          <TableCell
            v-for="(child, childIndex) in node.children"
            :key="childIndex"
            :children="[child]"
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
  </span>
</template>

<script setup lang="ts">
import type { ASTNodeType } from '@/services/ASTMarkdownRenderer'
import TextSpan from './TextSpan.vue'
import QuestionLinkSpan from './QuestionLinkSpan.vue'
import NoteSpan from './NoteSpan.vue'
import InlineCode from './InlineCode.vue'
import MathInline from './MathInline.vue'
import MarkdownStrong from './MarkdownStrong.vue'
import MarkdownEmphasis from './MarkdownEmphasis.vue'
import MarkdownLink from './MarkdownLink.vue'
import HtmlInline from './HtmlInline.vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const componentMap: Record<string, any> = {
  text: TextSpan,
  'question-link': QuestionLinkSpan,
  note: NoteSpan,
  code_inline: InlineCode,
  math_inline: MathInline,
  strong: MarkdownStrong,
  em: MarkdownEmphasis,
  link: MarkdownLink,
  html_inline: HtmlInline,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getComponent(type: string): any {
  return componentMap[type] || 'span'
}

function getNodeProps(node: Record<string, unknown>): Record<string, unknown> {
  switch (node.type) {
    case 'text':
      return { content: node.content, startOffset: node.startOffset, endOffset: node.endOffset }
    case 'question-link':
      return { text: node.text, targetMessageId: node.targetMessageId, questionId: node.questionId, startOffset: node.startOffset, endOffset: node.endOffset }
    case 'note':
      return { text: node.text, noteId: node.noteId, startOffset: node.startOffset, endOffset: node.endOffset, noteContent: node.noteContent, isLastSegment: node.isLastSegment !== false, colorIndex: node.colorIndex ?? 0 }
    case 'code_inline':
      return { content: node.content, startOffset: node.startOffset, endOffset: node.endOffset }
    case 'math_inline':
      return { content: node.content, startOffset: node.startOffset, endOffset: node.endOffset }
    case 'link':
      return { href: node.href, title: node.title }
    case 'html_inline':
      return { content: node.content }
    default:
      return {}
  }
}

function handleClick(node: Record<string, unknown>, targetMessageId: unknown) {
  if (node.type === 'question-link') {
    // handled by parent
  }
}

defineProps<{
  children: ASTNodeType[]
}>()

defineEmits<{ 'highlight-click': [event: unknown]; 'note-click': [event: unknown] }>()
</script>
