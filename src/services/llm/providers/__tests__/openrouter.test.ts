import { describe, it, expect, vi, beforeEach } from 'vitest'

const settingsState = vi.hoisted(() => ({
  openrouterApiKey: 'sk-or-test',
}))

vi.mock('@/services/settings', () => ({
  Settings: {
    getAll: () => ({ ...settingsState }),
    getString: (key: string) => (settingsState as Record<string, string>)[key] ?? '',
  },
}))
vi.unmock('@/services/llm/providers/openrouter')

const { openRouterProvider } = await import('@/services/llm/providers/openrouter')

function sseBody(...events: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const payload = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(payload))
      controller.close()
    },
  })
}

function okStream(...deltas: string[]): Response {
  const events = deltas.map((d) => ({ choices: [{ delta: { content: d } }] }))
  return { ok: true, status: 200, body: sseBody(...events) } as unknown as Response
}

function okJson(content: string): Response {
  return {
    ok: true,
    status: 200,
    body: null,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response
}

function errorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    body: null,
    json: async () => ({ error: { message } }),
  } as unknown as Response
}

async function drain(iter: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const c of iter) out += c
  return out
}

describe('openRouterProvider', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    settingsState.openrouterApiKey = 'sk-or-test'
  })

  describe('isConfigured', () => {
    it('is true with an API key', () => {
      expect(openRouterProvider.isConfigured()).toBe(true)
    })

    it('is false without an API key', () => {
      settingsState.openrouterApiKey = ''
      expect(openRouterProvider.isConfigured()).toBe(false)
    })
  })

  describe('send', () => {
    it('returns the message content using the pinned gemma model', async () => {
      const fetchMock = vi.fn(async () => okJson('hello'))
      vi.stubGlobal('fetch', fetchMock)
      const out = await openRouterProvider.send('hi')
      expect(out).toBe('hello')
      expect(String(fetchMock.mock.calls[0][0])).toBe('https://openrouter.ai/api/v1/chat/completions')
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(JSON.parse(init.body as string).model).toBe('google/gemma-4-31b-it:free')
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-test')
    })

    it('makes a single request and throws the enriched error on 429', async () => {
      const fetchMock = vi.fn(async () => errorResponse(429, 'Rate limit exceeded'))
      vi.stubGlobal('fetch', fetchMock)
      await expect(openRouterProvider.send('hi')).rejects.toThrow(/429.*Rate limit exceeded/)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws when not configured', async () => {
      settingsState.openrouterApiKey = ''
      await expect(openRouterProvider.send('hi')).rejects.toThrow(/not configured/)
    })
  })

  describe('sendStream', () => {
    it('yields content deltas', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => okStream('hel', 'lo')))
      const out = await drain(openRouterProvider.sendStream('hi'))
      expect(out).toBe('hello')
    })

    it('surfaces 429 with a single request', async () => {
      const fetchMock = vi.fn(async () => errorResponse(429, 'Rate limit exceeded'))
      vi.stubGlobal('fetch', fetchMock)
      await expect(drain(openRouterProvider.sendStream('hi'))).rejects.toThrow(/429.*Rate limit exceeded/)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('propagates mid-stream failures', async () => {
      const enc = new TextEncoder()
      const partial = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'par' } }] })}\n\n`))
          setTimeout(() => controller.error(new Error('drop')), 10)
        },
      })
      const fetchMock = vi.fn(async () => ({ ok: true, status: 200, body: partial } as unknown as Response))
      vi.stubGlobal('fetch', fetchMock)
      await expect(drain(openRouterProvider.sendStream('hi'))).rejects.toThrow('drop')
    })

    it('throws when not configured', async () => {
      settingsState.openrouterApiKey = ''
      await expect(drain(openRouterProvider.sendStream('hi'))).rejects.toThrow(/not configured/)
    })
  })
})
