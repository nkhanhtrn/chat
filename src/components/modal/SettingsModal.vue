<template>
  <Modal :visible="visible" title="Settings" size="large" :content-style="{ maxWidth: '460px' }" @close="$emit('update:modelValue', false)">
    <div class="settings-container">
      <!-- Tabs -->
      <div class="settings-tabs">
        <button :class="['tab-button', { active: activeTab === 'theme' }]" @click="activeTab = 'theme'">Theme</button>
        <button :class="['tab-button', { active: activeTab === 'llm' }]" @click="activeTab = 'llm'">LLM</button>
        <button :class="['tab-button', { active: activeTab === 'account' }]" @click="activeTab = 'account'">Account</button>
        <button :class="['tab-button', { active: activeTab === 'debug' }]" @click="activeTab = 'debug'">Debug</button>
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
            <div class="setting-item setting-item-vertical">
              <label class="setting-label">OpenCode API URL</label>
              <input type="text" v-model="codeApiUrl" placeholder="http://localhost:4096" class="api-key-input" @input="handleCodeApiUrlChange" />
              <span class="setting-hint">URL of the opencode server (see <code>opencode serve</code>)</span>
            </div>
            <div class="setting-item setting-item-vertical">
              <label class="setting-label">OpenCode Zen API Key</label>
              <input type="password" v-model="opencodeApiKey" placeholder="opencode-..." class="api-key-input" @input="handleOpencodeApiKeyChange" />
              <span class="setting-hint">Fallback to <code>deepseek-v4-flash-free</code> on <a href="https://opencode.ai/zen" target="_blank" rel="noopener">OpenCode Zen</a> when the server is unavailable</span>
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
            <div class="setting-item setting-item-vertical tools-section">
              <label class="setting-label">Studio Projects</label>
              <div class="backup-buttons">
                <button class="backup-btn" @click="downloadStudio">Download Studio</button>
                <label class="backup-btn restore-btn">
                  Restore Studio
                  <input type="file" accept=".json" @change="restoreStudio" class="file-input" />
                </label>
              </div>
              <div v-if="toolsRestoreStatus" :class="['connection-status', toolsRestoreStatus.type]">{{ toolsRestoreStatus.message }}</div>
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
          </div>

          <!-- Debug Tab -->
          <DebugPanel v-else-if="activeTab === 'debug'" key="debug" />
        </Transition>
      </div>
    </div>

    <LoginModal :visible="showLoginModal" @close="showLoginModal = false" @success="handleLoginSuccess" />
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Modal from './Modal.vue'
import LoginModal from './LoginModal.vue'
import DebugPanel from './DebugPanel.vue'
import { onAuthChange, signOutUser } from '@/services/auth'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'
import { useVocabStore } from '@/stores/vocab'
import { useSyncStore } from '@/stores/sync'
import { useGlobalToolStore } from '@/stores/globalTool'
import { useProjectStore } from '@/stores/project'
import { Settings, setTheme, getTheme, applyFontSize, applyFontFamily, applyLineHeight, applyContentWidth } from '@/services/settings'
import type { Theme, ContentWidth, ConnectionStatus } from '@/types/settings'

const props = defineProps<{ modelValue?: boolean }>()
const visible = computed(() => props.modelValue ?? false)
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

// Stores
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()
const vocabStore = useVocabStore()
const syncStore = useSyncStore()
const globalToolStore = useGlobalToolStore()
const projectStore = useProjectStore()

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

const restoreStatus = ref<ConnectionStatus | null>(null)
const toolsRestoreStatus = ref<ConnectionStatus | null>(null)
const codeApiUrl = ref('')
const opencodeApiKey = ref('')
const customFetchUrl = ref('')
const bookApiUrl = ref('')
const bookApiKey = ref('')
const extraService = ref('public-library')

// Watch modal open to reload settings

