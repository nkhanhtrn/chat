<template>
  <Transition :name="transitionName" :mode="mode" :appear="appear">
    <slot />
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  direction: {
    type: String,
    default: 'horizontal',
    validator: (value) => ['horizontal', 'vertical'].includes(value)
  },
  mode: {
    type: String,
    default: 'out-in'
  },
  appear: {
    type: Boolean,
    default: false
  }
})

const transitionName = computed(() =>
  props.direction === 'horizontal' ? 'slide-horizontal' : 'slide-vertical'
)
</script>

<style>
/* Horizontal slide transition */
.slide-horizontal-enter-active,
.slide-horizontal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-horizontal-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-horizontal-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Vertical slide transition */
.slide-vertical-enter-active,
.slide-vertical-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-vertical-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-vertical-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
