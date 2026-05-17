import { describe, it, expect } from 'vitest'
import { lmService } from '../LMService'

describe('LMService', () => {
  describe('chat', () => {
    it('throws when no provider is configured', async () => {
      await expect(lmService.chat('test', [{ role: 'user', content: 'hi' }]))
        .rejects.toThrow('LLM service not configured')
    })
  })

  describe('ephemeralChat', () => {
    it('throws when no provider is configured', async () => {
      await expect(lmService.ephemeralChat([{ role: 'user', content: 'hi' }]))
        .rejects.toThrow('LLM service not configured')
    })
  })

  describe('invalidateClient', () => {
    it('does not throw', () => {
      expect(() => lmService.invalidateClient()).not.toThrow()
    })
  })
})
