import { ref } from 'vue'

/**
 * Composable for managing collapsed state of chat messages.
 * Handles collapse/expand all, manual collapse, and user-assistant linkage.
 */
export function useCollapseMessages(chat) {
  const collapseAllMessages = ref(false)
  const collapsedMap = ref({})

  // Toggle collapse all and reset collapsedMap accordingly
  function toggleCollapseAll() {
    collapseAllMessages.value = !collapseAllMessages.value
    if (collapseAllMessages.value) {
      // Collapse all except last message
      const map = {}
      for (let i = 0; i < chat.value.messages.length - 1; i++) {
        map[i] = true
      }
      collapsedMap.value = map
    } else {
      // Expand all
      collapsedMap.value = {}
    }
  }

  // Helper to get collapsed state for a message
  function getCollapsed(index) {
    if (collapseAllMessages.value && index !== chat.value.messages.length - 1) return true
    return !!collapsedMap.value[index]
  }

  // When a user message is collapsed/expanded, also update its reply (assistant)
  function onUserCollapse(userIdx, collapsed) {
    collapsedMap.value = { ...collapsedMap.value, [userIdx]: collapsed }
    if (chat.value.messages[userIdx + 1]?.role === 'assistant') {
      collapsedMap.value = { ...collapsedMap.value, [userIdx + 1]: collapsed }
    }
  }

  // When assistant message is clicked, expand its associated user message
  function expandAssociatedUser(assistantIdx) {
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (chat.value.messages[i]?.role === 'user') {
        collapsedMap.value = { ...collapsedMap.value, [i]: false, [assistantIdx]: false }
        break
      }
    }
  }

  return {
    collapseAllMessages,
    collapsedMap,
    toggleCollapseAll,
    getCollapsed,
    onUserCollapse,
    expandAssociatedUser
  }
}
