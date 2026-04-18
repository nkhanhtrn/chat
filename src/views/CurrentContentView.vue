<template>
  <ChatView v-if="type === 'notebook'" />
  <BookViewer v-else-if="type === 'book'" />
  <div v-else class="unknown-content-type">
    <p>Unknown content type: {{ type }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ChatView from './ChatView.vue'
import BookViewer from './BookViewer.vue'

const route = useRoute()
const type = computed(() => route.params.type as string)
</script>

<style scoped>
.unknown-content-type { padding: 4rem 2rem; text-align: center; color: var(--color-text-muted); }
</style>
