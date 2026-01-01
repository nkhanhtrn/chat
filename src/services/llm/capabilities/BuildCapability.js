/**
 * BuildCapability - Builds interactive Vue.js tools from user prompts
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'
import { saveTool, syncToolsFromCloud } from '../../indexedDB.js'

const SYSTEM_PROMPT = `Build interactive Vue 3 components using Options API (data, methods, computed). Style to fill container.

CRITICAL: Use these pre-defined CSS variables (do NOT redefine them, they are already set by the host app):
- Backgrounds: var(--color-bg-base), var(--color-bg-elevated), var(--color-bg-hover), var(--color-bg-button)
- Text: var(--color-text-base), var(--color-text-muted), var(--color-text-strong)
- Borders: var(--color-border-base), var(--color-border-subtle), var(--color-border-input)
- Inputs: var(--color-bg-input), var(--color-border-input)
- Primary accent: var(--color-primary), var(--color-primary-hover)
Never include :root or define CSS variables. Just use var(--color-*).

Start with: <!-- @tool: Name Emoji --> (e.g. <!-- @tool: Calculator 🧮 -->)
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
    const { fullContext, models, config, provider, signal, callbacks = {}, sessionId } = context
    const { onToolGenerated } = callbacks

    // Sync tools from cloud first (non-blocking, best effort)
    await syncToolsFromCloud().catch(() => {})

    // Build new tool
    const code = await this._buildTool(fullContext, models.executorId, provider, config, signal, pipedData)

    let parsedTool
    try {
      parsedTool = this._parseOutput(code)
    } catch (e) {
      return { success: false, result: null, error: e.message }
    }

    // Auto-save tool to library with session scope (defaults to session if sessionId provided)
    // This generates and assigns an ID that must be used for tool instance storage
    const savedTool = await saveTool({
      ...parsedTool,
      sourcePrompt: fullContext,
      scope: sessionId ? 'session' : 'global',
      sessionId: sessionId || null
    })

    if (onToolGenerated) onToolGenerated(savedTool)

    return { success: true, result: savedTool, error: null }
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
- Use CSS variables for colors: --color-bg-base, --color-bg-elevated, --color-text-base, --color-text-muted, --color-border-base, --color-primary, --color-bg-input, --color-border-input, --color-bg-button
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

    // Extract name and emoji from @tool comment before processing
    let name = null
    let emoji = null
    const toolMatch = code.match(/<!--\s*@tool:\s*(.+?)\s*-->/)
    if (toolMatch) {
      const toolInfo = toolMatch[1].trim()
      // Split into name and emoji - emoji is typically at the end
      const emojiMatch = toolInfo.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u)
      if (emojiMatch) {
        emoji = emojiMatch[0]
        name = toolInfo.slice(0, -emoji.length).trim()
      } else {
        name = toolInfo
      }
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

    // Strip any :root CSS variable definitions to prevent theme override
    code = code.replace(/:root\s*\{[^}]*\}/g, '')

    // Fallback: extract name from component if not found in @tool comment
    if (!name) {
      name = this._extractComponentName(code)
    }

    return { code, type: 'vue-sfc', name, emoji }
  }

  _extractComponentName(code) {
    // Try to find name property in script: name: 'ComponentName' or name: "ComponentName"
    const nameMatch = code.match(/name\s*:\s*['"]([^'"]+)['"]/)
    if (nameMatch) {
      return nameMatch[1]
    }

    // Try to find a main heading in template
    const h1Match = code.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) {
      return h1Match[1].trim().substring(0, 30)
    }

    // Try to find title in template (common pattern)
    const titleMatch = code.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i) ||
                       code.match(/<[^>]+title[^>]*>([^<]+)</i)
    if (titleMatch) {
      return titleMatch[1].trim().substring(0, 30)
    }

    return 'Tool'
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
