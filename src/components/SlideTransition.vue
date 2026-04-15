<template>
  <Transition :name="transitionName" :mode="mode" :appear="appear">
    <slot />
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  direction?: 'horizontal' | 'vertical'
  mode?: string
  appear?: boolean
}>(), {
  direction: 'horizontal',
  mode: 'out-in',
  appear: false,
})

const transitionName = computed(() =>
  props.direction === 'horizontal' ? 'slide-horizontal' : 'slide-vertical'
)
</script>

<style>
.slide-horizontal-enter-active, .slide-horizontal-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.slide-horizontal-enter-from { opacity: 0; transform: translateX(20px); }
.slide-horizontal-leave-to { opacity: 0; transform: translateX(-20px); }
.slide-vertical-enter-active, .slide-vertical-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.slide-vertical-enter-from { opacity: 0; transform: translateY(20px); }
.slide-vertical-leave-to { opacity: 0; transform: translateY(-20px); }
</style>
