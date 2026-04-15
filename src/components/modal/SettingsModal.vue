<template>
  <Modal :visible="visible" title="Settings" size="large" @close="$emit('update:modelValue', false)">
    <div class="settings-container">
      <!-- Tabs -->
      <div class="settings-tabs">
        <button :class="['tab-button', { active: activeTab === 'theme' }]" @click="activeTab = 'theme'">Theme</button>
        <button :class="['tab-button', { active: activeTab === 'llm' }]" @click="activeTab = 'llm'">LLM</button>
        <button :class="['tab-button', { active: activeTab === 'account' }]" @click="activeTab = 'account'">Account</button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content-wrapper">
        <Transition name="tab-fade" mode="out-in">
          <!-- Theme Tab -->
          <div v-if="activeTab === 'theme'" key="theme" class="settings-body">
            <div class="setting-item">
              <label class="setting-label">Theme</label>
              <div class="button-group">
                <button :class="['toggle-button theme-button theme-button-light', { active: currentTheme === 'light' }]" @click="handleSetTheme('light')">Light</button>
                <button :class="['toggle-button theme-button theme-button-sepia', { active: currentTheme === 'sepia' }]" @click="handleSetTheme('sepia')">Sepia</button>
                <button :class="['toggle-button theme-button theme-button-dark', { active: currentTheme === 'dark' }]" @click="handleSetTheme('dark')">Dark</button>
              </div>
            </div>
            <div class="setting-item setting-item-vertical">
              <label class="setting-label">Font</label>
              <div class="font-grid">
                <button
                  v-for="font in fonts"
                  :key="font.value"
                  :class="['font-button', { active: fontFamily === font.value }]"
                  @click="handleSetFontFamily(font.value)"
                >
                  <span class="font-button-content">
                    <span class="font-preview" :style="{ fontFamily: font.value }">Aa</span>
                    <span class="font-name">{{ font.label }}</span>
                  </span>
                </button>
              </div>
            </div>
            <div class="setting-item">
              <label class="setting-label">Size</label>
              <div class="slider-wrapper">
                <button class="slider-label small" @click="fontSize = Math.max(14, fontSize - 1); handleFontSize()">A</button>
                <input type="range" v-model.number="fontSize" min="14" max="24" step="1" class="font-slider" @input="handleFontSize" />
                <button class="slider-label large" @click="fontSize = Math.min(24, fontSize + 1); handleFontSize()">A</button>
                <span class="font-size-value">{{ fontSize }}</span>
              </div>
            </div>
            <div class="setting-item">
              <label class="setting-label">Line Height</label>
              <div class="slider-wrapper">
                <button class="slider-label small" @click="lineHeight = Math.max(1.4, Math.round((lineHeight - 0.1) * 10) / 10); handleLineHeight()">≡</button>
                <input type="range" v-model.number="lineHeight" min="1.4" max="2.2" step="0.1" class="font-slider" @input="handleLineHeight" />
                <button class="slider-label large" @click="lineHeight = Math.min(2.2, Math.round((lineHeight + 0.1) * 10) / 10); handleLineHeight()">≡</button>
                <span class="font-size-value">{{ lineHeight }}</span>
              </div>
            </div>
            <div class="setting-item">
              <label class="setting-label">Width</label>
              <div class="button-group">
                <button v-for="option in widthOptions" :key="option.value" :class="['toggle-button', { active: contentWidth === option.value }]" @click="handleSetContentWidth(option.value)">{{ option.label }}</button>
              </div>
            </div>
          </div>

          <!-- LLM Tab -->
          <div v-else-if="activeTab === 'llm'" key="llm" class="settings-body">
            <div class="provider-tabs">
              <button v-for="provider in providers" :key="provider.id" :class="['provider-tab', { active: currentProvider === provider.id }]" @click="handleSelectProvider(provider.id)">{{ provider.name }}</button>
            </div>
            <div class="setting-item setting-item-vertical">
              <div>
                <label class="setting-label">Model</label>
                <select v-model="currentModels[currentProvider]" @change="handleModelChange" class="model-select" :disabled="isLoadingModels">
                  <option v-if="!providerModels[currentProvider]?.length" value="">{{ isLoadingModels ? 'Loading...' : 'No models available' }}</option>
                  <option v-for="model in providerModels[currentProvider] || []" :key="model.id" :value="model.id">{{ model.name }}</option>
                </select>
              </div>
              <div v-if="selectedProviderRequiresKey">
                <ApiKeyInput v-if="currentProvider === 'google'" v-model="googleApiKeys" help-url="https://aistudio.google.com/apikey" @update:model-value="handleGoogleApiKeysChange" />
                <ApiKeyInput v-else-if="currentProvider === 'cerebras'" v-model="cerebrasApiKeys" help-url="https://cloud.cerebras.ai/" @update:model-value="handleCerebrasApiKeysChange" />
              </div>
              <div v-if="!selectedProviderRequiresKey && currentProvider === 'lmstudio'" class="api-key-section">
                <input type="text" v-model="baseUrl" placeholder="http://localhost:1234" class="api-key-input" @input="handleBaseUrlChange" />
              </div>
              <div v-if="connectionStatus" :class="['connection-status', connectionStatus.type]">{{ connectionStatus.message }}</div>
            </div>
            <div class="setting-item setting-item-vertical">
              <label class="setting-label">Extra Services</label>
              <div class="button-group provider-group">
                <button :class="['toggle-button', { active: extraService === 'public-library' }]" @click="handleSetExtraService('public-library')">Bookstore</button>
                <button :class="['toggle-button', { active: extraService === 'web-proxy' }]" @click="handleSetExtraService('web-proxy')">Web Proxy</button>
              </div>
              <div v-if="extraService === 'public-library'" class="api-key-section">
                <input type="text" v-model="bookApiUrl" placeholder="https://your-library.org" class="api-key-input" @input="handleBookApiUrlChange" />
                <input type="password" v-model="bookApiKey" placeholder="API Key (optional)" class="api-key-input" @input="handleBookApiKeyChange" />
              </div>
              <div v-if="extraService === 'web-proxy'" class="api-key-section">
                <input type="text" v-model="customFetchUrl" placeholder="https://your-service.com/api" class="api-key-input" @input="handleCustomFetchUrlChange" />
              </div>
            </div>
          </div>

          <!-- Account Tab -->
          <div v-else-if="activeTab === 'account'" key="account" class="settings-body">
            <div class="setting-item setting-item-vertical">
              <label class="setting-label">Account</label>
              <div v-if="currentUser" class="account-info">
                <span class="user-email">{{ currentUser.email }}</span>
                <button class="sign-out-btn" @click="handleSignOut">Sign Out</button>
              </div>
              <div v-else class="account-info">
                <span class="user-email">Not signed in</span>
                <button class="sign-in-btn" @click="showLoginModal = true">Sign In</button>
              </div>
            </div>
            <div class="setting-item setting-item-vertical backup-section">
              <label class="setting-label">Backup & Restore</label>
              <div class="backup-buttons">
                <button class="backup-btn" @click="downloadNotebooks">Download Notebooks</button>
                <label class="backup-btn restore-btn">
                  Restore Notebooks
                  <input type="file" accept=".json" @change="restoreNotebooks" class="file-input" />
                </label>
              </div>
              <div v-if="restoreStatus" :class="['connection-status', restoreStatus.type]">{{ restoreStatus.message }}</div>
            </div>
            <div class="setting-item setting-item-vertical sync-section">
              <label class="setting-label">Cloud Sync</label>
              <button class="sync-btn" :disabled="syncStore.isSyncing" @click="handleSyncAll">
                <span v-if="syncStore.isSyncing" class="sync-spinner"></span>
                <span>{{ syncStore.isSyncing ? 'Syncing...' : 'Download All Data' }}</span>
              </button>
              <span class="setting-hint">Download all messages from cloud for offline use</span>
              <div v-if="syncStore.syncStatus && syncStore.syncMessage" :class="['connection-status', syncStore.syncStatus]">{{ syncStore.syncMessage }}</div>
            </div>
            <div class="setting-item dev-toolbar-section">
              <label class="setting-label">Dev Toolbar</label>
              <button :class="['toggle-button', { active: devToolbarVisible }]" @click="handleToggleDevToolbar">{{ devToolbarVisible ? 'Visible' : 'Hidden' }}</button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <LoginModal :visible="showLoginModal" @close="showLoginModal = false" @success="handleLoginSuccess" />
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import Modal from './Modal.vue'
import LoginModal from './LoginModal.vue'
import ApiKeyInput from '../ApiKeyInput.vue'
import { onAuthChange, signOutUser } from '@/services/auth'
import { lmService } from '@/services/llm/LMService'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'
import { useVocabStore } from '@/stores/vocab'
import { useSyncStore } from '@/stores/sync'
import { Settings, setTheme, getTheme, applyFontSize, applyFontFamily, applyLineHeight, applyContentWidth } from '@/services/settings'
import type { Theme, ContentWidth, ConnectionStatus } from '@/types/settings'

