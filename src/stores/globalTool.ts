import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ToolTemplate } from '@/types/tool'
import {
  saveGlobalToolToCloud,
  loadGlobalToolsFromCloud,
  deleteGlobalToolFromCloud,
} from '@/services/firestore/firestore-studio'
import { getCurrentUser } from '@/services/auth'

const STORAGE_KEY = 'global-tools'

let syncInitialized = false
let isApplyingCloud = false

function generateId(): string {
  return crypto.randomUUID()
}

function loadFromStorage(): ToolTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(templates: ToolTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export const useGlobalToolStore = defineStore('globalTool', () => {
  const templates = ref<ToolTemplate[]>(loadFromStorage())

  const templateList = computed(() =>
    [...templates.value].sort((a, b) => b.updatedAt - a.updatedAt)
  )

  watch(templates, (val) => saveToStorage(val), { deep: true })

  async function pullFromCloud(): Promise<void> {
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return

    const cloudTemplates = await loadGlobalToolsFromCloud()
    if (cloudTemplates.length === 0) return

    isApplyingCloud = true
    try {
      const localById = new Map(templates.value.map(t => [t.id, t]))
      const result: ToolTemplate[] = []

      for (const cloud of cloudTemplates) {
        const local = localById.get(cloud.id)
        localById.delete(cloud.id)
        if (!local || cloud.updatedAt >= local.updatedAt) {
          result.push(cloud)
        } else {
          result.push(local)
        }
      }
      for (const local of localById.values()) {
        result.push(local)
      }
      templates.value.splice(0, templates.value.length, ...result)
    } finally {
      isApplyingCloud = false
    }
  }

  function initSync(): void {
    if (syncInitialized) return
    syncInitialized = true

    pullFromCloud().catch(err =>
      console.error('[GlobalToolSync] Initial pull failed:', err)
    )

    if (import.meta.hot) {
      import.meta.hot?.dispose(() => {
        syncInitialized = false
      })
    }
  }

  function syncToCloud(template: ToolTemplate): void {
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return
    saveGlobalToolToCloud(template).catch(err =>
      console.error('[GlobalToolSync] Save failed:', err)
    )
  }

  function createTemplate(data: { name: string; description?: string; code: string; icon?: string }): ToolTemplate {
    const template: ToolTemplate = {
      id: generateId(),
      name: data.name,
      description: data.description,
      code: data.code,
      icon: data.icon,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    templates.value.push(template)
    syncToCloud(template)
    return template
  }

  function updateTemplate(id: string, updates: Partial<Pick<ToolTemplate, 'name' | 'description' | 'code' | 'icon'>>): void {
    const t = templates.value.find(t => t.id === id)
    if (!t) return
    Object.assign(t, updates, { updatedAt: Date.now() })
    syncToCloud(t)
  }

  function deleteTemplate(id: string): void {
    templates.value = templates.value.filter(t => t.id !== id)
    const user = getCurrentUser()
    if (!user || !navigator.onLine) return
    deleteGlobalToolFromCloud(id).catch(err =>
      console.error('[GlobalToolSync] Delete failed:', err)
    )
  }

  function getTemplate(id: string): ToolTemplate | undefined {
    return templates.value.find(t => t.id === id)
  }

  return {
    templates,
    templateList,
    initSync,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
  }
})
