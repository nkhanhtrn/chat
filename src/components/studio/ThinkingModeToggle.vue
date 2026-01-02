<template>
  <div class="thinking-toggle" @click="toggle">
    <span>Thinking Mode</span>
    <span class="slider" :class="{ checked: modelValue }"></span>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.thinking-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.thinking-toggle .slider {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--color-text-muted);
  opacity: 0.3;
  border-radius: 9px;
  transition: 0.2s;
  flex-shrink: 0;
}

.thinking-toggle .slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
}

.thinking-toggle .slider.checked {
  background: var(--color-primary);
  opacity: 1;
}

.thinking-toggle .slider.checked::before {
  transform: translateX(14px);
}
</style>
