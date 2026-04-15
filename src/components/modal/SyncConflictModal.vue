<template>
  <div v-if="visible" class="sync-conflict-modal">Sync Conflict (stub)</div>
</template>
<script setup lang="ts">
defineProps<{
  visible: boolean
  localChatCount: number
  cloudChatCount: number
  localChats: any[]
  cloudChats: any[]
}>()
defineEmits<{
  resolve: [choice: string]
}>()
</script>
