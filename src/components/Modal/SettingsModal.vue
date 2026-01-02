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
        <button
          :class="['tab-button', { active: activeTab === 'account' }]"
          @click="activeTab = 'account'"
        >
          Account
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
        <!-- Provider -->
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
          <!-- API Key inputs -->
          <div v-if="selectedProviderRequiresKey">
            <ApiKeyInput
              v-if="currentProvider === 'google'"
              v-model="googleApiKeys"
              help-url="https://aistudio.google.com/apikey"
              @update:model-value="onGoogleApiKeysChange"
            />
            <ApiKeyInput
              v-else-if="currentProvider === 'cerebras'"
              v-model="cerebrasApiKeys"
              help-url="https://cloud.cerebras.ai/"
              @update:model-value="onCerebrasApiKeysChange"
            />
          </div>
          <!-- LM Studio URL -->
          <div v-if="!selectedProviderRequiresKey && currentProvider === 'lmstudio'" class="api-key-section">
            <input
              type="text"
              v-model="baseUrl"
              placeholder="http://localhost:1234"
              class="api-key-input"
              @input="onBaseUrlChange"
            />
          </div>
          <!-- Model selector -->
          <div v-if="availableModels.length > 0" class="model-section">
            <label class="model-label">Model</label>
            <select v-model="selectedModel" class="model-select" @change="onModelChange">
              <option v-for="model in availableModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
          <!-- Connection status -->
          <div v-if="connectionStatus" :class="['connection-status', connectionStatus.type]">
            {{ connectionStatus.message }}
          </div>
        </div>

        <!-- Extra Services -->
        <div class="setting-item setting-item-vertical">
          <label class="setting-label">Extra Services</label>
          <div class="button-group provider-group">
            <button
              :class="['toggle-button', { active: extraService === 'public-library' }]"
              @click="setExtraService('public-library')"
            >
              Bookstore
            </button>
            <button
              :class="['toggle-button', { active: extraService === 'web-proxy' }]"
              @click="setExtraService('web-proxy')"
            >
              Web Proxy
            </button>
            <button
              :class="['toggle-button', { active: extraService === 'reasoning-ai' }]"
              @click="setExtraService('reasoning-ai')"
            >
              Reasoning AI
            </button>
          </div>
          <div v-if="extraService === 'public-library'" class="api-key-section">
            <input
              type="text"
              v-model="bookApiUrl"
              placeholder="https://your-library.org"
              class="api-key-input"
              @input="onBookApiUrlChange"
            />
            <input
              type="password"
              v-model="bookApiKey"
              placeholder="API Key (optional)"
              class="api-key-input"
              @input="onBookApiKeyChange"
            />
          </div>
          <div v-if="extraService === 'web-proxy'" class="api-key-section">
            <input
              type="text"
              v-model="customFetchUrl"
              placeholder="https://your-service.com/api"
              class="api-key-input"
              @input="onCustomFetchUrlChange"
            />
          </div>
          <div v-if="extraService === 'reasoning-ai'" class="api-key-section">
            <input
              type="password"
              v-model="codeApiUrl"
              placeholder="https://your-reasoning-ai.com/api"
              class="api-key-input"
              @input="onCodeApiUrlChange"
            />
            <span class="setting-hint">Used when Thinking Mode is ON for enhanced reasoning</span>
          </div>
        </div>
          </div>

          <!-- Account Tab Content -->
          <div v-else-if="activeTab === 'account'" key="account" class="settings-body">
        <!-- Account Section -->
        <div class="setting-item setting-item-vertical">
          <label class="setting-label">Account</label>
          <div v-if="currentUser" class="account-info">
            <span class="user-email">{{ currentUser.email }}</span>
            <button class="sign-out-btn" @click="handleSignOut">
              Sign Out
            </button>
          </div>
          <div v-else class="account-info">
            <span class="user-email">Not signed in</span>
            <button class="sign-in-btn" @click="showLoginModal = true">
              Sign In
            </button>
          </div>
        </div>

        <!-- Backup & Restore Section -->
        <div class="setting-item setting-item-vertical backup-section">
          <label class="setting-label">Backup & Restore</label>
          <div class="backup-buttons">
            <button class="backup-btn" @click="downloadNotebooks">
              Download Notebooks
            </button>
            <label class="backup-btn restore-btn">
              Restore Notebooks
              <input
                type="file"
                accept=".json"
                @change="restoreNotebooks"
                class="file-input"
              />
            </label>
          </div>
          <div v-if="restoreStatus" :class="['connection-status', restoreStatus.type]">
            {{ restoreStatus.message }}
          </div>
        </div>

        <!-- Dev Toolbar Toggle -->
        <div class="setting-item dev-toolbar-section">
          <label class="setting-label">Dev Toolbar</label>
          <button
            :class="['toggle-button', { active: showDevToolbar }]"
            @click="handleToggleDevToolbar"
          >
            {{ showDevToolbar ? 'Visible' : 'Hidden' }}
          </button>
        </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Login Modal -->
    <LoginModal
      :visible="showLoginModal"
      @close="showLoginModal = false"
      @success="handleLoginSuccess"
    />
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import Modal from './Modal.vue'
import LoginModal from './LoginModal.vue'
import Button from '../Button.vue'
import ApiKeyInput from '../ApiKeyInput.vue'
import { onAuthChange, signOutUser } from '../../services/auth.js'
import {
  listProviders,
  getCurrentProviderId,
  getCurrentConfig,
  setProvider,
  testConnection,
  fetchModels,
  initProvider
} from '../../services/api.js'
import { useChatStore } from '../../stores/chat.js'
import { saveUserSettings, loadUserSettings } from '../../services/firestore.js'
import { invalidateFetchSettingsCache } from '../../services/urlFetcher.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'provider-changed'])

