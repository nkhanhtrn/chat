import { debugLog } from '@/utils/debug'
import { ref, watch, onMounted, onUnmounted } from 'vue'

const MOBILE_BREAKPOINT = 768

export function useSidebarCollapse(storageKey = 'chatSidebarCollapsed') {
  const isCollapsed = ref(false)

  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT

  const handleResize = () => {
    if (isMobile() && !isCollapsed.value) {
      isCollapsed.value = true
    }
  }

  onMounted(() => {
    if (isMobile()) {
      isCollapsed.value = true
    } else {
      const savedState = localStorage.getItem(storageKey)
      if (savedState !== null) {
        isCollapsed.value = savedState === 'true'
      }
    }
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  watch(isCollapsed, (newValue) => {
    if (!isMobile()) {
      localStorage.setItem(storageKey, String(newValue))
    }
  })

  const toggle = () => { isCollapsed.value = !isCollapsed.value }
  const collapse = () => { isCollapsed.value = true }

  return { isCollapsed, toggle, collapse }
}
