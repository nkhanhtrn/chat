import type { LLMMessage, SendMessageResult } from '@/types/llm'
import { ProviderBase } from '../ProviderBase'
import { parseSSEStream } from '../SSEParser'
import { getNextApiKey } from '../keyRotation'
import { parseGeminiUsage } from '@/utils/tokenUsage'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

function convertMessages(messages: LLMMessage[]) {
  const systemMessage = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  return {
    contents,
    systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined
  }
}

export class GoogleProvider extends ProviderBase {
  readonly id = 'google'
  readonly name = 'Google AI Studio'
  readonly category = 'details' as const
  readonly requiresApiKey = true
  readonly supportsStreaming = true
  readonly defaultBaseUrl = DEFAULT_BASE_URL

  getDefaultModel(): string { return 'models/gemini-2.5-flash' }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl
    const keyToUse = getNextApiKey((config.apiKeys ?? config.apiKey) as string | string[] | undefined)
    if (!keyToUse) return []

    try {
      const response = await fetch(`${baseUrl}/models?key=${keyToUse}`)
      if (!response.ok) return []
      const data = await response.json() as Record<string, any>
      return (data.models ?? [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({ id: m.name, name: m.displayName ?? m.name.replace('models/', '') }))
    } catch {
      return []
    }
  }

  async send(messages: LLMMessage[]): Promise<SendMessageResult> {
    const model = this.getModelId()
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl
    const keyToUse = getNextApiKey((config.apiKeys ?? config.apiKey) as string | string[] | undefined)

    if (!keyToUse) throw new Error('Google AI API key is required')

    const { contents, systemInstruction } = convertMessages(messages)

    const response = await fetch(`${baseUrl}/${model}:generateContent?key=${keyToUse}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemInstruction, generationConfig: { temperature: 0.7 } })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as any).error?.message ?? `HTTP ${response.status}`)
    }

    const data = await response.json() as Record<string, any>
    const usage = parseGeminiUsage(data)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('No response from model')

    return { content: text, usage }
  }

  async *sendStream(messages: LLMMessage[]): AsyncIterable<string> {
    const model = this.getModelId()
    const config = this.getResolvedConfig()
    const baseUrl = (config.baseUrl as string) ?? this.defaultBaseUrl
    const keyToUse = getNextApiKey((config.apiKeys ?? config.apiKey) as string | string[] | undefined)

    if (!keyToUse) throw new Error('Google AI API key is required')

    const { contents, systemInstruction } = convertMessages(messages)

    const response = await fetch(`${baseUrl}/${model}:streamGenerateContent?alt=sse&key=${keyToUse}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemInstruction, generationConfig: { temperature: 0.7 } })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as any).error?.message ?? `HTTP ${response.status}`)
    }

    const reader = response.body!.getReader()
    const chunks: string[] = []
    let resolveChunk: ((result: IteratorResult<string>) => void) | null = null
    let streamDone = false

    const processStream = async () => {
      try {
        await parseSSEStream(reader, {
          extractContent: (data) => (data.candidates as any[])?.[0]?.content?.parts?.[0]?.text ?? null,
          extractUsage: (data) => data.usageMetadata ? parseGeminiUsage(data as any) : null,
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
      if (chunks.length > 0) {
        yield chunks.shift()!
        continue
      }
      if (streamDone) break
      const result = await new Promise<IteratorResult<string>>((resolve) => { resolveChunk = resolve })
      if (result.done) break
      yield result.value
    }

    await streamPromise
  }
}

export const googleProvider = new GoogleProvider()
export default googleProvider
