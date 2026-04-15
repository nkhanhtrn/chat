import { ref, watch } from 'vue'
import type { Ref } from 'vue'

interface MessageLike {
  id: string
  parentId: string | null
  childIds: string[]
}

export function useTreeExpansion(options: {
  getMessageById: (id: string) => MessageLike | null
  currentMessageId: Ref<string | null>
  initialExpandAll?: boolean
}) {
  const { getMessageById, currentMessageId, initialExpandAll = false } = options

  const expandedRootId = ref<string | null>(null)
  const expandedPath = ref<Set<string>>(new Set())
  const expandedRoots = ref<Set<string>>(new Set())
  const expandAllMode = ref(initialExpandAll)

  const buildPathToChild = (childId: string) => {
    const newPath = new Set<string>()
    let msg = getMessageById(childId)
    newPath.add(childId)
    while (msg?.parentId) {
      newPath.add(msg.parentId)
      msg = getMessageById(msg.parentId)
    }
    expandedPath.value = newPath
  }

  const findRootId = (messageId: string): string | null => {
    let msg = getMessageById(messageId)
    while (msg?.parentId) msg = getMessageById(msg.parentId)
    return msg?.id ?? null
  }

  const isInActivePath = (messageId: string, currentMsgId: string): boolean => {
    if (messageId === currentMsgId) return true
    const currentRootId = currentMsgId ? findRootId(currentMsgId) : null
    if (messageId === currentRootId) return true
    return expandedPath.value.has(messageId)
  }

  const isRootExpanded = (rootId: string): boolean => {
    if (expandAllMode.value) return !expandedRoots.value.has(rootId + '_collapsed')
    return expandedRootId.value === rootId
  }

  const toggleExpand = (messageId: string, opts: { expandOnly?: boolean } = {}) => {
    if (expandedPath.value.has(messageId)) {
      if (opts.expandOnly) return
      const newPath = new Set(expandedPath.value)
      newPath.delete(messageId)
      const removeDescendants = (id: string) => {
        const msg = getMessageById(id)
        if (msg?.childIds) msg.childIds.forEach(childId => { newPath.delete(childId); removeDescendants(childId) })
      }
      removeDescendants(messageId)
      expandedPath.value = newPath
    } else {
      expandedPath.value = new Set([...expandedPath.value, messageId])
    }
  }

  const toggleRoot = (rootId: string, opts: { expandOnly?: boolean } = {}) => {
    if (expandAllMode.value) {
      const newRoots = new Set(expandedRoots.value)
      if (newRoots.has(rootId + '_collapsed')) {
        newRoots.delete(rootId + '_collapsed')
      } else if (!opts.expandOnly) {
        newRoots.add(rootId + '_collapsed')
      }
      expandedRoots.value = newRoots
    } else {
      if (expandedRootId.value === rootId) {
        if (!opts.expandOnly) { expandedRootId.value = null; expandedPath.value = new Set() }
      } else {
        expandedRootId.value = rootId
        expandedPath.value = new Set()
      }
    }
  }

  const expandToMessage = (messageId: string) => {
    const rootId = findRootId(messageId)
    if (rootId) {
      expandedRootId.value = rootId
      buildPathToChild(messageId)
    }
  }

  watch(currentMessageId, (newId) => {
    if (newId) expandToMessage(newId)
  }, { immediate: true })

  return { expandedRootId, expandedPath, expandedRoots, expandAllMode, buildPathToChild, findRootId, isInActivePath, isRootExpanded, toggleExpand, toggleRoot, expandToMessage }
}
