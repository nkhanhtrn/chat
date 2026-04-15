import type { LLMMessage, SendMessageResult, ProviderConfig } from '@/types/llm'
import { ProviderBase } from '../ProviderBase'
import { parseSSEStream } from '../SSEParser'
import { getNextApiKey } from '../keyRotation'
import { parseOpenAIUsage } from '@/utils/tokenUsage'

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1'

export class CerebrasProvider extends ProviderBase {
  readonly id = 'cerebras'
  readonly name = 'Cerebras'
  readonly category = 'quick' as const
  readonly requiresApiKey = true
  readonly supportsStreaming = true
  readonly defaultBaseUrl = DEFAULT_BASE_URL

  getDefaultModel(): string { return 'gpt-oss-120b' }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    const config = this.getResolvedConfig()
    const keyToUse = getNextApiKey((config.apiKeys ?? config.apiKey) as string | string[] | undefined)
    if (!keyToUse) return []
    return [
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B' },
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
      { id: 'qwen-3-32b', name: 'Qwen 3 32B' }
    ]
  }

  async send(messages: LLMMessage[]): Promise<SendMessageResult> {
    const model = this.getModelId()
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl
    const keyToUse = getNextApiKey((config.apiKeys ?? config.apiKey) as string | string[] | undefined)

    if (!keyToUse) throw new Error('Cerebras API key is required')

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as any).error?.message ?? `HTTP ${response.status}`)
    }

    const data = await response.json() as Record<string, any>
    const usage = parseOpenAIUsage(data)
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('No response from model')

    return { content, usage }
  }

  async *sendStream(messages: LLMMessage[]): AsyncIterable<string> {
    const model = this.getModelId()
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl
    const keyToUse = getNextApiKey((config.apiKeys ?? config.apiKey) as string | string[] | undefined)

    if (!keyToUse) throw new Error('Cerebras API key is required')

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.7, stream: true })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as any).error?.message ?? `HTTP ${response.status}`)
    }

    const reader = response.body!.getReader()
    const chunks: string[] = []

    // Use a queue-based approach for async iterable
    let resolveChunk: ((result: IteratorResult<string>) => void) | null = null
    let done = false

    const processStream = async () => {
      try {
        await parseSSEStream(reader, {
          extractContent: (data) => (data.choices as any[])?.[0]?.delta?.content ?? null,
          extractUsage: (data) => data.usage ? parseOpenAIUsage(data as any) : null,
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
        done = true
        if (resolveChunk) {
          const r = resolveChunk
          resolveChunk = null
          r({ value: undefined as any, done: true })
        }
      }
    }

    const streamPromise = processStream()

    while (true) {
      if (chunks.length > 0) {
        yield chunks.shift()!
        continue
      }
      if (done) break

      const result = await new Promise<IteratorResult<string>>((resolve) => {
        resolveChunk = resolve
      })
      if (result.done) break
      yield result.value
    }

    await streamPromise
  }
}

export const cerebrasProvider = new CerebrasProvider()
export default cerebrasProvider
