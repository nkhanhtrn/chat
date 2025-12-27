/**
 * BuildCapability - Builds interactive Vue.js tools from user prompts
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'

const SYSTEM_PROMPT = `Build interactive Vue 3 components using Options API (data, methods, computed). Style to fill container.
Use CSS variables for theming: --color-primary, --color-bg-base, --color-bg-elevated, --color-text-base, --color-text-muted, --color-border-base.
Output only the code.`

export class BuildCapability extends BaseCapability {
  name = 'build'
  priority = 55

  getRouterDescription() {
    return {
      name: 'build',
      description: 'Creates INTERACTIVE UI tools with buttons, forms, and controls.',
      conditions: [
        'User says "add a tool" or "build a tool"',
        'User wants an interactive tool (buttons, inputs, controls)',
        'User describes an app, widget, or utility to use'
      ],
      examples: [
        { input: 'Build me a calculator' },
        { input: 'Create a todo list' },
        { input: 'Make a timer' }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'build' ||
           analysis.isBuildTool === true ||
           analysis.toolType !== undefined
  }

  async process(input) {
    const { data: pipedData, context } = input
    const { fullContext, models, config, provider, signal, callbacks = {} } = context
    const { onToolGenerated } = callbacks

    // Build the tool directly
    const code = await this._buildTool(fullContext, models.executorId, provider, config, signal, pipedData)

    let parsedTool
    try {
      parsedTool = this._parseOutput(code)
    } catch (e) {
      return { success: false, result: null, error: e.message }
    }

    if (onToolGenerated) onToolGenerated(parsedTool)

    return { success: true, result: parsedTool, error: null }
  }

  async _buildTool(userMessage, modelId, provider, config, signal, pipedData = null) {
    let prompt = `Build: "${userMessage}"`

    if (pipedData) {
      prompt += `\n\nUse this data: ${JSON.stringify(pipedData)}`
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]

    return await provider.sendMessage(modelId, messages, null, signal, config)
  }

  async editTool(currentCode, request, modelId, provider, config, signal) {
    const systemPrompt = `Modify the Vue component per the request. Also consolidate the code:
- Remove comments and unused code
- Simplify verbose patterns
- Keep functionality identical
Output only the complete, consolidated code.`

    const userPrompt = `Component:\n${currentCode}\n\nRequest: ${request}`

    const totalChars = systemPrompt.length + userPrompt.length
    console.log(`[BuildCapability] Edit tokens: ~${Math.ceil(totalChars / 4)} (code: ${currentCode.length} chars)`)

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    const output = await provider.sendMessage(modelId, messages, null, signal, config)
    return this._parseOutput(output)
  }

  _parseOutput(raw) {
    let code = raw.trim()

    // Remove markdown fences
    if (code.startsWith('```')) {
      code = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
    }

    // Extract Vue SFC
    const start = code.indexOf('<template>')
    const endStyle = code.lastIndexOf('</style>')
    const endScript = code.lastIndexOf('</script>')
    const end = endStyle !== -1 ? endStyle + 8 : endScript + 9

    if (start !== -1 && end > start) {
      code = code.substring(start, end)
    }

    if (!code.includes('<template>')) {
      throw new Error('Invalid Vue component')
    }

    return { code, type: 'vue-sfc', name: 'Tool' }
  }

  // Base class interface
  receiveInput(pipeInput, context) {
    return { data: pipeInput?.data ?? null, context }
  }

  produceOutput(result) {
    return createPipeData(result.success ? result.result : { error: result.error }, this.name)
  }

  async execute(context, pipeInput = null) {
    const input = this.receiveInput(pipeInput, context)
    const result = await this.process(input)
    return { ...result, pipe: this.produceOutput(result) }
  }

  formatOutput(result) {
    return { type: 'tool', content: result, displayHint: 'tool' }
  }
}

export default BuildCapability
