<template>
  <div v-if="visible" class="stale-banner">Data may be outdated</div>
</template>
<script setup lang="ts">
defineProps<{
  visible: boolean
  isReadOnlyMode: boolean
}>()
defineEmits<{
  refresh: []
  dismiss: []
}>()
</script>
