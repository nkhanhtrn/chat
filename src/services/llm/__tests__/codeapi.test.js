import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the codeApi module
vi.mock('../../codeApi.js', () => ({
  generateCode: vi.fn()
}))

describe('Code API Provider', () => {
  let codeApiProvider
  let generateCode

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    const codeApiModule = await import('../../codeApi.js')
    generateCode = codeApiModule.generateCode

    const providerModule = await import('../providers/codeapi.js')
    codeApiProvider = providerModule.codeApiProvider
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('provider metadata', () => {
    it('should have correct id', () => {
      expect(codeApiProvider.id).toBe('codeapi')
    })

    it('should have correct name', () => {
      expect(codeApiProvider.name).toBe('Code API')
    })

    it('should not require apiKey', () => {
      expect(codeApiProvider.requiresApiKey).toBe(false)
    })
  })

  describe('fetchModels', () => {
    it('should return Reasoning AI model', async () => {
      const models = await codeApiProvider.fetchModels()

      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('codeapi-model')
      expect(models[0].name).toBe('Reasoning AI')
    })
  })

  describe('sendMessage', () => {
    it('should extract last user message as prompt', async () => {
      vi.mocked(generateCode).mockResolvedValue({
        stdout: 'Thinking process...',
        code: 'result code',
        success: true
      })

      const messages = [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' }
      ]
      const chunks = []

      await codeApiProvider.sendMessage('codeapi-model', messages, (chunk) => chunks.push(chunk))

      expect(generateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          edit_prompt: 'Second question'
        })
      )
    })

    it('should pass onChunk callback to generateCode', async () => {
      const chunks = []
      vi.mocked(generateCode).mockImplementation(async ({ onStdoutChunk }) => {
        onStdoutChunk('chunk1')
        onStdoutChunk('chunk2')
        return { stdout: 'full output', code: '', success: true }
      })

      const messages = [{ role: 'user', content: 'test' }]

      await codeApiProvider.sendMessage('codeapi-model', messages, (chunk) => chunks.push(chunk))

      expect(chunks).toEqual(['chunk1', 'chunk2'])
    })

    it('should return stdout from result when available', async () => {
      vi.mocked(generateCode).mockResolvedValue({
        stdout: 'Reasoning output',
        code: 'generated code',
        success: true
      })

      const messages = [{ role: 'user', content: 'test' }]

      const result = await codeApiProvider.sendMessage('codeapi-model', messages)

      expect(result).toBe('Reasoning output')
    })

    it('should return code as fallback when stdout is empty', async () => {
      vi.mocked(generateCode).mockResolvedValue({
        stdout: '',
        code: 'fallback code',
        success: true
      })

      const messages = [{ role: 'user', content: 'test' }]

      const result = await codeApiProvider.sendMessage('codeapi-model', messages)

      expect(result).toBe('fallback code')
    })

    it('should return "Done" as final fallback', async () => {
      vi.mocked(generateCode).mockResolvedValue({
        stdout: '',
        code: '',
        success: true
      })

      const messages = [{ role: 'user', content: 'test' }]

      const result = await codeApiProvider.sendMessage('codeapi-model', messages)

      expect(result).toBe('Done')
    })

    it('should throw errors from generateCode', async () => {
      vi.mocked(generateCode).mockRejectedValue(new Error('API error'))

      const messages = [{ role: 'user', content: 'test' }]

      await expect(
        codeApiProvider.sendMessage('codeapi-model', messages)
      ).rejects.toThrow('API error')
    })

    it('should pass abort signal to generateCode', async () => {
      const abortController = new AbortController()
      const signal = abortController.signal

      vi.mocked(generateCode).mockResolvedValue({
        stdout: 'output',
        code: '',
        success: true
      })

      const messages = [{ role: 'user', content: 'test' }]

      await codeApiProvider.sendMessage('codeapi-model', messages, null, signal)

      expect(generateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: signal
        })
      )
    })

    it('should use default output_path', async () => {
      vi.mocked(generateCode).mockResolvedValue({
        stdout: 'output',
        code: '',
        success: true
      })

      const messages = [{ role: 'user', content: 'test' }]

      await codeApiProvider.sendMessage('codeapi-model', messages)

      expect(generateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          output_path: 'chat.txt'
        })
      )
    })

    it('should use empty initial_code', async () => {
      vi.mocked(generateCode).mockResolvedValue({
        stdout: 'output',
        code: '',
        success: true
      })

      const messages = [{ role: 'user', content: 'test' }]

      await codeApiProvider.sendMessage('codeapi-model', messages)

      expect(generateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          initial_code: ''
        })
      )
    })
  })

  describe('error handling', () => {
    it('should throw error when no user message found', async () => {
      const messages = [
        { role: 'assistant', content: 'Just assistant message' }
      ]

      await expect(
        codeApiProvider.sendMessage('codeapi-model', messages)
      ).rejects.toThrow('No user message found')
    })

    it('should throw error when messages array is empty', async () => {
      const messages = []

      await expect(
        codeApiProvider.sendMessage('codeapi-model', messages)
      ).rejects.toThrow('No user message found')
    })
  })
})
