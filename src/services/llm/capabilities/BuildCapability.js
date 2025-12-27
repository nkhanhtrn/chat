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

Your job is to generate a complete tool specification in JSON format that includes:
1. Tool metadata (name, description)
2. UI layout with buttons, displays, and inputs
3. State variables
4. JavaScript code for handling interactions

CRITICAL RULES:
1. Output ONLY valid JSON - no markdown, no explanations
2. Create simple, functional tools that do what the user asks
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
- "textarea": Multi-line text input
- "select": Dropdown select
- "checkbox": Single checkbox with label
- "checkbox-group": Multiple checkboxes with stateKey storing array of selected values
- "radio-group": Radio buttons for single selection with options array
- "range": Slider input with min, max, step, stateKey, showValue (bool)
- "toggle": On/off switch with stateKey (boolean)
- "date": Date picker input
- "time": Time picker input
- "datetime": Date and time picker
- "progress": Progress bar with value (0-100) from state
- "meter": Meter display with min, max, low, high, optimum, stateKey
- "rating": Star rating input with max (default 5), stateKey
- "stepper": Number input with +/- buttons, min, max, step, stateKey
- "tabs": Tab container with tabs array [{label, content: elements[]}]
- "accordion": Collapsible sections with sections array [{title, content: elements[]}]
- "card": Card container with title, subtitle, content (elements[]), footer
- "alert": Alert/notification box with type (info/success/warning/error), message, dismissible
- "badge-group": Display badges/tags from stateKey (array)
- "table": Display tabular data with columns array and rowsStateKey
  - Column types: text (default), checkbox, badge, action
  - Action columns: { key: 'actions', label: 'Actions', type: 'action', action: 'deleteItem', buttonLabel: 'Delete', class: 'danger' }
  - Action receives { row, rowIdx, rowsStateKey } as value
- "list": Display list from stateKey (array), ordered (bool)
- "divider": Horizontal divider line
- "spacer": Vertical spacing with size (sm/md/lg)
- "heading": Section heading with level (1-6), text
- "text": Static text paragraph
- "image": Display image with src (from state or static), alt
- "color-input": Color picker with hex and RGB values
- "input-row": Multiple inputs in a row

DISPLAY TYPES:
- "single": Single line display (calculator style)
- "multi": Multi-line with main and secondary
- "stats": Grid of statistics with label/value pairs
- "color-preview": Color swatch with format values
- "table": Tabular data display
- "chart": Simple bar/progress visualization

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

