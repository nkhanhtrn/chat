<template>
  <AppLayout ref="appLayoutRef" storage-key="sidebar">
    <template #side>
      <ProjectHeader
        :name="projectStore.currentProject?.name ?? 'Project'"
        :subprojects="projectStore.currentProject?.subprojects ?? []"
        :openSubprojects="projectStore.openSubprojects"
        :activeSubprojectId="projectStore.currentSubprojectId ?? ''"
        :isHome="isHome"
        :isStreaming="chat.isStreaming.value"
        :hasScratchpad="hasAnyScratchpad"
        :sideTab="sideTab"
        @rename="handleRenameProject"
        @show-home="handleShowHome"
        @switch-subproject="handleSwitchSubproject"
        @add-subproject="handleAddSubproject"
        @close-subproject="handleCloseSubproject"
        @rename-subproject="handleRenameSubproject"
        @open-scratchpad="scratchpadOpen = true"
        @reorder-subprojects="handleReorderSubprojects"
        @switch-tab="sideTab = $event"
      />

      <div v-show="sideTab === 'project'" class="side-tab-content">
        <template v-if="isHome">
          <SubprojectHomePanel
            :subprojects="projectStore.currentProject?.subprojects ?? []"
            :closedIds="getClosedIds()"
            @open-subproject="handleSwitchSubproject"
            @delete-subproject="handleDeleteSubproject"
            @reorder-subprojects="handleReorderSubprojects"
          />
        </template>
        <template v-else>
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
            <div v-if="commandFeedback" class="command-feedback">{{ commandFeedback }}</div>
            <MessageInput
              ref="messageInputRef"
              v-model="inputText"
              :is-streaming="chat.isStreaming.value"
              :messages-empty="projectStore.currentMessages.length === 0"
              :tools="toolRefs"
              @send="handleSend"
              @stop="handleStop"
              @clear="handleClear"
            />
          </div>
        </template>
      </div>

      <div v-show="sideTab === 'chat'" class="side-tab-content">
        <SideChatPlayground />
      </div>

      <ScratchpadPanel
        v-model:open="scratchpadOpen"
        :model-value="projectStore.currentScratchpad"
        :data-key="scratchpadDataKey"
        :subprojects="isHome ? (projectStore.currentProject?.subprojects ?? []) : []"
        :getScratchpadFn="scratchpadGetFn"
        :updateScratchpadFn="scratchpadUpdateFn"
        @update:model-value="handleUpdateScratchpad"
      />
    </template>

    <div v-if="!isHome" class="canvas-wrapper">
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
          @revert-window="handleRevertWindow"
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
import { handleCommand, extractToolRefs, stripToolRefs, type CommandContext, type ToolRef } from '@/utils/chatCommands'
import { getToolState } from '@/services/builder/toolData'
import { searchWeb, fetchResultContent, formatSearchResultsForPrompt } from '@/services/builder/webSearch'
import AppLayout from '@/components/AppLayout.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import ProjectHeader from '@/components/project/ProjectHeader.vue'
import MessageList from '@/components/project/MessageList.vue'
import MessageInput from '@/components/project/MessageInput.vue'
import CanvasPanel from '@/components/project/CanvasPanel.vue'
import ToolTargetBar from '@/components/project/ToolTargetBar.vue'
import ScratchpadPanel from '@/components/project/ScratchpadPanel.vue'
import SubprojectHomePanel from '@/components/project/SubprojectHomePanel.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
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

const isHome = computed(() => !route.params.subId)

const scratchpadDataKey = computed(() => {
  if (isHome.value && projectStore.currentProjectId) {
    return `${projectStore.currentProjectId}-`
  }
  return dk.value
})

function scratchpadGetFn(dataKey: string): string {
  return projectStore.scratchpads.get(dataKey) ?? ''
}

function scratchpadUpdateFn(dataKey: string, content: string) {
  projectStore.updateScratchpad(dataKey, content)
}

const hasAnyScratchpad = computed(() => {
  if (!projectStore.currentProject) return false
  if (!isHome.value) return projectStore.currentScratchpad.trim().length > 0
  return projectStore.currentProject.subprojects.some(sub => {
    const key = `${projectStore.currentProjectId}-${sub.id}`
    return (projectStore.scratchpads.get(key) ?? '').trim().length > 0
  })
})

const chat = useProjectChat()

const inputText = ref('')
const sideTab = ref<'project' | 'chat'>('project')
const scratchpadOpen = ref(false)
const targetToolId = ref<string | null>(null)
const commandFeedback = ref('')
const messageListRef = ref<InstanceType<typeof MessageList> | null>(null)
const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null)
const appLayoutRef = ref<InstanceType<typeof AppLayout> | null>(null)

