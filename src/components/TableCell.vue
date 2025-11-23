<template>
  <span>
    <template v-for="(part, index) in content" :key="index">
      <InlineCode v-if="part.type === 'code'" :text="part.text" />
      <strong v-else-if="part.type === 'bold'" v-html="unescapeHtml(part.text)"></strong>
      <em v-else-if="part.type === 'italic'" v-html="unescapeHtml(part.text)"></em>
      <span v-else v-html="unescapeHtml(part.text)"></span>
    </template>
  </span>
</template>

<script>
import InlineCode from './InlineCode.vue'

export default {
  name: 'TableCell',
  components: {
    InlineCode
  },
  props: {
    content: {
      type: Array,
      required: true
    }
  },
  methods: {
    unescapeHtml(text) {
      if (!text) return ''
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    }
  }
}
</script>
