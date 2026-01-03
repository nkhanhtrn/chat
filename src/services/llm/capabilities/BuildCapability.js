/**
 * BuildCapability - Builds interactive Vue.js tools from user prompts
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'
import { saveTool } from '../../indexedDB.js'
import { generateCode as callCodeApi } from '../../codeApi.js'
import { detectUrls, fetchUrlContent, cleanHtml } from '../../urlFetcher.js'

const DESIGN_GUIDE = `DESIGN SYSTEM - These classes are DEFINED GLOBALLY in style.css. Use them directly, DO NOT redefine in your component:

AVAILABLE CLASSES (use these in your template):
.tool-container - Main container with flex column layout, full height
.btn - Standard button (hover effect built-in)
.btn.primary - Primary action button (color-primary background)
.btn.active - Active state button
.btn-group - Group buttons with shared borders
.input - Text input field
.select - Dropdown select
.textarea - Multi-line text area
.card - Container with border and background
.card-header - Card title section
.card-body - Card content section
.row - Flex row with gap (aligns items center)
.col - Flex column with gap
.container - Full-height flex column container
.header - Header bar with title and actions (has bottom border)
.content - Main content area (flex: 1, min-height: 0)
.footer - Footer section (has top border)
.form-group - Form field with label
.form-label - Field label
.form-hint - Helper text
.text-muted - Muted text color
.text-strong - Strong/bold text
.text-center - Center aligned text
.text-right - Right aligned text
.mt-1, .mt-2, .mt-3 - Margin top (0.25rem, 0.5rem, 1rem)
.mb-1, .mb-2, .mb-3 - Margin bottom (0.25rem, 0.5rem, 1rem)
.gap-1, .gap-2, .gap-3 - Gap utilities (0.25rem, 0.5rem, 1rem)

IMPORTANT:
- ALWAYS start with <div class="tool-container"> as your root
- Use the classes above - they are pre-styled
- Only add custom styles in <style scoped> for tool-specific needs
- DO NOT redefine these classes
- Tools automatically fill available window height
- Use .content for scrollable areas (it has flex: 1 and overflow: auto)
- Keep header/footer compact with flex-shrink: 0

DATA PERSISTENCE (Auto-save user data):
- Tools can auto-save user data using the 'persistKeys' option
- Add persistKeys: [] to your component options to specify which data keys to save
- Only include USER DATA that should persist (inputs, settings, user state)
- EXCLUDE temporary UI state like: loading, error, hovered, temp, etc.
- Data is automatically restored when the tool reopens
- Example:
  export default {
    persistKeys: ['count', 'userText', 'settings'],  // only these are saved
    data() {
      return {
        count: 0,           // saved (in persistKeys)
        userText: '',       // saved (in persistKeys)
        settings: {},       // saved (in persistKeys)
        loading: false,     // NOT saved (temporary UI state)
        error: null         // NOT saved (temporary UI state)
      }
    }
  }

CHARTING with ECHARTS (v6.0.0):
- For charts/graphs, use ECharts library (available globally as 'echarts')
- ECharts is pre-loaded - DO NOT import it, just use it directly
- Basic ECharts usage:
  * Create a ref: chartRef: null
  * Initialize: onMounted() { this.chartInstance = echarts.init(this.$refs.chartRef) }
  * Set options: this.chartInstance.setOption({ ...option object... })
  * Clean up: onUnmounted() { this.chartInstance?.dispose() }
  * Update: this.chartInstance.setOption(newOption, true) for updates
- ECharts option structure: { title, tooltip, legend, xAxis, yAxis, series, ... }
- Series types: 'line', 'bar', 'pie', 'scatter', 'area', etc.
- Keep charts responsive: this.chartInstance.resize() on container resize

EXAMPLE:
<template>
  <div class="tool-container">
    <div class="header">
      <h3>Tool Name</h3>
      <button class="btn" @click="reset">Reset</button>
    </div>
    <div class="content">
      <div class="form-group">
        <input class="input" v-model="value" placeholder="Enter..." />
      </div>
      <div class="row">
        <button class="btn primary" @click="submit">Submit</button>
        <button class="btn" @click="cancel">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  // Specify which data to auto-save (user data only, not UI state)
  persistKeys: ['value'],

  data() {
    return {
      value: ''  // this will be saved and restored
    }
  },
  methods: {
    submit() { },
    reset() { this.value = '' },
    cancel() { }
  }
}
</script>

<style scoped>
/* Only add custom styles for tool-specific needs, all utility classes already exist */
</style>