const props = defineProps<{ modelValue?: boolean }>()
const visible = computed(() => props.modelValue ?? false)
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

// Dev toolbar (injected from AppLayout)
const devToolbarVisible = inject('showDevToolbar', ref(false))
const toggleDevToolbar = inject<(val: boolean) => void>('toggleDevToolbar', () => {})

// Stores
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()
const vocabStore = useVocabStore()
const syncStore = useSyncStore()

// Auth state
const showLoginModal = ref(false)
const currentUser = ref<{ email?: string } | null>(null)
let unsubscribeAuth: (() => void) | null = null

// Tab state
const activeTab = ref('theme')

// Theme state
const currentTheme = ref<Theme>('light')
const fontSize = ref(18)
const fontFamily = ref('Georgia, serif')
const lineHeight = ref(1.7)
const contentWidth = ref<ContentWidth>('medium')

const fonts = [
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Charter', value: "'Charis SIL', Charter, Georgia, serif" },
  { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
]

const widthOptions = [
  { label: 'Narrow', value: 'narrow' as ContentWidth },
  { label: 'Medium', value: 'medium' as ContentWidth },
  { label: 'Wide', value: 'wide' as ContentWidth },
]

// LLM state
const providers = ref<Array<{ id: string; name: string; category: string; requiresApiKey: boolean; supportsStreaming: boolean }>>([])
const currentProvider = ref('lmstudio')
const providerConfigs = ref<Record<string, any>>({
  google: { apiKeys: [''] },
  cerebras: { apiKeys: [''] },
  lmstudio: { baseUrl: 'http://localhost:1234' },
})
const providerModels = ref<Record<string, Array<{ id: string; name: string }>>>({})
const currentModels = ref<Record<string, string>>({})
const isLoadingModels = ref(false)
const googleApiKeys = ref([''])
const cerebrasApiKeys = ref([''])
const connectionStatus = ref<ConnectionStatus | null>(null)
const restoreStatus = ref<ConnectionStatus | null>(null)
const customFetchUrl = ref('')
const bookApiUrl = ref('')
const bookApiKey = ref('')
const extraService = ref('public-library')

const baseUrl = computed({
  get: () => providerConfigs.value[currentProvider.value]?.baseUrl || 'http://localhost:1234',
  set: (value: string) => {
    if (!providerConfigs.value[currentProvider.value]) providerConfigs.value[currentProvider.value] = {}
    providerConfigs.value[currentProvider.value].baseUrl = value
  },
})

const selectedProviderRequiresKey = computed(() => {
  const provider = providers.value.find(p => p.id === currentProvider.value)
  return provider?.requiresApiKey ?? false
})

// Watch modal open to reload provider settings
watch(() => props.modelValue, (v) => {
  if (v) loadProviderSettings()
})

// ── Theme handlers ──

function handleSetTheme(theme: Theme) {
  currentTheme.value = theme
  setTheme(theme)
  Settings.set({ theme })
}

function handleSetFontFamily(family: string) {
  fontFamily.value = family
  applyFontFamily(family)
  Settings.set({ fontFamily: family })
}

function handleFontSize() {
  applyFontSize(fontSize.value)
  Settings.set({ fontSize: fontSize.value })
}

function handleLineHeight() {
  applyLineHeight(lineHeight.value)
  Settings.set({ lineHeight: lineHeight.value })
}

function handleSetContentWidth(width: ContentWidth) {
  contentWidth.value = width
  applyContentWidth(width)
  Settings.set({ contentWidth: width })
}

// ── LLM handlers ──

function getCachedModels(providerId: string): Array<{ id: string; name: string }> | null {
  try {
    const cached = localStorage.getItem(`llm-models-cache-${providerId}`)
    if (cached) {
      const data = JSON.parse(cached)
      return data.models || null
    }
  } catch { /* ignore */ }
  return null
}

function setCachedModels(providerId: string, models: Array<{ id: string; name: string }>) {
  try {
    localStorage.setItem(`llm-models-cache-${providerId}`, JSON.stringify({ models, timestamp: Date.now() }))
  } catch (e) {
    console.warn('Failed to cache models:', e)
  }
}

async function loadProviderSettings() {
  providers.value = lmService.listProviders().filter(p => p.id !== 'codeapi')

  const settings = Settings.getAll()
  if (settings.providerConfigs) {
    providerConfigs.value = { ...providerConfigs.value, ...settings.providerConfigs as Record<string, any> }
  }
  if (settings.currentModels) {
    currentModels.value = { ...(settings.currentModels as Record<string, string>) }
  }

  // Load API keys
  const googleConfig = providerConfigs.value.google || {}
  if (googleConfig.apiKeys?.length) {
    googleApiKeys.value = [...googleConfig.apiKeys]
  } else if (googleConfig.apiKey) {
    googleApiKeys.value = [googleConfig.apiKey]
  } else {
    googleApiKeys.value = ['']
  }

  const cerebrasConfig = providerConfigs.value.cerebras || {}
  if (cerebrasConfig.apiKeys?.length) {
    cerebrasApiKeys.value = [...cerebrasConfig.apiKeys]
  } else if (cerebrasConfig.apiKey) {
    cerebrasApiKeys.value = [cerebrasConfig.apiKey]
  } else {
    cerebrasApiKeys.value = ['']
  }

  connectionStatus.value = null

  // Load cached models
  for (const provider of providers.value) {
    const cached = getCachedModels(provider.id)
    if (cached) {
      providerModels.value[provider.id] = cached
      if (!currentModels.value[provider.id] && cached.length > 0) {
        currentModels.value[provider.id] = cached[0].id
      }
    }
  }

  await loadModelsForProvider(currentProvider.value)
}

function buildCleanProviderConfigs(): Record<string, any> {
  const clean: Record<string, any> = {}
  for (const p of providers.value) {
    const config = providerConfigs.value[p.id] || {}
    if (p.requiresApiKey) {
      if (p.id === 'google') {
        const keys = googleApiKeys.value.filter((k: string) => k.trim() !== '')
        clean[p.id] = { apiKeys: keys.length > 0 ? keys : [] }
      } else if (p.id === 'cerebras') {
        const keys = cerebrasApiKeys.value.filter((k: string) => k.trim() !== '')
        clean[p.id] = { apiKeys: keys.length > 0 ? keys : [] }
      } else {
        clean[p.id] = { apiKey: config.apiKey || '' }
      }
    } else {
      clean[p.id] = { baseUrl: config.baseUrl || 'http://localhost:1234' }
    }
  }
  return clean
}

async function handleSelectProvider(providerId: string) {
  currentProvider.value = providerId
  await loadModelsForProvider(providerId)
}

async function loadModelsForProvider(providerId: string, forceRefresh = false) {
  const provider = lmService.getProvider(providerId)
  if (!provider) return

  if (!forceRefresh) {
    const cached = getCachedModels(providerId)
    if (cached) {
      providerModels.value[providerId] = cached
      if (!currentModels.value[providerId] && cached.length > 0) {
        currentModels.value[providerId] = cached[0].id
        saveCurrentModels()
      }
      return
    }
  }

  isLoadingModels.value = true
  try {
    const models = await provider.listModels()
    providerModels.value[providerId] = models
    setCachedModels(providerId, models)
    if (!currentModels.value[providerId] && models.length > 0) {
      currentModels.value[providerId] = models[0].id
      saveCurrentModels()
    }
  } catch (error: any) {
    console.warn(`Failed to load models for ${providerId}:`, error.message)
    providerModels.value[providerId] = []
  } finally {
    isLoadingModels.value = false
  }
}

function saveCurrentModels() {
  Settings.set({ currentModels: { ...currentModels.value } })
}

function handleModelChange() {
  saveCurrentModels()
}

async function handleBaseUrlChange() {
  connectionStatus.value = null
  Settings.set({ providerConfigs: buildCleanProviderConfigs() })
  if (currentProvider.value === 'lmstudio') {
    await loadModelsForProvider('lmstudio', true)
  }
}

function handleCustomFetchUrlChange() {
  Settings.set({ customFetchUrl: customFetchUrl.value })
}

function handleBookApiUrlChange() {
  Settings.set({ bookApiUrl: bookApiUrl.value })
}

function handleBookApiKeyChange() {
  Settings.set({ bookApiKey: bookApiKey.value })
}

function handleSetExtraService(service: string) {
  extraService.value = service
  Settings.set({ extraService: service })
}

async function handleGoogleApiKeysChange(keys: string[]) {
  googleApiKeys.value = keys
  const filteredKeys = keys.filter(k => k.trim() !== '')
  providerConfigs.value.google = { apiKeys: filteredKeys }
  Settings.set({ providerConfigs: buildCleanProviderConfigs() })
  if (currentProvider.value === 'google') {
    await loadModelsForProvider('google', true)
  }
}

async function handleCerebrasApiKeysChange(keys: string[]) {
  cerebrasApiKeys.value = keys
  const filteredKeys = keys.filter(k => k.trim() !== '')
  providerConfigs.value.cerebras = { apiKeys: filteredKeys }
  Settings.set({ providerConfigs: buildCleanProviderConfigs() })
  if (currentProvider.value === 'cerebras') {
    await loadModelsForProvider('cerebras', true)
  }
}

// ── Account handlers ──

async function handleSignOut() {
  try {
    await signOutUser()
  } catch (error) {
    console.error('Sign out error:', error)
    alert('Failed to sign out. Please try again.')
  }
}

function handleLoginSuccess() {
  showLoginModal.value = false
}

function downloadNotebooks() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chats: notebookStore.chats,
    messagesById: treeStore.messagesById,
    vocabData: vocabStore.vocabData,
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

async function restoreNotebooks(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    console.log('[Restore] File structure:', Object.keys(data))

    let chats: any[] = []
    let messagesById: Record<string, any> = {}
    let vocabData: Record<string, any> = {}

    if (data.chats && Array.isArray(data.chats)) {
      chats = data.chats
      messagesById = data.messagesById || {}
      vocabData = data.vocabData || {}
    } else {
      throw new Error(`Invalid file format. Expected 'chats' array but found: ${Object.keys(data).join(', ')}`)
    }

    if (!Array.isArray(chats) || chats.length === 0) {
      throw new Error('Invalid file: no chats found')
    }

    // Merge messages (don't overwrite existing)
    for (const [id, message] of Object.entries(messagesById)) {
      if (!treeStore.messagesById[id]) {
        treeStore.messagesById[id] = message as any
      }
    }

    // Merge chats (don't overwrite existing)
    let addedCount = 0
    for (const chat of chats) {
      const exists = notebookStore.chats.some(c => c.id === chat.id)
      if (!exists) {
        notebookStore.chats.push(chat)
        addedCount++
      }
    }

    // Merge vocab (don't overwrite existing)
    if (vocabData && typeof vocabData === 'object') {
      for (const [id, card] of Object.entries(vocabData)) {
        if (!vocabStore.vocabData[id]) {
          vocabStore.vocabData[id] = card as any
        }
      }
    }

    await syncStore.persistAll()

    restoreStatus.value = { type: 'success', message: `Restored ${addedCount} notebook(s)` }
    setTimeout(() => { restoreStatus.value = null }, 3000)
  } catch (error: any) {
    console.error('[Restore] Error:', error)
    restoreStatus.value = { type: 'error', message: error.message || 'Failed to restore notebooks' }
    setTimeout(() => { restoreStatus.value = null }, 3000)
  }

  input.value = ''
}