// Dev toolbar (injected from App.vue)
const showDevToolbar = inject('showDevToolbar', ref(false))
const toggleDevToolbar = inject('toggleDevToolbar', () => {})

const handleToggleDevToolbar = () => {
  toggleDevToolbar(!showDevToolbar.value)
}

// Auth state
const showLoginModal = ref(false)
const currentUser = ref(null)
let unsubscribeAuth = null

// LLM Provider state
const providers = ref([])
const currentProvider = ref('lmstudio')
const providerConfigs = ref({
  google: { apiKeys: [''] },
  cerebras: { apiKeys: [''] },
  lmstudio: { baseUrl: 'http://localhost:1234' }
})

// API keys arrays for multi-key input
const googleApiKeys = ref([''])
const cerebrasApiKeys = ref([''])
const connectionStatus = ref(null)
const restoreStatus = ref(null)
const availableModels = ref([])
const selectedModel = ref('')
const customFetchUrl = ref('')
const bookApiUrl = ref('')
const bookApiKey = ref('')
const extraService = ref('public-library')
const codeApiUrl = ref('')
const chatStore = useChatStore()

// Computed properties for current provider's config
const baseUrl = computed({
  get: () => providerConfigs.value[currentProvider.value]?.baseUrl || 'http://localhost:1234',
  set: (value) => {
    if (!providerConfigs.value[currentProvider.value]) {
      providerConfigs.value[currentProvider.value] = {}
    }
    providerConfigs.value[currentProvider.value].baseUrl = value
  }
})

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

  // Load all provider configs from settings (uses cache, no Firestore read)
  const settings = await loadUserSettings()
  if (settings?.providerConfigs) {
    // Merge saved configs with defaults
    providerConfigs.value = {
      ...providerConfigs.value,
      ...settings.providerConfigs
    }
  }

  // Also load current provider's config from the active config
  // But only load relevant keys for the current provider type
  const config = getCurrentConfig()
  const provider = providers.value.find(p => p.id === currentProvider.value)

  if (provider?.requiresApiKey) {
    if (config.apiKeys) {
      providerConfigs.value[currentProvider.value] = {
        ...providerConfigs.value[currentProvider.value],
        apiKeys: config.apiKeys
      }
    } else if (config.apiKey) {
      providerConfigs.value[currentProvider.value] = {
        ...providerConfigs.value[currentProvider.value],
        apiKey: config.apiKey
      }
    }
  }
  if (!provider?.requiresApiKey && config.baseUrl) {
    providerConfigs.value[currentProvider.value] = {
      ...providerConfigs.value[currentProvider.value],
      baseUrl: config.baseUrl
    }
  }

  // Load Google API keys into the reactive array
  const googleConfig = providerConfigs.value.google || {}
  if (googleConfig.apiKeys && googleConfig.apiKeys.length > 0) {
    googleApiKeys.value = [...googleConfig.apiKeys]
  } else if (googleConfig.apiKey) {
    // Migrate single key to array format
    googleApiKeys.value = [googleConfig.apiKey]
  } else {
    googleApiKeys.value = ['']
  }

  // Load Cerebras API keys into the reactive array
  const cerebrasConfig = providerConfigs.value.cerebras || {}
  if (cerebrasConfig.apiKeys && cerebrasConfig.apiKeys.length > 0) {
    cerebrasApiKeys.value = [...cerebrasConfig.apiKeys]
  } else if (cerebrasConfig.apiKey) {
    // Migrate single key to array format
    cerebrasApiKeys.value = [cerebrasConfig.apiKey]
  } else {
    cerebrasApiKeys.value = ['']
  }

  connectionStatus.value = null

  // Load available models and current selection
  // Prefer Firestore settings for cross-device sync, fallback to store
  const currentModels = settings?.currentModels || {}
  selectedModel.value = currentModels[currentProvider.value] || chatStore.currentModel || ''
  await loadModels()
}

