<template>
  <DevToolbar v-if="showDevToolbar" />
  <div v-if="showDevToolbar" class="dev-toolbar-spacer"></div>

  <StaleDataBanner
    :visible="showStaleDataBanner"
    :isReadOnlyMode="isReadOnlyMode"
    @refresh="refresh"
    @dismiss="dismissBanner"
  />

  <router-view />

  <SyncConflictModal
    :visible="showConflictModal"
    :localChatCount="conflictData.localChatCount"
    :cloudChatCount="conflictData.cloudChatCount"
    :localChats="conflictData.localChats"
    :cloudChats="conflictData.cloudChats"
    @resolve="handleConflictResolve"
  />
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SyncConflictModal from '@/components/modal/SyncConflictModal.vue'
import StaleDataBanner from '@/components/StaleDataBanner.vue'
import DevToolbar from '@/components/DevToolbar.vue'
import { useNotebookStore } from '@/stores/notebook'
import { useStaleDataDetection } from '@/composables/useStaleDataDetection'
import { getDevToolbarEnabled, setDevToolbarEnabled } from '@/composables/useEnvironment'
import type { ConflictData } from '@/types/sync'

const router = useRouter()
const showDevToolbar = ref(getDevToolbarEnabled())

const toggleDevToolbar = (enabled: boolean) => {
  setDevToolbarEnabled(enabled)
  showDevToolbar.value = enabled
}

const notebookStore = useNotebookStore()

const { showStaleDataBanner, isReadOnlyMode, refresh, dismissBanner, triggerBanner } = useStaleDataDetection()

provide('triggerStaleDataBanner', triggerBanner)
provide('showDevToolbar', showDevToolbar)
provide('toggleDevToolbar', toggleDevToolbar)

const showConflictModal = ref(false)
const conflictData = ref<ConflictData>({
  localChatCount: 0,
  cloudChatCount: 0,
  localChats: [],
  cloudChats: []
})

onMounted(() => {
  const syncConflict = (window as any).__syncConflict as ConflictData | undefined
  if (syncConflict) {
    conflictData.value = syncConflict
    showConflictModal.value = true
  }

  if ((window as any).__notebookDeleted) {
    delete (window as any).__notebookDeleted
    router.push({ name: 'notebooks' })
  }
})

const handleConflictResolve = async (choice: string) => {
  await notebookStore.resolveListConflict(choice, conflictData.value as unknown as Record<string, unknown>)
  showConflictModal.value = false
  conflictData.value = {
    localChatCount: 0,
    cloudChatCount: 0,
    localChats: [],
    cloudChats: []
  }
}
</script>

<style>
.dev-toolbar-spacer {
  height: 41px;
}
</style>
