/**
 * BuildCapability - Builds interactive tools from user prompts
 *
 * Pipe interface:
 * - Input: Accepts text, json, array, code-result (data to embed in tool)
 * - Process: Generates interactive tool specification
 * - Output: Produces 'tool' type with tool spec
 *
 * This capability:
 * 1. Takes a user description of a tool they want
 * 2. Generates a complete tool specification with UI layout
 * 3. Returns an interactive tool
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'

const TOOL_BUILDER_SYSTEM_PROMPT = `You are a tool builder that creates simple, functional interactive tools.

Output ONLY valid JSON - no markdown, no explanations. The code uses 'state' object for variables.

TOOL SPECIFICATION FORMAT:
{
  "name": "Tool Name",
  "description": "What this tool does",
  "layout": "calculator|converter|text-processor|form|custom",
  "state": { "variableName": "initialValue" },
  "display": { "type": "single|multi|stats|color-preview", "lines": ["main", "secondary"] },
  "elements": [{ "type": "element-type", "label": "text", "action": "actionName", "stateKey": "key" }],
  "actions": { "actionName": "JavaScript code using state and updateDisplay()" },
  "displayFormatter": "JavaScript code to format state for display, return string or {main, secondary, stats}"
}

ELEMENT TYPES:
- button, button-row, button-grid: Buttons with label, action, value, class (primary|secondary|operator|danger|wide)
- input, textarea: Text input with stateKey, placeholder, inputType
- select: Dropdown with stateKey, options [{value, label}]
- checkbox, toggle: Boolean with stateKey
- checkbox-group, radio-group: Multiple/single selection with stateKey, options
- range: Slider with stateKey, min, max, step, showValue
- stepper: Number +/- buttons with stateKey, min, max, step
- rating: Stars with stateKey, max
- progress, meter: Display values from stateKey
- date, time, datetime: Date/time pickers with stateKey
- table: columns [{key, label, type: text|checkbox|badge|action}], rowsStateKey
- list: Display array from stateKey, ordered (bool)
- tabs: [{label, content: elements[]}], accordion: [{title, content: elements[]}]
- card: {title, content: elements[]}, alert: {alertType, message, dismissible}
- heading, text, divider, spacer, badge-group, color-input, input-row

DISPLAY TYPES: single (one line), multi (main/secondary), stats (label/value grid), color-preview

ESCAPE SEQUENCES in regex: Use \\\\s, \\\\n, \\\\d (double-escape in JSON strings).

Keep tools simple - only include elements necessary for functionality.`

const TOOL_EDIT_SYSTEM_PROMPT = `You are a tool editor. Modify the given tool specification based on the user's request.

RULES:
1. Output ONLY valid JSON - no markdown, no explanations
2. Preserve existing functionality unless asked to change it
3. Keep the same structure

TOOL SPECIFICATION FORMAT:
{
  "name": "Tool Name",
  "description": "What this tool does",
  "layout": "calculator|converter|text-processor|form|custom",
  "state": { "variableName": "initialValue" },
  "display": { "type": "single|multi|stats|color-preview|table|chart", "lines": ["main", "secondary"] },
  "elements": [
    { "type": "element-type", "label": "text", "action": "actionName", "stateKey": "key", "class": "optional-class" }
  ],
  "actions": { "actionName": "JavaScript code using state, value, db, and updateDisplay()" },
  "displayFormatter": "JavaScript code to format state for display"
}

ELEMENT TYPES:
- button, button-row, button-grid: Buttons with label, action, value, class
- input, textarea: Text input with stateKey, placeholder, inputType
- select: Dropdown with stateKey, options [{value, label}]
- checkbox, toggle: Boolean with stateKey
- checkbox-group: Multiple selection with stateKey (array), options
- radio-group: Single selection with stateKey, options
- range: Slider with stateKey, min, max, step, showValue
- stepper: Number with +/- buttons, stateKey, min, max, step
- rating: Stars with stateKey, max
- progress, meter: Display values from stateKey
- date, time, datetime: Date/time pickers with stateKey
- table: Data table with columns [{key, label, type}], rowsStateKey
  - Column types: text, checkbox, badge, action
  - Action column: {key, label, type: 'action', action, buttonLabel, class}
- list: Display array from stateKey, ordered (bool)
- tabs: [{label, content: elements[]}]
- accordion: [{title, content: elements[]}]
- card: {title, subtitle, content: elements[], footer}
- alert: {alertType: info|success|warning|error, message, dismissible}
- heading, text, divider, spacer, image, badge-group

BUTTON CLASSES: primary, secondary, operator, danger, wide, double-wide

DATA PERSISTENCE (db object in actions):
- db.create({...}) - Add record, returns {id, ...data}
- db.read() / db.read(id) - Get all or one record
- db.update(id, {...}) - Update record
- db.delete(id) - Remove record
- db.query(fn) - Filter records
- db.clear() - Remove all

ESCAPE SEQUENCES in regex: Use \\\\s for whitespace, \\\\n for newline, \\\\d for digits.`

export class BuildCapability extends BaseCapability {
  name = 'build'
  priority = 55

  getRouterDescription() {
    return {
      name: 'build',
      description: 'Creates INTERACTIVE UI tools with buttons, forms, and controls. Use when the user wants something they can USE repeatedly, not just get an answer.',
      conditions: [
        'User says "add a tool" or "build a tool"',
        'User wants an interactive tool (buttons, inputs, controls)',
        'User describes an app, widget, or utility to use',
        'Request involves managing or tracking data over time',
        'User wants a persistent interface, not a one-time result'
      ],
      examples: [
        { input: 'Add a tool to calculate tips' },
        { input: 'Build me a calculator' },
        { input: 'Create a todo list' },
        { input: 'Make a timer with start/stop buttons' },
        { input: 'I need something to track my expenses' }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'build' ||
           analysis.isBuildTool === true ||
           analysis.toolType !== undefined
  }

  // ===========================================================================
  // PIPE INTERFACE
  // ===========================================================================

  receiveInput(pipeInput, context) {
    return {
      data: pipeInput?.data ?? null,
      context
    }
  }

  async process(input) {
    const { data: pipedData, context } = input
    const {
      fullContext,
      models,
      config,
      provider,
      signal,
      previousResults = {},
      callbacks = {}
    } = context

    const { onToolGenerated } = callbacks

    // Merge piped data into previousResults for the prompt
    const mergedResults = { ...previousResults }
    if (pipedData !== null) {
      mergedResults.pipe = {
        capability: 'pipe',
        data: pipedData,
        success: true
      }
    }

    const toolSpec = await this._generateToolSpec(fullContext, models.executorId, provider, config, signal, mergedResults)

    let parsedTool
    try {
      parsedTool = this._parseToolOutput(toolSpec)
    } catch (e) {
      return {
        success: false,
        result: null,
        error: e.message,
        metadata: { rawOutput: toolSpec }
      }
    }

    if (onToolGenerated) {
      onToolGenerated(parsedTool)
    }

    return {
      success: true,
      result: parsedTool,
      error: null,
      metadata: {
        toolSpec: parsedTool,
        hasPipedData: !!pipedData
      }
    }
  }

  produceOutput(processResult) {
    const { success, result, error } = processResult
    return createPipeData(success ? result : { error }, this.name)
  }

  async execute(context, pipeInput = null) {
    const transformedInput = this.receiveInput(pipeInput, context)
    const processResult = await this.process(transformedInput)
    const pipeOutput = this.produceOutput(processResult)

    return {
      ...processResult,
      pipe: pipeOutput
    }
  }

  // ===========================================================================
  // LEGACY INTERFACE
  // ===========================================================================

  getSystemPrompt() {
    return TOOL_BUILDER_SYSTEM_PROMPT
  }

  buildExecutorPrompt(context) {
    const { userMessage, previousResults = {} } = context

    let prompt = `Create a simple, functional tool based on this description:

"${userMessage}"`

    // Include data from previous steps that the tool should use
    if (Object.keys(previousResults).length > 0) {
      prompt += `\n\nDATA FROM PREVIOUS STEPS (embed this data in the tool's initial state):`
      for (const [stepNum, stepData] of Object.entries(previousResults)) {
        prompt += `\nStep ${stepNum} (${stepData.capability}): ${JSON.stringify(stepData.data)}`
      }
      prompt += `\n\nIncorporate this data into the tool's state and functionality.`
    }

    prompt += `\n\nOutput ONLY the JSON specification - no explanations, no markdown, just the raw JSON object starting with { and ending with }:`

    return prompt
  }

  buildEditPrompt(currentSpec, improvementRequest) {
    return `Modify this existing tool based on the request below. Preserve existing functionality unless asked to change it.

REQUEST: "${improvementRequest}"

CURRENT TOOL SPECIFICATION:
${JSON.stringify(currentSpec, null, 2)}

Output ONLY the improved JSON specification - no explanations, no markdown, just the raw JSON object starting with { and ending with }:`
  }

  async _generateToolSpec(userMessage, executorModelId, provider, config, signal, previousResults = {}) {
    const systemPrompt = this.getSystemPrompt()
    const userPrompt = this.buildExecutorPrompt({ userMessage, previousResults })
    const totalChars = systemPrompt.length + userPrompt.length
    console.log(`[BuildCapability] Tokens: ~${Math.ceil(totalChars / 4)} (system: ${systemPrompt.length} chars, user: ${userPrompt.length} chars)`)

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    return provider.sendMessage(
      executorModelId,
      messages,
      null,
      signal,
      config
    )
  }

  /**
   * Parse and validate tool output from LLM
   * @param {string} rawOutput - Raw LLM output
   * @returns {Object} - Parsed tool specification
   * @throws {Error} - If parsing or validation fails
   */
  _parseToolOutput(rawOutput) {
    const cleaned = this.cleanOutput(rawOutput)

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No valid tool specification in response')
      }
    }

    if (!parsed.name || !parsed.elements) {
      throw new Error('Tool specification missing required fields (name, elements)')
    }

    return parsed
  }

  /**
   * Edit/improve an existing tool (uses concise system prompt)
   */
  async editTool(currentSpec, improvementRequest, executorModelId, provider, config, signal) {
    const messages = [
      { role: 'system', content: TOOL_EDIT_SYSTEM_PROMPT },
      { role: 'user', content: this.buildEditPrompt(currentSpec, improvementRequest) }
    ]

    const rawOutput = await provider.sendMessage(executorModelId, messages, null, signal, config)
    return this._parseToolOutput(rawOutput)
  }

  formatOutput(result, metadata = {}) {
    return {
      type: 'tool',
      content: result,
      displayHint: 'tool',
      metadata: {
        toolSpec: metadata.toolSpec
      }
    }
  }

  cleanOutput(rawOutput) {
    let cleaned = rawOutput.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    return cleaned.trim()
  }
}

export default BuildCapability
