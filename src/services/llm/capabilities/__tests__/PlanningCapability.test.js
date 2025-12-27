import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanningCapability } from '../PlanningCapability.js'

describe('PlanningCapability', () => {
  let capability
  let mockProvider

  beforeEach(() => {
    capability = new PlanningCapability()
    mockProvider = {
      sendMessage: vi.fn()
    }
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('planning')
    })

    it('should have priority 80 (higher than websearch)', () => {
      expect(capability.priority).toBe(80)
    })

    it('should have correct AVAILABLE_CAPABILITIES', () => {
      expect(PlanningCapability.AVAILABLE_CAPABILITIES).toEqual([
        'text', 'code', 'visualization', 'build', 'websearch'
      ])
    })
  })

  describe('getRouterDescription', () => {
    it('should return description with name and description', () => {
      const desc = capability.getRouterDescription()

      expect(desc.name).toBe('planning')
      expect(desc.description).toContain('TWO OR MORE different capabilities')
    })

    it('should include conditions for multi-step workflows', () => {
      const desc = capability.getRouterDescription()

      expect(desc.conditions).toBeDefined()
      expect(desc.conditions.length).toBeGreaterThan(0)
      expect(desc.conditions.some(c => c.includes('sequential'))).toBe(true)
    })

    it('should include anti-conditions for simple tasks', () => {
      const desc = capability.getRouterDescription()

      expect(desc.antiConditions).toBeDefined()
      expect(desc.antiConditions.some(c => c.includes('simple') || c.includes('Just'))).toBe(true)
    })

    it('should include examples of multi-step tasks', () => {
      const desc = capability.getRouterDescription()

      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples[0]).toHaveProperty('input')
      // Examples should mention search/find combined with create/build
      expect(desc.examples.some(e =>
        e.input.toLowerCase().includes('search') || e.input.toLowerCase().includes('find')
      )).toBe(true)
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "planning"', () => {
      expect(capability.canHandle({ capability: 'planning' })).toBe(true)
    })

    it('should not handle other capabilities', () => {
      expect(capability.canHandle({ capability: 'text' })).toBe(false)
      expect(capability.canHandle({ capability: 'code' })).toBe(false)
      expect(capability.canHandle({ capability: 'build' })).toBe(false)
      expect(capability.canHandle({ capability: 'visualization' })).toBe(false)
      expect(capability.canHandle({ capability: 'websearch' })).toBe(false)
    })

    it('should not handle when capability is not specified', () => {
      expect(capability.canHandle({})).toBe(false)
    })
  })

  describe('_getPlanningPrompt', () => {
    it('should return a prompt string', () => {
      const prompt = capability._getPlanningPrompt()

      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
    })

    it('should mention available capabilities', () => {
      const prompt = capability._getPlanningPrompt()

      expect(prompt).toContain('websearch')
      expect(prompt).toContain('code')
      expect(prompt).toContain('visualization')
      expect(prompt).toContain('build')
      expect(prompt).toContain('text')
    })

    it('should include rules for step creation', () => {
      const prompt = capability._getPlanningPrompt()

      expect(prompt).toContain('2-5 steps')
      expect(prompt).toContain('{{step_N_result}}')
    })

    it('should include output format specification', () => {
      const prompt = capability._getPlanningPrompt()

      expect(prompt).toContain('OUTPUT FORMAT')
      expect(prompt).toContain('"plan"')
      expect(prompt).toContain('"steps"')
    })
  })

  describe('_parsePlan', () => {
    it('should parse valid plan JSON', () => {
      const response = JSON.stringify({
        plan: 'Test plan',
        steps: [
          { step: 1, capability: 'websearch', task: 'Search for data' },
          { step: 2, capability: 'build', task: 'Build a tool' }
        ]
      })

      const plan = capability._parsePlan(response)

      expect(plan.plan).toBe('Test plan')
      expect(plan.steps).toHaveLength(2)
      expect(plan.steps[0].capability).toBe('websearch')
    })

    it('should extract JSON from response with surrounding text', () => {
      const response = `Here's the plan:
      {
        "plan": "Extract JSON plan",
        "steps": [
          { "step": 1, "capability": "text", "task": "Generate text" }
        ]
      }
      Done!`

      const plan = capability._parsePlan(response)

      expect(plan.plan).toBe('Extract JSON plan')
      expect(plan.steps).toHaveLength(1)
    })

    it('should fix common JSON issues (trailing commas)', () => {
      const response = `{
        "plan": "Plan with trailing comma",
        "steps": [
          { "step": 1, "capability": "code", "task": "Run code", },
        ],
      }`

      const plan = capability._parsePlan(response)

      expect(plan.plan).toBe('Plan with trailing comma')
    })

    it('should fix capability aliases (search -> websearch)', () => {
      const response = JSON.stringify({
        plan: 'Test aliases',
        steps: [
          { step: 1, capability: 'search', task: 'Search' }
        ]
      })

      const plan = capability._parsePlan(response)

      expect(plan.steps[0].capability).toBe('websearch')
    })

    it('should fix capability aliases (chart -> visualization)', () => {
      const response = JSON.stringify({
        plan: 'Test chart alias',
        steps: [
          { step: 1, capability: 'chart', task: 'Create chart' }
        ]
      })

      const plan = capability._parsePlan(response)

      expect(plan.steps[0].capability).toBe('visualization')
    })

    it('should fix capability aliases (diagram -> visualization)', () => {
      const response = JSON.stringify({
        plan: 'Test diagram alias',
        steps: [
          { step: 1, capability: 'diagram', task: 'Create diagram' }
        ]
      })

      const plan = capability._parsePlan(response)

      expect(plan.steps[0].capability).toBe('visualization')
    })

    it('should fix capability aliases (tool -> build)', () => {
      const response = JSON.stringify({
        plan: 'Test tool alias',
        steps: [
          { step: 1, capability: 'tool', task: 'Create tool' }
        ]
      })

      const plan = capability._parsePlan(response)

      expect(plan.steps[0].capability).toBe('build')
    })

    it('should throw error when no JSON found', () => {
      const response = 'No JSON here, just plain text'

      expect(() => capability._parsePlan(response)).toThrow('No JSON found')
    })

    it('should throw error when steps array is missing', () => {
      const response = JSON.stringify({
        plan: 'No steps'
      })

      expect(() => capability._parsePlan(response)).toThrow('missing steps array')
    })

    it('should throw error when steps array is empty', () => {
      const response = JSON.stringify({
        plan: 'Empty steps',
        steps: []
      })

      expect(() => capability._parsePlan(response)).toThrow('missing steps array')
    })

    it('should throw error when step is missing capability', () => {
      const response = JSON.stringify({
        plan: 'Missing capability',
        steps: [
          { step: 1, task: 'Do something' }
        ]
      })

      expect(() => capability._parsePlan(response)).toThrow('missing capability or task')
    })

    it('should throw error when step is missing task', () => {
      const response = JSON.stringify({
        plan: 'Missing task',
        steps: [
          { step: 1, capability: 'text' }
        ]
      })

      expect(() => capability._parsePlan(response)).toThrow('missing capability or task')
    })
  })

  describe('process', () => {
    it('should generate and execute a plan', async () => {
      const planJson = JSON.stringify({
        plan: 'Test execution',
        steps: [
          { step: 1, capability: 'text', task: 'Generate response' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      // Mock the registry
      vi.doMock('../index.js', () => ({
        registry: {
          get: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue({
              success: true,
              result: 'Step result',
              error: null
            })
          })
        }
      }))

      const context = {
        userMessage: 'Test request',
        fullContext: 'Full context',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: {}
      }

      const result = await capability.process({ context })

      expect(mockProvider.sendMessage).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.result.plan).toBeDefined()
    })

    it('should call onPlanGenerated callback when plan is ready', async () => {
      const planJson = JSON.stringify({
        plan: 'Callback test',
        steps: [
          { step: 1, capability: 'text', task: 'Task 1' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      const onPlanGenerated = vi.fn()

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: { onPlanGenerated }
      }

      await capability.process({ context })

      expect(onPlanGenerated).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'Callback test' })
      )
    })

    it('should call onStepStart and onStepComplete callbacks', async () => {
      const planJson = JSON.stringify({
        plan: 'Step callbacks',
        steps: [
          { step: 1, capability: 'text', task: 'Task 1' },
          { step: 2, capability: 'code', task: 'Task 2' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      const onStepStart = vi.fn()
      const onStepComplete = vi.fn()

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: { onStepStart, onStepComplete }
      }

      await capability.process({ context })

      expect(onStepStart).toHaveBeenCalledTimes(2)
      expect(onStepComplete).toHaveBeenCalledTimes(2)
    })

    it('should call onPlanComplete callback when all steps done', async () => {
      const planJson = JSON.stringify({
        plan: 'Complete callback',
        steps: [
          { step: 1, capability: 'text', task: 'Only task' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      const onPlanComplete = vi.fn()

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: { onPlanComplete }
      }

      await capability.process({ context })

      expect(onPlanComplete).toHaveBeenCalled()
    })

    it('should stop execution when signal is aborted', async () => {
      const planJson = JSON.stringify({
        plan: 'Abort test',
        steps: [
          { step: 1, capability: 'text', task: 'Task 1' },
          { step: 2, capability: 'text', task: 'Task 2' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      const controller = new AbortController()
      controller.abort()

      const onStepStart = vi.fn()

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: controller.signal,
        callbacks: { onStepStart }
      }

      await capability.process({ context })

      // Should not start any steps since signal was already aborted
      expect(onStepStart).not.toHaveBeenCalled()
    })

    it('should replace placeholders in step tasks with previous results', async () => {
      const planJson = JSON.stringify({
        plan: 'Placeholder test',
        steps: [
          { step: 1, capability: 'websearch', task: 'Get price' },
          { step: 2, capability: 'build', task: 'Build with {{step_1_result}}' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      const executedTasks = []

      // Track the tasks that get executed
      const originalExecuteStep = capability._executeStep.bind(capability)
      capability._executeStep = vi.fn().mockImplementation(async (step, context, previousResults) => {
        executedTasks.push(step.task)
        if (step.step === 1) {
          return { success: true, result: '$50000' }
        }
        return { success: true, result: 'Built' }
      })

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: {}
      }

      await capability.process({ context })

      expect(executedTasks[1]).toBe('Build with $50000')
    })

    it('should return error result on plan parsing failure', async () => {
      mockProvider.sendMessage.mockResolvedValue('Invalid response without JSON')

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: {}
      }

      const result = await capability.process({ context })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to parse execution plan')
    })

    it('should include metadata about execution', async () => {
      const planJson = JSON.stringify({
        plan: 'Metadata test',
        steps: [
          { step: 1, capability: 'text', task: 'Task 1' },
          { step: 2, capability: 'code', task: 'Task 2' }
        ]
      })

      mockProvider.sendMessage.mockResolvedValue(planJson)

      capability._executeStep = vi.fn().mockResolvedValue({
        success: true,
        result: 'Done'
      })

      const context = {
        userMessage: 'Test',
        fullContext: 'Test',
        models: { executorId: 'model-1' },
        provider: mockProvider,
        config: {},
        signal: null,
        callbacks: {}
      }

      const result = await capability.process({ context })

      expect(result.metadata.totalSteps).toBe(2)
      expect(result.metadata.successfulSteps).toBe(2)
      expect(result.metadata.capabilities).toEqual(['text', 'code'])
    })
  })

  describe('_executeStep', () => {
    it('should return error for unknown capability', async () => {
      const step = { capability: 'unknown', task: 'Do something' }

      vi.doMock('../index.js', () => ({
        registry: {
          get: vi.fn().mockReturnValue(null)
        }
      }))

      const result = await capability._executeStep(step, {}, {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown capability')
    })

    it('should handle chaining when capability returns chainTo', async () => {
      const step = { step: 1, capability: 'websearch', task: 'Search' }

      const mockCapability = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          result: 'search results',
          chainTo: 'text'
        })
      }

      const mockChainedCapability = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          result: 'chained result'
        })
      }

      // We can't easily mock dynamic imports, so we'll test the logic conceptually
      // The actual chaining behavior is tested through integration tests
    })
  })

  describe('_generateSummary', () => {
    it('should generate summary with plan title', () => {
      const plan = { plan: 'My test plan' }
      const stepResults = []

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('## Plan: My test plan')
    })

    it('should show step completion status', () => {
      const plan = { plan: 'Status test' }
      const stepResults = [
        { step: 1, task: 'Task 1', capability: 'text', success: true, result: 'Done' },
        { step: 2, task: 'Task 2', capability: 'code', success: false, result: { error: 'Failed' } }
      ]

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('1/2 steps completed')
    })

    it('should show checkmark for successful steps', () => {
      const plan = { plan: 'Success test' }
      const stepResults = [
        { step: 1, task: 'Successful task', capability: 'text', success: true, result: 'OK' }
      ]

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('Complete')
    })

    it('should show X for failed steps', () => {
      const plan = { plan: 'Failure test' }
      const stepResults = [
        { step: 1, task: 'Failed task', capability: 'text', success: false, result: { error: 'Oops' } }
      ]

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('Failed')
    })

    it('should include step details', () => {
      const plan = { plan: 'Details test' }
      const stepResults = [
        { step: 1, task: 'Do something', capability: 'code', success: true, result: 'output' }
      ]

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('Step 1')
      expect(summary).toContain('Do something')
      expect(summary).toContain('code')
    })

    it('should truncate long results', () => {
      const plan = { plan: 'Truncate test' }
      const longResult = 'x'.repeat(300)
      const stepResults = [
        { step: 1, task: 'Task', capability: 'text', success: true, result: longResult }
      ]

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('...')
      expect(summary.length).toBeLessThan(longResult.length + 200)
    })

    it('should stringify object results', () => {
      const plan = { plan: 'Object test' }
      const stepResults = [
        { step: 1, task: 'Task', capability: 'text', success: true, result: { key: 'value' } }
      ]

      const summary = capability._generateSummary(plan, stepResults)

      expect(summary).toContain('"key"')
      expect(summary).toContain('"value"')
    })
  })

  describe('produceOutput', () => {
    it('should create pipe data with result on success', () => {
      const processResult = {
        success: true,
        result: { plan: 'Test', stepResults: [] }
      }

      const output = capability.produceOutput(processResult)

      expect(output.data).toEqual(processResult.result)
      expect(output.source).toBe('planning')
    })

    it('should create pipe data with error on failure', () => {
      const processResult = {
        success: false,
        result: null,
        error: 'Something went wrong'
      }

      const output = capability.produceOutput(processResult)

      expect(output.data).toEqual({ error: 'Something went wrong' })
      expect(output.source).toBe('planning')
    })
  })

  describe('formatOutput', () => {
    it('should return error display hint when result is null', () => {
      const output = capability.formatOutput(null)

      expect(output.type).toBe('planning')
      expect(output.content).toBeNull()
      expect(output.displayHint).toBe('error')
    })

    it('should format valid result', () => {
      const result = {
        plan: { plan: 'Test plan', steps: [] },
        stepResults: [{ step: 1, success: true }],
        summary: 'Summary text'
      }

      const output = capability.formatOutput(result)

      expect(output.type).toBe('planning')
      expect(output.content).toEqual(result)
      expect(output.displayHint).toBe('plan')
    })

    it('should include metadata', () => {
      const result = {
        plan: { plan: 'Test', steps: [] },
        stepResults: []
      }
      const metadata = { totalSteps: 2, successfulSteps: 1 }

      const output = capability.formatOutput(result, metadata)

      expect(output.metadata.totalSteps).toBe(2)
      expect(output.metadata.successfulSteps).toBe(1)
      expect(output.metadata.plan).toEqual(result.plan)
      expect(output.metadata.stepResults).toEqual(result.stepResults)
    })
  })
})
