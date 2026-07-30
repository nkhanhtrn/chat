import { Settings } from '@/services/settings'

const DEFAULT_ZEN_PROXY_URL = 'https://us-central1-nk-cloud-323802.cloudfunctions.net/zenProxy'
const ZEN_MODEL = 'deepseek-v4-flash-free'

class ZenProvider {
  readonly id = 'opencode-zen'
  readonly name = 'OpenCode Zen'
  readonly supportsStreaming = true

  private _getApiKey(): string {
    return Settings.getString('opencodeApiKey')
  }

  private _getEndpoint(): string {
    return Settings.getString('opencodeZenUrl') || DEFAULT_ZEN_PROXY_URL
  }

  isConfigured(): boolean {
    return this._getApiKey().length > 0
  }

  private _headers(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
  }

  async send(text: string, signal?: AbortSignal): Promise<string> {
    const apiKey = this._getApiKey()
    if (!apiKey) throw new Error('OpenCode Zen API key is not configured')
    const res = await fetch(this._getEndpoint(), {
      method: 'POST',
      headers: this._headers(apiKey),
      body: JSON.stringify({
        model: ZEN_MODEL,
        messages: [{ role: 'user', content: text }],
        stream: false,
      }),
      signal,
    })
    if (!res.ok) throw new Error(`Zen request failed: ${res.status}`)
    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? ''
  }

  async *sendStream(text: string, signal?: AbortSignal): AsyncIterable<string> {
    const apiKey = this._getApiKey()
    if (!apiKey) throw new Error('OpenCode Zen API key is not configured')
    const res = await fetch(this._getEndpoint(), {
      method: 'POST',
      headers: this._headers(apiKey),
      body: JSON.stringify({
        model: ZEN_MODEL,
        messages: [{ role: 'user', content: text }],
        stream: true,
      }),
      signal,
    })
    if (!res.ok || !res.body) throw new Error(`Zen stream failed: ${res.status}`)

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

export const zenProvider = new ZenProvider()