const loadModels = async () => {
  try {
    availableModels.value = await fetchModels()

    // Get saved models per provider
    const settings = await loadUserSettings()
    const currentModels = settings?.currentModels || {}
    const savedModel = currentModels[currentProvider.value]

    // Validate selected model exists in available models
    const modelExists = availableModels.value.some(m => m.id === selectedModel.value)

    // If saved model exists and is valid, use it
    if (savedModel && availableModels.value.some(m => m.id === savedModel)) {
      selectedModel.value = savedModel
      chatStore.setCurrentModel(selectedModel.value)
    } else if (!selectedModel.value || !modelExists) {
      // If no model selected or selected model not available, select the first one
      if (availableModels.value.length > 0) {
        selectedModel.value = availableModels.value[0].id
        chatStore.setCurrentModel(selectedModel.value)
        // Save the initial selection for this provider
        const updatedModels = { ...currentModels, [currentProvider.value]: selectedModel.value }
        saveUserSettings({ currentModels: updatedModels })
      }
    } else if (selectedModel.value && modelExists) {
      // Sync Firestore model selection to store
      chatStore.setCurrentModel(selectedModel.value)
    }
  } catch (error) {
    // Don't clear models if we already have some - just show error
    if (availableModels.value.length === 0) {
      availableModels.value = []
    }
    // Show connection error for model loading failures
    connectionStatus.value = { type: 'error', message: `Failed to load models: ${error.message}` }
    console.warn('Failed to load models:', error.message)
  }
}

const onModelChange = async () => {
  if (selectedModel.value) {
    chatStore.setCurrentModel(selectedModel.value)
    // Save to Firestore per provider for cross-device sync
    const settings = await loadUserSettings()
    const currentModels = settings?.currentModels || {}
    currentModels[currentProvider.value] = selectedModel.value
    saveUserSettings({ currentModels })
  }
}

/**
 * Build clean provider configs with only relevant keys per provider
 */
const buildCleanProviderConfigs = () => {
  const clean = {}
  for (const p of providers.value) {
    const config = providerConfigs.value[p.id] || {}
    if (p.requiresApiKey) {
      // Use apiKeys array for providers that support multiple keys
      if (p.id === 'google') {
        const keys = googleApiKeys.value.filter(k => k.trim() !== '')
        clean[p.id] = { apiKeys: keys.length > 0 ? keys : [] }
      } else if (p.id === 'cerebras') {
        const keys = cerebrasApiKeys.value.filter(k => k.trim() !== '')
        clean[p.id] = { apiKeys: keys.length > 0 ? keys : [] }
      } else {
        clean[p.id] = { apiKey: config.apiKey || '' }
      }
    } else {
      clean[p.id] = { baseUrl: config.baseUrl || p.defaultBaseUrl || 'http://localhost:1234' }
    }
  }
  return clean
}

