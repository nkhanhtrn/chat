/**
 * VisualizationCapability - Handles charts, diagrams, and drawings
 *
 * Supports multiple visualization types via internal handlers:
 * - chart: ECharts configurations
 * - mermaid: Mermaid diagram syntax
 * - svg: SVG illustrations
 */

import { BaseCapability } from './BaseCapability.js'

// Handler for ECharts visualizations
const chartHandler = {
  type: 'chart',

  getSystemPrompt() {
    return `You are a chart generator that creates ECharts configuration objects.

CRITICAL RULES:
1. Output ONLY a valid JSON object - no markdown, no explanations, no code blocks
2. The JSON must be a valid ECharts option object
3. Use appropriate chart types: 'pie', 'bar', 'line', 'scatter', 'radar', etc.
4. Include proper titles, legends, and axis labels where appropriate
5. Use a clean color palette

EXAMPLES:

For a pie chart with data Apple: 30, Google: 25, Microsoft: 45:
{
  "title": {"text": "Market Share", "left": "center"},
  "tooltip": {"trigger": "item"},
  "legend": {"orient": "vertical", "left": "left"},
  "series": [{
    "name": "Share",
    "type": "pie",
    "radius": "50%",
    "data": [
      {"value": 30, "name": "Apple"},
      {"value": 25, "name": "Google"},
      {"value": 45, "name": "Microsoft"}
    ]
  }]
}

For a bar chart with monthly sales:
{
  "title": {"text": "Monthly Sales"},
  "tooltip": {},
  "xAxis": {"type": "category", "data": ["Jan", "Feb", "Mar", "Apr"]},
  "yAxis": {"type": "value"},
  "series": [{"type": "bar", "data": [120, 200, 150, 80]}]
}

Output ONLY the JSON object, nothing else.`
  },

  cleanOutput(content) {
    let cleaned = content.trim()

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }

    return cleaned.trim()
  }
}

// Handler for Mermaid diagrams
const mermaidHandler = {
  type: 'mermaid',

  getSystemPrompt() {
    return `You are a Mermaid diagram generator.

CRITICAL RULES:
1. Output ONLY valid Mermaid diagram syntax - no markdown code blocks, no explanations
2. Start directly with the diagram type (flowchart, sequenceDiagram, classDiagram, etc.)
3. Use proper Mermaid syntax

DIAGRAM TYPES AND SYNTAX:

Flowchart:
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D

Sequence Diagram:
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
    B-->>A: Hi there

Class Diagram:
classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog

Entity Relationship:
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains

State Diagram:
stateDiagram-v2
    [*] --> Active
    Active --> Inactive
    Inactive --> [*]

Output ONLY the Mermaid diagram code, nothing else.`
  },

  cleanOutput(content) {
    let cleaned = content.trim()

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '')
    }

    return cleaned.trim()
  }
}

