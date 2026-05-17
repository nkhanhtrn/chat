import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lmService } from '../LMService'

vi.mock('@/services/settings', () => ({
  Settings: {
    getAll: () => ({}),
    getString: () => '',
  },
}))

describe('LMService', () => {
  describe('ensureSession', () => {
    it('returns existing session ID when provided', async () => {
      const result = await lmService.ensureSession('msg-1', 'existing-session')
      expect(result).toBe('existing-session')
    })
  })

  describe('chat', () => {
    it('calls openCodeProvider.send when no onChunk', async () => {
      const provider = await import('../providers/opencode').then(m => m.openCodeProvider)
      vi.spyOn(provider, 'send').mockResolvedValue('hello world')
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }])
      expect(result).toBe('hello world')
      vi.restoreAllMocks()
    })

    it('streams chunks when onChunk is provided', async () => {
      const provider = await import('../providers/opencode').then(m => m.openCodeProvider)
      async function* gen() { yield 'hel'; yield 'lo' }
      vi.spyOn(provider, 'sendStream').mockReturnValue(gen())
      const chunks: string[] = []
      const result = await lmService.chat('session-1', [{ role: 'user', content: 'hi' }], (chunk) => chunks.push(chunk))
      expect(result).toBe('hello')
      expect(chunks).toEqual(['hel', 'lo'])
      vi.restoreAllMocks()
    })
  })

  describe('ephemeralChat', () => {
    it('creates and deletes a temporary session', async () => {
      const provider = await import('../providers/opencode').then(m => m.openCodeProvider)
      vi.spyOn(provider, 'createSession').mockResolvedValue('temp-session')
      vi.spyOn(provider, 'deleteSession').mockResolvedValue(undefined)
      vi.spyOn(provider, 'send').mockResolvedValue('response')
      const result = await lmService.ephemeralChat([{ role: 'user', content: 'hi' }])
      expect(result).toBe('response')
      expect(provider.deleteSession).toHaveBeenCalledWith('temp-session')
      vi.restoreAllMocks()
    })
  })
})
