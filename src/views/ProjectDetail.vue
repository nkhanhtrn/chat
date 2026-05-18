<template>
  <AppLayout ref="appLayoutRef" storage-key="sidebar">
    <template #side>
      <ProjectHeader
        :name="projectStore.currentProject?.name ?? 'Project'"
        :subprojects="projectStore.currentProject?.subprojects ?? []"
        :activeSubprojectId="projectStore.currentSubprojectId ?? ''"
        :isStreaming="chat.isStreaming.value"
        :hasScratchpad="projectStore.currentScratchpad.trim().length > 0"
        @rename="handleRenameProject"
        @switch-subproject="handleSwitchSubproject"
        @add-subproject="handleAddSubproject"
        @delete-subproject="handleDeleteSubproject"
        @rename-subproject="handleRenameSubproject"
        @open-scratchpad="scratchpadOpen = true"
      />

      <ScratchpadPanel
        v-model:open="scratchpadOpen"
        :model-value="projectStore.currentScratchpad"
        :data-key="dk"
        @update:model-value="handleUpdateScratchpad"
      />

      <MessageList
        ref="messageListRef"
        :messages="projectStore.currentMessages"
        :is-streaming="chat.isStreaming.value"
        @edit="handleEdit"
      />

      <div class="input-wrapper">
        <ToolTargetBar
          :tools="openTools"
          :selectedId="targetToolId"
          @update:selectedId="targetToolId = $event"
        />
        <MessageInput
          ref="messageInputRef"
          v-model="inputText"
          :is-streaming="chat.isStreaming.value"
          :messages-empty="projectStore.currentMessages.length === 0"
          @send="handleSend"
          @stop="handleStop"
          @clear="handleClear"
        />
      </div>
    </template>

    <div class="canvas-wrapper">
      <SlideTransition appear direction="vertical">
        <CanvasPanel
          :key="projectStore.currentSubprojectId"
          :windows="projectStore.activeWindows"
          :session-id="projectId"
          @close-window="handleCloseWindow"
          @minimize-window="handleMinimizeWindow"
          @restore-window="handleRestoreWindow"
          @toggle-window="handleToggleWindow"
          @update-position="handleUpdateWindowPosition"
          @update-size="handleUpdateWindowSize"
          @update-title="handleUpdateTitle"
          @bring-to-front="handleBringToFront"
          @clone-window="handleCloneWindow"
          @update-code="handleUpdateCode"
          @delete-window="handleDeleteWindow"
          @instantiate-tool="handleInstantiateTool"
          @promote-tool="handlePromoteTool"
        />
      </SlideTransition>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import { useGlobalToolStore } from '@/stores/globalTool'
import { useProjectChat } from '@/composables/useProjectChat'
import AppLayout from '@/components/AppLayout.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import ProjectHeader from '@/components/project/ProjectHeader.vue'
import MessageList from '@/components/project/MessageList.vue'
import MessageInput from '@/components/project/MessageInput.vue'
import CanvasPanel from '@/components/project/CanvasPanel.vue'
import ToolTargetBar from '@/components/project/ToolTargetBar.vue'
import ScratchpadPanel from '@/components/project/ScratchpadPanel.vue'
import type { ProjectWindow } from '@/types/project'
import type { ToolTemplate } from '@/types/tool'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const globalToolStore = useGlobalToolStore()
const { showToast } = useToast()
const projectId = route.params.id as string
const dk = computed(() => projectStore.currentDataKey ?? '')

const chat = useProjectChat()

const inputText = ref('')
const scratchpadOpen = ref(false)
const targetToolId = ref<string | null>(null)
const messageListRef = ref<InstanceType<typeof MessageList> | null>(null)
const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null)
const appLayoutRef = ref<InstanceType<typeof AppLayout> | null>(null)

const openTools = computed(() =>
  projectStore.activeWindows.filter(w => w.type === 'tool' && w.code)
)

watch(openTools, (tools, oldTools) => {
  if (!tools.length) {
    targetToolId.value = null
    return
  }
  const oldIds = new Set((oldTools ?? []).map(t => t.id))
  const newTool = tools.find(t => !oldIds.has(t.id))
  if (newTool) {
    targetToolId.value = newTool.id
  } else if (!tools.find(t => t.id === targetToolId.value)) {
    targetToolId.value = null
  }
})

function initFromRoute() {
  const pid = route.params.id as string
  if (!pid) return
  const subId = route.params.subId as string | undefined
  if (subId) {
    projectStore.switchToProject(pid)
    projectStore.switchSubProject(pid, subId)
  } else {
    projectStore.switchToProject(pid)
  }
}

onMounted(initFromRoute)

watch(() => [route.params.id, route.params.subId] as const, () => {
  initFromRoute()
})

async function handleSend() {
  if (chat.isStreaming.value) return
  const snippets = messageInputRef.value?.consumeSnippets?.() ?? ''
  const text = [inputText.value.trim(), snippets].filter(Boolean).join('\n\n')
  if (!text) return
  inputText.value = ''
  messageInputRef.value?.resetHeight()
  const targetTool = targetToolId.value
    ? openTools.value.find(t => t.id === targetToolId.value)
    : null
  await chat.sendMessage(text, targetTool ?? null)
}

function handleStop() {
  chat.stopStreaming()
}

