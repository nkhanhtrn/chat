import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/settings', () => ({
  Settings: {
    getAll: () => ({ codeApiUrl: 'http://localhost:4096' }),
    getString: () => '',
  },
}))
vi.unmock('@/services/llm/providers/opencode')

const { openCodeProvider } = await import('@/services/llm/providers/opencode')

function sseBody(...events: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const payload = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(payload))
      controller.close()
    },
  })
}

function mockFetch(events: ReadableStream<Uint8Array>, promptStatus = 204): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/global/event')) {
        return { ok: true, status: 200, body: events } as any
      }
      if (u.includes('/prompt_async')) {
        return { ok: promptStatus >= 200 && promptStatus < 300, status: promptStatus, body: null } as any
      }
      return { ok: true, status: 200, body: null } as any
    }),
  )
}

async function drain(iter: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const c of iter) out += c
  return out
}

describe('openCodeProvider.sendStream', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws on first connection-failure retry so fallback fires fast', async () => {
    const retry = {
      type: 'session.status',
      properties: { sessionID: 'ses', status: { type: 'retry', message: 'Cannot connect to API: Unable to connect.' } },
    }
    mockFetch(sseBody(retry))
    await expect(drain(openCodeProvider.sendStream('ses', 'hi'))).rejects.toThrow(/cannot connect/i)
  })

  it('tolerates a non-connection retry and completes on session.idle', async () => {
    const retry = {
      type: 'session.status',
      properties: { sessionID: 'ses', status: { type: 'retry', message: 'rate limited, backing off' } },
    }
    const idle = { type: 'session.idle', properties: { sessionID: 'ses' } }
    mockFetch(sseBody(retry, idle))
    const out = await drain(openCodeProvider.sendStream('ses', 'hi'))
    expect(out).toBe('')
  })

  it('streams message.part.delta text and completes on idle', async () => {
    const delta1 = { type: 'message.part.delta', properties: { sessionID: 'ses', field: 'text', delta: 'hel' } }
    const delta2 = { type: 'message.part.delta', properties: { sessionID: 'ses', field: 'text', delta: 'lo' } }
    const idle = { type: 'session.idle', properties: { sessionID: 'ses' } }
    mockFetch(sseBody(delta1, delta2, idle))
    const out = await drain(openCodeProvider.sendStream('ses', 'hi'))
    expect(out).toBe('hello')
  })

  it('throws when prompt_async returns a non-ok status', async () => {
    const empty = new ReadableStream<Uint8Array>({ start(c) { c.close() } })
    mockFetch(empty, 500)
    await expect(drain(openCodeProvider.sendStream('ses', 'hi'))).rejects.toThrow(/prompt_async failed: 500/)
  })
})
