import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  executeCode,
  formatResult,
  findRouterAndExecutorModels,
  analyzeRequest,
  generateCode,
  regenerateCodeWithError,
  generateVisualization,
  analyzeGenerateAndExecute
} from '../services/llm/taskRouter.js'

// Mock lmstudioProvider
const mockSendMessage = vi.fn()
const mockFetchModels = vi.fn()

vi.mock('../services/llm/providers/lmstudio.js', () => ({
  lmstudioProvider: {
    sendMessage: (...args) => mockSendMessage(...args),
    fetchModels: (...args) => mockFetchModels(...args)
  }
}))

vi.mock('../services/llm/index.js', () => ({
  getProviderConfig: vi.fn(() => ({}))
}))

describe('taskRouter', () => {
  beforeEach(() => {
    mockSendMessage.mockReset()
    mockFetchModels.mockReset()
  })

  describe('executeCode', () => {
    describe('simple expressions', () => {
      it('should execute a simple number', () => {
        const result = executeCode('42')
        expect(result.success).toBe(true)
        expect(result.result).toBe(42)
        expect(result.error).toBeNull()
      })

      it('should execute a simple string', () => {
        const result = executeCode('"hello"')
        expect(result.success).toBe(true)
        expect(result.result).toBe('hello')
      })

      it('should execute arithmetic expressions', () => {
        const result = executeCode('5 + 3 * 2')
        expect(result.success).toBe(true)
        expect(result.result).toBe(11)
      })

      it('should execute array literals', () => {
        const result = executeCode('[1, 2, 3]')
        expect(result.success).toBe(true)
        expect(result.result).toEqual([1, 2, 3])
      })

      it('should execute object literals', () => {
        const result = executeCode('({ a: 1, b: 2 })')
        expect(result.success).toBe(true)
        expect(result.result).toEqual({ a: 1, b: 2 })
      })
    })

    describe('function declarations and calls', () => {
      it('should execute function declaration and call', () => {
        const code = `const add = (a, b) => a + b;
add(2, 3)`
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe(5)
      })

      it('should execute arrow function and call', () => {
        const code = `const double = x => x * 2;
double(5)`
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe(10)
      })

      it('should execute text to ASCII conversion', () => {
        const code = `const textToAscii = (text) => [...text].map(c => c.charCodeAt(0));
textToAscii("hello")`
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toEqual([104, 101, 108, 108, 111])
      })

      it('should execute string reversal', () => {
        const code = `const reverseString = (str) => [...str].reverse().join('');
reverseString("hello")`
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe('olleh')
      })

      it('should execute multiple function declarations', () => {
        const code = `const square = x => x * x;
const double = x => x * 2;
double(square(3))`
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe(18)
      })
    })

    describe('array operations', () => {
      it('should execute map operation', () => {
        const code = '[1, 2, 3].map(x => x * 2)'
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toEqual([2, 4, 6])
      })

      it('should execute filter operation', () => {
        const code = '[1, 2, 3, 4, 5].filter(x => x % 2 === 0)'
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toEqual([2, 4])
      })

      it('should execute reduce operation', () => {
        const code = '[1, 2, 3, 4].reduce((a, b) => a + b, 0)'
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe(10)
      })
    })

    describe('string operations', () => {
      it('should execute string split', () => {
        const code = '"hello world".split(" ")'
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toEqual(['hello', 'world'])
      })

      it('should execute string toUpperCase', () => {
        const code = '"hello".toUpperCase()'
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe('HELLO')
      })

      it('should execute template literals', () => {
        const code = `const name = "World";
\`Hello, \${name}!\``
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe('Hello, World!')
      })
    })

    describe('error handling', () => {
      it('should return error for syntax errors', () => {
        const result = executeCode('const x = ')
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
      })

      it('should return error for undefined variables', () => {
        const result = executeCode('undefinedVariable')
        expect(result.success).toBe(false)
        expect(result.error).toContain('undefinedVariable')
      })

      it('should return error for empty code', () => {
        const result = executeCode('')
        expect(result.success).toBe(false)
        expect(result.error).toBe('No code to execute')
      })

      it('should return error for whitespace only', () => {
        const result = executeCode('   \n  ')
        expect(result.success).toBe(false)
        expect(result.error).toBe('No code to execute')
      })
    })

    describe('edge cases', () => {
      it('should handle code with trailing semicolons', () => {
        const result = executeCode('5 + 3;')
        expect(result.success).toBe(true)
        expect(result.result).toBe(8)
      })

      it('should handle code with comments', () => {
        const code = `// This is a comment
const x = 5;
x * 2`
        const result = executeCode(code)
        expect(result.success).toBe(true)
        expect(result.result).toBe(10)
      })

      it('should handle boolean results', () => {
        const result = executeCode('5 > 3')
        expect(result.success).toBe(true)
        expect(result.result).toBe(true)
      })

      it('should handle null result', () => {
        const result = executeCode('null')
        expect(result.success).toBe(true)
        expect(result.result).toBe(null)
      })

      it('should handle undefined result', () => {
        const result = executeCode('undefined')
        expect(result.success).toBe(true)
        expect(result.result).toBe(undefined)
      })
    })
  })

  describe('formatResult', () => {
    it('should format undefined', () => {
      expect(formatResult(undefined)).toBe('undefined')
    })

    it('should format null', () => {
      expect(formatResult(null)).toBe('null')
    })

    it('should format strings as-is', () => {
      expect(formatResult('hello')).toBe('hello')
    })

    it('should format numbers as strings', () => {
      expect(formatResult(42)).toBe('42')
    })

    it('should format booleans as strings', () => {
      expect(formatResult(true)).toBe('true')
      expect(formatResult(false)).toBe('false')
    })

    it('should format arrays as pretty JSON', () => {
      const result = formatResult([1, 2, 3])
      expect(result).toBe('[\n  1,\n  2,\n  3\n]')
    })

    it('should format objects as pretty JSON', () => {
      const result = formatResult({ a: 1, b: 2 })
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}')
    })

    it('should format nested structures', () => {
      const result = formatResult({ arr: [1, 2], obj: { x: 1 } })
      expect(result).toContain('"arr"')
      expect(result).toContain('"obj"')
    })
  })

  describe('findRouterAndExecutorModels', () => {
    it('should find mistral model for router', () => {
      const models = [
        { id: 'mistral-7b', name: 'Mistral 7B' },
        { id: 'gpt-oss-20b', name: 'GPT OSS 20B' }
      ]
      const { router } = findRouterAndExecutorModels(models)
      expect(router.id).toBe('mistral-7b')
    })

    it('should find ministral model for router', () => {
      const models = [
        { id: 'ministral-3b', name: 'Ministral 3B' },
        { id: 'other-model', name: 'Other' }
      ]
      const { router } = findRouterAndExecutorModels(models)
      expect(router.id).toBe('ministral-3b')
    })

    it('should find gpt-oss-20b model for executor', () => {
      const models = [
        { id: 'mistral-7b', name: 'Mistral 7B' },
        { id: 'gpt-oss-20b', name: 'GPT OSS 20B' }
      ]
      const { executor } = findRouterAndExecutorModels(models)
      expect(executor.id).toBe('gpt-oss-20b')
    })

    it('should find gpt-oss model for executor', () => {
      const models = [
        { id: 'mistral-7b', name: 'Mistral 7B' },
        { id: 'gpt-oss-120b', name: 'GPT OSS 120B' }
      ]
      const { executor } = findRouterAndExecutorModels(models)
      expect(executor.id).toBe('gpt-oss-120b')
    })

    it('should return null when no matching router found', () => {
      const models = [
        { id: 'llama-7b', name: 'Llama 7B' },
        { id: 'phi-2', name: 'Phi 2' }
      ]
      const { router } = findRouterAndExecutorModels(models)
      expect(router).toBeNull()
    })

    it('should return null when no matching executor found', () => {
      const models = [
        { id: 'mistral-7b', name: 'Mistral 7B' },
        { id: 'llama-7b', name: 'Llama 7B' }
      ]
      const { executor } = findRouterAndExecutorModels(models)
      expect(executor).toBeNull()
    })

    it('should handle empty models array', () => {
      const { router, executor } = findRouterAndExecutorModels([])
      expect(router).toBeNull()
      expect(executor).toBeNull()
    })

    it('should be case-insensitive', () => {
      const models = [
        { id: 'MISTRAL-7B', name: 'MISTRAL 7B' },
        { id: 'GPT-OSS-20B', name: 'GPT OSS 20B' }
      ]
      const { router, executor } = findRouterAndExecutorModels(models)
      expect(router.id).toBe('MISTRAL-7B')
      expect(executor.id).toBe('GPT-OSS-20B')
    })

    it('should match by name if id does not match', () => {
      const models = [
        { id: 'model-1', name: 'Mistral 3B Instruct' },
        { id: 'model-2', name: 'OpenAI GPT OSS' }
      ]
      const { router, executor } = findRouterAndExecutorModels(models)
      expect(router.id).toBe('model-1')
      expect(executor.id).toBe('model-2')
    })
  })

  describe('analyzeRequest', () => {
    it('should parse valid JSON response', async () => {
      mockSendMessage.mockResolvedValue(JSON.stringify({
        canBeCode: true,
        taskDescription: 'Convert text to ASCII',
        inputs: [{ name: 'text', value: 'hello', type: 'string' }],
        expectedOutput: 'Array of ASCII codes',
        codeType: 'function',
        functionName: 'textToAscii'
      }))

      const result = await analyzeRequest('convert hello to ASCII', 'mistral-3b')

      expect(result.canBeCode).toBe(true)
      expect(result.taskDescription).toBe('Convert text to ASCII')
      expect(result.functionName).toBe('textToAscii')
    })

    it('should handle JSON with extra text', async () => {
      mockSendMessage.mockResolvedValue(`Here is the analysis:
{
  "canBeCode": true,
  "taskDescription": "Calculate sum",
  "inputs": [],
  "expectedOutput": "number",
  "codeType": "expression",
  "functionName": "calculate"
}
That's my analysis.`)

      const result = await analyzeRequest('what is 5 + 3', 'mistral-3b')

      expect(result.canBeCode).toBe(true)
      expect(result.functionName).toBe('calculate')
    })

    it('should return fallback for invalid response', async () => {
      mockSendMessage.mockResolvedValue('This is not JSON at all')

      const result = await analyzeRequest('do something', 'mistral-3b')

      expect(result.canBeCode).toBe(true)
      expect(result.codeType).toBe('expression')
    })

    it('should call lmstudioProvider with correct params', async () => {
      mockSendMessage.mockResolvedValue('{"canBeCode": false}')

      await analyzeRequest('hello', 'mistral-3b', { baseUrl: 'http://localhost:1234' })

      expect(mockSendMessage).toHaveBeenCalledWith(
        'mistral-3b',
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'hello' })
        ]),
        null,
        null,
        expect.any(Object)
      )
    })
  })

  describe('generateCode', () => {
    it('should call lmstudioProvider with analysis instructions', async () => {
      mockSendMessage.mockResolvedValue('const x = 5; x')

      const analysis = {
        taskDescription: 'Calculate something',
        inputs: [{ name: 'x', value: 5 }],
        expectedOutput: 'number',
        codeType: 'expression',
        functionName: 'calculate'
      }

      await generateCode(analysis, 'calculate 5', 'gpt-oss-20b')

      expect(mockSendMessage).toHaveBeenCalledWith(
        'gpt-oss-20b',
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Task: Calculate something')
          })
        ]),
        null,
        null,
        expect.any(Object)
      )
    })

    it('should include original request in prompt', async () => {
      mockSendMessage.mockResolvedValue('42')

      const analysis = {
        taskDescription: 'Test',
        inputs: [],
        expectedOutput: 'number',
        codeType: 'expression',
        functionName: 'test'
      }

      await generateCode(analysis, 'original user request', 'gpt-oss-20b')

      const callArgs = mockSendMessage.mock.calls[0][1]
      expect(callArgs[1].content).toContain('original user request')
    })

    it('should generate code and return result', async () => {
      mockSendMessage.mockResolvedValue('10 + 5')

      const result = await generateCode(
        { taskDescription: 'test', inputs: [], expectedOutput: '', codeType: 'expression', functionName: 'test' },
        'test',
        'gpt-oss-20b'
      )

      expect(result).toBe('10 + 5')
      expect(mockSendMessage).toHaveBeenCalledWith(
        'gpt-oss-20b',
        expect.any(Array),
        null,
        null,
        expect.any(Object)
      )
    })
  })

  describe('analyzeGenerateAndExecute', () => {
    it('should run full pipeline for code task', async () => {
      // First call: analyzeRequest
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        canBeCode: true,
        taskDescription: 'Add numbers',
        inputs: [],
        expectedOutput: 'number',
        codeType: 'expression',
        functionName: 'add'
      }))
      // Second call: generateCode
      mockSendMessage.mockResolvedValueOnce('5 + 3')

      const onAnalysis = vi.fn()
      const onCodeGenerated = vi.fn()
      const onExecutionComplete = vi.fn()
      const onChunk = vi.fn()

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'what is 5 + 3' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
        onChunk,
        null,
        { onAnalysis, onCodeGenerated, onExecutionComplete }
      )

      expect(onAnalysis).toHaveBeenCalledWith(expect.objectContaining({ canBeCode: true }))
      expect(onCodeGenerated).toHaveBeenCalledWith('5 + 3')
      expect(onExecutionComplete).toHaveBeenCalledWith(expect.objectContaining({ success: true, result: 8 }))
      expect(result.code).toBe('5 + 3')
      expect(result.execution.result).toBe(8)
    })

    it('should skip code generation for non-code task', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        canBeCode: false,
        taskDescription: 'Knowledge question',
        inputs: [],
        expectedOutput: 'text',
        codeType: 'none',
        functionName: ''
      }))
      mockSendMessage.mockResolvedValueOnce('The history of computers begins...')

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'tell me about computers' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      expect(result.code).toBeNull()
      expect(result.execution).toBeNull()
      expect(result.finalResponse).toBe('The history of computers begins...')
    })

    it('should throw error when no user message', async () => {
      await expect(
        analyzeGenerateAndExecute(
          [{ role: 'assistant', content: 'Hello' }],
          { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
        )
      ).rejects.toThrow('No user message to process')
    })

    it('should use last user message for analysis', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({ canBeCode: false }))
      mockSendMessage.mockResolvedValueOnce('Response')

      await analyzeGenerateAndExecute(
        [
          { role: 'user', content: 'first message' },
          { role: 'assistant', content: 'response' },
          { role: 'user', content: 'second message' }
        ],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      // First call should be analysis with 'second message'
      expect(mockSendMessage.mock.calls[0][1][1].content).toBe('second message')
    })

    it('should handle execution errors', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        canBeCode: true,
        taskDescription: 'Bad code',
        inputs: [],
        expectedOutput: 'error',
        codeType: 'expression',
        functionName: 'bad'
      }))
      mockSendMessage.mockResolvedValueOnce('undefinedVariable')

      const onExecutionComplete = vi.fn()

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'do bad thing' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
        null,
        null,
        { onExecutionComplete }
      )

      expect(result.execution.success).toBe(false)
      expect(result.execution.error).toBeTruthy()
      expect(onExecutionComplete).toHaveBeenCalledWith(expect.objectContaining({ success: false }))
    })

    it('should stream final result via onChunk', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        canBeCode: true,
        taskDescription: 'Add',
        inputs: [],
        expectedOutput: 'number',
        codeType: 'expression',
        functionName: 'add'
      }))
      mockSendMessage.mockResolvedValueOnce('2 + 2')

      const onChunk = vi.fn()

      await analyzeGenerateAndExecute(
        [{ role: 'user', content: '2 + 2' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
        onChunk
      )

      expect(onChunk).toHaveBeenCalledWith('4')
    })

    it('should clean markdown code blocks from generated code', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        canBeCode: true,
        taskDescription: 'Test',
        inputs: [],
        expectedOutput: 'number',
        codeType: 'expression',
        functionName: 'test'
      }))
      mockSendMessage.mockResolvedValueOnce('```javascript\n5 + 5\n```')

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'test' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      expect(result.code).toBe('5 + 5')
      expect(result.execution.result).toBe(10)
    })

    describe('verify mode', () => {
      it('should retry on execution failure when verifyMode is enabled', async () => {
        // First call: analyzeRequest
        mockSendMessage.mockResolvedValueOnce(JSON.stringify({
          canBeCode: true,
          taskDescription: 'Test task',
          inputs: [],
          expectedOutput: 'number',
          codeType: 'expression',
          functionName: 'test'
        }))
        // Second call: generateCode - returns broken code
        mockSendMessage.mockResolvedValueOnce('undefinedVar')
        // Third call: regenerateCodeWithError - returns fixed code
        mockSendMessage.mockResolvedValueOnce('42')

        const onVerifyAttempt = vi.fn()

        const result = await analyzeGenerateAndExecute(
          [{ role: 'user', content: 'test' }],
          { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
          null,
          null,
          { verifyMode: true, maxRetries: 3, onVerifyAttempt }
        )

        expect(result.execution.success).toBe(true)
        expect(result.execution.result).toBe(42)
        expect(result.attempts).toBe(2)
        expect(onVerifyAttempt).toHaveBeenCalledWith(2, expect.stringContaining('undefinedVar'))
      })

      it('should not retry when verifyMode is disabled', async () => {
        mockSendMessage.mockResolvedValueOnce(JSON.stringify({
          canBeCode: true,
          taskDescription: 'Test',
          inputs: [],
          expectedOutput: 'number',
          codeType: 'expression',
          functionName: 'test'
        }))
        mockSendMessage.mockResolvedValueOnce('undefinedVar')

        const result = await analyzeGenerateAndExecute(
          [{ role: 'user', content: 'test' }],
          { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
          null,
          null,
          { verifyMode: false }
        )

        expect(result.execution.success).toBe(false)
        expect(result.attempts).toBe(1)
        expect(mockSendMessage).toHaveBeenCalledTimes(2) // Only analyze + generate, no retry
      })

      it('should stop retrying after maxRetries', async () => {
        mockSendMessage.mockResolvedValueOnce(JSON.stringify({
          canBeCode: true,
          taskDescription: 'Test',
          inputs: [],
          expectedOutput: 'number',
          codeType: 'expression',
          functionName: 'test'
        }))
        // All attempts return broken code
        mockSendMessage.mockResolvedValue('brokenCode')

        const result = await analyzeGenerateAndExecute(
          [{ role: 'user', content: 'test' }],
          { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
          null,
          null,
          { verifyMode: true, maxRetries: 3 }
        )

        expect(result.execution.success).toBe(false)
        expect(result.attempts).toBe(3)
        // The final response contains the error message from the failed execution
        expect(result.finalResponse).toContain('Error:')
      })

      it('should return attempts count in result', async () => {
        mockSendMessage.mockResolvedValueOnce(JSON.stringify({
          canBeCode: true,
          taskDescription: 'Test',
          inputs: [],
          expectedOutput: 'number',
          codeType: 'expression',
          functionName: 'test'
        }))
        mockSendMessage.mockResolvedValueOnce('10 + 5')

        const result = await analyzeGenerateAndExecute(
          [{ role: 'user', content: 'test' }],
          { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
          null,
          null,
          { verifyMode: true }
        )

        expect(result.attempts).toBe(1)
        expect(result.execution.success).toBe(true)
      })
    })
  })

  describe('regenerateCodeWithError', () => {
    it('should call lmstudioProvider with error context', async () => {
      mockSendMessage.mockResolvedValue('42')

      const analysis = {
        taskDescription: 'Calculate sum',
        inputs: [{ name: 'x', value: 5 }],
        expectedOutput: 'number'
      }

      await regenerateCodeWithError(
        analysis,
        'calculate sum',
        'badCode',
        'ReferenceError: badCode is not defined',
        'gpt-oss-20b'
      )

      expect(mockSendMessage).toHaveBeenCalledWith(
        'gpt-oss-20b',
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('badCode')
          })
        ]),
        null,
        null,
        expect.any(Object)
      )

      // Check that error message is included
      const userMessage = mockSendMessage.mock.calls[0][1][1].content
      expect(userMessage).toContain('ReferenceError: badCode is not defined')
      expect(userMessage).toContain('Calculate sum')
    })
  })

  describe('generateVisualization', () => {
    it('should generate chart visualization', async () => {
      const chartOption = JSON.stringify({
        title: { text: 'Test Chart' },
        series: [{ type: 'pie', data: [{ value: 30, name: 'A' }] }]
      })
      mockSendMessage.mockResolvedValue(chartOption)

      const analysis = {
        visualizationType: 'chart',
        taskDescription: 'Create pie chart',
        inputs: [{ name: 'data', value: [{ name: 'A', value: 30 }] }],
        expectedOutput: 'Pie chart'
      }

      const result = await generateVisualization(analysis, 'draw a pie chart', 'gpt-oss-20b')

      expect(result.type).toBe('chart')
      expect(result.content).toContain('Test Chart')
      expect(mockSendMessage).toHaveBeenCalledWith(
        'gpt-oss-20b',
        expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('ECharts') })
        ]),
        null,
        null,
        expect.any(Object)
      )
    })

    it('should generate mermaid visualization', async () => {
      const mermaidCode = 'flowchart TD\n    A[Start] --> B[End]'
      mockSendMessage.mockResolvedValue(mermaidCode)

      const analysis = {
        visualizationType: 'mermaid',
        taskDescription: 'Create flowchart',
        inputs: [],
        expectedOutput: 'Flowchart'
      }

      const result = await generateVisualization(analysis, 'draw a flowchart', 'gpt-oss-20b')

      expect(result.type).toBe('mermaid')
      expect(result.content).toContain('flowchart TD')
      expect(mockSendMessage).toHaveBeenCalledWith(
        'gpt-oss-20b',
        expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('Mermaid') })
        ]),
        null,
        null,
        expect.any(Object)
      )
    })

    it('should generate svg visualization', async () => {
      const svgCode = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'
      mockSendMessage.mockResolvedValue(svgCode)

      const analysis = {
        visualizationType: 'svg',
        taskDescription: 'Draw a circle',
        inputs: [],
        expectedOutput: 'SVG drawing'
      }

      const result = await generateVisualization(analysis, 'draw a circle', 'gpt-oss-20b')

      expect(result.type).toBe('svg')
      expect(result.content).toContain('<svg')
      expect(result.content).toContain('</svg>')
      expect(mockSendMessage).toHaveBeenCalledWith(
        'gpt-oss-20b',
        expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('SVG') })
        ]),
        null,
        null,
        expect.any(Object)
      )
    })

    it('should clean markdown code blocks from chart output', async () => {
      mockSendMessage.mockResolvedValue('```json\n{"title": {"text": "Chart"}}\n```')

      const analysis = {
        visualizationType: 'chart',
        taskDescription: 'Test',
        inputs: [],
        expectedOutput: 'Chart'
      }

      const result = await generateVisualization(analysis, 'test', 'gpt-oss-20b')

      expect(result.content).toBe('{"title": {"text": "Chart"}}')
    })

    it('should extract SVG from response with extra text', async () => {
      mockSendMessage.mockResolvedValue('Here is the SVG:\n<svg viewBox="0 0 100 100"><rect/></svg>\nDone!')

      const analysis = {
        visualizationType: 'svg',
        taskDescription: 'Test',
        inputs: [],
        expectedOutput: 'SVG'
      }

      const result = await generateVisualization(analysis, 'test', 'gpt-oss-20b')

      expect(result.content).toBe('<svg viewBox="0 0 100 100"><rect/></svg>')
    })

    it('should default to chart type when visualizationType is null', async () => {
      mockSendMessage.mockResolvedValue('{"series": []}')

      const analysis = {
        visualizationType: null,
        taskDescription: 'Test',
        inputs: [],
        expectedOutput: 'Chart'
      }

      const result = await generateVisualization(analysis, 'test', 'gpt-oss-20b')

      expect(result.type).toBe('chart')
    })
  })

  describe('analyzeGenerateAndExecute with visualization', () => {
    it('should route to visualization for chart task', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        isVisualization: true,
        visualizationType: 'chart',
        canBeCode: false,
        taskDescription: 'Create pie chart',
        inputs: [{ name: 'data', value: [{ name: 'A', value: 30 }] }],
        expectedOutput: 'Pie chart'
      }))
      mockSendMessage.mockResolvedValueOnce('{"title": {"text": "Sales"}, "series": [{"type": "pie"}]}')

      const onVisualizationGenerated = vi.fn()

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'draw a pie chart of sales' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' },
        null,
        null,
        { onVisualizationGenerated }
      )

      expect(result.visualization).toBeTruthy()
      expect(result.visualization.type).toBe('chart')
      expect(result.code).toBeNull()
      expect(result.execution).toBeNull()
      expect(onVisualizationGenerated).toHaveBeenCalledWith(expect.objectContaining({ type: 'chart' }))
    })

    it('should route to visualization for mermaid task', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        isVisualization: true,
        visualizationType: 'mermaid',
        canBeCode: false,
        taskDescription: 'Create flowchart',
        inputs: [],
        expectedOutput: 'Flowchart'
      }))
      mockSendMessage.mockResolvedValueOnce('flowchart TD\n    A --> B')

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'draw a flowchart' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      expect(result.visualization).toBeTruthy()
      expect(result.visualization.type).toBe('mermaid')
      expect(result.visualization.content).toContain('flowchart')
    })

    it('should route to visualization for svg task', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        isVisualization: true,
        visualizationType: 'svg',
        canBeCode: false,
        taskDescription: 'Draw a star',
        inputs: [],
        expectedOutput: 'SVG'
      }))
      mockSendMessage.mockResolvedValueOnce('<svg viewBox="0 0 100 100"><polygon points="50,5 20,99 95,39 5,39 80,99"/></svg>')

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'draw a star' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      expect(result.visualization).toBeTruthy()
      expect(result.visualization.type).toBe('svg')
      expect(result.visualization.content).toContain('<svg')
    })

    it('should not route to visualization when isVisualization is false', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        isVisualization: false,
        visualizationType: null,
        canBeCode: true,
        taskDescription: 'Generate QR code',
        inputs: [],
        expectedOutput: 'QR code data',
        codeType: 'function',
        functionName: 'generateQR'
      }))
      mockSendMessage.mockResolvedValueOnce('"QR_CODE_DATA"')

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'generate a QR code' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      expect(result.visualization).toBeNull()
      expect(result.code).toBeTruthy()
      expect(result.execution).toBeTruthy()
    })

    it('should return null visualization for text response', async () => {
      mockSendMessage.mockResolvedValueOnce(JSON.stringify({
        isVisualization: false,
        visualizationType: null,
        canBeCode: false,
        taskDescription: 'Explain something',
        inputs: [],
        expectedOutput: 'Explanation'
      }))
      mockSendMessage.mockResolvedValueOnce('Here is the explanation...')

      const result = await analyzeGenerateAndExecute(
        [{ role: 'user', content: 'explain charts' }],
        { routerId: 'mistral-3b', executorId: 'gpt-oss-20b' }
      )

      expect(result.visualization).toBeNull()
      expect(result.code).toBeNull()
      expect(result.finalResponse).toBe('Here is the explanation...')
    })
  })

  describe('parseAnalysisResponse (via analyzeRequest)', () => {
    it('should handle JSON with trailing commas', async () => {
      mockSendMessage.mockResolvedValue(`{
        "canBeCode": true,
        "taskDescription": "Test",
        "inputs": [],
        "expectedOutput": "result",
        "codeType": "expression",
        "functionName": "test",
      }`)

      const result = await analyzeRequest('test', 'mistral-3b')

      expect(result.canBeCode).toBe(true)
      expect(result.functionName).toBe('test')
    })

    it('should handle JSON with single quotes', async () => {
      mockSendMessage.mockResolvedValue(`{
        'canBeCode': true,
        'taskDescription': 'Test task',
        'inputs': [],
        'expectedOutput': 'result',
        'codeType': 'expression',
        'functionName': 'test'
      }`)

      const result = await analyzeRequest('test', 'mistral-3b')

      expect(result.canBeCode).toBe(true)
    })

    it('should extract fields from malformed JSON via fallback', async () => {
      mockSendMessage.mockResolvedValue(`Here's my analysis:
        { "canBeCode": true, "taskDescription": "Calculate sum", "functionName": "calculateSum"
        broken JSON here...`)

      const result = await analyzeRequest('test', 'mistral-3b')

      // Should use fallback extraction
      expect(result.taskDescription).toBe('Calculate sum')
      expect(result.functionName).toBe('calculateSum')
    })

    it('should detect language task as non-code', async () => {
      mockSendMessage.mockResolvedValue('{"canBeCode": false, "taskDescription": "Language task"}')

      const result = await analyzeRequest('translate hello to French', 'mistral-3b')

      expect(result.canBeCode).toBe(false)
    })

    it('should detect language task from fallback text', async () => {
      mockSendMessage.mockResolvedValue('This is a language task that needs understanding')

      const result = await analyzeRequest('summarize this', 'mistral-3b')

      expect(result.canBeCode).toBe(false)
    })

    it('should default to code task when unsure', async () => {
      mockSendMessage.mockResolvedValue('Some random response without clear indicators')

      const result = await analyzeRequest('do something', 'mistral-3b')

      expect(result.canBeCode).toBe(true)
      expect(result.codeType).toBe('expression')
    })

    it('should parse visualization fields from JSON', async () => {
      mockSendMessage.mockResolvedValue(JSON.stringify({
        isVisualization: true,
        visualizationType: 'chart',
        canBeCode: false,
        taskDescription: 'Create chart',
        inputs: [],
        expectedOutput: 'Chart'
      }))

      const result = await analyzeRequest('draw a chart', 'mistral-3b')

      expect(result.isVisualization).toBe(true)
      expect(result.visualizationType).toBe('chart')
    })

    it('should extract visualization type from malformed JSON', async () => {
      mockSendMessage.mockResolvedValue(`{
        "isVisualization": true,
        "visualizationType": "mermaid",
        broken...`)

      const result = await analyzeRequest('draw diagram', 'mistral-3b')

      expect(result.visualizationType).toBe('mermaid')
    })

    it('should default isVisualization to false when not present', async () => {
      mockSendMessage.mockResolvedValue('Random response without visualization')

      const result = await analyzeRequest('do something', 'mistral-3b')

      expect(result.isVisualization).toBe(false)
      expect(result.visualizationType).toBeNull()
    })
  })
})
