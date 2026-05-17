import { Settings } from '@/services/settings'

const DEFAULT_BASE_URL = 'http://localhost:4096'

export class OpenCodeProvider {
  readonly id = 'opencode'
  readonly name = 'OpenCode'
  readonly supportsStreaming = true

  private _baseUrl = ''

  private getBaseUrl(): string {
    const settings = Settings.getAll() as Record<string, any>
    let url = (settings.codeApiUrl as string) || DEFAULT_BASE_URL
    if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`
    return url.replace(/\/+$/, '')
  }

  invalidateClient(): void {
    this._baseUrl = ''
  }

  async createSession(title?: string): Promise<string> {
    const baseUrl = this.getBaseUrl()
    const res = await fetch(`${baseUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
    const data = await res.json()
    return data.id
  }

  async deleteSession(sessionId: string): Promise<void> {
    const baseUrl = this.getBaseUrl()
    try {
      await fetch(`${baseUrl}/session/${sessionId}`, { method: 'DELETE' })
    } catch {}
  }

  async send(sessionId: string, text: string): Promise<string> {
    const baseUrl = this.getBaseUrl()
    const res = await fetch(`${baseUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text }],
      }),
    })
    if (!res.ok) throw new Error(`Send failed: ${res.status}`)
    const data = await res.json()
    return extractText(data.parts ?? [])
  }

  async *sendStream(sessionId: string, text: string, signal?: AbortSignal): AsyncIterable<string> {
    const baseUrl = this.getBaseUrl()

    const eventRes = await fetch(`${baseUrl}/event`, {
      headers: { 'Accept': 'text/event-stream' },
      signal,
    })
    if (!eventRes.ok || !eventRes.body) throw new Error(`Event stream failed: ${eventRes.status}`)
    const eventReader = eventRes.body.getReader()
    const eventDecoder = new TextDecoder()

    await fetch(`${baseUrl}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text }],
      }),
    })

    let buffer = ''
    try {
      while (true) {
        if (signal?.aborted) break
        const { done, value } = await eventReader.read()
        if (done) break

        buffer += eventDecoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)

          try {
            const event = JSON.parse(payload)
            if (event.type === 'message.part.delta') {
              const props = event.properties
              if (props?.field === 'text' && props?.delta) yield props.delta
            }
            if (event.type === 'session.idle' && event.properties?.sessionID === sessionId) {
              return
            }
          } catch {}
        }
      }
    } finally {
      try { await eventReader.cancel() } catch {}
    }
  }
}

function extractText(parts: any[]): string {
  let text = ''
  for (const part of parts) {
    if (part.type === 'text' && part.text) text += part.text
  }
  return text
}

export const openCodeProvider = new OpenCodeProvider()
export default openCodeProvider
