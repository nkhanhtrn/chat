import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuildCapability } from '../BuildCapability.js'

describe('BuildCapability', () => {
  let capability
  let mockProvider

  beforeEach(() => {
    capability = new BuildCapability()
    mockProvider = {
      sendMessage: vi.fn()
    }
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('build')
    })

    it('should have priority 55', () => {
      expect(capability.priority).toBe(55)
    })
  })

  describe('getRouterDescription', () => {
    it('should return description with name and description', () => {
      const desc = capability.getRouterDescription()
      expect(desc.name).toBe('build')
      expect(desc.description).toContain('INTERACTIVE')
    })

    it('should have conditions for interactive tool creation', () => {
      const desc = capability.getRouterDescription()
      expect(desc.conditions.length).toBeGreaterThan(0)
      // Conditions should describe interactive intent
      expect(desc.conditions.some(c => c.toLowerCase().includes('interactive') || c.toLowerCase().includes('tool'))).toBe(true)
    })

    it('should include examples', () => {
      const desc = capability.getRouterDescription()
      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples[0]).toHaveProperty('input')
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "build"', () => {
      expect(capability.canHandle({ capability: 'build' })).toBe(true)
    })

    it('should handle when isBuildTool is true', () => {
      expect(capability.canHandle({ isBuildTool: true })).toBe(true)
    })

    it('should handle when toolType is defined', () => {
      expect(capability.canHandle({ toolType: 'calculator' })).toBe(true)
    })

    it('should not handle without explicit build signals', () => {
      // canHandle relies on router setting capability/isBuildTool/toolType
      // not on parsing taskDescription - that's the router's job
      expect(capability.canHandle({ taskDescription: 'Build a calculator' })).toBe(false)
    })

    it('should handle when router sets toolType', () => {
      expect(capability.canHandle({ toolType: 'custom', toolName: 'My App' })).toBe(true)
    })

    it('should not handle plain text requests', () => {
      expect(capability.canHandle({ capability: 'text', taskDescription: 'Explain how to make a tool' })).toBe(false)
    })

    it('should not handle unrelated capabilities', () => {
      expect(capability.canHandle({ capability: 'text', taskDescription: 'Explain something' })).toBe(false)
    })

    it('should not handle code capability', () => {
      expect(capability.canHandle({ capability: 'code', canBeCode: true })).toBeFalsy()
    })
  })

  describe('getSystemPrompt', () => {
    it('should return a system prompt string', () => {
      const prompt = capability.getSystemPrompt()
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(100)
    })

    it('should include tool specification format', () => {
      const prompt = capability.getSystemPrompt()
      expect(prompt).toContain('TOOL SPECIFICATION FORMAT')
      expect(prompt).toContain('"name"')
      expect(prompt).toContain('"elements"')
      expect(prompt).toContain('"actions"')
    })

    it('should include element types', () => {
      const prompt = capability.getSystemPrompt()
      expect(prompt).toContain('button-grid')
      expect(prompt).toContain('button-row')
      expect(prompt).toContain('input')
      expect(prompt).toContain('select')
    })

    it('should include layout options', () => {
      const prompt = capability.getSystemPrompt()
      expect(prompt).toContain('calculator')
      expect(prompt).toContain('converter')
      expect(prompt).toContain('form')
    })
  })

  describe('buildExecutorPrompt', () => {
    it('should include user message', () => {
      const context = { userMessage: 'build me a calculator' }
      const prompt = capability.buildExecutorPrompt(context)
      expect(prompt).toContain('build me a calculator')
    })

    it('should ask for complete JSON specification', () => {
      const context = { userMessage: 'create a word counter' }
      const prompt = capability.buildExecutorPrompt(context)
      expect(prompt).toContain('JSON specification')
    })
  })

  describe('cleanOutput', () => {
    it('should remove markdown code blocks with json', () => {
      const input = '```json\n{"name": "Test"}\n```'
      const output = capability.cleanOutput(input)
      expect(output).toBe('{"name": "Test"}')
    })

    it('should remove plain markdown code blocks', () => {
      const input = '```\n{"name": "Test"}\n```'
      const output = capability.cleanOutput(input)
      expect(output).toBe('{"name": "Test"}')
    })

    it('should handle clean JSON', () => {
      const input = '{"name": "Test", "elements": []}'
      const output = capability.cleanOutput(input)
      expect(output).toBe('{"name": "Test", "elements": []}')
    })

    it('should trim whitespace', () => {
      const input = '  \n{"name": "Test"}\n  '
      const output = capability.cleanOutput(input)
      expect(output).toBe('{"name": "Test"}')
    })
  })

  describe('formatOutput', () => {
    it('should return tool type and displayHint', () => {
      const result = { name: 'Calculator', elements: [] }
      const output = capability.formatOutput(result, { toolSpec: result })

      expect(output.type).toBe('tool')
      expect(output.displayHint).toBe('tool')
      expect(output.content).toEqual(result)
    })

    it('should include toolSpec in metadata', () => {
      const result = { name: 'Test', elements: [] }
      const output = capability.formatOutput(result, { toolSpec: result })

      expect(output.metadata.toolSpec).toEqual(result)
    })
  })

  describe('execute', () => {
    it('should return success with valid tool spec', async () => {
      const validToolSpec = JSON.stringify({
        name: 'Calculator',
        description: 'A simple calculator',
        layout: 'calculator',
        state: { display: '0' },
        elements: [
          {
            type: 'button-grid',
            columns: 4,
            buttons: [
              { label: '1', action: 'digit', value: '1' }
            ]
          }
        ],
        actions: {
          digit: 'state.display = value;'
        },
        displayFormatter: 'return state.display;'
      })

      mockProvider.sendMessage.mockResolvedValue(validToolSpec)

      const context = {
        fullContext: 'build a calculator',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result.name).toBe('Calculator')
      expect(result.result.elements).toHaveLength(1)
      expect(result.error).toBeNull()
    })

    it('should handle JSON wrapped in markdown', async () => {
      const wrappedSpec = '```json\n{"name": "Test", "elements": []}\n```'
      mockProvider.sendMessage.mockResolvedValue(wrappedSpec)

      const context = {
        fullContext: 'build a test tool',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result.name).toBe('Test')
    })

    it('should return error for invalid JSON', async () => {
      mockProvider.sendMessage.mockResolvedValue('not valid json at all')

      const context = {
        fullContext: 'build something',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No valid tool specification')
    })

    it('should return error when name is missing', async () => {
      const invalidSpec = JSON.stringify({ elements: [] })
      mockProvider.sendMessage.mockResolvedValue(invalidSpec)

      const context = {
        fullContext: 'build something',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('missing required fields')
    })

    it('should return error when elements is missing', async () => {
      const invalidSpec = JSON.stringify({ name: 'Test' })
      mockProvider.sendMessage.mockResolvedValue(invalidSpec)

      const context = {
        fullContext: 'build something',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('missing required fields')
    })

    it('should call onToolGenerated callback', async () => {
      const validSpec = JSON.stringify({
        name: 'Test',
        elements: [{ type: 'button', label: 'Click', action: 'test' }]
      })
      mockProvider.sendMessage.mockResolvedValue(validSpec)

      const onToolGenerated = vi.fn()
      const context = {
        fullContext: 'build a test',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: { onToolGenerated }
      }

      await capability.execute(context)

      expect(onToolGenerated).toHaveBeenCalledTimes(1)
      expect(onToolGenerated).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test'
      }))
    })

    it('should extract JSON from text with surrounding content', async () => {
      const messyOutput = 'Here is the tool:\n{"name": "Tool", "elements": []}\nEnjoy!'
      mockProvider.sendMessage.mockResolvedValue(messyOutput)

      const context = {
        fullContext: 'build something',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result.name).toBe('Tool')
    })
  })
})
