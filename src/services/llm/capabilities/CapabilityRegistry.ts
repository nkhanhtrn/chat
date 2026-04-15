import type { CapabilityDescription } from '@/types/capabilities'
import type { BaseCapability } from './BaseCapability'

class CapabilityRegistry {
  capabilities: BaseCapability[] = []

  register(capability: BaseCapability): void {
    if (!capability.name) throw new Error('Capability must have a name')

    const existing = this.capabilities.find(c => c.name === capability.name)
    if (existing) {
      this.capabilities = this.capabilities.filter(c => c.name !== capability.name)
    }
    this.capabilities.push(capability)
    this.capabilities.sort((a, b) => b.priority - a.priority)
  }

  unregister(name: string): void {
    this.capabilities = this.capabilities.filter(c => c.name !== name)
  }

  get(name: string): BaseCapability | undefined {
    return this.capabilities.find(c => c.name === name)
  }

  getNames(): string[] {
    return this.capabilities.map(c => c.name)
  }

  buildRouterPrompt(): string {
    const capabilityList = this.getNames().join(', ')
    const capabilityDescriptions = this.capabilities.map(cap => {
      const desc = cap.getRouterDescription()
      return this._formatCapabilitySection(desc)
    }).join('\n\n')

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December']
    const now = new Date()
    const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`

    return `You are a task router. Analyze the user's request and select the appropriate capability.
Today is ${dateStr}.

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
searchQuery: <query if websearch needed, otherwise omit this line>`
  }

  private _formatCapabilitySection(desc: CapabilityDescription): string {
    let section = `【${desc.name.toUpperCase()}】`
    if (desc.description) section += `\n${desc.description}`
    if (desc.conditions?.length) {
      section += '\n\nUSE WHEN:\n' + desc.conditions.map(c => `  ✓ ${c}`).join('\n')
    }
    if (desc.examples?.length) {
      section += '\n\nEXAMPLES:\n' + desc.examples.map(ex => `  "${ex.input}" → ${desc.name}`).join('\n')
    }
    return section
  }

  resolve(analysis: Record<string, any>): BaseCapability | null {
    const capability = this.get(analysis.capability) ?? this.getDefault()
    return capability ?? null
  }

  getDefault(): BaseCapability | null {
    if (this.capabilities.length === 0) return null
    return this.capabilities[this.capabilities.length - 1]!
  }
}

export const registry = new CapabilityRegistry()
export default registry
