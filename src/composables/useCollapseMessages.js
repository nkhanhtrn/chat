import { ref, watch } from 'vue'

/**
 * Composable for managing collapsed state of chat messages.
 * Handles collapse/expand all, manual collapse, and user-assistant linkage.
 */
export function useCollapseMessages(chat) {
  // Each message has its own collapse status
  const collapsedMap = ref({})
  // Track if all are collapsed for button state
  const allCollapsed = ref(false)

  // Keep collapsedMap in sync with chat messages
  watch(() => chat.value.messages.length, () => {
    // Add new messages as expanded by default
    const map = { ...collapsedMap.value }
    for (let i = 0; i < chat.value.messages.length; i++) {
      if (!(i in map)) map[i] = false
    }
    // Remove deleted messages
    Object.keys(map).forEach(k => {
      if (k >= chat.value.messages.length) delete map[k]
    })
    collapsedMap.value = map
  }, { immediate: true })

  // Collapse or expand all messages
  function toggleCollapseAll() {
    const shouldCollapse = !allCollapsed.value
    const map = {}
    const len = chat.value.messages.length
    for (let i = 0; i < len; i++) {
      map[i] = shouldCollapse
    }
    collapsedMap.value = map
    allCollapsed.value = shouldCollapse
  }

  // Helper to get collapsed state for a message
  function getCollapsed(index) {
    return !!collapsedMap.value[index]
  }

  // When a user message is collapsed/expanded, also update its reply (assistant)
  function onUserCollapse(userIdx, collapsed) {
    const map = { ...collapsedMap.value, [userIdx]: collapsed }
    if (chat.value.messages[userIdx + 1]?.role === 'assistant') {
      map[userIdx + 1] = collapsed
    }
    collapsedMap.value = map
    // Update allCollapsed state
    allCollapsed.value = Object.values(map).every(Boolean)
  }

  // When assistant message is clicked, expand its associated user message
  function expandAssociatedUser(assistantIdx) {
    const map = { ...collapsedMap.value, [assistantIdx]: false }
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (chat.value.messages[i]?.role === 'user') {
        map[i] = false
        break
      }
    }
    collapsedMap.value = map
    // Update allCollapsed state
    allCollapsed.value = Object.values(map).every(Boolean)
  }

  return {
    allCollapsed,
    collapsedMap,
    toggleCollapseAll,
    getCollapsed,
    onUserCollapse,
    expandAssociatedUser
  }
}
