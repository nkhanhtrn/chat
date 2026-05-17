<template>
  <AppLayout ref="appLayoutRef" storage-key="project-layout">
    <template #side>
      <ProjectHeader :name="projectStore.currentProject?.name ?? 'Project'" @rename="handleRenameProject" />

      <MessageList
        ref="messageListRef"
        :messages="projectStore.currentMessages"
        :is-streaming="isStreaming"
        @edit="handleEdit"
      />

      <div class="input-wrapper">
        <MessageInput
          ref="messageInputRef"
          v-model="inputText"
          :is-streaming="isStreaming"
          :messages-empty="projectStore.currentMessages.length === 0"
          @send="handleSend"
          @stop="handleStop"
          @clear="handleClear"
        />
      </div>
    </template>

    <div class="canvas-wrapper" @click="handleCanvasClick">
      <SlideTransition appear direction="vertical">
        <CanvasPanel
          :windows="projectStore.activeWindows"
          :session-id="projectId"
          @close-window="handleCloseWindow"
          @minimize-window="handleMinimizeWindow"
          @restore-window="handleRestoreWindow"
          @update-position="handleUpdateWindowPosition"
          @update-size="handleUpdateWindowSize"
          @update-title="handleUpdateTitle"
          @bring-to-front="handleBringToFront"
          @clone-window="handleCloneWindow"
          @browse-windows="isBrowsingWindows = !isBrowsingWindows"
        />
      </SlideTransition>

      <WindowBrowser
        v-if="isBrowsingWindows"
        :windows="projectStore.currentWindows"
        @close="isBrowsingWindows = false"
        @restore="handleRestoreWindow"
        @delete="handleDeleteWindow"
        @rename="handleUpdateTitle"
        @click.stop
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import AppLayout from '@/components/AppLayout.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import ProjectHeader from '@/components/project/ProjectHeader.vue'
import MessageList from '@/components/project/MessageList.vue'
import MessageInput from '@/components/project/MessageInput.vue'
import CanvasPanel from '@/components/project/CanvasPanel.vue'
import WindowBrowser from '@/components/project/WindowBrowser.vue'
import type { ProjectMessage, ProjectWindow } from '@/types/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const projectId = route.params.id as string

const inputText = ref('')
const isStreaming = ref(false)
const isBrowsingWindows = ref(false)
const messageListRef = ref<InstanceType<typeof MessageList> | null>(null)
const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null)
const appLayoutRef = ref<InstanceType<typeof AppLayout> | null>(null)

onMounted(() => {
  if (projectId) {
    projectStore.switchToProject(projectId)
  }
})

watch(() => route.params.id, (newId) => {
  if (newId && typeof newId === 'string') {
    projectStore.switchToProject(newId)
  }
})

function handleSend() {
  if (!inputText.value.trim() || isStreaming.value) return
  if (!projectId) return

  const userMessage: ProjectMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: inputText.value,
    timestamp: Date.now(),
  }
  projectStore.addMessage(projectId, userMessage)
  inputText.value = ''
  messageInputRef.value?.resetHeight()

  isStreaming.value = true

  setTimeout(() => {
    const assistantMessage: ProjectMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'This is a placeholder response. Connect an LLM to get real responses.',
      timestamp: Date.now(),
    }
    projectStore.addMessage(projectId, assistantMessage)
    isStreaming.value = false
  }, 1000)
}

function handleStop() {
  isStreaming.value = false
}

function handleClear() {
  if (projectId) {
    projectStore.clearMessages(projectId)
  }
}

function handleEdit(index: number, newContent: string) {
  if (isStreaming.value) return
  const msgs = projectStore.currentMessages
  if (index >= 0 && index < msgs.length && msgs[index].role === 'user') {
    if (projectId) projectStore.clearMessages(projectId)
    inputText.value = newContent
    handleSend()
  }
}

function handleCloseWindow(windowId: string) {
  if (projectId) projectStore.setWindowDisplayState(projectId, windowId, 'closed')
}

function handleMinimizeWindow(windowId: string) {
  if (projectId) projectStore.setWindowDisplayState(projectId, windowId, 'minimized')
}

function handleRestoreWindow(windowId: string) {
  if (projectId) projectStore.setWindowDisplayState(projectId, windowId, 'open')
}

function handleDeleteWindow(windowId: string) {
  if (projectId) projectStore.removeWindow(projectId, windowId)
}

function handleUpdateWindowPosition(windowId: string, position: { x: number; y: number }) {
  if (projectId) projectStore.updateWindow(projectId, windowId, { position })
}

function handleUpdateWindowSize(windowId: string, size: { width: number; height: number }) {
  if (projectId) projectStore.updateWindow(projectId, windowId, { size })
}

function handleBringToFront(windowId: string) {
  if (projectId) projectStore.updateWindow(projectId, windowId, { zIndex: projectStore.getNextZIndex() })
}

function handleUpdateTitle(windowId: string, title: string) {
  if (projectId) projectStore.updateWindow(projectId, windowId, { title })
}

function handleCloneWindow(window: ProjectWindow) {
  if (!projectId) return
  const newWindow: ProjectWindow = {
    ...window,
    id: crypto.randomUUID(),
    position: { ...window.position, x: window.position.x + 30, y: window.position.y + 30 },
    zIndex: projectStore.getNextZIndex(),
  }
  projectStore.addWindow(projectId, newWindow)
}

function handleCanvasClick() {
  if (isBrowsingWindows.value) {
    isBrowsingWindows.value = false
  }
}

function handleRenameProject(newName: string) {
  if (projectId && newName.trim()) {
    projectStore.renameProject(projectId, newName.trim())
  }
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
