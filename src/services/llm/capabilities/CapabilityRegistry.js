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

    return `You are a task router. Analyze the user's request and select the appropriate capability.
Today is ${getCurrentDateString()}.

═══════════════════════════════════════════════════════════════
AVAILABLE CAPABILITIES
═══════════════════════════════════════════════════════════════

${capabilityDescriptions}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Respond with ONLY this format (no markdown, no explanation):

capability: <${capabilityList}>
task: <brief description of what to do>
searchQuery: <query if websearch needed, otherwise omit this line>

MULTI-STEP (only when one step's output feeds into the next):

PLAN: <one line summary>

STEP 1
capability: <name>
task: <what to do>

STEP 2
capability: <name>
task: <what to do using {{step_1_result}}>`
  }

  /**
   * Format a single capability's section for the router prompt
   * @private
   */
  _formatCapabilitySection(desc) {
    let section = `【${desc.name.toUpperCase()}】`
    if (desc.description) {
      section += `\n${desc.description}`
    }
    if (desc.conditions && desc.conditions.length > 0) {
      section += '\n\nUSE WHEN:'
      section += '\n' + desc.conditions.map(c => `  ✓ ${c}`).join('\n')
    }
    if (desc.examples && desc.examples.length > 0) {
      section += '\n\nEXAMPLES:'
      section += '\n' + desc.examples.map(ex => `  "${ex.input}" → ${desc.name}`).join('\n')
    }
    return section
  }

  /**
   * Resolve which capability should handle the given analysis
   * @param {Object} analysis - The parsed analysis from router
   * @returns {import('./BaseCapability').BaseCapability|null}
   */
  resolve(analysis) {
    const capability = this.get(analysis.capability) || this.getDefault()
    console.log('[Router] analysis.capability:', analysis.capability, '-> resolved:', capability?.name)
    return capability
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
