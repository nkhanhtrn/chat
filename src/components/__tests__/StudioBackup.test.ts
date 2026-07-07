import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SettingsModal from '../modal/SettingsModal.vue'
import { Settings } from '@/services/settings'
import * as settingsFunctions from '@/services/settings'
import { useGlobalToolStore } from '@/stores/globalTool'
import { useProjectStore } from '@/stores/project'
import type { ToolTemplate } from '@/types/tool'

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

vi.mock('@/composables/useEnvironment', () => ({
  getIsDev: vi.fn().mockReturnValue(true),
  getDefaultQuestions: vi.fn().mockReturnValue([]),
}))

vi.mock('@/services/sync/IndexedDBService', () => ({
  syncChatList: vi.fn().mockResolvedValue({ chats: [], currentChatId: null, currentModel: null, lastSyncedAt: null }),
  syncChatMessages: vi.fn().mockResolvedValue({ messagesById: {}, lastSyncedAt: null }),
  getLocalChatMessages: vi.fn().mockResolvedValue(null),
  resolveChatListConflict: vi.fn().mockResolvedValue({ chats: [], currentChatId: null, currentModel: null, lastSyncedAt: null }),
}))

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

async function switchToAccountTab() {
  const tabButtons = Array.from(getBody().querySelectorAll('.tab-button'))
  const accountTab = tabButtons.find(b => b.textContent === 'Account')!
  accountTab.click()
  await nextTick()
}

