<template>
  <component :is="elementTag" :class="elementClass">
    <template v-for="(part, index) in content" :key="index">
      <InlineCode v-if="part.type === 'code'" :text="part.text" />
      <a v-else-if="part.type === 'link'" :href="part.text" target="_blank" rel="noopener noreferrer" class="markdown-link">{{ part.text }}</a>
      <strong v-else-if="part.type === 'bold'">{{ part.text }}</strong>
      <em v-else-if="part.type === 'italic'">{{ part.text }}</em>
      <MathInline v-else-if="part.type === 'mathinline'" :content="part.content" />
      <span v-else v-html="part.text"></span>
    </template>
  </component>
</template>

<script>
import InlineCode from './InlineCode.vue'
import MathInline from './MathInline.vue'

export default {
  name: 'FormattedText',
  components: {
    InlineCode,
    MathInline
  },
  props: {
    content: {
      type: Array,
      required: true
    },
    type: {
      type: String,
      default: 'text'
    },
    level: {
      type: Number,
      default: null
    }
  },
  computed: {
    elementTag() {
      if (this.type === 'header' && this.level) {
        return `h${this.level}`
      }
      return 'div'
    },
    elementClass() {
      if (this.type === 'header' && this.level) {
        return `markdown-h${this.level}`
      }
      return 'message-text'
    }
  }
}
</script>