async function handleClear() {
  await chat.clearChat()
}

async function handleEdit(index: number, newContent: string) {
  if (chat.isStreaming.value) return
  await chat.editAndResend(index, newContent)
}

function handleRenameProject(name: string) {
  if (projectId) projectStore.renameProject(projectId, name)
}

function handleUpdateScratchpad(content: string) {
  if (dk.value) projectStore.updateScratchpad(dk.value, content)
}

function handleSwitchSubproject(subprojectId: string) {
  router.push({ name: 'project-subproject', params: { id: projectId, subId: subprojectId } })
}

function handleAddSubproject() {
  if (!projectId) return
  const sub = projectStore.createSubProject(projectId)
  if (sub) {
    router.push({ name: 'project-subproject', params: { id: projectId, subId: sub.id } })
  }
}

function handleDeleteSubproject(subprojectId: string) {
  if (!projectId) return
  const project = projectStore.projects.find(p => p.id === projectId)
  if (!project || project.subprojects.length <= 1) return
  projectStore.deleteSubProject(projectId, subprojectId)
  const newActiveId = project.activeSubprojectId
  if (newActiveId) {
    router.push({ name: 'project-subproject', params: { id: projectId, subId: newActiveId } })
  }
}

function handleRenameSubproject(subprojectId: string, name: string) {
  if (projectId) projectStore.renameSubProject(projectId, subprojectId, name)
}

function handleCloseWindow(windowId: string) {
  if (dk.value) projectStore.setWindowDisplayState(dk.value, windowId, 'minimized')
}

function handleMinimizeWindow(windowId: string) {
  if (dk.value) projectStore.setWindowDisplayState(dk.value, windowId, 'minimized')
}

function handleRestoreWindow(windowId: string) {
  if (dk.value) projectStore.setWindowDisplayState(dk.value, windowId, 'open')
}

function handleToggleWindow(windowId: string) {
  if (!dk.value) return
  const win = projectStore.activeWindows.find(w => w.id === windowId)
  if (!win) return
  projectStore.setWindowDisplayState(dk.value, windowId, win.displayState === 'open' ? 'minimized' : 'open')
}

function handleUpdateWindowPosition(windowId: string, position: { x: number; y: number }) {
  if (dk.value) projectStore.updateWindow(dk.value, windowId, { position })
}

function handleUpdateWindowSize(windowId: string, size: { width: number; height: number }) {
  if (dk.value) projectStore.updateWindow(dk.value, windowId, { size })
}

function handleBringToFront(windowId: string) {
  if (dk.value) {
    projectStore.updateWindow(dk.value, windowId, { zIndex: projectStore.getNextZIndex() })
    const win = projectStore.activeWindows.find(w => w.id === windowId)
    if (win?.type === 'tool') targetToolId.value = windowId
  }
}

function handleDeleteWindow(windowId: string) {
  if (!dk.value) return
  const win = projectStore.activeWindows.find(w => w.id === windowId)
  if (!win) return
  if (!confirm(`Delete "${win.title}"? This cannot be undone.`)) return
  if (targetToolId.value === windowId) targetToolId.value = null
  projectStore.removeWindow(dk.value, windowId)
}

function handleUpdateTitle(windowId: string, title: string) {
  if (dk.value) projectStore.updateWindow(dk.value, windowId, { title })
}

function handleUpdateCode(windowId: string, code: string) {
  if (dk.value) projectStore.updateWindow(dk.value, windowId, { code })
}

function handleCloneWindow(window: ProjectWindow) {
  if (!dk.value) return
  const newWindow: ProjectWindow = {
    ...window,
    id: crypto.randomUUID(),
    position: { ...window.position, x: window.position.x + 30, y: window.position.y + 30 },
    zIndex: projectStore.getNextZIndex(),
    toolInstanceId: window.type === 'tool' ? crypto.randomUUID() : window.toolInstanceId,
  }
  projectStore.addWindow(dk.value, newWindow)
}

function handleInstantiateTool(template: ToolTemplate) {
  if (!dk.value) return
  const wins = projectStore.windows.get(dk.value) || []
  const baseX = 40 + (wins.length % 5) * 40
  const baseY = 40 + (wins.length % 5) * 40
  projectStore.addWindow(dk.value, {
    id: crypto.randomUUID(),
    sessionId: dk.value,
    title: template.name,
    type: 'tool',
    displayState: 'open',
    position: { x: baseX, y: baseY },
    size: { width: 500, height: 450 },
    zIndex: projectStore.getNextZIndex(),
    code: template.code,
    toolInstanceId: crypto.randomUUID(),
    templateId: template.id,
  })
}

function handlePromoteTool(win: ProjectWindow) {
  if (!win.code) return
  if (win.templateId) {
    const existing = globalToolStore.getTemplate(win.templateId)
    if (existing) {
      globalToolStore.updateTemplate(existing.id, { code: win.code, name: win.title })
      showToast(`Updated "${win.title}" in tool library`)
      return
    }
  }
  globalToolStore.createTemplate({
    name: win.title,
    code: win.code,
  })
  showToast(`"${win.title}" saved to tool library`)
}
</script>

<style scoped>
.canvas-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.5rem 1rem;
  background: var(--color-bg-base);
}
</style>
