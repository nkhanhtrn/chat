import { describe, it, expect, vi, beforeEach } from 'vitest'

const settingsState = vi.hoisted(() => ({
  openrouterApiKey: 'sk-or-test',
  openrouterModels: '',
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
    settingsState.openrouterModels = ''
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
    it('returns the message content using the default model', async () => {
      const fetchMock = vi.fn(async () => okJson('hello'))
      vi.stubGlobal('fetch', fetchMock)
      const out = await openRouterProvider.send('hi')
      expect(out).toBe('hello')
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(String(fetchMock.mock.calls[0][0])).toBe('https://openrouter.ai/api/v1/chat/completions')
      expect(JSON.parse(init.body as string).model).toBe('google/gemma-4-31b-it:free')
    })

    it('retries the next model when the first is rate-limited', async () => {
      settingsState.openrouterModels = 'google/gemma-4-31b-it:free, nvidia/nemotron-3.5-lightning:free'
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(429, 'Rate limit exceeded'))
        .mockResolvedValueOnce(okJson('second-model'))
      vi.stubGlobal('fetch', fetchMock)
      const out = await openRouterProvider.send('hi')
      expect(out).toBe('second-model')
      const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).model)
      expect(bodies).toEqual(['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free'])
    })

    it('throws the enriched error when all models fail', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => errorResponse(429, 'Rate limit exceeded')))
      await expect(openRouterProvider.send('hi')).rejects.toThrow(/429.*Rate limit exceeded/)
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

    it('retries the next model when the first fails before any chunk', async () => {
      settingsState.openrouterModels = 'google/gemma-4-31b-it:free, nvidia/nemotron-3.5-lightning:free'
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(429, 'Rate limit exceeded'))
        .mockResolvedValueOnce(okStream('or', '-ok'))
      vi.stubGlobal('fetch', fetchMock)
      const out = await drain(openRouterProvider.sendStream('hi'))
      expect(out).toBe('or-ok')
    })

    it('does not retry after a partial stream', async () => {
      settingsState.openrouterModels = 'google/gemma-4-31b-it:free, nvidia/nemotron-3.5-lightning:free'
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
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws when not configured', async () => {
      settingsState.openrouterApiKey = ''
      await expect(drain(openRouterProvider.sendStream('hi'))).rejects.toThrow(/not configured/)
    })
  })
})
