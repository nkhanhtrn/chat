<template>
  <!-- Dev Toolbar (fixed at top, outside app flow) -->
  <DevToolbar v-if="isDev" />
  <div v-if="isDev" class="dev-toolbar-spacer"></div>

  <!-- Stale Data Banner -->
  <StaleDataBanner
    :visible="showStaleDataBanner"
    :isReadOnlyMode="isReadOnlyMode"
    @refresh="refresh"
    @dismiss="dismissBanner"
  />

  <router-view />

  <!-- Sync Conflict Modal -->
  <SyncConflictModal
    :visible="showConflictModal"
    :localData="conflictData.localData"
    :cloudData="conflictData.cloudData"
    @resolve="handleConflictResolve"
  />
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import SyncConflictModal from './components/Modal/SyncConflictModal.vue'
import StaleDataBanner from './components/StaleDataBanner.vue'
import DevToolbar from './components/DevToolbar.vue'
import { useChatStore } from './stores/chat.js'
import { useStaleDataDetection } from './composables/useStaleDataDetection.js'
import { getIsDev } from './composables/useEnvironment.js'

const isDev = getIsDev()

const chatStore = useChatStore()

// Stale data detection
const { showStaleDataBanner, isReadOnlyMode, refresh, dismissBanner, triggerBanner } = useStaleDataDetection()

// Provide trigger function for DevToolbar
provide('triggerStaleDataBanner', triggerBanner)

const showConflictModal = ref(false)
const conflictData = ref({
  localData: null,
  cloudData: null
})

onMounted(() => {
  // Check for sync conflict passed from main.js
  if (window.__syncConflict) {
    conflictData.value = window.__syncConflict
    showConflictModal.value = true
    // Clean up global
    delete window.__syncConflict
  }
})

const handleConflictResolve = async (choice) => {
  await chatStore.resolveConflict(
    choice,
    conflictData.value.localData,
    conflictData.value.cloudData
  )
  showConflictModal.value = false
  conflictData.value = { localData: null, cloudData: null }
}
</script>

<style>
/* Global styles are in style.css */

/* Add padding when dev toolbar is visible */
.dev-toolbar-spacer {
  height: 41px; /* Match dev toolbar height */
}
</style>