User: build a task manager
Output:
{
  "name": "Task Manager",
  "description": "Manage your tasks with priorities and categories",
  "layout": "custom",
  "state": {
    "tasks": [],
    "newTask": "",
    "priority": "medium",
    "category": "work",
    "showCompleted": true,
    "filterCategory": "all"
  },
  "elements": [
    {
      "type": "card",
      "title": "Add New Task",
      "content": [
        {
          "type": "input",
          "label": "Task",
          "stateKey": "newTask",
          "placeholder": "Enter task description"
        },
        {
          "type": "input-row",
          "inputs": [
            {
              "type": "select",
              "label": "Priority",
              "stateKey": "priority",
              "options": [
                {"value": "low", "label": "Low"},
                {"value": "medium", "label": "Medium"},
                {"value": "high", "label": "High"}
              ]
            },
            {
              "type": "select",
              "label": "Category",
              "stateKey": "category",
              "options": [
                {"value": "work", "label": "Work"},
                {"value": "personal", "label": "Personal"},
                {"value": "shopping", "label": "Shopping"}
              ]
            }
          ]
        },
        {
          "type": "button",
          "label": "Add Task",
          "action": "addTask",
          "class": "primary"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "heading",
      "level": 3,
      "text": "Tasks"
    },
    {
      "type": "toggle",
      "label": "Show Completed",
      "stateKey": "showCompleted"
    },
    {
      "type": "radio-group",
      "label": "Filter by Category",
      "stateKey": "filterCategory",
      "options": [
        {"value": "all", "label": "All"},
        {"value": "work", "label": "Work"},
        {"value": "personal", "label": "Personal"},
        {"value": "shopping", "label": "Shopping"}
      ]
    },
    {
      "type": "table",
      "columns": [
        {"key": "done", "label": "✓", "type": "checkbox"},
        {"key": "text", "label": "Task"},
        {"key": "priority", "label": "Priority", "type": "badge"},
        {"key": "category", "label": "Category"}
      ],
      "rowsStateKey": "filteredTasks"
    }
  ],
  "actions": {
    "addTask": "if (state.newTask.trim()) { state.tasks.push({id: Date.now(), text: state.newTask, priority: state.priority, category: state.category, done: false}); state.newTask = ''; }",
    "toggleTask": "const task = state.tasks.find(t => t.id === value); if (task) task.done = !task.done;"
  },
  "displayFormatter": "state.filteredTasks = state.tasks.filter(t => (state.showCompleted || !t.done) && (state.filterCategory === 'all' || t.category === state.filterCategory)); return '';"
}

User: build a survey form
Output:
{
  "name": "Customer Survey",
  "description": "Collect customer feedback",
  "layout": "form",
  "state": {
    "name": "",
    "email": "",
    "rating": 0,
    "satisfaction": 50,
    "features": [],
    "feedback": "",
    "subscribe": false,
    "contactMethod": "email",
    "submitted": false
  },
  "elements": [
    {
      "type": "alert",
      "alertType": "info",
      "message": "Please take a moment to share your feedback with us.",
      "dismissible": false
    },
    {
      "type": "spacer",
      "size": "md"
    },
    {
      "type": "input",
      "label": "Full Name",
      "stateKey": "name",
      "placeholder": "Enter your name"
    },
    {
      "type": "input",
      "label": "Email",
      "stateKey": "email",
      "inputType": "email",
      "placeholder": "your@email.com"
    },
    {
      "type": "divider"
    },
    {
      "type": "rating",
      "label": "Overall Experience",
      "stateKey": "rating",
      "max": 5
    },
    {
      "type": "range",
      "label": "Satisfaction Level",
      "stateKey": "satisfaction",
      "min": 0,
      "max": 100,
      "step": 10,
      "showValue": true
    },
    {
      "type": "checkbox-group",
      "label": "Features you liked",
      "stateKey": "features",
      "options": [
        {"value": "speed", "label": "Fast Performance"},
        {"value": "ui", "label": "User Interface"},
        {"value": "support", "label": "Customer Support"},
        {"value": "price", "label": "Pricing"}
      ]
    },
    {
      "type": "radio-group",
      "label": "Preferred Contact Method",
      "stateKey": "contactMethod",
      "options": [
        {"value": "email", "label": "Email"},
        {"value": "phone", "label": "Phone"},
        {"value": "none", "label": "Do not contact"}
      ]
    },
    {
      "type": "textarea",
      "label": "Additional Feedback",
      "stateKey": "feedback",
      "placeholder": "Tell us more about your experience...",
      "rows": 4
    },
    {
      "type": "toggle",
      "label": "Subscribe to newsletter",
      "stateKey": "subscribe"
    },
    {
      "type": "spacer",
      "size": "md"
    },
    {
      "type": "button",
      "label": "Submit Survey",
      "action": "submit",
      "class": "primary"
    },
    {
      "type": "progress",
      "label": "Form Completion",
      "stateKey": "progress"
    }
  ],
  "actions": {
    "submit": "state.submitted = true;"
  },
  "displayFormatter": "let filled = 0; if(state.name) filled++; if(state.email) filled++; if(state.rating > 0) filled++; if(state.features.length > 0) filled++; if(state.feedback) filled++; state.progress = Math.round((filled / 5) * 100); return '';"
}

User: build a timer with laps
Output:
{
  "name": "Stopwatch",
  "description": "Timer with lap tracking",
  "layout": "custom",
  "state": {
    "time": 0,
    "running": false,
    "laps": [],
    "intervalId": null
  },
  "display": {
    "type": "single"
  },
  "elements": [
    {
      "type": "button-row",
      "buttons": [
        {"label": "Start", "action": "start", "class": "primary"},
        {"label": "Stop", "action": "stop", "class": "danger"},
        {"label": "Lap", "action": "lap", "class": "secondary"},
        {"label": "Reset", "action": "reset", "class": "secondary"}
      ]
    },
    {
      "type": "heading",
      "level": 4,
      "text": "Laps"
    },
    {
      "type": "list",
      "stateKey": "lapDisplay",
      "ordered": true
    }
  ],
  "actions": {
    "start": "if (!state.running) { state.running = true; }",
    "stop": "state.running = false;",
    "lap": "if (state.running) { state.laps.push(state.time); }",
    "reset": "state.time = 0; state.laps = []; state.running = false;"
  },
  "displayFormatter": "const t = state.time; const mins = Math.floor(t / 60000); const secs = Math.floor((t % 60000) / 1000); const ms = Math.floor((t % 1000) / 10); state.lapDisplay = state.laps.map((l, i) => { const m = Math.floor(l / 60000); const s = Math.floor((l % 60000) / 1000); return 'Lap ' + (i+1) + ': ' + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0'); }); return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0') + '.' + ms.toString().padStart(2, '0');"
}

User: build a recipe scaler
Output:
{
  "name": "Recipe Scaler",
  "description": "Scale recipe ingredients up or down",
  "layout": "custom",
  "state": {
    "originalServings": 4,
    "targetServings": 4,
    "ingredients": [
      {"name": "Flour", "amount": 2, "unit": "cups"},
      {"name": "Sugar", "amount": 1, "unit": "cup"},
      {"name": "Eggs", "amount": 3, "unit": ""}
    ]
  },
  "elements": [
    {
      "type": "card",
      "title": "Servings",
      "content": [
        {
          "type": "stepper",
          "label": "Original Servings",
          "stateKey": "originalServings",
          "min": 1,
          "max": 100,
          "step": 1
        },
        {
          "type": "stepper",
          "label": "Target Servings",
          "stateKey": "targetServings",
          "min": 1,
          "max": 100,
          "step": 1
        }
      ]
    },
    {
      "type": "meter",
      "label": "Scale Factor",
      "stateKey": "scaleFactor",
      "min": 0,
      "max": 10,
      "low": 0.5,
      "high": 5,
      "optimum": 1
    },
    {
      "type": "heading",
      "level": 3,
      "text": "Scaled Ingredients"
    },
    {
      "type": "table",
      "columns": [
        {"key": "name", "label": "Ingredient"},
        {"key": "scaled", "label": "Amount"},
        {"key": "unit", "label": "Unit"}
      ],
      "rowsStateKey": "scaledIngredients"
    }
  ],
  "displayFormatter": "state.scaleFactor = state.targetServings / state.originalServings; state.scaledIngredients = state.ingredients.map(i => ({name: i.name, scaled: (i.amount * state.scaleFactor).toFixed(2), unit: i.unit})); return '';"
}

KEEP IT SIMPLE:
- Only include elements that are necessary for the tool to function
- Don't over-engineer - match complexity to what the user asked for
- A simple counter just needs a display and buttons, not cards and accordions
- Only use advanced elements (tabs, accordion, cards) when the user's request requires organization
- The "display" property is OPTIONAL - only include it for calculator-style tools that need a result display area
- Forms, todo lists, data managers do NOT need a display - they show data directly in their elements

IMPORTANT - ESCAPE SEQUENCES:
When using regex patterns in actions or displayFormatter, you MUST double-escape backslashes because the code is inside a JSON string:
- Use \\\\s for whitespace (\\s)
- Use \\\\n for newline (\\n)
- Use \\\\d for digits (\\d)
- Example: text.split(/\\\\s+/) NOT text.split(/\\s+/)

Generate simple, functional tools. Use the minimum UI elements needed to accomplish the task.`

export class BuildCapability extends BaseCapability {
  name = 'build'
  priority = 55

  getRouterDescription() {
    return {
      name: 'build',
      description: 'Creates INTERACTIVE UI tools with buttons, forms, and controls. Use when the user wants something they can USE repeatedly, not just get an answer.',
      conditions: [
        'User wants an interactive tool (buttons, inputs, controls)',
        'User describes an app, widget, or utility to use',
        'Request involves managing or tracking data over time',
        'User wants a persistent interface, not a one-time result'
      ],
      examples: [
        { input: 'Build me a calculator' },
        { input: 'Create a todo list' },
        { input: 'Make a timer with start/stop buttons' },
        { input: 'I need something to track my expenses' },
        { input: 'Create a unit converter' }
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

  async _generateToolSpec(userMessage, executorModelId, provider, config, signal, previousResults = {}) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.buildExecutorPrompt({ userMessage, previousResults }) }
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
