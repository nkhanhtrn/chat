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
  <Toaster />
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import StaleDataBanner from '@/components/StaleDataBanner.vue'
import DevToolbar from '@/components/DevToolbar.vue'
import { Toaster } from 'vue-sonner'
import { useNotebookStore } from '@/stores/notebook'
import { useStaleDataDetection } from '@/composables/useStaleDataDetection'
import { getDevToolbarEnabled, setDevToolbarEnabled } from '@/composables/useEnvironment'

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

onMounted(() => {
  if ((window as any).__notebookDeleted) {
    delete (window as any).__notebookDeleted
    router.push({ name: 'notebooks' })
  }
})
</script>

<style>
.dev-toolbar-spacer {
  height: 41px;
}
</style>
