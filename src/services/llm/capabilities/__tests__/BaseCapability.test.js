import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseCapability, createPipeData } from '../BaseCapability.js'

describe('createPipeData', () => {
  it('should create pipe data with data and source', () => {
    const result = createPipeData({ foo: 'bar' }, 'test-source')

    expect(result).toEqual({
      data: { foo: 'bar' },
      source: 'test-source'
    })
  })

  it('should handle null data', () => {
    const result = createPipeData(null, 'source')

    expect(result.data).toBeNull()
    expect(result.source).toBe('source')
  })

  it('should handle primitive data', () => {
    expect(createPipeData('string', 'src').data).toBe('string')
    expect(createPipeData(42, 'src').data).toBe(42)
    expect(createPipeData(true, 'src').data).toBe(true)
  })

  it('should handle array data', () => {
    const arr = [1, 2, 3]
    const result = createPipeData(arr, 'src')

    expect(result.data).toBe(arr)
  })
})

describe('BaseCapability', () => {
  let capability

  beforeEach(() => {
    capability = new BaseCapability()
  })

  describe('default properties', () => {
    it('should have empty name by default', () => {
      expect(capability.name).toBe('')
    })

    it('should have priority 0 by default', () => {
      expect(capability.priority).toBe(0)
    })
  })

  describe('abstract methods that throw', () => {
    it('getRouterDescription should throw', () => {
      expect(() => capability.getRouterDescription()).toThrow('getRouterDescription() must be implemented')
    })

    it('canHandle should throw', () => {
      expect(() => capability.canHandle({})).toThrow('canHandle() must be implemented')
    })

    it('process should throw', async () => {
      await expect(capability.process({})).rejects.toThrow('process() must be implemented')
    })

    it('getSystemPrompt should throw', () => {
      expect(() => capability.getSystemPrompt({})).toThrow('getSystemPrompt() must be implemented')
    })
  })

  describe('receiveInput', () => {
    it('should extract data from pipe input', () => {
      const pipeInput = { data: 'test-data', source: 'prev-capability' }
      const context = { userMessage: 'hello' }

      const result = capability.receiveInput(pipeInput, context)

      expect(result.data).toBe('test-data')
      expect(result.source).toBe('prev-capability')
      expect(result.context).toBe(context)
    })

    it('should handle null pipe input', () => {
      const context = { userMessage: 'hello' }

      const result = capability.receiveInput(null, context)

      expect(result.data).toBeNull()
      expect(result.source).toBeNull()
      expect(result.context).toBe(context)
    })

    it('should handle undefined pipe input', () => {
      const context = { userMessage: 'hello' }

      const result = capability.receiveInput(undefined, context)

      expect(result.data).toBeNull()
      expect(result.source).toBeNull()
    })

    it('should handle pipe input with missing properties', () => {
      const result = capability.receiveInput({}, {})

      expect(result.data).toBeNull()
      expect(result.source).toBeNull()
    })
  })

  describe('produceOutput', () => {
    beforeEach(() => {
      capability.name = 'test-capability'
    })

    it('should create pipe data from successful result', () => {
      const processResult = {
        success: true,
        result: { computed: 'value' },
        error: null
      }

      const output = capability.produceOutput(processResult)

      expect(output.data).toEqual({ computed: 'value' })
      expect(output.source).toBe('test-capability')
    })

    it('should create error pipe data from failed result', () => {
      const processResult = {
        success: false,
        result: null,
        error: 'Something went wrong'
      }

      const output = capability.produceOutput(processResult)

      expect(output.data).toEqual({ error: 'Something went wrong' })
      expect(output.source).toBe('test-capability')
    })

    it('should use capability name as source', () => {
      capability.name = 'custom-name'
      const processResult = { success: true, result: 'data' }

      const output = capability.produceOutput(processResult)

      expect(output.source).toBe('custom-name')
    })
  })

  describe('getChainTo', () => {
    it('should return null by default', () => {
      const result = capability.getChainTo({}, {})

      expect(result).toBeNull()
    })
  })

  describe('execute', () => {
    let TestCapability

    beforeEach(() => {
      TestCapability = class extends BaseCapability {
        name = 'test'

        async process(input) {
          return {
            success: true,
            result: `processed: ${input.data}`,
            error: null,
            metadata: { inputSource: input.source }
          }
        }
      }
    })

    it('should orchestrate the full pipe flow', async () => {
      const testCap = new TestCapability()
      const context = { userMessage: 'test' }
      const pipeInput = createPipeData('input-data', 'previous')

      const result = await testCap.execute(context, pipeInput)

      expect(result.success).toBe(true)
      expect(result.result).toBe('processed: input-data')
      expect(result.pipe.data).toBe('processed: input-data')
      expect(result.pipe.source).toBe('test')
      expect(result.chainTo).toBeNull()
    })

    it('should work without pipe input', async () => {
      const testCap = new TestCapability()
      const context = { userMessage: 'test' }

      const result = await testCap.execute(context)

      expect(result.success).toBe(true)
      expect(result.result).toBe('processed: null')
    })

    it('should include chainTo from getChainTo', async () => {
      class ChainableCapability extends TestCapability {
        getChainTo(processResult, context) {
          return 'next-capability'
        }
      }

      const chainCap = new ChainableCapability()
      const result = await chainCap.execute({})

      expect(result.chainTo).toBe('next-capability')
    })

    it('should preserve metadata from process result', async () => {
      const testCap = new TestCapability()
      const pipeInput = createPipeData('data', 'src')

      const result = await testCap.execute({}, pipeInput)

      expect(result.metadata.inputSource).toBe('src')
    })

    it('should handle errors from process', async () => {
      class FailingCapability extends BaseCapability {
        name = 'failing'

        async process() {
          return {
            success: false,
            result: null,
            error: 'Processing failed',
            metadata: {}
          }
        }
      }

      const failCap = new FailingCapability()
      const result = await failCap.execute({})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Processing failed')
      expect(result.pipe.data).toEqual({ error: 'Processing failed' })
    })
  })

  describe('buildExecutorPrompt', () => {
    it('should build prompt from analysis context', () => {
      const context = {
        analysis: {
          taskDescription: 'Generate a chart',
          inputs: ['data.csv'],
          expectedOutput: 'SVG chart'
        },
        userMessage: 'Create a bar chart'
      }

      const prompt = capability.buildExecutorPrompt(context)

      expect(prompt).toContain('Task: Generate a chart')
      expect(prompt).toContain('Inputs: ["data.csv"]')
      expect(prompt).toContain('Expected output: SVG chart')
      expect(prompt).toContain('Original request: "Create a bar chart"')
      expect(prompt).toContain('Generate the output now:')
    })

    it('should handle missing inputs', () => {
      const context = {
        analysis: {
          taskDescription: 'Simple task'
        },
        userMessage: 'Do something'
      }

      const prompt = capability.buildExecutorPrompt(context)

      expect(prompt).toContain('Inputs: []')
    })

    it('should handle missing expectedOutput', () => {
      const context = {
        analysis: {
          taskDescription: 'Task'
        },
        userMessage: 'Request'
      }

      const prompt = capability.buildExecutorPrompt(context)

      expect(prompt).toContain('Expected output: Result')
    })
  })

  describe('formatOutput', () => {
    it('should format result as plain text', () => {
      const output = capability.formatOutput('Hello World')

      expect(output.type).toBe('text')
      expect(output.content).toBe('Hello World')
      expect(output.displayHint).toBe('plain')
    })

    it('should convert non-string result to string', () => {
      const output = capability.formatOutput(42)

      expect(output.content).toBe('42')
    })

    it('should convert object to string', () => {
      const output = capability.formatOutput({ key: 'value' })

      expect(output.content).toBe('[object Object]')
    })

    it('should handle null result', () => {
      const output = capability.formatOutput(null)

      expect(output.content).toBe('null')
    })

    it('should ignore metadata by default', () => {
      const output = capability.formatOutput('result', { extra: 'data' })

      expect(output.type).toBe('text')
      expect(output.displayHint).toBe('plain')
    })
  })

  describe('cleanOutput', () => {
    it('should trim whitespace', () => {
      const result = capability.cleanOutput('  hello world  ')

      expect(result).toBe('hello world')
    })

    it('should remove markdown code blocks with language', () => {
      const input = '```javascript\nconsole.log("hi")\n```'
      const result = capability.cleanOutput(input)

      expect(result).toBe('console.log("hi")')
    })

    it('should remove markdown code blocks without language', () => {
      const input = '```\nsome code\n```'
      const result = capability.cleanOutput(input)

      expect(result).toBe('some code')
    })

    it('should handle code blocks with leading whitespace', () => {
      const input = '  ```python\nprint("hello")\n```  '
      const result = capability.cleanOutput(input)

      expect(result).toBe('print("hello")')
    })

    it('should not modify text without code blocks', () => {
      const input = 'plain text content'
      const result = capability.cleanOutput(input)

      expect(result).toBe('plain text content')
    })

    it('should handle empty string', () => {
      const result = capability.cleanOutput('')

      expect(result).toBe('')
    })

    it('should handle only whitespace', () => {
      const result = capability.cleanOutput('   \n\t  ')

      expect(result).toBe('')
    })

    it('should preserve code blocks in the middle of text', () => {
      const input = 'before ```code``` after'
      const result = capability.cleanOutput(input)

      // Only removes if it starts with ```
      expect(result).toBe('before ```code``` after')
    })
  })

  describe('inheritance', () => {
    it('should allow subclass to override name', () => {
      class CustomCapability extends BaseCapability {
        name = 'custom'
      }

      const custom = new CustomCapability()
      expect(custom.name).toBe('custom')
    })

    it('should allow subclass to override priority', () => {
      class HighPriorityCapability extends BaseCapability {
        priority = 100
      }

      const cap = new HighPriorityCapability()
      expect(cap.priority).toBe(100)
    })

    it('should allow subclass to implement abstract methods', () => {
      class ConcreteCapability extends BaseCapability {
        name = 'concrete'

        getRouterDescription() {
          return { name: this.name, description: 'A concrete capability' }
        }

        canHandle(analysis) {
          return analysis.capability === 'concrete'
        }

        async process(input) {
          return { success: true, result: 'done', error: null, metadata: {} }
        }

        getSystemPrompt() {
          return 'You are a concrete assistant'
        }
      }

      const cap = new ConcreteCapability()

      expect(() => cap.getRouterDescription()).not.toThrow()
      expect(cap.canHandle({ capability: 'concrete' })).toBe(true)
      expect(() => cap.getSystemPrompt()).not.toThrow()
    })

    it('should allow subclass to override default methods', () => {
      class CustomOutputCapability extends BaseCapability {
        name = 'custom'

        formatOutput(result, metadata) {
          return {
            type: 'custom',
            content: result,
            displayHint: 'special'
          }
        }
      }

      const cap = new CustomOutputCapability()
      const output = cap.formatOutput('data')

      expect(output.type).toBe('custom')
      expect(output.displayHint).toBe('special')
    })
  })
})
