<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @pointerdown.self="onOutsideClose">
        <div class="modal-content" :class="sizeClass" :style="contentStyle">
          <div v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <span class="modal-title" :class="titleClass" :style="titleStyle">{{ title }}</span>
            </slot>
            <div class="modal-header-actions">
              <slot name="header-actions"></slot>
              <button class="modal-close-btn" @click="onClose" title="Close">&times;</button>
            </div>
          </div>
          <div class="modal-body">
            <slot></slot>
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  title?: string
  titleClass?: string | object | string[]
  titleStyle?: Record<string, string>
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  contentStyle?: Record<string, string>
  preventClose?: boolean
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
}>(), {
  visible: false,
  title: '',
  titleClass: '',
  titleStyle: () => ({}),
  size: 'small',
  contentStyle: () => ({}),
  preventClose: false,
  closeOnOutsideClick: true,
  closeOnEscape: true,
})

const emit = defineEmits<{ close: [] }>()

const sizeClass = computed(() => `modal-content--${props.size}`)

function onClose() {
  if (props.preventClose) return
  emit('close')
}

function onOutsideClose() {
  if (!props.closeOnOutsideClick) return
  onClose()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (!props.closeOnEscape) return
  onClose()
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', handleKeydown)
  else document.removeEventListener('keydown', handleKeydown)
})

onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style>
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--color-backdrop, rgba(0, 0, 0, 0.3));
  display: flex; align-items: center; justify-content: center; z-index: 9998;
}
.modal-content {
  position: relative; display: flex; flex-direction: column;
  background-color: var(--color-bg-context-menu, #fff);
  border: 1px solid var(--color-border-context, #ddd);
  box-shadow: 0 4px 16px var(--shadow-lg, rgba(0, 0, 0, 0.15));
  border-radius: 8px; width: 90%; max-height: 85vh;
  color: var(--color-text-base, #333);
}
.modal-content--small { max-width: 400px; }
.modal-content--medium { max-width: 500px; }
.modal-content--large { max-width: 600px; }
.modal-content--xlarge { max-width: 800px; }
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem; border-bottom: 1px solid var(--color-border-subtle, #eee);
}
.modal-title { font-weight: 600; font-size: 1rem; color: var(--color-text-strong, #333); }
.modal-header-actions { display: flex; align-items: center; gap: 0.25rem; }
.modal-close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; background: transparent; border: none;
  border-radius: 4px; cursor: pointer; font-size: 1.25rem; line-height: 1;
  color: var(--color-text-muted, #666); transition: all 0.15s ease;
}
.modal-close-btn:hover { background: var(--color-bg-hover, #f5f5f5); color: var(--color-text-strong, #333); }
.modal-body { padding: 1rem; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid var(--color-border-subtle, #eee); }
.modal-enter-active, .modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-active .modal-content, .modal-leave-active .modal-content { transition: transform 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-content, .modal-leave-to .modal-content { transform: translateY(-10px); }
</style>
