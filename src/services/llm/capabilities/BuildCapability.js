/**
 * BuildCapability - Builds sophisticated interactive tools from user prompts
 *
 * This capability:
 * 1. Takes a user description of a tool they want
 * 2. Generates a complete tool specification with UI layout
 * 3. Returns an interactive tool that looks and feels like a real application
 */

import { BaseCapability } from './BaseCapability.js'

const TOOL_BUILDER_SYSTEM_PROMPT = `You are a tool builder that creates sophisticated, realistic interactive tools.

Your job is to generate a complete tool specification in JSON format that includes:
1. Tool metadata (name, description)
2. UI layout with buttons, displays, and inputs
3. State variables
4. JavaScript code for handling interactions

CRITICAL RULES:
1. Output ONLY valid JSON - no markdown, no explanations
2. Create realistic, fully-functional tools that look like real applications
3. Include all necessary buttons/controls for the tool type
4. The code uses 'state' object for variables and 'updateDisplay()' to refresh the display

TOOL SPECIFICATION FORMAT:
{
  "name": "Tool Name",
  "description": "What this tool does",
  "layout": "calculator|converter|text-processor|form|custom",
  "state": {
    "variableName": "initialValue"
  },
  "display": {
    "type": "single|multi",
    "lines": ["main", "secondary"]
  },
  "elements": [
    {
      "type": "button|input|select|display|button-row|button-grid",
      "label": "Display text",
      "action": "actionName",
      "value": "optional value",
      "class": "optional-class primary|secondary|operator|danger|wide|double-wide",
      "buttons": [/* for button-row/button-grid */]
    }
  ],
  "actions": {
    "actionName": "JavaScript code using state and updateDisplay()"
  },
  "displayFormatter": "JavaScript code to format state for display, return string or {main, secondary}"
}

ELEMENT TYPES:
- "button": Single button with label and action
- "button-row": Horizontal row of buttons
- "button-grid": Grid of buttons (for calculators, keypads)
- "input": Text/number input field
- "select": Dropdown select
- "display": Read-only display area

BUTTON CLASSES:
- "primary": Main action button (highlighted)
- "secondary": Secondary styling
- "operator": For operators (+, -, ×, ÷)
- "danger": For destructive actions (clear, delete)
- "wide": Takes 2 columns
- "double-wide": Takes full width

EXAMPLES:

User: build a calculator
Output:
{
  "name": "Calculator",
  "description": "A fully functional calculator",
  "layout": "calculator",
  "state": {
    "display": "0",
    "firstOperand": null,
    "operator": null,
    "waitingForSecond": false
  },
  "display": {
    "type": "single"
  },
  "elements": [
    {
      "type": "button-grid",
      "columns": 4,
      "buttons": [
        {"label": "C", "action": "clear", "class": "danger"},
        {"label": "±", "action": "negate", "class": "secondary"},
        {"label": "%", "action": "percent", "class": "secondary"},
        {"label": "÷", "action": "divide", "class": "operator"},
        {"label": "7", "action": "digit", "value": "7"},
        {"label": "8", "action": "digit", "value": "8"},
        {"label": "9", "action": "digit", "value": "9"},
        {"label": "×", "action": "multiply", "class": "operator"},
        {"label": "4", "action": "digit", "value": "4"},
        {"label": "5", "action": "digit", "value": "5"},
        {"label": "6", "action": "digit", "value": "6"},
        {"label": "−", "action": "subtract", "class": "operator"},
        {"label": "1", "action": "digit", "value": "1"},
        {"label": "2", "action": "digit", "value": "2"},
        {"label": "3", "action": "digit", "value": "3"},
        {"label": "+", "action": "add", "class": "operator"},
        {"label": "0", "action": "digit", "value": "0", "class": "wide"},
        {"label": ".", "action": "decimal"},
        {"label": "=", "action": "equals", "class": "primary"}
      ]
    }
  ],
  "actions": {
    "clear": "state.display = '0'; state.firstOperand = null; state.operator = null; state.waitingForSecond = false;",
    "digit": "if (state.waitingForSecond) { state.display = value; state.waitingForSecond = false; } else { state.display = state.display === '0' ? value : state.display + value; }",
    "decimal": "if (!state.display.includes('.')) state.display += '.';",
    "negate": "state.display = String(-parseFloat(state.display));",
    "percent": "state.display = String(parseFloat(state.display) / 100);",
    "add": "state.firstOperand = parseFloat(state.display); state.operator = '+'; state.waitingForSecond = true;",
    "subtract": "state.firstOperand = parseFloat(state.display); state.operator = '-'; state.waitingForSecond = true;",
    "multiply": "state.firstOperand = parseFloat(state.display); state.operator = '*'; state.waitingForSecond = true;",
    "divide": "state.firstOperand = parseFloat(state.display); state.operator = '/'; state.waitingForSecond = true;",
    "equals": "if (state.operator && state.firstOperand !== null) { const b = parseFloat(state.display); let result; switch(state.operator) { case '+': result = state.firstOperand + b; break; case '-': result = state.firstOperand - b; break; case '*': result = state.firstOperand * b; break; case '/': result = b !== 0 ? state.firstOperand / b : 'Error'; break; } state.display = String(result); state.operator = null; state.firstOperand = null; }"
  },
  "displayFormatter": "return state.display;"
}

User: build a unit converter for length
Output:
{
  "name": "Length Converter",
  "description": "Convert between different units of length",
  "layout": "converter",
  "state": {
    "value": "",
    "fromUnit": "meters",
    "toUnit": "feet"
  },
  "display": {
    "type": "multi",
    "lines": ["result", "formula"]
  },
  "elements": [
    {
      "type": "input",
      "label": "Value",
      "stateKey": "value",
      "inputType": "number",
      "placeholder": "Enter value"
    },
    {
      "type": "select",
      "label": "From",
      "stateKey": "fromUnit",
      "options": [
        {"value": "meters", "label": "Meters (m)"},
        {"value": "feet", "label": "Feet (ft)"},
        {"value": "inches", "label": "Inches (in)"},
        {"value": "centimeters", "label": "Centimeters (cm)"},
        {"value": "kilometers", "label": "Kilometers (km)"},
        {"value": "miles", "label": "Miles (mi)"},
        {"value": "yards", "label": "Yards (yd)"}
      ]
    },
    {
      "type": "button",
      "label": "⇄ Swap",
      "action": "swap",
      "class": "secondary"
    },
    {
      "type": "select",
      "label": "To",
      "stateKey": "toUnit",
      "options": [
        {"value": "meters", "label": "Meters (m)"},
        {"value": "feet", "label": "Feet (ft)"},
        {"value": "inches", "label": "Inches (in)"},
        {"value": "centimeters", "label": "Centimeters (cm)"},
        {"value": "kilometers", "label": "Kilometers (km)"},
        {"value": "miles", "label": "Miles (mi)"},
        {"value": "yards", "label": "Yards (yd)"}
      ]
    }
  ],
  "actions": {
    "swap": "const temp = state.fromUnit; state.fromUnit = state.toUnit; state.toUnit = temp;"
  },
  "displayFormatter": "const conversions = {meters: 1, feet: 3.28084, inches: 39.3701, centimeters: 100, kilometers: 0.001, miles: 0.000621371, yards: 1.09361}; const val = parseFloat(state.value) || 0; const inMeters = val / conversions[state.fromUnit]; const result = inMeters * conversions[state.toUnit]; return {main: result.toFixed(6).replace(/\\.?0+$/, '') + ' ' + state.toUnit, secondary: val + ' ' + state.fromUnit + ' = ' + result.toFixed(6).replace(/\\.?0+$/, '') + ' ' + state.toUnit};"
}

User: build a word counter
Output:
{
  "name": "Word Counter",
  "description": "Count words, characters, sentences, and paragraphs",
  "layout": "text-processor",
  "state": {
    "text": ""
  },
  "display": {
    "type": "stats"
  },
  "elements": [
    {
      "type": "textarea",
      "label": "Enter your text",
      "stateKey": "text",
      "placeholder": "Type or paste your text here...",
      "rows": 8
    },
    {
      "type": "button-row",
      "buttons": [
        {"label": "Clear", "action": "clear", "class": "danger"},
        {"label": "Copy Stats", "action": "copyStats", "class": "secondary"}
      ]
    }
  ],
  "actions": {
    "clear": "state.text = '';",
    "copyStats": "const stats = getStats(); navigator.clipboard.writeText('Words: ' + stats.words + ', Characters: ' + stats.characters);"
  },
  "displayFormatter": "const text = state.text.trim(); const words = text ? text.split(/\\\\s+/).length : 0; const chars = state.text.length; const charsNoSpace = state.text.replace(/\\\\s/g, '').length; const sentences = text ? (text.match(/[.!?]+/g) || []).length : 0; const paragraphs = text ? text.split(/\\\\n\\\\n+/).filter(p => p.trim()).length : 0; return {stats: [{label: 'Words', value: words}, {label: 'Characters', value: chars}, {label: 'Characters (no spaces)', value: charsNoSpace}, {label: 'Sentences', value: sentences}, {label: 'Paragraphs', value: paragraphs}]};"
}

User: build a color picker
Output:
{
  "name": "Color Picker",
  "description": "Pick colors and get values in different formats",
  "layout": "custom",
  "state": {
    "hex": "#3B82F6",
    "r": 59,
    "g": 130,
    "b": 246
  },
  "display": {
    "type": "color-preview"
  },
  "elements": [
    {
      "type": "color-input",
      "stateKey": "hex"
    },
    {
      "type": "input-row",
      "inputs": [
        {"label": "R", "stateKey": "r", "type": "number", "min": 0, "max": 255},
        {"label": "G", "stateKey": "g", "type": "number", "min": 0, "max": 255},
        {"label": "B", "stateKey": "b", "type": "number", "min": 0, "max": 255}
      ]
    },
    {
      "type": "button-row",
      "buttons": [
        {"label": "Copy HEX", "action": "copyHex", "class": "primary"},
        {"label": "Copy RGB", "action": "copyRgb", "class": "secondary"}
      ]
    }
  ],
  "actions": {
    "copyHex": "navigator.clipboard.writeText(state.hex);",
    "copyRgb": "navigator.clipboard.writeText('rgb(' + state.r + ', ' + state.g + ', ' + state.b + ')');"
  },
  "displayFormatter": "return {color: state.hex, formats: [{label: 'HEX', value: state.hex}, {label: 'RGB', value: 'rgb(' + state.r + ', ' + state.g + ', ' + state.b + ')'}, {label: 'HSL', value: (function() { const r = state.r/255, g = state.g/255, b = state.b/255; const max = Math.max(r,g,b), min = Math.min(r,g,b); let h, s, l = (max+min)/2; if(max===min) { h=s=0; } else { const d = max-min; s = l > 0.5 ? d/(2-max-min) : d/(max+min); switch(max) { case r: h = ((g-b)/d + (g<b?6:0))/6; break; case g: h = ((b-r)/d + 2)/6; break; case b: h = ((r-g)/d + 4)/6; break; } } return 'hsl(' + Math.round(h*360) + ', ' + Math.round(s*100) + '%, ' + Math.round(l*100) + '%)'; })()}]};"
}

Generate tools that are complete, functional, and look like real applications. Include all necessary buttons and controls.`