const cmdCtx: CommandContext = {
  clearChat: () => chat.clearChat(),
  compactChat: () => chat.compactChat(),
}

const openTools = computed(() =>
  projectStore.activeWindows.filter(w => w.type === 'tool' && w.code)
)

const toolRefs = computed<ToolRef[]>(() =>
  openTools.value.map(t => ({ id: t.id, title: t.title }))
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

function showFeedback(msg: string) {
  commandFeedback.value = msg
  setTimeout(() => { commandFeedback.value = '' }, 3000)
}

function resolveTargetTool() {
  return targetToolId.value
    ? openTools.value.find(t => t.id === targetToolId.value) ?? null
    : null
}

async function handleSend() {
  if (chat.isStreaming.value) return
  const snippets = messageInputRef.value?.consumeSnippets?.() ?? ''
  const text = [inputText.value.trim(), snippets].filter(Boolean).join('\n\n')
  if (!text) return
  inputText.value = ''
  messageInputRef.value?.resetHeight()

  const result = await handleCommand(text.trim(), cmdCtx)
  if (result) {
    if (result.type === 'handled' && result.feedback) showFeedback(result.feedback)
    else if (result.type === 'error') showFeedback(result.message)
    else if (result.type === 'message') await chat.sendMessage(result.text, resolveTargetTool())
    else if (result.type === 'search') {
      try {
        let results = await searchWeb(result.query)
        results = await fetchResultContent(results)
        const webResults = results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet }))
        const prompt = formatSearchResultsForPrompt(results) + '\n\nRespond to the user\'s query using these search results.'
        await chat.sendMessage(`/search ${result.query}`, null, { query: result.query, results: webResults, prompt })
      } catch (err: any) { showFeedback(`Search failed: ${err.message}`) }
    }
    return
  }

  const refs = extractToolRefs(text, toolRefs.value)
  let messageText = text
  let toolDataContext = ''

  if (refs.length > 0) {
    messageText = stripToolRefs(text, refs)
    const parts = refs.map(ref => {
      const win = openTools.value.find(w => w.id === ref.id)
      if (!win) return ''
      const toolData = getToolState(dk.value, win.id)
      const dataStr = Object.keys(toolData).length > 0 ? `\nData: ${JSON.stringify(toolData, null, 2)}` : ''
      return `Tool "${ref.title}" code:\n\`\`\`\n${win.code}\n\`\`\`${dataStr}`
    }).filter(Boolean)
    toolDataContext = parts.join('\n\n')
  }

  if (toolDataContext) {
    messageText = `${messageText}\n\n[Referenced tools]:\n${toolDataContext}`
  }

  await chat.sendMessage(messageText, resolveTargetTool())
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
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project && !project.openSubprojectIds.includes(subprojectId)) {
    projectStore.reopenSubProject(projectId, subprojectId)
  }
  router.push({ name: 'project-subproject', params: { id: projectId, subId: subprojectId } })
}

function handleShowHome() {
  router.push({ name: 'project-detail', params: { id: projectId } })
}

function handleAddSubproject() {
  if (!projectId) return
  const sub = projectStore.createSubProject(projectId)
  if (sub) {
    router.push({ name: 'project-subproject', params: { id: projectId, subId: sub.id } })
  }
}

function handleCloseSubproject(subprojectId: string) {
  if (!projectId) return
  projectStore.closeSubProject(projectId, subprojectId)
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project?.activeSubprojectId) {
    router.push({ name: 'project-subproject', params: { id: projectId, subId: project.activeSubprojectId } })
  } else {
    router.push({ name: 'project-detail', params: { id: projectId } })
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
  } else {
    router.push({ name: 'project-detail', params: { id: projectId } })
  }
}

function handleRenameSubproject(subprojectId: string, name: string) {
  if (projectId) projectStore.renameSubProject(projectId, subprojectId, name)
}

function handleReorderSubprojects(orderedIds: string[]) {
  if (projectId) projectStore.reorderSubProjects(projectId, orderedIds)
}

function getClosedIds(): string[] {
  const proj = projectStore.currentProject
  if (!proj) return []
  const open = new Set(proj.openSubprojectIds ?? proj.subprojects.map(s => s.id))
  return proj.subprojects.filter(s => !open.has(s.id)).map(s => s.id)
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

function handleRevertWindow(windowId: string) {
  if (dk.value) projectStore.revertWindowCode(dk.value, windowId)
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

.command-feedback {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-bottom: 0.35rem;
  border-left: 3px solid var(--color-primary);
  white-space: pre-wrap;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

.side-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
