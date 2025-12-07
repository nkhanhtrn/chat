<template>
  <span>
    <template v-for="(node, index) in children" :key="index">
      <component
        :is="getComponent(node.type)"
        v-bind="getNodeProps(node)"
        @click="handleClick(node, $event)"
        @question-link-click="bubbleQuestionLinkClick"
        @highlight-click="bubbleHighlightClick"
      >
        <template v-if="node.children">
          <TableCell
            v-for="(child, childIndex) in node.children"
            :key="childIndex"
            :children="[child]"
            @question-link-click="bubbleQuestionLinkClick"
            @highlight-click="bubbleHighlightClick"
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

<script>
import TextSpan from './TextSpan.vue'
import HighlightSpan from './HighlightSpan.vue'
import QuestionLinkSpan from './QuestionLinkSpan.vue'
import InlineCode from './InlineCode.vue'
import MathInline from './MathInline.vue'
import MarkdownStrong from './MarkdownStrong.vue'
import MarkdownEmphasis from './MarkdownEmphasis.vue'
import MarkdownLink from './MarkdownLink.vue'
import HtmlInline from './HtmlInline.vue'

export default {
  name: 'TableCell',
  components: {
    TextSpan,
    HighlightSpan,
    QuestionLinkSpan,
    InlineCode,
    MathInline,
    MarkdownStrong,
    MarkdownEmphasis,
    MarkdownLink,
    HtmlInline
  },
  props: {
    children: {
      type: Array,
      required: true
    }
  },
  emits: ['question-link-click', 'highlight-click'],
  methods: {
    getComponent(type) {
      const map = {
        'text': TextSpan,
        'highlight': HighlightSpan,
        'question-link': QuestionLinkSpan,
        'code_inline': InlineCode,
        'math_inline': MathInline,
        'strong': MarkdownStrong,
        'em': MarkdownEmphasis,
        'link': MarkdownLink,
        'html_inline': HtmlInline
      }
      return map[type] || 'span'
    },
    getNodeProps(node) {
      switch (node.type) {
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
            endOffset: node.endOffset
          }
        case 'question-link':
          return {
            text: node.text,
            targetMessageId: node.targetMessageId,
            questionId: node.questionId,
            startOffset: node.startOffset,
            endOffset: node.endOffset
          }
        case 'code_inline':
          return {
            content: node.content,
            startOffset: node.startOffset,
            endOffset: node.endOffset
          }
        case 'math_inline':
          return {
            content: node.content,
            highlighted: node.highlighted || false,
            colorIndex: node.colorIndex,
            highlightId: node.highlightId,
            startOffset: node.startOffset,
            endOffset: node.endOffset
          }
        case 'link':
          return {
            href: node.href,
            title: node.title
          }
        case 'html_inline':
          return {
            content: node.content
          }
        default:
          return {}
      }
    },
    handleClick(node, targetMessageId) {
      if (node.type === 'question-link') {
        this.$emit('question-link-click', targetMessageId)
      }
    },
    bubbleQuestionLinkClick(targetMessageId) {
      this.$emit('question-link-click', targetMessageId)
    },
    bubbleHighlightClick(data) {
      this.$emit('highlight-click', data)
    }
  }
}
</script>
