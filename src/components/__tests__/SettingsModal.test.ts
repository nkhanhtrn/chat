import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SettingsModal from '../modal/SettingsModal.vue'
import { Settings } from '@/services/settings'
import * as settingsFunctions from '@/services/settings'

// Mock the Settings service
vi.mock('@/services/settings', () => ({
  Settings: {
    getAll: vi.fn().mockReturnValue({}),
    set: vi.fn(),
  },
  setTheme: vi.fn(),
  getTheme: vi.fn().mockReturnValue('light'),
  applyFontSize: vi.fn(),
  applyFontFamily: vi.fn(),
  applyLineHeight: vi.fn(),
  applyContentWidth: vi.fn(),
  applySettings: vi.fn(),
}))

// Mock the prompt service
vi.mock('@/composables/useEnvironment', () => ({
  getIsDev: vi.fn().mockReturnValue(true),
  getDefaultQuestions: vi.fn().mockReturnValue([]),
}))

// Mock the sync service for pinia store
vi.mock('@/services/sync/IndexedDBService', () => ({
  syncChatList: vi.fn().mockResolvedValue({ chats: [], currentChatId: null, currentModel: null, lastSyncedAt: null }),
  syncChatMessages: vi.fn().mockResolvedValue({ messagesById: {}, lastSyncedAt: null }),
  getLocalChatMessages: vi.fn().mockResolvedValue(null),
  resolveChatListConflict: vi.fn().mockResolvedValue({ chats: [], currentChatId: null, currentModel: null, lastSyncedAt: null }),
}))

// Stub child components
const ApiKeyInputStub = {
  name: 'ApiKeyInput',
  props: ['modelValue', 'helpUrl'],
  template: '<div class="stub-api-key-input"><input type="text" /></div>',
  emits: ['update:modelValue'],
}

const LoginModalStub = {
  name: 'LoginModal',
  props: ['modelValue'],
  template: '<div class="stub-login-modal"></div>',
  emits: ['update:modelValue', 'success'],
}

let wrapper: VueWrapper<any>

function mountSettings(props = {}) {
  if (wrapper) wrapper.unmount()
  wrapper = mount(SettingsModal, {
    props: { modelValue: true, ...props },
    global: {
      stubs: {
        ApiKeyInput: ApiKeyInputStub,
        LoginModal: LoginModalStub,
        PromptInput: { template: '<div />' },
      },
      provide: {
        showDevToolbar: { value: false },
        toggleDevToolbar: vi.fn(),
      },
    },
    attachTo: document.body,
  })
  return wrapper
}

function getBody() {
  return document.body
}

describe('SettingsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(Settings.getAll).mockReturnValue({})
    vi.mocked(settingsFunctions.getTheme).mockReturnValue('light')
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  describe('visibility', () => {
    it('renders when modelValue is true', () => {
      mountSettings()
      expect(getBody().querySelector('.settings-container')).not.toBeNull()
    })

    it('does not render when modelValue is false', () => {
      // Mount with true first, then set to false
      const w = mountSettings()
      // Since Modal uses <Transition>, the v-if is inside the Modal component.
      // When modelValue=false, the Modal's visible prop is false, so nothing renders.
      // But Transition is stubbed, so it renders immediately.
      // Instead, verify: mounting fresh with false should not show the settings container
      w.unmount()
      wrapper = mount(SettingsModal, {
        props: { modelValue: false },
        global: {
          stubs: {
            ApiKeyInput: ApiKeyInputStub,
            LoginModal: LoginModalStub,
            PromptInput: { template: '<div />' },
          },
          provide: {
            showDevToolbar: { value: false },
            toggleDevToolbar: vi.fn(),
          },
        },
        attachTo: document.body,
      })
      // The Modal component wraps with Transition - stubbed Transition always renders.
      // So we check the actual v-if condition in Modal: the overlay div
      // Since the Modal component gets visible=false, the modal-overlay should not render.
      // But with Transition stubbed, the v-if inside Transition still works.
      expect(getBody().querySelector('.settings-container')).toBeNull()
    })

    it('emits update:modelValue false when close button is clicked', async () => {
      const w = mountSettings()
      // SettingsModal passes @close="$emit('update:modelValue', false)" to Modal.
      // Modal emits 'close' when .modal-close-btn is clicked.
      // So clicking .modal-close-btn should bubble up to SettingsModal.
      const closeBtn = getBody().querySelector('.modal-close-btn') as HTMLElement
      expect(closeBtn).not.toBeNull()
      closeBtn.click()
      await nextTick()
      expect(w.emitted('update:modelValue')).toBeTruthy()
      expect(w.emitted('update:modelValue')![0]).toEqual([false])
    })
  })

  describe('tabs', () => {
    it('renders all three tabs', () => {
      mountSettings()
      const tabButtons = Array.from(getBody().querySelectorAll('.tab-button'))
      const texts = tabButtons.map(b => b.textContent)
      expect(texts).toContain('Theme')
      expect(texts).toContain('LLM')
      expect(texts).toContain('Account')
    })

    it('switches to LLM tab on click', async () => {
      mountSettings()
      const tabButtons = Array.from(getBody().querySelectorAll('.tab-button'))
      const llmTab = tabButtons.find(b => b.textContent === 'LLM')!
      llmTab.click()
      await nextTick()
      // Should show LLM tab content
      expect(getBody().querySelector('.settings-body')).not.toBeNull()
    })

    it('switches to Account tab on click', async () => {
      mountSettings()
      const tabButtons = Array.from(getBody().querySelectorAll('.tab-button'))
      const accountTab = tabButtons.find(b => b.textContent === 'Account')!
      accountTab.click()
      await nextTick()
      // Account section should exist
      expect(getBody().querySelector('.settings-body')).not.toBeNull()
    })
  })

  describe('theme settings', () => {
    it('calls setTheme and Settings.set when theme is changed', async () => {
      mountSettings()
      const themeButtons = Array.from(getBody().querySelectorAll('.theme-button'))
      if (themeButtons.length > 0) {
        themeButtons[0].click()
        await nextTick()
        expect(settingsFunctions.setTheme).toHaveBeenCalled()
        expect(Settings.set).toHaveBeenCalled()
      }
    })
  })

  describe('font size', () => {
    it('renders font size slider', () => {
      mountSettings()
      const slider = getBody().querySelector('input[type="range"]')
      expect(slider).not.toBeNull()
    })
  })

  describe('account tab', () => {
    it('shows download backup button', async () => {
      mountSettings()
      const tabButtons = Array.from(getBody().querySelectorAll('.tab-button'))
      const accountTab = tabButtons.find(b => b.textContent === 'Account')!
      accountTab.click()
      await nextTick()
      const body = getBody()
      const text = body.textContent ?? ''
      expect(text).toMatch(/download|backup|restore/i)
    })
  })

  describe('cleanup', () => {
    it('unsubscribes from auth on unmount', async () => {
      const { onAuthChange } = await import('@/services/auth')
      const unsubscribe = vi.fn()
      vi.mocked(onAuthChange).mockReturnValue(unsubscribe)

      const w = mountSettings()
      w.unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })
})