watch(() => props.modelValue, (v) => {
  if (v) loadSettings()
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

function handleCodeApiUrlChange() {
  Settings.set({ codeApiUrl: codeApiUrl.value })
}

function handleOpencodeApiKeyChange() {
  Settings.set({ opencodeApiKey: opencodeApiKey.value })
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

function loadSettings() {
  const settings = Settings.getAll()
  if (settings.codeApiUrl) codeApiUrl.value = settings.codeApiUrl as string
  if (settings.opencodeApiKey) opencodeApiKey.value = settings.opencodeApiKey as string
  if (settings.customFetchUrl) customFetchUrl.value = settings.customFetchUrl as string
  if (settings.bookApiUrl) bookApiUrl.value = settings.bookApiUrl as string
  if (settings.bookApiKey) bookApiKey.value = settings.bookApiKey as string
  if (settings.extraService) extraService.value = settings.extraService as string
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

function downloadStudio() {
  const TOOL_STATE_PREFIX = 'tool-state-'
  const projectData = projectStore.projects.map(project => {
    const subprojects = project.subprojects.map(sub => {
      const dataKey = `${project.id}-${sub.id}`
      const wins = projectStore.windows.get(dataKey) ?? []
      const sessionId = localStorage.getItem(`project-session-${dataKey}`) ?? null
      const toolStates: Record<string, Record<string, unknown>> = {}
      for (const w of wins) {
        const raw = localStorage.getItem(`${TOOL_STATE_PREFIX}${dataKey}-${w.id}`)
        if (raw) {
          try { toolStates[w.id] = JSON.parse(raw) } catch { /* skip */ }
        }
      }
      return { dataKey, windows: wins, sessionId, toolStates }
    })
    return { project, subprojects }
  })

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: globalToolStore.templates,
    projects: projectData,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `studio-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function restoreStudio(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (data.version !== 1) {
      throw new Error('Unsupported backup version')
    }

    const TOOL_STATE_PREFIX = 'tool-state-'
    let toolCount = 0
    let projectCount = 0

    if (data.templates && Array.isArray(data.templates)) {
      const existingIds = new Set(globalToolStore.templates.map(t => t.id))
      for (const tpl of data.templates) {
        if (!existingIds.has(tpl.id)) {
          globalToolStore.templates.push(tpl)
          toolCount++
        }
      }
    }

    if (data.projects && Array.isArray(data.projects)) {
      const existingProjectIds = new Set(projectStore.projects.map(p => p.id))
      for (const pd of data.projects) {
        if (!existingProjectIds.has(pd.project.id)) {
          projectStore.projects.push(pd.project)
          projectCount++
          for (const sub of pd.subprojects ?? []) {
            projectStore.windows.set(sub.dataKey, sub.windows ?? [])
            if (sub.sessionId) {
              localStorage.setItem(`project-session-${sub.dataKey}`, sub.sessionId)
            }
            if (sub.toolStates && typeof sub.toolStates === 'object') {
              for (const [wid, state] of Object.entries(sub.toolStates)) {
                localStorage.setItem(`${TOOL_STATE_PREFIX}${sub.dataKey}-${wid}`, JSON.stringify(state))
              }
            }
          }
        }
      }
    }

    const parts: string[] = []
    if (projectCount > 0) parts.push(`${projectCount} project(s)`)
    if (toolCount > 0) parts.push(`${toolCount} tool template(s)`)
    toolsRestoreStatus.value = { type: 'success', message: parts.length ? `Restored ${parts.join(', ')}` : 'Everything already exists' }
    setTimeout(() => { toolsRestoreStatus.value = null }, 3000)
  } catch (error: any) {
    toolsRestoreStatus.value = { type: 'error', message: error.message || 'Failed to restore studio' }
    setTimeout(() => { toolsRestoreStatus.value = null }, 3000)
  }

  input.value = ''
}

async function handleSyncAll() {
  // TODO: implement downloadAllData when cloud sync is fully ported
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
  if (settings.codeApiUrl) codeApiUrl.value = settings.codeApiUrl as string
  if (settings.opencodeApiKey) opencodeApiKey.value = settings.opencodeApiKey as string
  if (settings.customFetchUrl) customFetchUrl.value = settings.customFetchUrl as string
  if (settings.bookApiUrl) bookApiUrl.value = settings.bookApiUrl as string
  if (settings.bookApiKey) bookApiKey.value = settings.bookApiKey as string
  if (settings.extraService) extraService.value = settings.extraService as string

  loadSettings()
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
.tab-content-wrapper { position: relative; max-height: 70vh; overflow-y: auto; overflow-x: hidden; }
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

.api-key-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-base); border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem; font-family: monospace; }
.api-key-input:focus { outline: none; border-color: var(--color-border-strong); }
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
.tools-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-subtle); }
.sync-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.625rem 1rem; border: 1px solid var(--color-border-base); border-radius: 6px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem; font-family: system-ui, -apple-system, sans-serif; cursor: pointer; transition: all 0.15s ease; }
.sync-btn:hover:not(:disabled) { background: var(--color-bg-hover); border-color: var(--color-border-strong); }
.sync-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.sync-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.1); border-radius: 50%; border-top-color: currentColor; animation: spin 0.8s linear infinite; }


.account-info { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 6px; }
.user-email { font-size: 0.9rem; color: var(--color-text-base); }
.sign-out-btn, .sign-in-btn { padding: 0.375rem 0.75rem; font-size: 0.875rem; background: transparent; border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
.sign-out-btn:hover, .sign-in-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); border-color: var(--color-border-accent); }
.sign-in-btn { background: var(--color-accent); color: white; border-color: var(--color-accent); }
.sign-in-btn:hover { background: var(--color-accent-hover); border-color: var(--color-accent-hover); }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