async function handleSyncAll() {
  // TODO: implement downloadAllData when cloud sync is fully ported
}

function handleToggleDevToolbar() {
  toggleDevToolbar(!devToolbarVisible.value)
}

// ── Lifecycle ──

onMounted(async () => {
  unsubscribeAuth = onAuthChange((user: any) => {
    currentUser.value = user
  })

  const settings = Settings.getAll()

  if (settings.theme) {
    currentTheme.value = settings.theme as Theme
    setTheme(settings.theme as Theme)
  } else {
    currentTheme.value = getTheme() as Theme
  }

  if (settings.fontSize) {
    fontSize.value = settings.fontSize as number
    applyFontSize(settings.fontSize as number)
  }
  if (settings.fontFamily) {
    fontFamily.value = settings.fontFamily as string
    applyFontFamily(settings.fontFamily as string)
  }
  if (settings.lineHeight) {
    lineHeight.value = settings.lineHeight as number
    applyLineHeight(settings.lineHeight as number)
  }
  if (settings.contentWidth) {
    contentWidth.value = settings.contentWidth as ContentWidth
    applyContentWidth(settings.contentWidth as string)
  }
  if (settings.customFetchUrl) customFetchUrl.value = settings.customFetchUrl as string
  if (settings.bookApiUrl) bookApiUrl.value = settings.bookApiUrl as string
  if (settings.bookApiKey) bookApiKey.value = settings.bookApiKey as string
  if (settings.extraService) extraService.value = settings.extraService as string

  loadProviderSettings()
})

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth()
})
</script>

