<template>
  <Modal :visible="modelValue" title="Settings" @close="close">
    <div class="settings-container">
      <!-- Tabs -->
      <div class="settings-tabs">
        <button
          :class="['tab-button', { active: activeTab === 'theme' }]"
          @click="activeTab = 'theme'"
        >
          Theme
        </button>
        <button
          :class="['tab-button', { active: activeTab === 'llm' }]"
          @click="activeTab = 'llm'"
        >
          LLM
        </button>
      </div>

      <!-- Tab Content with Transitions -->
      <div class="tab-content-wrapper">
        <Transition name="tab-fade" mode="out-in">
          <!-- Theme Tab Content -->
          <div v-if="activeTab === 'theme'" key="theme" class="settings-body">
        <div class="setting-item">
          <label class="setting-label">Theme</label>
          <div class="button-group">
            <button
              :class="['toggle-button theme-button theme-button-light', { active: currentTheme === 'light' }]"
              @click="setTheme('light')"
            >
              Light
            </button>
            <button
              :class="['toggle-button theme-button theme-button-sepia', { active: currentTheme === 'sepia' }]"
              @click="setTheme('sepia')"
            >
              Sepia
            </button>
            <button
              :class="['toggle-button theme-button theme-button-dark', { active: currentTheme === 'dark' }]"
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
        <div class="setting-item">
          <label class="setting-label">Line Height</label>
          <div class="slider-wrapper">
            <span class="slider-label small">≡</span>
            <input
              type="range"
              v-model="lineHeight"
              min="1.4"
              max="2.2"
              step="0.1"
              class="font-slider"
              @input="updateLineHeight"
            />
            <span class="slider-label large">≡</span>
            <span class="font-size-value">{{ lineHeight }}</span>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label">Width</label>
          <div class="button-group">
            <button
              v-for="option in widthOptions"
              :key="option.value"
              :class="['toggle-button', { active: contentWidth === option.value }]"
              @click="setContentWidth(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
          </div>

          <!-- LLM Tab Content -->
          <div v-else-if="activeTab === 'llm'" key="llm" class="settings-body">
        <div class="setting-item setting-item-vertical">
          <label class="setting-label">Provider</label>
          <div class="button-group provider-group">
            <button
              v-for="provider in providers"
              :key="provider.id"
              :class="['toggle-button', { active: currentProvider === provider.id }]"
              @click="selectProvider(provider.id)"
            >
              {{ provider.name }}
            </button>
          </div>
          <div v-if="selectedProviderRequiresKey" class="api-key-section">
            <div class="api-key-input-wrapper">
              <input
                :type="showApiKey ? 'text' : 'password'"
                v-model="apiKey"
                placeholder="Enter API key"
                class="api-key-input"
                @input="onApiKeyChange"
              />
              <button class="toggle-visibility-btn" @click="showApiKey = !showApiKey">
                {{ showApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            <div class="api-key-hint">
              <a v-if="currentProvider === 'google'" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Get Google AI API key</a>
              <a v-else-if="currentProvider === 'cerebras'" href="https://cloud.cerebras.ai/" target="_blank" rel="noopener">Get Cerebras API key</a>
            </div>
          </div>
          <div v-if="!selectedProviderRequiresKey && currentProvider === 'lmstudio'" class="api-key-section">
            <input
              type="text"
              v-model="baseUrl"
              placeholder="http://localhost:1234"
              class="api-key-input"
              @input="onBaseUrlChange"
            />
            <div class="api-key-hint">LM Studio server URL</div>
          </div>
          <!-- Model selector for providers that have multiple models -->
          <div v-if="availableModels.length > 0" class="model-section">
            <label class="model-label">Model</label>
            <select v-model="selectedModel" class="model-select" @change="onModelChange">
              <option v-for="model in availableModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
          <div v-if="connectionStatus" :class="['connection-status', connectionStatus.type]">
            {{ connectionStatus.message }}
          </div>
        </div>
          </div>
        </Transition>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Modal from './Modal.vue'
import Button from '../Button.vue'
import {
  listProviders,
  getCurrentProviderId,
  getCurrentConfig,
  setProvider,
  testConnection,
  fetchModels
} from '../../services/api.js'
import { useChatStore } from '../../stores/chat.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'provider-changed'])

// LLM Provider state
const providers = ref([])
const currentProvider = ref('lmstudio')
const apiKey = ref('')
const baseUrl = ref('http://localhost:1234')
const showApiKey = ref(false)
const connectionStatus = ref(null)
const availableModels = ref([])
const selectedModel = ref('')
const chatStore = useChatStore()

const selectedProviderRequiresKey = computed(() => {
  const provider = providers.value.find(p => p.id === currentProvider.value)
  return provider?.requiresApiKey ?? false
})

// Tab state
const activeTab = ref('theme')

// Theme and font state
const currentTheme = ref('light')
const fontSize = ref(18)
const fontFamily = ref('Georgia, serif')
const lineHeight = ref(1.7)
const contentWidth = ref('medium')

const fonts = [
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Charter', value: "'Charis SIL', Charter, Georgia, serif" },
  { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' }
]

const widthOptions = [
  { label: 'Narrow', value: 'narrow' },
  { label: 'Medium', value: 'medium' },
  { label: 'Wide', value: 'wide' }
]

// Load provider settings when modal opens
watch(() => props.modelValue, (visible) => {
  if (visible) {
    loadProviderSettings()
  }
})

const loadProviderSettings = async () => {
  providers.value = listProviders()
  currentProvider.value = getCurrentProviderId()
  const config = getCurrentConfig()
  apiKey.value = config.apiKey || ''
  baseUrl.value = config.baseUrl || 'http://localhost:1234'
  connectionStatus.value = null

  // Load available models and current selection
  selectedModel.value = chatStore.currentModel || ''
  await loadModels()
}

const loadModels = async () => {
  try {
    availableModels.value = await fetchModels()
    // If no model selected yet, select the first one
    if (!selectedModel.value && availableModels.value.length > 0) {
      selectedModel.value = availableModels.value[0].id
      chatStore.setCurrentModel(selectedModel.value)
    }
  } catch (error) {
    availableModels.value = []
    console.warn('Failed to load models:', error.message)
  }
}

const onModelChange = () => {
  if (selectedModel.value) {
    chatStore.setCurrentModel(selectedModel.value)
  }
}

const selectProvider = async (providerId) => {
  currentProvider.value = providerId
  connectionStatus.value = null
  availableModels.value = []
  selectedModel.value = ''

  const config = {}
  if (selectedProviderRequiresKey.value) {
    config.apiKey = apiKey.value
  } else {
    config.baseUrl = baseUrl.value
  }

  setProvider(providerId, config)
  emit('provider-changed', providerId)

  // Test connection and load models
  await testProviderConnection()
  await loadModels()
}

const onApiKeyChange = async () => {
  const config = { apiKey: apiKey.value }
  setProvider(currentProvider.value, config)
  connectionStatus.value = null
  availableModels.value = []

  // Debounce connection test and model loading
  if (apiKey.value.length > 10) {
    await testProviderConnection()
    await loadModels()
  }
}

const onBaseUrlChange = () => {
  const config = { baseUrl: baseUrl.value }
  setProvider(currentProvider.value, config)
  connectionStatus.value = null
}

const testProviderConnection = async () => {
  connectionStatus.value = { type: 'pending', message: 'Testing connection...' }
  try {
    const success = await testConnection()
    if (success) {
      connectionStatus.value = { type: 'success', message: 'Connected successfully' }
    } else {
      connectionStatus.value = { type: 'error', message: 'Connection failed' }
    }
  } catch (error) {
    connectionStatus.value = { type: 'error', message: error.message || 'Connection failed' }
  }
}

onMounted(() => {
  loadProviderSettings()

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
  const savedLineHeight = localStorage.getItem('messageLineHeight')
  if (savedLineHeight) {
    lineHeight.value = parseFloat(savedLineHeight)
    applyLineHeight(lineHeight.value)
  }
  const savedContentWidth = localStorage.getItem('contentWidth')
  if (savedContentWidth) {
    contentWidth.value = savedContentWidth
    applyContentWidth(savedContentWidth)
  }
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

const applyLineHeight = (height) => {
  document.documentElement.style.setProperty('--message-line-height', height.toString())
}

const updateLineHeight = () => {
  applyLineHeight(lineHeight.value)
  localStorage.setItem('messageLineHeight', lineHeight.value.toString())
}

const applyContentWidth = (width) => {
  const widthMap = {
    narrow: '600px',
    medium: '800px',
    wide: '1000px'
  }
  document.documentElement.style.setProperty('--content-max-width', widthMap[width] || '800px')
}

const setContentWidth = (width) => {
  contentWidth.value = width
  applyContentWidth(width)
  localStorage.setItem('contentWidth', width)
}

const close = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.settings-body {
  padding: 0.25rem 0;
}

.settings-container {
  display: flex;
  flex-direction: column;
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border-base);
  margin-bottom: 1rem;
}

.tab-button {
  flex: 1;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 0.95rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--color-text-muted);
  transition: all 0.15s ease;
}

.tab-button:hover {
  color: var(--color-text-base);
  background: var(--color-bg-hover);
}

.tab-button.active {
  color: var(--color-text-strong);
  border-bottom-color: var(--color-text-strong);
}

.tab-content-wrapper {
  position: relative;
  height: 420px;
  overflow-y: auto;
}

/* Tab transition animations */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
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

.provider-group {
  align-self: flex-start;
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

.api-key-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.api-key-input-wrapper {
  display: flex;
  gap: 0.5rem;
}

.api-key-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-base);
  font-size: 0.9rem;
  font-family: monospace;
}

.api-key-input:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.toggle-visibility-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
}

.toggle-visibility-btn:hover {
  background: var(--color-bg-hover);
}

.api-key-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.api-key-hint a {
  color: var(--color-text-link, #0066cc);
  text-decoration: none;
}

.api-key-hint a:hover {
  text-decoration: underline;
}

.model-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.model-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.model-select {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-base);
  font-size: 0.9rem;
  cursor: pointer;
  max-width: 100%;
}

.model-select:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.connection-status {
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
}

.connection-status.pending {
  color: var(--color-text-muted);
  background: var(--color-bg-hover);
}

.connection-status.success {
  color: #166534;
  background: #dcfce7;
}

.connection-status.error {
  color: #991b1b;
  background: #fee2e2;
}

.theme-button-light {
  background: #ffffff;
  color: #333333;
}

.theme-button-light:hover {
  background: #f5f5f5;
}

.theme-button-light.active {
  background: #f5f5f5;
  color: #1a1a1a;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.theme-button-sepia {
  background: #faf6eb;
  color: #4a3c31;
}

.theme-button-sepia:hover {
  background: #f5efe1;
}

.theme-button-sepia.active {
  background: #f5efe1;
  color: #2d2015;
  box-shadow: inset 0 0 0 1px rgba(92, 74, 61, 0.15);
}

.theme-button-dark {
  background: #2a2a2a;
  color: #d0d0d0;
}

.theme-button-dark:hover {
  background: #353535;
}

.theme-button-dark.active {
  background: #353535;
  color: #e0e0e0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
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
</style>
