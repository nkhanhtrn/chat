/**
 * PlanningCapability - Breaks down complex prompts into multiple steps
 *
 * This capability analyzes complex user requests and creates an execution plan
 * with multiple steps, where each step uses one of the available capabilities
 * (text, code, visualization, build, websearch).
 *
 * The plan is displayed to the user and executed step by step, with results
 * from each step available to subsequent steps.
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'

export class PlanningCapability extends BaseCapability {
  name = 'planning'
  priority = 80  // Higher than websearch to catch complex multi-step requests

  /**
   * Available capabilities that can be used in steps
   */
  static AVAILABLE_CAPABILITIES = ['text', 'code', 'visualization', 'build', 'websearch']

  getRouterDescription() {
    return {
      name: 'planning',
      description: 'IMPORTANT: Use this when a request needs TWO OR MORE different capabilities in sequence. This orchestrates multi-step workflows.',
      conditions: [
        'Request mentions "search/find/look up" AND "create/build/make/show"',
        'Request combines web search with visualization (chart, diagram)',
        'Request combines web search with building a tool',
        'Request needs data from web THEN processing or display',
        'User explicitly asks to "plan", "break down", or do "step by step"',
        'Task has clear sequential dependencies (get X, then do Y with X)'
      ],
      antiConditions: [
        'Simple single-step tasks',
        'Just a question (use text)',
        'Just a calculation (use code)',
        'Just a chart with given data (use visualization)',
        'Just a tool with no external data (use build)'
      ],
      examples: [
        { input: 'Search for Bitcoin price and create a converter tool' },
        { input: 'Find population of countries and create a chart' },
        { input: 'Look up weather and build a display widget' },
        { input: 'Research stock prices and visualize the comparison' }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'planning'
  }

  /**
   * Generate the planning prompt for the LLM
   */
  _getPlanningPrompt() {
    return `You are a task planner. Analyze the user's complex request and break it down into sequential steps.

AVAILABLE CAPABILITIES:
- websearch: Search the web for current information (use for: prices, news, weather, facts)
- code: Execute JavaScript calculations (use for: math, data processing, transformations)
- visualization: Create charts/diagrams (use for: displaying data visually)
- build: Create interactive tools (use for: calculators, forms, converters)
- text: Generate text response (use for: summaries, explanations, analysis)

RULES:
1. Create 2-5 steps maximum
2. Each step should use exactly one capability
3. Steps are executed in order - later steps can reference earlier results
4. Use {{step_N_result}} to reference results from step N
5. Be specific about what each step should produce

OUTPUT FORMAT (respond with ONLY this JSON, no other text):
{
  "plan": "Brief one-line description of the overall plan",
  "steps": [
    {
      "step": 1,
      "capability": "websearch|code|visualization|build|text",
      "task": "Specific task description",
      "searchQuery": "search query if websearch",
      "expectedOutput": "What this step will produce"
    }
  ]
}

EXAMPLE:
User: "Find the current price of Bitcoin and create a simple calculator to convert BTC to USD"

{
  "plan": "Get Bitcoin price and create BTC-USD converter",
  "steps": [
    {
      "step": 1,
      "capability": "websearch",
      "task": "Find current Bitcoin price in USD",
      "searchQuery": "current bitcoin price USD",
      "expectedOutput": "Current BTC price value"
    },
    {
      "step": 2,
      "capability": "build",
      "task": "Create a BTC to USD converter tool using {{step_1_result}} as the exchange rate",
      "expectedOutput": "Interactive calculator tool"
    }
  ]
}`
  }

  /**
   * Parse the plan from LLM response
   */
  _parsePlan(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      let jsonStr = jsonMatch[0]
      // Clean up common JSON issues
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')

      const plan = JSON.parse(jsonStr)

      // Validate plan structure
      if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        throw new Error('Invalid plan structure: missing steps array')
      }

      // Validate each step
      for (const step of plan.steps) {
        if (!step.capability || !step.task) {
          throw new Error('Invalid step: missing capability or task')
        }
        if (!PlanningCapability.AVAILABLE_CAPABILITIES.includes(step.capability)) {
          // Try to fix common mismatches
          if (step.capability === 'search') step.capability = 'websearch'
          else if (step.capability === 'chart' || step.capability === 'diagram') step.capability = 'visualization'
          else if (step.capability === 'tool') step.capability = 'build'
        }
      }

      return plan
    } catch (error) {
      console.error('Failed to parse plan:', error, response)
      throw new Error(`Failed to parse execution plan: ${error.message}`)
    }
  }

  async process(input) {
    const { context } = input
    const {
      userMessage,
      fullContext,
      models,
      provider,
      config,
      signal,
      callbacks = {}
    } = context

    const {
      onPlanGenerated,
      onStepStart,
      onStepComplete,
      onPlanComplete
    } = callbacks

    try {
      // Step 1: Generate the plan
      const planningMessages = [
        { role: 'system', content: this._getPlanningPrompt() },
        { role: 'user', content: fullContext || userMessage }
      ]

      const planResponse = await provider.sendMessage(
        models.executorId,
        planningMessages,
        null,
        signal,
        config
      )

      const plan = this._parsePlan(planResponse)

      // Notify that plan is generated
      if (onPlanGenerated) {
        onPlanGenerated(plan)
      }

      // Step 2: Execute each step in sequence
      const stepResults = []
      let previousResults = {}

      for (let i = 0; i < plan.steps.length; i++) {
        if (signal?.aborted) break

        const step = plan.steps[i]

        // Notify step is starting
        if (onStepStart) {
          onStepStart(step, i)
        }

        // Replace placeholders with previous results
        let taskWithResults = step.task
        for (const [key, value] of Object.entries(previousResults)) {
          const placeholder = `{{${key}}}`
          const resultStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
          taskWithResults = taskWithResults.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), resultStr)
        }

        // Execute the step
        const stepResult = await this._executeStep({
          ...step,
          task: taskWithResults
        }, context, previousResults)

        stepResults.push({
          step: step.step,
          capability: step.capability,
          task: step.task,
          result: stepResult,
          success: stepResult.success
        })

        // Store result for next steps
        previousResults[`step_${step.step}_result`] = stepResult.success ? stepResult.result : stepResult.error

        // Notify step is complete
        if (onStepComplete) {
          onStepComplete(stepResults[i], i)
        }

        // If step failed and it's critical, we might want to stop
        // For now, continue with remaining steps
      }

      // Notify plan execution is complete
      if (onPlanComplete) {
        onPlanComplete(stepResults)
      }

      return {
        success: true,
        result: {
          plan,
          stepResults,
          summary: this._generateSummary(plan, stepResults)
        },
        error: null,
        metadata: {
          totalSteps: plan.steps.length,
          successfulSteps: stepResults.filter(r => r.success).length,
          capabilities: plan.steps.map(s => s.capability)
        }
      }
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message,
        metadata: {}
      }
    }
  }

  /**
   * Execute a single step using the appropriate capability
   */
  async _executeStep(step, context, previousResults) {
    const { registry } = await import('./index.js')

    // Get the capability for this step
    const capability = registry.get(step.capability)
    if (!capability) {
      return {
        success: false,
        result: null,
        error: `Unknown capability: ${step.capability}`
      }
    }

    // Build step-specific context
    const stepContext = {
      ...context,
      analysis: {
        capability: step.capability,
        taskDescription: step.task,
        searchQuery: step.searchQuery || '',
        needsWebSearch: step.capability === 'websearch',
        visualizationType: step.capability === 'visualization' ? 'chart' : null,
        expectedOutput: step.expectedOutput
      },
      userMessage: step.task,
      fullContext: step.task,
      previousResults
    }

    try {
      const result = await capability.execute(stepContext, null)

      // Handle chaining if the capability wants to chain
      if (result.chainTo) {
        const nextCapability = registry.get(result.chainTo)
        if (nextCapability) {
          const chainedResult = await nextCapability.execute(
            { ...stepContext, webSearchResults: result.result },
            result.pipe
          )
          return {
            success: chainedResult.success,
            result: chainedResult.result,
            error: chainedResult.error
          }
        }
      }

      return {
        success: result.success,
        result: result.result,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message
      }
    }
  }

  /**
   * Generate a summary of the plan execution
   */
  _generateSummary(plan, stepResults) {
    const successful = stepResults.filter(r => r.success).length
    const total = stepResults.length

    let summary = `## Plan: ${plan.plan}\n\n`
    summary += `**Status:** ${successful}/${total} steps completed\n\n`

    for (const stepResult of stepResults) {
      const icon = stepResult.success ? '✓' : '✗'
      const status = stepResult.success ? 'Complete' : 'Failed'
      summary += `### Step ${stepResult.step}: ${stepResult.task}\n`
      summary += `${icon} **${status}** (${stepResult.capability})\n`

      if (stepResult.success && stepResult.result) {
        // Show brief result preview
        const resultStr = typeof stepResult.result === 'object'
          ? JSON.stringify(stepResult.result, null, 2).slice(0, 200)
          : String(stepResult.result).slice(0, 200)
        summary += `\`\`\`\n${resultStr}${resultStr.length >= 200 ? '...' : ''}\n\`\`\`\n`
      } else if (!stepResult.success) {
        summary += `> Error: ${stepResult.result?.error || 'Unknown error'}\n`
      }
      summary += '\n'
    }

    return summary
  }

  produceOutput(processResult) {
    const { success, result, error } = processResult
    return createPipeData(success ? result : { error }, this.name)
  }

  formatOutput(result, metadata = {}) {
    if (!result) {
      return {
        type: 'planning',
        content: null,
        displayHint: 'error'
      }
    }

    return {
      type: 'planning',
      content: result,
      displayHint: 'plan',
      metadata: {
        ...metadata,
        plan: result.plan,
        stepResults: result.stepResults
      }
    }
  }
}

export default PlanningCapability
