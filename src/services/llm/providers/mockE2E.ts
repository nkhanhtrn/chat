import type { LLMMessage, SendMessageResult } from '@/types/llm'
import { ProviderBase } from '../ProviderBase'

const MOCK_SERVER_URL = 'http://localhost:3001'

function isE2EMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('__e2e__') === 'true'
}

export class MockE2EProvider extends ProviderBase {
  readonly id = 'mock-e2e'
  readonly name = 'Mock E2E'
  readonly category = 'free' as const
  readonly requiresApiKey = false
  readonly supportsStreaming = false
  readonly defaultBaseUrl = MOCK_SERVER_URL

  getDefaultModel(): string { return 'mock-model' }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return [{ id: 'mock-model', name: 'Mock Model' }]
  }

  async send(messages: LLMMessage[]): Promise<SendMessageResult> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    const question = lastUserMessage?.content ?? ''
    if (!question) throw new Error('No question found in messages')

    let notebookId: string | null = null
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/\/notebook\/([^/?#]+)/)
      if (match) notebookId = match[1] ?? null
    }

    const response = await fetch(`${MOCK_SERVER_URL}/api/notebook/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ question, notebookId })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Mock server error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as Record<string, any>
    const content = data?.data?.answer ?? data?.answer ?? ''
    return { content }
  }

  async *sendStream(_messages: LLMMessage[]): AsyncIterable<string> {
    const result = await this.send(_messages)
    yield result.content
  }

  static isActive(): boolean {
    return isE2EMode()
  }
}

export const mockE2EProvider = new MockE2EProvider()
export default mockE2EProvider
