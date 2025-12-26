/**
 * CapabilityRegistry - Central registry for all capabilities
 *
 * Responsibilities:
 * 1. Store and manage registered capabilities
 * 2. Dynamically build the router prompt from registered capabilities
 * 3. Resolve which capability should handle a given request
 */

// Get current date for the router prompt
const getCurrentDateString = () => {
  const now = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

class CapabilityRegistry {
  constructor() {
    /** @type {import('./BaseCapability').BaseCapability[]} */
    this.capabilities = []
  }

  /**
   * Register a capability
   * @param {import('./BaseCapability').BaseCapability} capability
   */
  register(capability) {
    if (!capability.name) {
      throw new Error('Capability must have a name')
    }

    // Check for duplicates
    const existing = this.capabilities.find(c => c.name === capability.name)
    if (existing) {
      console.warn(`Capability "${capability.name}" already registered, replacing`)
      this.capabilities = this.capabilities.filter(c => c.name !== capability.name)
    }

    this.capabilities.push(capability)

    // Sort by priority (highest first)
    this.capabilities.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Unregister a capability by name
   * @param {string} name
   */
  unregister(name) {
    this.capabilities = this.capabilities.filter(c => c.name !== name)
  }

  /**
   * Get a capability by name
   * @param {string} name
   * @returns {import('./BaseCapability').BaseCapability|undefined}
   */
  get(name) {
    return this.capabilities.find(c => c.name === name)
  }

  /**
   * Get all registered capability names
   * @returns {string[]}
   */
  getNames() {
    return this.capabilities.map(c => c.name)
  }

  /**
   * Build the router system prompt dynamically from all registered capabilities
   * @returns {string}
   */
  buildRouterPrompt() {
    const capabilityList = this.getNames().join(', ')
    const capabilityDescriptions = this.capabilities.map(cap => {
      const desc = cap.getRouterDescription()
      return this._formatCapabilitySection(desc)
    }).join('\n\n')

    return `You are a task analyzer. Today is ${getCurrentDateString()}.

CAPABILITIES: ${capabilityList}

${capabilityDescriptions}

OUTPUT FORMAT (line-based, not JSON):

For SINGLE-STEP tasks:
---
capability: <name>
task: <what to do>
searchQuery: <query if web search needed, omit if not>
---

For MULTI-STEP tasks (when steps must chain results):
---
PLAN: <brief summary>

STEP 1
capability: <name>
task: <what to do>
searchQuery: <query if needed>

STEP 2
capability: <name>
task: <what to do>
input: {{step_1_result}}

STEP 3
capability: <name>
task: <what to do>
input: {{step_2_result}}
---

RULES:
- Use MULTI-STEP only when results from one step feed into the next
- Use {{step_N_result}} to reference previous step output
- capability must be one of: ${capabilityList}
- searchQuery triggers web search for current info (prices, news, weather)
- Keep task descriptions concise`
  }

  /**
   * Format a single capability's section for the router prompt
   * @private
   */
  _formatCapabilitySection(desc) {
    let section = `${desc.name.toUpperCase()}`
    if (desc.description) {
      section += `: ${desc.description}`
    }
    if (desc.conditions && desc.conditions.length > 0) {
      section += '\n' + desc.conditions.map(c => `  - ${c}`).join('\n')
    }
    return section
  }

  /**
   * Resolve which capability should handle the given analysis
   * @param {Object} analysis - The parsed analysis from router
   * @returns {import('./BaseCapability').BaseCapability|null}
   */
  resolve(analysis) {
    // First, check if analysis explicitly specifies a capability
    if (analysis.capability) {
      const explicit = this.get(analysis.capability)
      if (explicit && explicit.canHandle(analysis)) {
        return explicit
      }
    }

    // Otherwise, check each capability in priority order
    for (const cap of this.capabilities) {
      if (cap.canHandle(analysis)) {
        return cap
      }
    }

    return null
  }

  /**
   * Get the default/fallback capability
   * @returns {import('./BaseCapability').BaseCapability|null}
   */
  getDefault() {
    // Return the lowest priority capability (usually text response)
    if (this.capabilities.length === 0) return null
    return this.capabilities[this.capabilities.length - 1]
  }
}

// Singleton instance
export const registry = new CapabilityRegistry()

export default registry