function createSampleToolTemplate(id: string): ToolTemplate {
  return {
    id,
    name: `Tool ${id}`,
    code: '<template><div>test</div></template>',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('Studio Backup & Restore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(Settings.getAll).mockReturnValue({})
    vi.mocked(settingsFunctions.getTheme).mockReturnValue('light')
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  describe('UI', () => {
    it('renders Studio Projects section on Account tab', async () => {
      mountSettings()
      await switchToAccountTab()
      const section = getBody().querySelector('.tools-section')
      expect(section).not.toBeNull()
      expect(section?.textContent).toContain('Studio Projects')
    })

    it('renders Download Studio and Restore Studio buttons', async () => {
      mountSettings()
      await switchToAccountTab()
      const section = getBody().querySelector('.tools-section')!
      const buttons = section.querySelectorAll('.backup-btn')
      const texts = Array.from(buttons).map(b => b.textContent?.trim())
      expect(texts).toContain('Download Studio')
      expect(texts).toContain('Restore Studio')
    })

    it('renders file input with .json accept on Restore Studio button', async () => {
      mountSettings()
      await switchToAccountTab()
      const section = getBody().querySelector('.tools-section')!
      const fileInput = section.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).not.toBeNull()
      expect(fileInput.accept).toBe('.json')
    })
  })

  describe('downloadStudio', () => {
    it('exports global tool templates', async () => {
      const toolStore = useGlobalToolStore()
      toolStore.templates.push(createSampleToolTemplate('tool-1'))
      toolStore.templates.push(createSampleToolTemplate('tool-2'))

      mountSettings()
      await switchToAccountTab()

      const createElementSpy = vi.spyOn(document, 'createElement')
      const downloadBtn = Array.from(getBody().querySelectorAll('.backup-btn'))
        .find(b => b.textContent?.includes('Download Studio'))!
      downloadBtn.click()

      expect(createElementSpy).toHaveBeenCalledWith('a')
      const anchorCall = createElementSpy.mock.results.find(
        r => r.value?.tagName === 'A' && r.value?.download?.includes('studio-')
      )
      expect(anchorCall).toBeTruthy()
      createElementSpy.mockRestore()
    })

    it('exports projects with subprojects, windows, session IDs, and tool states', async () => {
      const projectStore = useProjectStore()
      const project = projectStore.createProject('Test Project')
      const dataKey = `${project.id}-${project.activeSubprojectId}`

      projectStore.windows.set(dataKey, [{
        id: 'win-1',
        sessionId: 'sess-1',
        title: 'My Tool',
        type: 'tool',
        displayState: 'open',
        position: { x: 10, y: 20 },
        size: { width: 400, height: 300 },
        zIndex: 1,
      }])
      localStorage.setItem(`project-session-${dataKey}`, 'session-abc')
      localStorage.setItem(`tool-state-${dataKey}-win-1`, JSON.stringify({ count: 42 }))

      mountSettings()
      await switchToAccountTab()

      let capturedBlob: Blob | null = null
      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
        capturedBlob = blob
        return 'blob:mock'
      })

      const downloadBtn = Array.from(getBody().querySelectorAll('.backup-btn'))
        .find(b => b.textContent?.includes('Download Studio'))!
      downloadBtn.click()

      expect(capturedBlob).not.toBeNull()
      const json = JSON.parse(await capturedBlob!.text())
      expect(json.version).toBe(1)
      expect(json.templates).toBeDefined()
      expect(json.projects).toBeDefined()
      expect(json.projects.length).toBe(1)

      const exported = json.projects[0]
      expect(exported.project.id).toBe(project.id)
      expect(exported.project.name).toBe('Test Project')
      expect(exported.subprojects.length).toBe(1)

      const sub = exported.subprojects[0]
      expect(sub.dataKey).toBe(dataKey)
      expect(sub.windows.length).toBe(1)
      expect(sub.windows[0].id).toBe('win-1')
      expect(sub.sessionId).toBe('session-abc')
      expect(sub.toolStates['win-1']).toEqual({ count: 42 })

      vi.mocked(URL.createObjectURL).mockRestore()
    })

    it('excludes chat messages from export', async () => {
      const projectStore = useProjectStore()
      const project = projectStore.createProject('Msg Project')
      const dataKey = `${project.id}-${project.activeSubprojectId}`
      projectStore.messages.set(dataKey, [{ id: 'msg-1', role: 'user', content: 'hello', timestamp: Date.now() }])

      mountSettings()
      await switchToAccountTab()

      let capturedBlob: Blob | null = null
      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
        capturedBlob = blob
        return 'blob:mock'
      })

      const downloadBtn = Array.from(getBody().querySelectorAll('.backup-btn'))
        .find(b => b.textContent?.includes('Download Studio'))!
      downloadBtn.click()

      const json = JSON.parse(await capturedBlob!.text())
      const sub = json.projects[0].subprojects[0]
      expect(sub.messages).toBeUndefined()

      vi.mocked(URL.createObjectURL).mockRestore()
    })
  })

  describe('restoreStudio', () => {
    it('restores tool templates that do not already exist', async () => {
      const toolStore = useGlobalToolStore()
      toolStore.templates.push(createSampleToolTemplate('existing'))

      mountSettings()
      await switchToAccountTab()

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: [createSampleToolTemplate('existing'), createSampleToolTemplate('new-1'), createSampleToolTemplate('new-2')],
        projects: [],
      }
      const file = new File([JSON.stringify(backupData)], 'backup.json', { type: 'application/json' })

      const fileInput = getBody().querySelector('.tools-section input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))
      await vi.waitFor(() => {
        expect(toolStore.templates.length).toBe(3)
      })

      const status = getBody().querySelector('.tools-section .connection-status')
      expect(status?.textContent).toContain('2 tool template')
      expect(status?.className).toContain('success')
    })

    it('restores projects with windows, session IDs, and tool states', async () => {
      mountSettings()
      await switchToAccountTab()

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: [],
        projects: [{
          project: {
            id: 'proj-1',
            name: 'Restored Project',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            subprojects: [{ id: 'sub-1', name: 'Main', createdAt: Date.now() }],
            activeSubprojectId: 'sub-1',
          },
          subprojects: [{
            dataKey: 'proj-1-sub-1',
            windows: [{
              id: 'win-1',
              sessionId: 'sess-1',
              title: 'Chart',
              type: 'chart',
              displayState: 'open',
              position: { x: 0, y: 0 },
              size: { width: 500, height: 400 },
              zIndex: 1,
            }],
            sessionId: 'restored-session-id',
            toolStates: { 'win-1': { data: 'value' } },
          }],
        }],
      }
      const file = new File([JSON.stringify(backupData)], 'backup.json', { type: 'application/json' })

      const fileInput = getBody().querySelector('.tools-section input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))
      await vi.waitFor(() => {
        const status = getBody().querySelector('.tools-section .connection-status')
        expect(status?.textContent).toContain('1 project')
      })

      const projectStore = useProjectStore()
      const restored = projectStore.projects.find(p => p.id === 'proj-1')
      expect(restored).toBeTruthy()
      expect(restored!.name).toBe('Restored Project')
      expect(projectStore.windows.get('proj-1-sub-1')?.length).toBe(1)
      expect(projectStore.windows.get('proj-1-sub-1')![0].title).toBe('Chart')
      expect(localStorage.getItem('project-session-proj-1-sub-1')).toBe('restored-session-id')
      expect(JSON.parse(localStorage.getItem('tool-state-proj-1-sub-1-win-1')!)).toEqual({ data: 'value' })
    })

    it('does not overwrite existing projects', async () => {
      const projectStore = useProjectStore()
      projectStore.projects.push({
        id: 'proj-existing',
        name: 'Existing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        subprojects: [{ id: 'sub-x', name: 'Main', createdAt: Date.now() }],
        activeSubprojectId: 'sub-x',
      })

      mountSettings()
      await switchToAccountTab()

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        templates: [],
        projects: [{
          project: {
            id: 'proj-existing',
            name: 'Should Not Overwrite',
            createdAt: 1,
            updatedAt: 1,
            subprojects: [],
            activeSubprojectId: '',
          },
          subprojects: [],
        }],
      }
      const file = new File([JSON.stringify(backupData)], 'backup.json', { type: 'application/json' })

      const fileInput = getBody().querySelector('.tools-section input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))
      await vi.waitFor(() => {
        const status = getBody().querySelector('.tools-section .connection-status')
        expect(status).not.toBeNull()
      })

      expect(projectStore.projects.find(p => p.id === 'proj-existing')?.name).toBe('Existing')
    })

    it('shows error for unsupported version', async () => {
      mountSettings()
      await switchToAccountTab()

      const file = new File([JSON.stringify({ version: 99 })], 'bad.json', { type: 'application/json' })
      const fileInput = getBody().querySelector('.tools-section input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))
      await vi.waitFor(() => {
        const status = getBody().querySelector('.tools-section .connection-status')
        expect(status).not.toBeNull()
      })

      const status = getBody().querySelector('.tools-section .connection-status')
      expect(status?.className).toContain('error')
      expect(status?.textContent).toContain('Unsupported')
    })

    it('shows error for malformed JSON', async () => {
      mountSettings()
      await switchToAccountTab()

      const file = new File(['not json'], 'bad.json', { type: 'application/json' })
      const fileInput = getBody().querySelector('.tools-section input[type="file"]') as HTMLInputElement
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
      fileInput.dispatchEvent(new Event('change'))
      await vi.waitFor(() => {
        const status = getBody().querySelector('.tools-section .connection-status')
        expect(status).not.toBeNull()
      })

      const status = getBody().querySelector('.tools-section .connection-status')
      expect(status?.className).toContain('error')
    })
  })
})
