<template>
  <component :is="elementTag" :class="elementClass">
    <template v-for="(part, index) in content" :key="index">
      <code v-if="part.type === 'code'" class="inline-code">{{ part.text }}</code>
      <strong v-else-if="part.type === 'bold'">{{ part.text }}</strong>
      <em v-else-if="part.type === 'italic'">{{ part.text }}</em>
      <span v-else>{{ part.text }}</span>
    </template>
  </component>
</template>

<script>
export default {
  name: 'FormattedText',
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
