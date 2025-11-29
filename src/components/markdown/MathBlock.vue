<template>
  <mark
    v-if="highlighted"
    class="math-highlight"
    :style="{ backgroundColor: highlightColor }"
    :data-highlight-id="highlightId"
    :data-md-start="startOffset"
    :data-md-end="endOffset"
    @click="handleHighlightClick"
  >
    <span ref="mathEl"></span>
  </mark>
  <span v-else ref="mathEl"></span>
</template>

<script>
import { onMounted, ref, watch, computed, nextTick } from 'vue'
import { renderKatex } from '../../services/katex'
import { highlightColors } from '../../constants/highlightColors.js'
import 'katex/dist/katex.min.css'

export default {
  name: 'MathBlock',
  props: {
    content: {
      type: String,
      required: true
    },
    highlighted: {
      type: Boolean,
      default: false
    },
    colorIndex: {
      type: Number,
      default: 0
    },
    highlightId: {
      type: String,
      default: ''
    },
    startOffset: {
      type: Number,
      default: 0
    },
    endOffset: {
      type: Number,
      default: 0
    }
  },
  emits: ['highlight-click'],
  setup(props, { emit }) {
    const mathEl = ref(null)

    const highlightColor = computed(() => highlightColors[props.colorIndex] || highlightColors[0])

    const renderMath = () => {
      if (mathEl.value) {
        mathEl.value.innerHTML = renderKatex(props.content, true)
      }
    }

    const handleHighlightClick = (event) => {
      event.stopPropagation()
      emit('highlight-click', {
        highlightId: props.highlightId,
        text: props.content,
        colorIndex: props.colorIndex,
        startOffset: props.startOffset,
        endOffset: props.endOffset,
        x: event.clientX,
        y: event.clientY
      })
    }

    onMounted(renderMath)
    watch(() => props.content, renderMath)
    // Re-render when highlighted changes because the ref element changes with v-if
    watch(() => props.highlighted, () => {
      nextTick(renderMath)
    })

    return { mathEl, highlightColor, handleHighlightClick }
  }
}
</script>

<style scoped>
.katex {
  font-size: 1.1em;
}

.math-highlight {
  display: block;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
}

.math-highlight:hover {
  filter: brightness(0.9);
}
</style>
