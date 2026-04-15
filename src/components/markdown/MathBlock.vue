<template>
  <span ref="mathEl"></span>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { renderKatex } from '@/services/katex'
import 'katex/dist/katex.min.css'

const props = withDefaults(defineProps<{
  content: string
  startOffset?: number
  endOffset?: number
  displayMode?: boolean
}>(), { displayMode: true })

const mathEl = ref<HTMLElement | null>(null)

const renderMath = () => { if (mathEl.value) mathEl.value.innerHTML = renderKatex(props.content, props.displayMode) }

onMounted(renderMath)
watch(() => props.content, renderMath)
</script>

<style scoped>
.katex { font-size: 1.1em; }
</style>
