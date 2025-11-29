<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Settings</h2>
            <Button variant="danger" @click="close">&times;</Button>
          </div>
          <div class="modal-body">
            <div class="setting-item">
              <label class="setting-label">Theme</label>
              <div class="button-group">
                <button
                  :class="['toggle-button', { active: currentTheme === 'light' }]"
                  @click="setTheme('light')"
                >
                  Light
                </button>
                <button
                  :class="['toggle-button', { active: currentTheme === 'dark' }]"
                  @click="setTheme('dark')"
                >
                  Dark
                </button>
              </div>
            </div>
            <div class="setting-item setting-item-vertical">
              <label class="setting-label">Font</label>
              <div class="font-grid">
                <Button
                  v-for="font in fonts"
                  :key="font.value"
                  variant="secondary"
                  :class="['font-button', { active: fontFamily === font.value }]"
                  @click="setFontFamily(font.value)"
                >
                  <span class="font-button-content">
                    <span class="font-preview" :style="{ fontFamily: font.value }">Aa</span>
                    <span class="font-name">{{ font.label }}</span>
                  </span>
                </Button>
              </div>
            </div>
            <div class="setting-item">
              <label class="setting-label">Size</label>
              <div class="slider-wrapper">
                <span class="slider-label small">A</span>
                <input
                  type="range"
                  v-model="fontSize"
                  min="14"
                  max="24"
                  step="1"
                  class="font-slider"
                  @input="updateFontSize"
                />
                <span class="slider-label large">A</span>
                <span class="font-size-value">{{ fontSize }}</span>
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
import Button from './Button.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const currentTheme = ref('light')
const fontSize = ref(18)
const fontFamily = ref('Georgia, serif')

const fonts = [
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Palatino', value: "'Palatino Linotype', Palatino, serif" },
  { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Helvetica', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
]

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  currentTheme.value = window.__getTheme?.() || 'light'
  const savedFontSize = localStorage.getItem('messageFontSize')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10)
    applyFontSize(fontSize.value)
  }
  const savedFontFamily = localStorage.getItem('messageFontFamily')
  if (savedFontFamily) {
    fontFamily.value = savedFontFamily
    applyFontFamily(savedFontFamily)
  }
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
  localStorage.setItem('theme', theme)
}

const applyFontSize = (size) => {
  document.documentElement.style.setProperty('--message-font-size', `${size}px`)
}

const updateFontSize = () => {
  applyFontSize(fontSize.value)
  localStorage.setItem('messageFontSize', fontSize.value.toString())
}

const applyFontFamily = (family) => {
  document.documentElement.style.setProperty('--message-font-family', family)
}

const setFontFamily = (family) => {
  fontFamily.value = family
  applyFontFamily(family)
  localStorage.setItem('messageFontFamily', family)
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
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--color-bg-elevated);
  border-radius: 4px;
  width: 90%;
  max-width: 340px;
  border: 1px solid var(--color-border-base);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-text-strong);
  font-family: 'Georgia', serif;
}

.modal-body {
  padding: 1.25rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.setting-item-vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
}

.setting-item + .setting-item {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.setting-label {
  font-size: 0.95rem;
  color: var(--color-text-base);
  font-family: 'Georgia', serif;
  flex-shrink: 0;
}

.button-group {
  display: flex;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  overflow: hidden;
}

.toggle-button {
  padding: 0.4rem 1rem;
  background: var(--color-bg-elevated);
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
  transition: all 0.15s ease;
  border-right: 1px solid var(--color-border-base);
}

.toggle-button:last-child {
  border-right: none;
}

.toggle-button:hover {
  background: var(--color-bg-hover);
}

.toggle-button.active {
  background: var(--color-bg-active);
  color: var(--color-text-strong);
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.font-button {
  flex-direction: column;
  aspect-ratio: 1;
  padding: 0.5rem;
  width: 100%;
}

.font-button.active {
  background: var(--color-bg-active);
  border-color: var(--color-text-muted);
}

.font-button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.font-preview {
  font-size: 1.25rem;
  color: var(--color-text-strong);
  line-height: 1;
}

.font-name {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.slider-label {
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
}

.slider-label.small {
  font-size: 0.75rem;
}

.slider-label.large {
  font-size: 1.1rem;
}

.font-slider {
  width: 100px;
  height: 4px;
  appearance: none;
  background: var(--color-border-base);
  border-radius: 2px;
  cursor: pointer;
}

.font-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  cursor: pointer;
}

.font-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  cursor: pointer;
}

.font-size-value {
  min-width: 24px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
  text-align: right;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: translateY(-10px);
}
</style>