<style scoped>
.settings-body { padding: 0.25rem 0; }
.settings-container { display: flex; flex-direction: column; }
.settings-tabs { display: flex; border-bottom: 1px solid var(--color-border-base); margin-bottom: 1rem; }
.tab-button { flex: 1; padding: 0.75rem 1rem; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.95rem; font-family: system-ui, -apple-system, sans-serif; color: var(--color-text-muted); transition: all 0.15s ease; }
.tab-button:hover { color: var(--color-text-base); background: var(--color-bg-hover); }
.tab-button.active { color: var(--color-text-strong); border-bottom-color: var(--color-text-strong); }
.tab-content-wrapper { position: relative; height: 420px; overflow-y: auto; overflow-x: hidden; }
.tab-fade-enter-active, .tab-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tab-fade-enter-from { opacity: 0; transform: translateX(10px); }
.tab-fade-leave-to { opacity: 0; transform: translateX(-10px); }
.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.setting-item-vertical { flex-direction: column; align-items: stretch; gap: 0.75rem; }
.setting-item + .setting-item { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-subtle); }
.setting-label { font-size: 0.95rem; color: var(--color-text-base); font-family: 'Georgia', serif; flex-shrink: 0; }
.button-group { display: flex; border: 1px solid var(--color-border-base); border-radius: 4px; overflow: hidden; }
.provider-group { align-self: flex-start; }
.toggle-button { padding: 0.4rem 1rem; background: var(--color-bg-elevated); border: none; cursor: pointer; font-size: 0.9rem; color: var(--color-text-muted); font-family: system-ui, -apple-system, sans-serif; transition: all 0.15s ease; border-right: 1px solid var(--color-border-base); }
.toggle-button:last-child { border-right: none; }
.toggle-button:hover { background: var(--color-bg-hover); }
.toggle-button.active { background: var(--color-bg-active); color: var(--color-text-strong); }

