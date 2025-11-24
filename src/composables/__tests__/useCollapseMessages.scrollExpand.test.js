import { ref } from 'vue'
import { useCollapseMessages } from '../useCollapseMessages'

describe('useCollapseMessages - scroll/expand integration', () => {
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

  it('expands both user and assistant when scrolling to a user message', () => {
    const { collapsedMap } = useCollapseMessages(chat)
    // Simulate both user and assistant collapsed
    collapsedMap.value = { 2: true, 3: true }
    // Simulate scroll-to logic: expand user and assistant
    const userMsgIdx = 2
    collapsedMap.value = { ...collapsedMap.value, [userMsgIdx]: false }
    if (chat.value.messages[userMsgIdx + 1]?.role === 'assistant') {
      collapsedMap.value[userMsgIdx + 1] = false
    }
    expect(collapsedMap.value[2]).toBe(false)
    expect(collapsedMap.value[3]).toBe(false)
  })

  it('does not throw if there is no assistant after user', () => {
    chat.value.messages = [
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'how are you?' }
    ]
    const { collapsedMap } = useCollapseMessages(chat)
    collapsedMap.value = { 0: true, 1: true }
    const userMsgIdx = 0
    collapsedMap.value = { ...collapsedMap.value, [userMsgIdx]: false }
    if (chat.value.messages[userMsgIdx + 1]?.role === 'assistant') {
      collapsedMap.value[userMsgIdx + 1] = false
    }
    expect(collapsedMap.value[0]).toBe(false)
    // No error, and index 1 remains as is
    expect(collapsedMap.value[1]).toBe(true)
  })
})
