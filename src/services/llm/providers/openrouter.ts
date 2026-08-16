import { Settings } from '@/services/settings'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'google/gemma-4-31b-it:free'

class OpenRouterProvider {
  readonly id = 'openrouter'
  readonly name = 'OpenRouter'
  readonly supportsStreaming = true

  private _getApiKey(): string {
    return Settings.getString('openrouterApiKey')
  }

  isConfigured(): boolean {
    return this._getApiKey().length > 0
  }

  private _headers(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Title': 'studygpt',
    }
  }

  private _body(text: string, stream: boolean): string {
    return JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: text }],
      stream,
    })
  }

  private async _error(res: Response): Promise<Error> {
    let detail = ''
    try {
      const data = await res.json()
      detail = data?.error?.message ?? ''
    } catch { /* ignore non-JSON error bodies */ }
    return new Error(`OpenRouter request failed: ${res.status}${detail ? ` — ${detail}` : ''}`)
  }

  async send(text: string, signal?: AbortSignal): Promise<string> {
    const apiKey = this._getApiKey()
    if (!apiKey) throw new Error('OpenRouter API key is not configured')
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: this._headers(apiKey),
      body: this._body(text, false),
      signal,
    })
    if (!res.ok) throw await this._error(res)
    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? ''
  }

  async *sendStream(text: string, signal?: AbortSignal): AsyncIterable<string> {
    const apiKey = this._getApiKey()
    if (!apiKey) throw new Error('OpenRouter API key is not configured')
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: this._headers(apiKey),
      body: this._body(text, true),
      signal,
    })
    if (!res.ok || !res.body) throw await this._error(res)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        if (signal?.aborted) break
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const raw = trimmed.slice(6)
          if (raw === '[DONE]') return
          try {
            const parsed = JSON.parse(raw)
            const delta = parsed?.choices?.[0]?.delta?.content
            if (delta) yield delta as string
          } catch { /* ignore malformed keepalive lines */ }
        }
      }
    } finally {
      try { await reader.cancel() } catch { /* ignore */ }
    }
  }
}

export const openRouterProvider = new OpenRouterProvider()
