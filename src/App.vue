<template>
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
import { ref, onMounted } from 'vue'
import SyncConflictModal from './components/Modal/SyncConflictModal.vue'
import { useChatStore } from './stores/chat.js'

const chatStore = useChatStore()

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
</style>
