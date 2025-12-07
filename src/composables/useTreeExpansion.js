import { ref, watch, computed } from 'vue'

/**
 * Composable for managing tree expansion state in sidebar
 * Handles which root is expanded and the path from root to current message
 *
 * @param {Object} options
 * @param {Function} options.getMessageById - Function to get message by ID
 * @param {import('vue').Ref<string|null>} options.currentMessageId - Reactive ref to current message ID
 * @returns {Object} - Tree expansion state and methods
 */
export function useTreeExpansion({ getMessageById, currentMessageId }) {
  // Track which root message tree is expanded (only one at a time)
  const expandedRootId = ref(null)

  // Track the expanded path within the tree (ancestors of current selection)
  const expandedPath = ref(new Set())

  /**
   * Build the expanded path from root to a specific child (inclusive)
   * @param {string} childId - The child message ID to build path to
   */
  const buildPathToChild = (childId) => {
    const newPath = new Set()
    let msg = getMessageById(childId)

    // Include the child itself so its children are visible
    newPath.add(childId)

    while (msg?.parentId) {
      newPath.add(msg.parentId)
      msg = getMessageById(msg.parentId)
    }

    expandedPath.value = newPath
  }

  /**
   * Find the root ID for a given message by walking up the tree
   * @param {string} messageId - Message ID to find root for
   * @returns {string|null} - Root message ID or null
   */
  const findRootId = (messageId) => {
    let msg = getMessageById(messageId)
    while (msg?.parentId) {
      msg = getMessageById(msg.parentId)
    }
    return msg?.id || null
  }

  /**
   * Check if a message is in the active path (from root to current message)
   * @param {string} messageId - Message ID to check
   * @param {string} currentMsgId - Current message ID for comparison
   * @returns {boolean}
   */
  const isInActivePath = (messageId, currentMsgId) => {
    if (messageId === currentMsgId) return true
    const currentRootId = currentMsgId ? findRootId(currentMsgId) : null
    if (messageId === currentRootId) return true
    return expandedPath.value.has(messageId)
  }

  /**
   * Check if a root is currently expanded
   * @param {string} rootId - Root message ID
   * @returns {boolean}
   */
  const isRootExpanded = (rootId) => {
    return expandedRootId.value === rootId
  }

  /**
   * Toggle expansion of a node within the tree
   * @param {string} messageId - Message ID to toggle
   * @param {Object} options - Options
   * @param {boolean} options.expandOnly - If true, only expand (never collapse)
   */
  const toggleExpand = (messageId, { expandOnly = false } = {}) => {
    if (expandedPath.value.has(messageId)) {
      if (expandOnly) return
      // Collapse: remove this node and all its descendants from path
      const newPath = new Set(expandedPath.value)
      newPath.delete(messageId)

      // Also remove any descendants
      const removeDescendants = (id) => {
        const msg = getMessageById(id)
        if (msg?.childIds) {
          msg.childIds.forEach(childId => {
            newPath.delete(childId)
            removeDescendants(childId)
          })
        }
      }
      removeDescendants(messageId)

      expandedPath.value = newPath
    } else {
      // Expand: add this node to path
      expandedPath.value = new Set([...expandedPath.value, messageId])
    }
  }

  /**
   * Toggle a root's expansion and reset the path
   * @param {string} rootId - Root message ID
   * @param {Object} options - Options
   * @param {boolean} options.expandOnly - If true, only expand (never collapse)
   */
  const toggleRoot = (rootId, { expandOnly = false } = {}) => {
    if (expandedRootId.value === rootId) {
      if (!expandOnly) {
        expandedRootId.value = null
        expandedPath.value = new Set()
      }
    } else {
      expandedRootId.value = rootId
      expandedPath.value = new Set()
    }
  }

  /**
   * Expand tree to show a specific message
   * @param {string} messageId - Message ID to expand to
   */
  const expandToMessage = (messageId) => {
    const rootId = findRootId(messageId)
    if (rootId) {
      expandedRootId.value = rootId
      buildPathToChild(messageId)
    }
  }

  // Auto-expand when currentMessageId changes
  watch(currentMessageId, (newId) => {
    if (newId) {
      expandToMessage(newId)
    }
  }, { immediate: true })

  return {
    expandedRootId,
    expandedPath,
    buildPathToChild,
    findRootId,
    isInActivePath,
    isRootExpanded,
    toggleExpand,
    toggleRoot,
    expandToMessage
  }
}
