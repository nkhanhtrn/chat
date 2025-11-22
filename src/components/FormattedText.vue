<template>
  <component :is="elementTag" :class="elementClass">
    <template v-for="(part, index) in content" :key="index">
      <InlineCode v-if="part.type === 'code'" :text="part.text" />
      <strong v-else-if="part.type === 'bold'">{{ part.text }}</strong>
      <em v-else-if="part.type === 'italic'">{{ part.text }}</em>
      <span v-else>{{ part.text }}</span>
    </template>
  </component>
</template>

<script>
import InlineCode from './InlineCode.vue'

export default {
  name: 'FormattedText',
  components: {
    InlineCode
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