CHART EXAMPLE (using ECharts):
<template>
  <div class="tool-container">
    <div class="header">
      <h3>Sales Chart</h3>
      <button class="btn" @click="refresh">Refresh</button>
    </div>
    <div class="content">
      <div ref="chartRef" style="width:100%;height:100%"></div>
    </div>
  </div>
</template>

<script>
export default {
  persistKeys: ['chartData'],  // save chart data but not chartInstance

  data() {
    return {
      chartInstance: null,
      chartData: [120, 200, 150, 80, 70, 110, 130]
    }
  },
  mounted() {
    // Initialize ECharts
    this.chartInstance = echarts.init(this.$refs.chartRef)
    this.updateChart()
    // Handle resize
    window.addEventListener('resize', this.handleResize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
    this.chartInstance?.dispose()
  },
  methods: {
    updateChart() {
      const option = {
        title: { text: 'Weekly Sales' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
        yAxis: { type: 'value' },
        series: [{
          data: this.chartData,
          type: 'line',
          smooth: true
        }]
      }
      this.chartInstance.setOption(option)
    },
    refresh() {
      this.chartData = this.chartData.map(() => Math.floor(Math.random() * 200))
      this.updateChart()
    },
    handleResize() {
      this.chartInstance?.resize()
    }
  }
}
</script>
`

const SYSTEM_PROMPT = `Build interactive Vue 3 components using Options API (data, methods, computed). Use plain JavaScript (NOT TypeScript). NEVER import or use 'ref' from Vue - only use Options API. Style to fill container.

CRITICAL: Use these pre-defined CSS variables (do NOT redefine them, they are already set by the host app):
- Backgrounds: var(--color-bg-base), var(--color-bg-elevated), var(--color-bg-hover), var(--color-bg-button)
- Text: var(--color-text-base), var(--color-text-muted), var(--color-text-strong)
- Borders: var(--color-border-base), var(--color-border-subtle), var(--color-border-input)
- Inputs: var(--color-bg-input), var(--color-border-input)
- Primary accent: var(--color-primary), var(--color-primary-hover)
Never include :root or define CSS variables. Just use var(--color-*).

${DESIGN_GUIDE}

IMPORTANT - Data Persistence:
- ALWAYS include a 'persistKeys' array in your component options
- List ONLY the data keys that contain user data (inputs, settings, counts, etc.)
- DO NOT include temporary UI state (loading, error, hovered, temp, etc.)
- This ensures user data is saved/restored automatically when tools close and reopen

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
    const { fullContext, useThinkingMode = false, provider, signal, callbacks = {}, sessionId } = context
    const { onToolGenerated } = callbacks

    // Build new tool
    const code = await this._buildTool(fullContext, useThinkingMode, provider, signal, pipedData)

    let parsedTool
    try {
      parsedTool = this._parseOutput(code)
    } catch (e) {
      return { success: false, result: null, error: e.message }
    }

    // Auto-save tool to library (always session-scoped)
    const savedTool = await saveTool({
      ...parsedTool,
      sourcePrompt: fullContext
    }, sessionId)

    if (onToolGenerated) onToolGenerated(savedTool)

    return { success: true, result: savedTool, error: null }
  }

  async _buildTool(userMessage, useThinkingMode, provider, signal, pipedData = null) {
    if (useThinkingMode) {
      // Thinking mode ON - use Reasoning AI
      const result = await callCodeApi({
        initial_code: `<template><!-- Vue 3 component - JavaScript only, NO TypeScript --></template>\n<script>\nexport default {\n  data() { return {} },\n  methods: {},\n  computed: {}\n}\n</script>\n<style scoped></style>`,
        edit_prompt: `Create a Vue 3 component using plain JavaScript (NOT TypeScript). NEVER import or use 'ref' from Vue - only use Options API (data, methods, computed, watch, etc.).

${DESIGN_GUIDE}

IMPORTANT - Data Persistence:
- ALWAYS include a 'persistKeys' array listing user data keys (inputs, settings, counts, etc.)
- DO NOT include temporary UI state (loading, error, hovered, temp, etc.)

${userMessage}`,
        output_path: `tools/${crypto.randomUUID()}.vue`,
        signal
      })

      if (!result.success || !result.code) {
        throw new Error(result.stderr || 'Reasoning AI returned no code')
      }

      // Return both code and stdout for later display
      return { code: result.code, stdout: result.stdout || '' }
    } else {
      // Thinking mode OFF - use LLM
      let prompt = `Build: "${userMessage}"`
      if (pipedData) {
        prompt += `\n\nUse this data: ${JSON.stringify(pipedData)}`
      }

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]

      return await provider.send(messages)
    }
  }

  async editTool(currentCode, request, provider, signal, useThinkingMode = false, onStdoutChunk = null) {
    // Detect and fetch URLs from the request
    const urls = detectUrls(request)
    let urlContent = ''
    if (urls.length > 0) {
      try {
        // Fetch all URLs in parallel
        const fetchPromises = urls.map(async url => {
          try {
            const raw = await fetchUrlContent(url)
            return { url, content: cleanHtml(raw), success: true }
          } catch (error) {
            console.warn(`Failed to fetch URL ${url}:`, error.message)
            return { url, content: `[Error fetching ${url}: ${error.message}]`, success: false }
          }
        })
        const results = await Promise.all(fetchPromises)

        // Format URL contents for the prompt
        urlContent = results
          .map(r => `--- Content from ${r.url} ---\n${r.content}\n--- End of ${r.url} ---`)
          .join('\n\n')
      } catch (error) {
        console.warn('Error fetching URLs:', error)
        urlContent = `[Error fetching URLs: ${error.message}]`
      }
    }

    // Build the enhanced request with URL content
    const enhancedRequest = urlContent
      ? `${request}\n\nReferenced content:\n${urlContent}`
      : request

    // Use Reasoning AI if thinking mode is enabled
    if (useThinkingMode) {
      const result = await callCodeApi({
        initial_code: currentCode,
        edit_prompt: `Edit this Vue 3 component per the user's request. Use plain JavaScript (NOT TypeScript). NEVER import or use 'ref' from Vue - only use Options API (data, methods, computed, watch, etc.).

${DESIGN_GUIDE}

IMPORTANT - Data Persistence:
- Maintain the 'persistKeys' array - keep user data keys, remove UI state keys
- If adding new user-facing data (inputs, settings), add to persistKeys
- If adding temporary UI state (loading, error), do NOT add to persistKeys

User Request: ${enhancedRequest}`,
        output_path: `tools/${crypto.randomUUID()}.vue`,
        onStdoutChunk,
        signal
      })

      if (!result.success || !result.code) {
        throw new Error(result.stderr || 'Reasoning AI returned no code')
      }

      // Pass full result to _parseOutput to preserve stdout
      return this._parseOutput({ code: result.code, stdout: result.stdout || '' })
    }

    const systemPrompt = `Modify the Vue component per the user's request.

IMPORTANT - Data Persistence:
- Maintain the 'persistKeys' array - keep user data keys, remove UI state keys
- If adding new user-facing data (inputs, settings), add to persistKeys
- If adding temporary UI state (loading, error), do NOT add to persistKeys

Also consolidate the code:
- Remove comments and unused code
- Simplify verbose patterns
- Keep functionality identical
- Use CSS variables for colors: --color-bg-base, --color-bg-elevated, --color-text-base, --color-text-muted, --color-border-base, --color-primary, --color-bg-input, --color-border-input, --color-bg-button
Output only the complete, consolidated code.`

    const userPrompt = `Component:\n${currentCode}\n\nRequest: ${enhancedRequest}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    return await provider.send(messages)
  }

  _parseOutput(raw) {
    // Handle both { code, stdout } format (thinking mode) and { content } format (non-thinking)
    let stdout = ''
    let code = raw

    if (typeof raw === 'object' && raw !== null) {
      stdout = raw.stdout || ''
      // Thinking mode: { code, stdout }, Non-thinking mode: { content }
      code = raw.code || raw.content || ''
    }

    // Ensure code is a string before processing
    if (typeof code !== 'string') {
      code = String(code || '')
    }

    code = code.trim()

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

    return { code, type: 'vue-sfc', name, emoji, stdout }
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
