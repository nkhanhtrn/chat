import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lmService } from '../LMService'

const opencode = await import('../providers/opencode').then(m => m.openCodeProvider)
const zen = await import('../providers/zen').then(m => m.zenProvider)

describe('LMService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.spyOn(zen, 'isConfigured').mockReturnValue(false)
    lmService.invalidateClient()
  })

  describe('ensureSession', () => {
    it('returns existing session ID when provided', async () => {
      const result = await lmService.ensureSession('msg-1', 'existing-session')
      expect(result).toBe('existing-session')
    })

    it('falls back to zen session when local server is unavailable', async () => {
      vi.spyOn(zen, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'createSession').mockRejectedValueOnce(new Error('network'))
      const result = await lmService.ensureSession('msg-1')
      expect(result).toBe('zen')
    })

    it('throws when local is unavailable and zen is not configured', async () => {
      vi.spyOn(zen, 'isConfigured').mockReturnValue(false)
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

    it('falls back to zen stream when local stream fails before any chunk', async () => {
      vi.spyOn(zen, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'sendStream').mockReturnValue(asyncFnStreamThrow({ error: new Error('network') }))
      vi.spyOn(zen, 'sendStream').mockReturnValue(asyncFnStream(['zen', '-ok']))
      const chunks: string[] = []
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      expect(result).toBe('zen-ok')
      expect(chunks).toEqual(['zen', '-ok'])
    })

    it('does not fall back after partial local stream', async () => {
      vi.spyOn(zen, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'sendStream').mockReturnValue(asyncFnStreamThrow({ yieldFirst: 'par', error: new Error('drop') }))
      vi.spyOn(zen, 'sendStream').mockReturnValue(asyncFnStream(['zen']))
      const chunks: string[] = []
      await expect(
        lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      ).rejects.toThrow('drop')
      expect(chunks).toEqual(['par'])
    })

    it('routes to zen directly for zen session id', async () => {
      vi.spyOn(zen, 'isConfigured').mockReturnValue(true)
      vi.spyOn(zen, 'sendStream').mockReturnValue(asyncFnStream(['direct']))
      const chunks: string[] = []
      const result = await lmService.chat('zen', [{ role: 'user', content: 'hi' }], (c) => chunks.push(c))
      expect(result).toBe('direct')
      expect(opencode.sendStream).not.toHaveBeenCalled()
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

    it('skips delete when using zen fallback', async () => {
      vi.spyOn(zen, 'isConfigured').mockReturnValue(true)
      vi.spyOn(opencode, 'createSession').mockRejectedValueOnce(new Error('network'))
      vi.spyOn(zen, 'send').mockResolvedValue('zen-response')
      const result = await lmService.ephemeralChat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('zen-response')
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