// Handler for SVG illustrations
const svgHandler = {
  type: 'svg',

  getSystemPrompt() {
    return `You are an SVG illustration generator.

CRITICAL RULES:
1. Output ONLY valid SVG code - no markdown, no explanations
2. Start directly with <svg> tag
3. Use viewBox for proper scaling, typically viewBox="0 0 200 200"
4. Include width="100%" and height="auto" for responsiveness
5. Use simple, clean shapes and colors
6. Keep illustrations simple and recognizable

EXAMPLES:

Simple star:
<svg viewBox="0 0 200 200" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
  <polygon points="100,10 40,198 190,78 10,78 160,198" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
</svg>

Smiley face:
<svg viewBox="0 0 200 200" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="90" fill="#FFE66D" stroke="#333" stroke-width="3"/>
  <circle cx="65" cy="80" r="12" fill="#333"/>
  <circle cx="135" cy="80" r="12" fill="#333"/>
  <path d="M 50 120 Q 100 170 150 120" stroke="#333" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>

Output ONLY the SVG code, nothing else.`
  },

  cleanOutput(content) {
    let cleaned = content.trim()

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:svg|xml)?\n?/, '').replace(/\n?```$/, '')
    }

    // Extract SVG element
    const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i)
    if (svgMatch) {
      cleaned = svgMatch[0]
    }

    return cleaned.trim()
  }
}

// Registry of visualization handlers
const handlers = {
  chart: chartHandler,
  mermaid: mermaidHandler,
  svg: svgHandler
}

export class VisualizationCapability extends BaseCapability {
  name = 'visualization'
  priority = 60  // Higher than code since visualization is more specific

  getRouterDescription() {
    return {
      name: 'VISUALIZATION',
      description: 'displaying data or concepts visually',
      conditions: [
        'Charts/graphs for data (bar, line, pie, scatter, etc.) -> visualizationType: "chart"',
        'Flowcharts, diagrams, sequences, entity relationships -> visualizationType: "mermaid"',
        'Simple illustrations, icons, shapes -> visualizationType: "svg"'
      ],
      antiConditions: [
        'QR codes, barcodes (use code capability - needs library)',
        'Image processing, encoding (use code capability)',
        'Any output requiring computation or external libraries'
      ],
      outputSchema: {
        visualizationType: 'chart|mermaid|svg'
      },
      examples: [
        {
          input: 'draw a pie chart showing: Apple 30%, Google 25%, Microsoft 45%',
          output: {
            taskDescription: 'Create pie chart with company market shares',
            inputs: [{ name: 'data', value: [{ name: 'Apple', value: 30 }, { name: 'Google', value: 25 }, { name: 'Microsoft', value: 45 }], type: 'array' }],
            expectedOutput: 'Pie chart visualization',
            visualizationType: 'chart'
          }
        },
        {
          input: 'create a flowchart: Start -> Check Input -> Valid? -> Process / Error -> End',
          output: {
            taskDescription: 'Create flowchart for input validation process',
            inputs: [],
            expectedOutput: 'Mermaid flowchart',
            visualizationType: 'mermaid'
          }
        },
        {
          input: 'draw a simple smiley face',
          output: {
            taskDescription: 'Draw SVG smiley face',
            inputs: [],
            expectedOutput: 'SVG drawing',
            visualizationType: 'svg'
          }
        }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'visualization' ||
           analysis.isVisualization === true ||
           !!(analysis.visualizationType && handlers[analysis.visualizationType])
  }

  getSystemPrompt(context) {
    const { analysis } = context
    const handler = this._getHandler(analysis.visualizationType)
    return handler.getSystemPrompt()
  }

  _getHandler(type) {
    return handlers[type] || handlers.chart  // Default to chart
  }

  async execute(context) {
    const {
      analysis,
      fullContext,
      models,
      config,
      provider,
      signal,
      callbacks = {}
    } = context

    const { onVisualizationGenerated } = callbacks

    const handler = this._getHandler(analysis.visualizationType)

    const instructionPrompt = `Task: ${analysis.taskDescription}
Data/Inputs: ${JSON.stringify(analysis.inputs || [])}
Expected output: ${analysis.expectedOutput || 'Visualization'}

Original request: "${fullContext}"

Generate the visualization now:`

    const messages = [
      { role: 'system', content: handler.getSystemPrompt() },
      { role: 'user', content: instructionPrompt }
    ]

    const response = await provider.sendMessage(
      models.executorId,
      messages,
      null,
      signal,
      config
    )

    const cleanedContent = handler.cleanOutput(response)
    const visualizationType = analysis.visualizationType || 'chart'

    const result = {
      type: visualizationType,
      content: cleanedContent
    }

    if (onVisualizationGenerated) {
      onVisualizationGenerated(result)
    }

    return {
      success: true,
      result,
      error: null,
      metadata: {
        visualizationType,
        rawResponse: response
      }
    }
  }

  formatOutput(result, metadata = {}) {
    return {
      type: 'visualization',
      content: result,
      displayHint: result.type,  // 'chart', 'mermaid', or 'svg'
      metadata
    }
  }

  cleanOutput(rawOutput) {
    // Generic cleanup - handlers have specific cleanup
    return rawOutput.trim()
  }
}

// Export handlers for potential external use
export { handlers as visualizationHandlers }

export default VisualizationCapability
