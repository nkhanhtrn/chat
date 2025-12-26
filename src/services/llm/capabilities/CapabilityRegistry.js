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
    const capabilityDescriptions = this.capabilities.map(cap => {
      const desc = cap.getRouterDescription()
      return this._formatCapabilitySection(desc)
    }).join('\n\n')

    const outputSchema = this._buildOutputSchema()
    const examples = this._buildExamples()

    return `You are a task analyzer. Today is ${getCurrentDateString()}. Analyze the user's request and determine which capability should handle it.

${capabilityDescriptions}

Respond with JSON:
${JSON.stringify(outputSchema, null, 2)}

${examples}

Respond ONLY with JSON.`
  }

  /**
   * Format a single capability's section for the router prompt
   * @private
   */
  _formatCapabilitySection(desc) {
    let section = `${desc.name.toUpperCase()} TASKS`
    if (desc.description) {
      section += ` - ${desc.description}`
    }
    section += ':\n'

    if (desc.conditions && desc.conditions.length > 0) {
      section += desc.conditions.map(c => `- ${c}`).join('\n')
    }

    if (desc.antiConditions && desc.antiConditions.length > 0) {
      section += '\n\nNOT ' + desc.name.toUpperCase() + ':\n'
      section += desc.antiConditions.map(c => `- ${c}`).join('\n')
    }

    return section
  }

  /**
   * Build the combined output schema from all capabilities
   * @private
   */
  _buildOutputSchema() {
    const schema = {
      capability: 'string (one of: ' + this.getNames().join(', ') + ')',
      taskDescription: 'string',
      inputs: '[...]',
      expectedOutput: 'string'
    }

    // Merge in capability-specific schema fields
    for (const cap of this.capabilities) {
      const desc = cap.getRouterDescription()
      if (desc.outputSchema) {
        Object.assign(schema, desc.outputSchema)
      }
    }

    return schema
  }

  /**
   * Build examples section from all capabilities
   * @private
   */
  _buildExamples() {
    let examplesText = 'Examples:\n'

    for (const cap of this.capabilities) {
      const desc = cap.getRouterDescription()
      if (desc.examples && desc.examples.length > 0) {
        for (const ex of desc.examples) {
          // Ensure the output has the capability field
          const output = { capability: cap.name, ...ex.output }
          examplesText += `\nUser: "${ex.input}"\n${JSON.stringify(output)}\n`
        }
      }
    }

    return examplesText
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
