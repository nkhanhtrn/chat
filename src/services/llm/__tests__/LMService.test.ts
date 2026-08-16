import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lmService } from '../LMService'

const opencode = await import('../providers/opencode').then(m => m.openCodeProvider)
const openrouter = await import('../providers/openrouter').then(m => m.openRouterProvider)

describe('LMService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.spyOn(openrouter, 'isConfigured').mockReturnValue(false)
    lmService.invalidateClient()
  })

  describe('ensureSession', () => {
    it('returns existing session ID when provided', async () => {
      const result = await lmService.ensureSession('msg-1', 'existing-session')
      expect(result).toBe('existing-session')
    })

    it('falls back to openrouter session when local server is unavailable', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'createSession').mockRejectedValueOnce(new Error('network'))
      const result = await lmService.ensureSession('msg-1')
      expect(result).toBe('openrouter')
    })

    it('throws when local is unavailable and openrouter is not configured', async () => {
      vi.spyOn(opencode, 'createSession').mockRejectedValueOnce(new Error('network'))
      await expect(lmService.ensureSession('msg-1')).rejects.toThrow()
    })
  })

  describe('chat', () => {
    it('calls openCodeProvider.send when no onChunk', async () => {
      vi.spyOn(opencode, 'send').mockResolvedValue('hello world')
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }])
      expect(result).toBe('hello world')
    })

    it('streams chunks when onChunk is provided', async () => {
      vi.spyOn(opencode, 'sendStream').mockReturnValue(asyncFnStream(['hel', 'lo']))
      const chunks: string[] = []
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      expect(result).toBe('hello')
      expect(chunks).toEqual(['hel', 'lo'])
    })

    it('falls back to openrouter stream when local stream fails before any chunk', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'sendStream').mockReturnValue(asyncFnStreamThrow({ error: new Error('network') }))
      vi.spyOn(openrouter, 'sendStream').mockReturnValue(asyncFnStream(['or', '-ok']))
      const chunks: string[] = []
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      expect(result).toBe('or-ok')
      expect(chunks).toEqual(['or', '-ok'])
    })

    it('falls back to openrouter send when local send fails without onChunk', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'send').mockRejectedValueOnce(new Error('network'))
      vi.spyOn(openrouter, 'send').mockResolvedValue('or-response')
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }])
      expect(result).toBe('or-response')
    })

    it('does not fall back after partial local stream', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'sendStream').mockReturnValue(asyncFnStreamThrow({ yieldFirst: 'par', error: new Error('drop') }))
      vi.spyOn(openrouter, 'sendStream').mockReturnValue(asyncFnStream(['or']))
      const chunks: string[] = []
      await expect(
        lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      ).rejects.toThrow('drop')
      expect(chunks).toEqual(['par'])
      expect(openrouter.sendStream).not.toHaveBeenCalled()
    })

    it('does not fall back after partial openrouter stream', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(openrouter, 'sendStream').mockReturnValue(asyncFnStreamThrow({ yieldFirst: 'par', error: new Error('drop') }))
      const chunks: string[] = []
      await expect(
        lmService.chat('openrouter', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      ).rejects.toThrow('drop')
      expect(chunks).toEqual(['par'])
    })

    it('routes to openrouter directly for openrouter session id', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(openrouter, 'sendStream').mockReturnValue(asyncFnStream(['direct']))
      const chunks: string[] = []
      const result = await lmService.chat('openrouter', [{ role: 'user', content: 'hi' }], (c) => chunks.push(c))
      expect(result).toBe('direct')
      expect(opencode.sendStream).not.toHaveBeenCalled()
    })

    it('throws the local error when no fallback is configured', async () => {
      vi.spyOn(opencode, 'sendStream').mockReturnValue(asyncFnStreamThrow({ error: new Error('network') }))
      await expect(
        lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (c) => c)
      ).rejects.toThrow('network')
    })
  })

  describe('ephemeralChat', () => {
    it('creates and deletes a temporary session', async () => {
      vi.spyOn(opencode, 'createSession').mockResolvedValue('temp-session')
      vi.spyOn(opencode, 'deleteSession').mockResolvedValue(undefined)
      vi.spyOn(opencode, 'send').mockResolvedValue('response')
      const result = await lmService.ephemeralChat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('response')
      expect(opencode.deleteSession).toHaveBeenCalledWith('temp-session')
    })

    it('skips delete when using openrouter fallback', async () => {
      vi.spyOn(openrouter, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'createSession').mockRejectedValueOnce(new Error('network'))
      vi.spyOn(openrouter, 'send').mockResolvedValue('or-response')
      const result = await lmService.ephemeralChat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('or-response')
      expect(opencode.deleteSession).not.toHaveBeenCalled()
    })
  })
})

function asyncFnStream(chunks: string[]): AsyncIterable<string> {
  return (async function* () {
    for (const c of chunks) yield c
  })()
}

function asyncFnStreamThrow(opts: { yieldFirst?: string; error: Error }): AsyncIterable<string> {
  return (async function* () {
    if (opts.yieldFirst !== undefined) yield opts.yieldFirst
    throw opts.error
  })()
}
