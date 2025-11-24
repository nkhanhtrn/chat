<template>
  <span ref="mathEl"></span>
</template>

<script>
import { onMounted, ref, watch } from 'vue'
import { renderKatex } from '../services/katex'
import 'katex/dist/katex.min.css'

export default {
  name: 'MathInline',
  props: {
    content: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const mathEl = ref(null)

    const renderMath = () => {
      if (mathEl.value) {
        mathEl.value.innerHTML = renderKatex(props.content, false)
      }
    }

    onMounted(renderMath)
    watch(() => props.content, renderMath)

    return { mathEl }
  }
}
</script>

<style scoped>
.katex {
  font-size: 1em;
}
</style>