export class BuildCapability extends BaseCapability {
  name = 'build'
  priority = 55

  getRouterDescription() {
    return {
      name: 'BUILD',
      description: 'creating interactive tools from descriptions',
      conditions: [
        'User wants to create/build/make a tool',
        'User describes a utility they want to use repeatedly',
        'User says "build me", "create a tool", "make a tool"',
        'User wants a calculator, converter, counter, picker, timer, or similar utility'
      ],
      antiConditions: [
        'One-time calculations or operations',
        'Just asking questions or explanations',
        'Visualization or chart requests',
        'Code review or debugging'
      ],
      outputSchema: {
        toolType: 'string',
        toolName: 'string'
      },
      examples: [
        {
          input: 'build me a calculator',
          output: {
            capability: 'build',
            taskDescription: 'Create a calculator tool',
            toolType: 'calculator',
            toolName: 'Calculator'
          }
        },
        {
          input: 'create a word counter',
          output: {
            capability: 'build',
            taskDescription: 'Create a word counting tool',
            toolType: 'text-processor',
            toolName: 'Word Counter'
          }
        },
        {
          input: 'make a temperature converter',
          output: {
            capability: 'build',
            taskDescription: 'Create a temperature converter tool',
            toolType: 'converter',
            toolName: 'Temperature Converter'
          }
        }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'build' ||
           analysis.isBuildTool === true ||
           analysis.toolType !== undefined ||
           (analysis.taskDescription &&
            (analysis.taskDescription.toLowerCase().includes('build') ||
             analysis.taskDescription.toLowerCase().includes('create a tool') ||
             analysis.taskDescription.toLowerCase().includes('make a tool')))
  }

  getSystemPrompt() {
    return TOOL_BUILDER_SYSTEM_PROMPT
  }

  buildExecutorPrompt(context) {
    const { userMessage } = context
    return `Create a sophisticated, realistic tool based on this description:

"${userMessage}"

Generate the complete JSON specification for this tool with all necessary UI elements:`
  }

  async execute(context) {
    const {
      fullContext,
      models,
      config,
      provider,
      signal,
      callbacks = {}
    } = context

    const { onToolGenerated } = callbacks

    const toolSpec = await this._generateToolSpec(fullContext, models.executorId, provider, config, signal)
    const cleanedSpec = this.cleanOutput(toolSpec)

    let parsedTool
    try {
      parsedTool = JSON.parse(cleanedSpec)
    } catch (e) {
      const jsonMatch = cleanedSpec.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsedTool = JSON.parse(jsonMatch[0])
        } catch (e2) {
          return {
            success: false,
            result: null,
            error: 'Failed to parse tool specification',
            metadata: { rawOutput: toolSpec }
          }
        }
      } else {
        return {
          success: false,
          result: null,
          error: 'No valid tool specification generated',
          metadata: { rawOutput: toolSpec }
        }
      }
    }

    if (!parsedTool.name || !parsedTool.elements) {
      return {
        success: false,
        result: null,
        error: 'Tool specification missing required fields (name, elements)',
        metadata: { parsedTool }
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
        toolSpec: parsedTool
      }
    }
  }

  async _generateToolSpec(userMessage, executorModelId, provider, config, signal) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.buildExecutorPrompt({ userMessage }) }
    ]

    return provider.sendMessage(
      executorModelId,
      messages,
      null,
      signal,
      config
    )
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
