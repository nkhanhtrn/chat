import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CodeCapability } from '../CodeCapability.js'

// Mock the LM Studio provider
vi.mock('../../providers/lmstudio.js', () => ({
  lmstudioProvider: {
    sendMessage: vi.fn()
  }
}))

describe('CodeCapability', () => {
  let capability

  beforeEach(() => {
    capability = new CodeCapability()
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('code')
    })

    it('should have priority 50', () => {
      expect(capability.priority).toBe(50)
    })
  })

  describe('getRouterDescription', () => {
    it('should return description with name and description', () => {
      const desc = capability.getRouterDescription()

      expect(desc.name).toBe('code')
      expect(desc.description).toContain('COMPUTE')
    })

    it('should include conditions for when to use', () => {
      const desc = capability.getRouterDescription()

      expect(desc.conditions).toBeDefined()
      expect(desc.conditions.length).toBeGreaterThan(0)
      expect(desc.conditions.some(c => c.toLowerCase().includes('computed') || c.toLowerCase().includes('math'))).toBe(true)
    })

    it('should include examples', () => {
      const desc = capability.getRouterDescription()

      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples[0]).toHaveProperty('input')
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "code"', () => {
      expect(capability.canHandle({ capability: 'code' })).toBe(true)
    })

    it('should not handle other capabilities', () => {
      expect(capability.canHandle({ capability: 'text' })).toBe(false)
      expect(capability.canHandle({ capability: 'build' })).toBe(false)
      expect(capability.canHandle({ capability: 'visualization' })).toBe(false)
    })

    it('should not handle when capability is not specified', () => {
      expect(capability.canHandle({})).toBe(false)
    })
  })

  describe('_executeCode', () => {
    it('should execute simple expression', () => {
      const result = capability._executeCode('5 + 3')

      expect(result.success).toBe(true)
      expect(result.result).toBe(8)
      expect(result.error).toBeNull()
    })

    it('should execute function definition and call', () => {
      const code = `
        const add = (a, b) => a + b;
        add(10, 20)
      `
      const result = capability._executeCode(code)

      expect(result.success).toBe(true)
      expect(result.result).toBe(30)
    })

    it('should handle array operations', () => {
      const code = `
        const nums = [1, 2, 3, 4, 5];
        nums.map(n => n * 2)
      `
      const result = capability._executeCode(code)

      expect(result.success).toBe(true)
      expect(result.result).toEqual([2, 4, 6, 8, 10])
    })

    it('should handle string operations', () => {
      const code = `
        const reverse = (s) => [...s].reverse().join('');
        reverse("hello")
      `
      const result = capability._executeCode(code)

      expect(result.success).toBe(true)
      expect(result.result).toBe('olleh')
    })

    it('should return error for invalid code', () => {
      const result = capability._executeCode('invalid syntax {{{')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('should return error for runtime errors', () => {
      const result = capability._executeCode('undefinedVariable.property')

      expect(result.success).toBe(false)
      expect(result.error).toContain('undefinedVariable')
    })

    it('should handle empty code', () => {
      const result = capability._executeCode('')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No code to execute')
    })

    it('should handle JSON parsing', () => {
      const code = `JSON.parse('{"name": "test", "value": 42}')`
      const result = capability._executeCode(code)

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ name: 'test', value: 42 })
    })
  })

  describe('cleanOutput', () => {
    it('should remove markdown code blocks', () => {
      const input = '```javascript\nconst x = 5;\nx\n```'
      const output = capability.cleanOutput(input)

      expect(output).toBe('const x = 5;\nx')
    })

    it('should remove js code blocks', () => {
      const input = '```js\nconst x = 5;\n```'
      const output = capability.cleanOutput(input)

      expect(output).toBe('const x = 5;')
    })

    it('should handle code without markdown', () => {
      const input = 'const x = 5; x'
      const output = capability.cleanOutput(input)

      expect(output).toBe('const x = 5; x')
    })

    it('should trim whitespace', () => {
      const input = '  \n  const x = 5;  \n  '
      const output = capability.cleanOutput(input)

      expect(output).toBe('const x = 5;')
    })

    it('should remove wrapping quotes', () => {
      const input = '"const x = 5"'
      const output = capability.cleanOutput(input)

      expect(output).toBe('const x = 5')
    })
  })

  describe('formatOutput', () => {
    it('should format string result', () => {
      const output = capability.formatOutput('hello', { code: 'x', attempts: 1 })

      expect(output.type).toBe('code-result')
      expect(output.content).toBe('hello')
      expect(output.displayHint).toBe('code')
    })

    it('should format array result as JSON', () => {
      const output = capability.formatOutput([1, 2, 3], {})

      expect(output.content).toBe('[\n  1,\n  2,\n  3\n]')
    })

    it('should format object result as JSON', () => {
      const output = capability.formatOutput({ a: 1 }, {})

      expect(output.content).toBe('{\n  "a": 1\n}')
    })

    it('should format null', () => {
      const output = capability.formatOutput(null, {})

      expect(output.content).toBe('null')
    })

    it('should format undefined', () => {
      const output = capability.formatOutput(undefined, {})

      expect(output.content).toBe('undefined')
    })

    it('should format numbers', () => {
      const output = capability.formatOutput(42, {})

      expect(output.content).toBe('42')
    })

    it('should include metadata', () => {
      const output = capability.formatOutput('result', { code: 'test', attempts: 2 })

      expect(output.metadata.code).toBe('test')
      expect(output.metadata.attempts).toBe(2)
    })
  })

  describe('buildExecutorPrompt', () => {
    it('should build prompt with analysis details', () => {
      const context = {
        analysis: {
          taskDescription: 'Add two numbers',
          inputs: [{ name: 'a', value: 5 }, { name: 'b', value: 3 }],
          expectedOutput: 'Number',
          codeType: 'function',
          functionName: 'add'
        },
        userMessage: 'add 5 and 3'
      }

      const prompt = capability.buildExecutorPrompt(context)

      expect(prompt).toContain('Add two numbers')
      expect(prompt).toContain('a')
      expect(prompt).toContain('5')
      expect(prompt).toContain('add 5 and 3')
    })
  })
})
