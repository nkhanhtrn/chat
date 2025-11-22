<template>
  <span>
    <template v-for="(part, index) in content" :key="index">
      <InlineCode v-if="part.type === 'code'" :text="part.text" />
      <strong v-else-if="part.type === 'bold'">{{ part.text }}</strong>
      <em v-else-if="part.type === 'italic'">{{ part.text }}</em>
      <span v-else>{{ part.text }}</span>
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
  }
}
</script>
