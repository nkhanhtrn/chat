import { ref } from 'vue'

export function useStaleDataDetection() {
  const showStaleDataBanner = ref(false)
  const isReadOnlyMode = ref(false)

  const refresh = () => {}
  const dismissBanner = () => { showStaleDataBanner.value = false }
  const triggerBanner = () => { showStaleDataBanner.value = true }

  return { showStaleDataBanner, isReadOnlyMode, refresh, dismissBanner, triggerBanner }
}
