import { ref } from 'vue'
import { useChatMessages } from '../useChatMessages'


// Mocks for API and emit
vi.mock('../../services/api.js', () => ({
  sendChatMessage: vi.fn(async (messages, model, onChunk) => {
    if (onChunk) {
      onChunk('Hello')
      return 'Hello'
    }
    return 'Hello'
  }),
  abortChatMessage: vi.fn(),
  saveChats: vi.fn()
}))

describe('useChatMessages', () => {
  let props, emit, scrollToBottom
  beforeEach(() => {
    props = {
      chat: {
        id: '1',
        messages: [],
        chats: [{ id: '1', messages: [] }]
      },
      selectedModel: 'test-model'
    }
    emit = vi.fn()
    scrollToBottom = vi.fn()
  })

  it('handleSendMessage adds user and assistant messages', async () => {
    const { handleSendMessage } = useChatMessages(props, emit, scrollToBottom)
    await handleSendMessage('Hi')
    expect(props.chat.messages.length).toBe(2)
    expect(props.chat.messages[0].role).toBe('user')
    expect(props.chat.messages[1].role).toBe('assistant')
    expect(scrollToBottom).toHaveBeenCalled()
  })

  it('retryMessage replaces messages after index', async () => {
    props.chat.messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' }
    ]
    const { retryMessage } = useChatMessages(props, emit, scrollToBottom)
    await retryMessage(1)
    expect(props.chat.messages.length).toBe(3)
    expect(props.chat.messages[2].role).toBe('assistant')
  })

  it('editMessage updates content and retries', async () => {
    props.chat.messages = [
      { role: 'user', content: 'hi', displayContent: 'hi' },
      { role: 'assistant', content: 'hello', displayContent: 'hello' }
    ]
    const { editMessage } = useChatMessages(props, emit, scrollToBottom)
    await editMessage(0, 'edited')
    expect(props.chat.messages[0].content).toBe('edited')
    expect(props.chat.messages.length).toBe(2)
    expect(props.chat.messages[1].role).toBe('assistant')
  })

  it('compressConversation adds summary message', async () => {
    props.chat.messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' }
    ]
    const { compressConversation } = useChatMessages(props, emit, scrollToBottom)
    await compressConversation()
    expect(props.chat.messages[2].role).toBe('assistant')
    expect(props.chat.messages[2].compressed).toBe(true)
  })

  it('stopStreaming aborts and emits', () => {
    const { stopStreaming } = useChatMessages(props, emit, scrollToBottom)
    stopStreaming()
    expect(emit).toHaveBeenCalledWith('loading-change', false)
  })

  it('deleteMessage removes user and assistant and saves', () => {
    props.chat.messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' }
    ]
    const { deleteMessage } = useChatMessages(props, emit, scrollToBottom)
    deleteMessage(0)
    expect(props.chat.messages.length).toBe(1)
  })
})
