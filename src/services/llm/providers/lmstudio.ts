import axios from 'axios'
import type { LLMMessage, SendMessageResult } from '@/types/llm'
import { ProviderBase } from '../ProviderBase'
import { parseSSEStream } from '../SSEParser'
import { parseOpenAIUsage } from '@/utils/tokenUsage'

const DEFAULT_BASE_URL = 'http://localhost:1234'

export class LMStudioProvider extends ProviderBase {
  readonly id = 'lmstudio'
  readonly name = 'LM Studio'
  readonly category = 'free' as const
  readonly requiresApiKey = false
  readonly supportsStreaming = true
  readonly defaultBaseUrl = DEFAULT_BASE_URL

  getDefaultModel(): string { return 'local-model' }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl

    try {
      const api = axios.create({ baseURL: baseUrl, headers: { 'Content-Type': 'application/json' } })
      const response = await api.get('/v1/models')
      if (response.data.data && Array.isArray(response.data.data)) {
        return response.data.data.map((m: any) => ({ id: m.id, name: m.id }))
      }
      if (Array.isArray(response.data)) {
        return response.data.map((m: any) => ({ id: m.id ?? m, name: m.id ?? m }))
      }
      return []
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to LM Studio. Make sure the server is running.')
      }
      throw new Error(error.response?.data?.error?.message ?? 'Failed to fetch models')
    }
  }

  async send(messages: LLMMessage[]): Promise<SendMessageResult> {
    const model = this.getModelId()
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl

    const api = axios.create({ baseURL: baseUrl, headers: { 'Content-Type': 'application/json' } })
    const response = await api.post('/v1/chat/completions', {
      model, messages, temperature: 0.7, max_tokens: -1, stream: false
    })

    const usage = parseOpenAIUsage(response.data)
    if (response.data.choices?.length) {
      return { content: response.data.choices[0].message.content, usage }
    }
    throw new Error('No response from model')
  }

  async *sendStream(messages: LLMMessage[]): AsyncIterable<string> {
    const model = this.getModelId()
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: -1, stream: true })
    })

    if (!response.ok) throw new Error('Failed to get chat response')

    const reader = response.body!.getReader()
    const chunks: string[] = []
    let resolveChunk: ((result: IteratorResult<string>) => void) | null = null
    let streamDone = false

    const processStream = async () => {
      try {
        await parseSSEStream(reader, {
          extractContent: (data) => {
            const choices = data.choices as any[]
            return choices?.[0]?.delta?.content ?? null
          },
          onChunk: (chunk) => {
            if (resolveChunk) {
              const r = resolveChunk
              resolveChunk = null
              r({ value: chunk, done: false })
            } else {
              chunks.push(chunk)
            }
          }
        })
      } finally {
        streamDone = true
        if (resolveChunk) {
          const r = resolveChunk
          resolveChunk = null
          r({ value: undefined as any, done: true })
        }
      }
    }

    const streamPromise = processStream()

    while (true) {
      if (chunks.length > 0) { yield chunks.shift()!; continue }
      if (streamDone) break
      const result = await new Promise<IteratorResult<string>>((resolve) => { resolveChunk = resolve })
      if (result.done) break
      yield result.value
    }

    await streamPromise
  }
}

export const lmstudioProvider = new LMStudioProvider()
export default lmstudioProvider