const selectProvider = async (providerId) => {
  currentProvider.value = providerId
  connectionStatus.value = null

  // Get config for the selected provider
  const providerConfig = providerConfigs.value[providerId] || {}
  const config = {}

  const provider = providers.value.find(p => p.id === providerId)
  if (provider?.requiresApiKey) {
    if (providerId === 'google') {
      const keys = googleApiKeys.value.filter(k => k.trim() !== '')
      config.apiKeys = keys
    } else if (providerId === 'cerebras') {
      const keys = cerebrasApiKeys.value.filter(k => k.trim() !== '')
      config.apiKeys = keys
    } else {
      config.apiKey = providerConfig.apiKey || ''
    }
  } else {
    config.baseUrl = providerConfig.baseUrl || 'http://localhost:1234'
  }

  // Set provider config BEFORE loading models
  setProvider(providerId, config)
  emit('provider-changed', providerId)

  // Save cleaned provider configs (only relevant keys per provider)
  saveUserSettings({ providerConfigs: buildCleanProviderConfigs() })

  // Test connection and load models
  await testProviderConnection()
  await loadModels()
}

const onBaseUrlChange = () => {
  const config = { baseUrl: baseUrl.value }
  setProvider(currentProvider.value, config)
  connectionStatus.value = null

  // Save cleaned provider configs
  saveUserSettings({ providerConfigs: buildCleanProviderConfigs() })
}

const onCustomFetchUrlChange = () => {
  saveUserSettings({ customFetchUrl: customFetchUrl.value.trim() })
  invalidateFetchSettingsCache()
}

const onBookApiUrlChange = () => {
  saveUserSettings({ bookApiUrl: bookApiUrl.value.trim() })
}

const onBookApiKeyChange = () => {
  saveUserSettings({ bookApiKey: bookApiKey.value.trim() })
}

const setExtraService = (service) => {
  extraService.value = service
  saveUserSettings({ extraService: service })
}

const onCodeApiUrlChange = () => {
  saveUserSettings({ codeApiUrl: codeApiUrl.value.trim() })
}

// API key change handlers
const onGoogleApiKeysChange = async (keys) => {
  googleApiKeys.value = keys
  const filteredKeys = keys.filter(k => k.trim() !== '')
  providerConfigs.value.google = { apiKeys: filteredKeys }
  setProvider('google', { apiKeys: filteredKeys })
  connectionStatus.value = null

  saveUserSettings({ providerConfigs: buildCleanProviderConfigs() })

  if (filteredKeys.some(k => k.length > 10)) {
    await testProviderConnection()
    await loadModels()
  }
}

