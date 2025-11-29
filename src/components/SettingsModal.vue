<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Settings</h2>
            <button class="close-button" @click="close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="setting-item">
              <label class="setting-label">Theme</label>
              <div class="theme-options">
                <button
                  :class="['theme-button', { active: currentTheme === 'light' }]"
                  @click="setTheme('light')"
                >
                  <span class="theme-icon">&#9788;</span>
                  <span>Light</span>
                </button>
                <button
                  :class="['theme-button', { active: currentTheme === 'dark' }]"
                  @click="setTheme('dark')"
                >
                  <span class="theme-icon">&#9790;</span>
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const currentTheme = ref('light')

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  currentTheme.value = window.__getTheme?.() || 'light'
})

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const setTheme = (theme) => {
  currentTheme.value = theme
  window.__setTheme?.(theme)
}

const close = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--color-bg-elevated);
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 24px var(--shadow-lg);
  border: 1px solid var(--color-border-base);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border-base);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-strong);
  font-family: 'Georgia', serif;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-button:hover {
  color: var(--color-text-strong);
}

.modal-body {
  padding: 1.5rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-base);
  font-family: 'Georgia', serif;
}

.theme-options {
  display: flex;
  gap: 0.75rem;
}

.theme-button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background-color: var(--color-bg-button);
  border: 2px solid var(--color-border-base);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-base);
  font-family: system-ui, -apple-system, sans-serif;
}

.theme-button:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-strong);
}

.theme-button.active {
  border-color: var(--color-primary);
  background-color: var(--color-bg-active);
}

.theme-icon {
  font-size: 1.5rem;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
