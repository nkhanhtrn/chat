import { ref } from 'vue'
import { useCollapseMessages } from '../useCollapseMessages'

describe('useCollapseMessages', () => {
  let chat
  beforeEach(() => {
    chat = ref({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'how are you?' },
        { role: 'assistant', content: 'fine' }
      ]
    })
  })

  it('toggles collapse all and expands all', () => {
    const {
      collapseAllMessages,
      collapsedMap,
      toggleCollapseAll
    } = useCollapseMessages(chat)
    expect(collapseAllMessages.value).toBe(false)
    toggleCollapseAll()
    expect(collapseAllMessages.value).toBe(true)
    expect(collapsedMap.value).toEqual({ 0: true, 1: true, 2: true })
    toggleCollapseAll()
    expect(collapseAllMessages.value).toBe(false)
    expect(collapsedMap.value).toEqual({})
  })

  it('getCollapsed returns correct state', () => {
    const { getCollapsed, toggleCollapseAll } = useCollapseMessages(chat)
    // Not collapsed by default
    expect(getCollapsed(0)).toBe(false)
    // Collapse all
    toggleCollapseAll()
    expect(getCollapsed(0)).toBe(true)
    // Last message should not be collapsed
    expect(getCollapsed(3)).toBe(false)
  })

  it('onUserCollapse updates user and assistant', () => {
    const { onUserCollapse, collapsedMap } = useCollapseMessages(chat)
    onUserCollapse(0, true)
    expect(collapsedMap.value).toEqual({ 0: true, 1: true })
    onUserCollapse(2, false)
    expect(collapsedMap.value).toEqual({ 0: true, 1: true, 2: false, 3: false })
  })

  it('expandAssociatedUser expands user and assistant', () => {
    const { onUserCollapse, expandAssociatedUser, collapsedMap } = useCollapseMessages(chat)
    // Collapse user and assistant
    onUserCollapse(2, true)
    expect(collapsedMap.value[2]).toBe(true)
    expect(collapsedMap.value[3]).toBe(true)
    // Expand via assistant
    expandAssociatedUser(3)
    expect(collapsedMap.value[2]).toBe(false)
    expect(collapsedMap.value[3]).toBe(false)
  })
})