/* Theme buttons */
.theme-button-light { background: #ffffff; color: #333333; }
.theme-button-light:hover { background: #f5f5f5; }
.theme-button-light.active { background: #f5f5f5; color: #1a1a1a; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1); }
.theme-button-sepia { background: #faf6eb; color: #4a3c31; }
.theme-button-sepia:hover { background: #f5efe1; }
.theme-button-sepia.active { background: #f5efe1; color: #2d2015; box-shadow: inset 0 0 0 1px rgba(92,74,61,0.15); }
.theme-button-dark { background: #2a2a2a; color: #d0d0d0; }
.theme-button-dark:hover { background: #353535; }
.theme-button-dark.active { background: #353535; color: #e0e0e0; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }

.font-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
.font-button { display: flex; flex-direction: column; padding: 0.5rem; width: 100%; background: var(--color-bg-elevated); border: 1px solid var(--color-border-base); border-radius: 4px; cursor: pointer; transition: all 0.15s; }
.font-button:hover { background: var(--color-bg-hover); }
.font-button.active { background: var(--color-bg-active); border-color: var(--color-text-muted); }
.font-button-content { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.font-preview { font-size: 1.25rem; color: var(--color-text-strong); line-height: 1; }
.font-name { font-size: 0.7rem; color: var(--color-text-muted); font-family: system-ui, -apple-system, sans-serif; }

.slider-wrapper { display: flex; align-items: center; gap: 0.6rem; }
.slider-label { color: var(--color-text-muted); font-family: 'Georgia', serif; background: none; border: none; cursor: pointer; padding: 0 0.15rem; transition: color 0.15s; }
.slider-label:hover { color: var(--color-text-strong); }
.slider-label.small { font-size: 0.75rem; }
.slider-label.large { font-size: 1.1rem; }
.font-slider { width: 100px; height: 4px; appearance: none; background: var(--color-border-base); border-radius: 2px; cursor: pointer; }
.font-slider::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong); border-radius: 50%; cursor: pointer; }
.font-slider::-moz-range-thumb { width: 14px; height: 14px; background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong); border-radius: 50%; cursor: pointer; }
.font-size-value { min-width: 24px; font-size: 0.85rem; color: var(--color-text-muted); font-family: system-ui, -apple-system, sans-serif; text-align: right; }

.provider-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border-base); }
.provider-tab { padding: 0.5rem 1rem; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.9rem; font-family: system-ui, -apple-system, sans-serif; color: var(--color-text-muted); transition: all 0.15s ease; }
.provider-tab:hover { color: var(--color-text-base); }
.provider-tab.active { color: var(--color-text-strong); border-bottom-color: var(--color-text-strong); }

.model-select { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-base); border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem; cursor: pointer; max-width: 100%; }
.model-select:focus { outline: none; border-color: var(--color-border-strong); }

.api-key-section { display: flex; flex-direction: column; gap: 0.5rem; }
.api-key-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-base); border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem; font-family: monospace; }
.api-key-input:focus { outline: none; border-color: var(--color-border-strong); }

.setting-hint { font-size: 0.75rem; color: var(--color-text-muted); font-family: system-ui, -apple-system, sans-serif; margin-top: 0.25rem; }

.connection-status { font-size: 0.85rem; padding: 0.4rem 0.6rem; border-radius: 4px; }
.connection-status.pending { color: var(--color-text-muted); background: var(--color-bg-hover); }
.connection-status.success { color: #166534; background: #dcfce7; }
.connection-status.error { color: #991b1b; background: #fee2e2; }

.backup-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-subtle); }
.backup-buttons { display: flex; justify-content: center; gap: 0.75rem; }
.backup-btn { padding: 0.5rem 1rem; border: 1px solid var(--color-border-base); border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem; font-family: system-ui, -apple-system, sans-serif; cursor: pointer; transition: all 0.15s ease; }
.backup-btn:hover { background: var(--color-bg-hover); border-color: var(--color-border-strong); }
.restore-btn { display: inline-flex; align-items: center; }
.file-input { display: none; }

.sync-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-subtle); }
.sync-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.625rem 1rem; border: 1px solid var(--color-border-base); border-radius: 6px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem; font-family: system-ui, -apple-system, sans-serif; cursor: pointer; transition: all 0.15s ease; }
.sync-btn:hover:not(:disabled) { background: var(--color-bg-hover); border-color: var(--color-border-strong); }
.sync-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.sync-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.1); border-radius: 50%; border-top-color: currentColor; animation: spin 0.8s linear infinite; }

.dev-toolbar-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-subtle); }
.dev-toolbar-section .toggle-button { border: 1px solid var(--color-border-base); border-radius: 4px; }

.account-info { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 6px; }
.user-email { font-size: 0.9rem; color: var(--color-text-base); }
.sign-out-btn, .sign-in-btn { padding: 0.375rem 0.75rem; font-size: 0.875rem; background: transparent; border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
.sign-out-btn:hover, .sign-in-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); border-color: var(--color-border-accent); }
.sign-in-btn { background: var(--color-accent); color: white; border-color: var(--color-accent); }
.sign-in-btn:hover { background: var(--color-accent-hover); border-color: var(--color-accent-hover); }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
