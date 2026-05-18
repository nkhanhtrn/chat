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
  <Toaster :theme="toasterTheme" :toastOptions="{ style: toasterStyle }" />
</template>

<script setup lang="ts">
import { ref, provide, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import StaleDataBanner from '@/components/StaleDataBanner.vue'
import DevToolbar from '@/components/DevToolbar.vue'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
import type { Theme } from 'vue-sonner'
import { useNotebookStore } from '@/stores/notebook'
import { useStaleDataDetection } from '@/composables/useStaleDataDetection'
import { getDevToolbarEnabled, setDevToolbarEnabled } from '@/composables/useEnvironment'

const router = useRouter()
const showDevToolbar = ref(getDevToolbarEnabled())

const themeRef = ref(document.documentElement.getAttribute('data-theme') || 'light')

const observer = new MutationObserver(() => {
  themeRef.value = document.documentElement.getAttribute('data-theme') || 'light'
})
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
onUnmounted(() => observer.disconnect())

const toasterTheme = computed<Theme>(() => themeRef.value === 'dark' ? 'dark' : 'light')

const toasterStyle = {
  background: 'var(--color-bg-page)',
  color: 'var(--color-text-base)',
  border: '1px solid var(--color-border-base)',
  fontSize: '1rem',
  padding: '0.875rem 1.25rem',
}

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