const onCerebrasApiKeysChange = async (keys) => {
  cerebrasApiKeys.value = keys
  const filteredKeys = keys.filter(k => k.trim() !== '')
  providerConfigs.value.cerebras = { apiKeys: filteredKeys }
  setProvider('cerebras', { apiKeys: filteredKeys })
  connectionStatus.value = null

  saveUserSettings({ providerConfigs: buildCleanProviderConfigs() })

  if (filteredKeys.some(k => k.length > 10)) {
    await testProviderConnection()
    await loadModels()
  }
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

onMounted(async () => {
  // Listen for auth state changes
  unsubscribeAuth = onAuthChange((user) => {
    currentUser.value = user
  })

  // Load settings from cache (no Firestore read - already loaded in main.js)
  const settings = await loadUserSettings()

  if (settings) {
    // Sync local state with cached settings and apply them
    if (settings.theme) {
      currentTheme.value = settings.theme
      window.__setTheme?.(settings.theme)
    } else {
      currentTheme.value = window.__getTheme?.() || 'light'
    }

    if (settings.fontSize) {
      fontSize.value = settings.fontSize
      applyFontSize(settings.fontSize)
    }

    if (settings.fontFamily) {
      fontFamily.value = settings.fontFamily
      applyFontFamily(settings.fontFamily)
    }

    if (settings.lineHeight) {
      lineHeight.value = settings.lineHeight
      applyLineHeight(settings.lineHeight)
    }

    if (settings.contentWidth) {
      contentWidth.value = settings.contentWidth
      applyContentWidth(settings.contentWidth)
    }

    if (settings.customFetchUrl) {
      customFetchUrl.value = settings.customFetchUrl
    }

    if (settings.bookApiUrl) {
      bookApiUrl.value = settings.bookApiUrl
    }

    if (settings.bookApiKey) {
      bookApiKey.value = settings.bookApiKey
    }

    if (settings.extraService) {
      extraService.value = settings.extraService
    }

    if (settings.codeApiUrl) {
      codeApiUrl.value = settings.codeApiUrl
    }
  } else {
    currentTheme.value = window.__getTheme?.() || 'light'
  }

  // Initialize LLM provider (uses cache)
  await initProvider()
  loadProviderSettings()
})

onUnmounted(() => {
  if (unsubscribeAuth) {
    unsubscribeAuth()
  }
})

const handleSignOut = async () => {
  try {
    await signOutUser()
  } catch (error) {
    console.error('Sign out error:', error)
    alert('Failed to sign out. Please try again.')
  }
}

const handleLoginSuccess = () => {
  showLoginModal.value = false
}

const setTheme = (theme) => {
  currentTheme.value = theme
  window.__setTheme?.(theme)
  saveUserSettings({ theme })
}

const applyFontSize = (size) => {
  document.documentElement.style.setProperty('--message-font-size', `${size}px`)
}

const updateFontSize = () => {
  applyFontSize(fontSize.value)
  saveUserSettings({ fontSize: fontSize.value })
}

const applyFontFamily = (family) => {
  document.documentElement.style.setProperty('--message-font-family', family)
}

const setFontFamily = (family) => {
  fontFamily.value = family
  applyFontFamily(family)
  saveUserSettings({ fontFamily: family })
}

const applyLineHeight = (height) => {
  document.documentElement.style.setProperty('--message-line-height', height.toString())
}

const updateLineHeight = () => {
  applyLineHeight(lineHeight.value)
  saveUserSettings({ lineHeight: lineHeight.value })
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
  saveUserSettings({ contentWidth: width })
}

const close = () => {
  emit('update:modelValue', false)
}

const downloadNotebooks = () => {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chats: chatStore.chats,
    messagesById: chatStore.messagesById,
    vocabData: chatStore.vocabData
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notebooks-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const restoreNotebooks = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // Validate the data structure
    if (!data.chats || !Array.isArray(data.chats)) {
      throw new Error('Invalid file: missing chats array')
    }
    if (!data.messagesById || typeof data.messagesById !== 'object') {
      throw new Error('Invalid file: missing messagesById')
    }

    // Merge imported data with existing data
    // Add new messages (don't overwrite existing ones)
    for (const [id, message] of Object.entries(data.messagesById)) {
      if (!chatStore.messagesById[id]) {
        chatStore.messagesById[id] = message
      }
    }

    // Add new chats (don't overwrite existing ones with same ID)
    for (const chat of data.chats) {
      const existingChat = chatStore.chats.find(c => c.id === chat.id)
      if (!existingChat) {
        chatStore.chats.push(chat)
      }
    }

    // Restore vocabulary data (don't overwrite existing)
    if (data.vocabData && typeof data.vocabData === 'object') {
      for (const [id, vocabCard] of Object.entries(data.vocabData)) {
        if (!chatStore.vocabData[id]) {
          chatStore.vocabData[id] = vocabCard
        }
      }
    }

    // Persist the merged state
    chatStore._persistState()

    restoreStatus.value = { type: 'success', message: `Restored ${data.chats.length} notebook(s)` }
    setTimeout(() => { restoreStatus.value = null }, 3000)
  } catch (error) {
    restoreStatus.value = { type: 'error', message: error.message || 'Failed to restore notebooks' }
    setTimeout(() => { restoreStatus.value = null }, 3000)
  }

  // Reset file input
  event.target.value = ''
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
  overflow-x: hidden;
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

.setting-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
  margin-top: 0.25rem;
}

.model-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.code-api-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.backup-section {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.backup-buttons {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.backup-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-base);
  font-size: 0.9rem;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;
}

.backup-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
}

.restore-btn {
  display: inline-flex;
  align-items: center;
}

.file-input {
  display: none;
}

.fetch-section {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.dev-toolbar-section {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.dev-toolbar-section .toggle-button {
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
}

.account-section {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
}

.account-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
}

.user-email {
  font-size: 0.9rem;
  color: var(--color-text-base);
}

.sign-out-btn,
.sign-in-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  background: transparent;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.sign-out-btn:hover,
.sign-in-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.sign-in-btn {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.sign-in-btn:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}
</style>
