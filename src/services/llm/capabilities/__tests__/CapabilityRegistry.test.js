import { describe, it, expect, beforeEach } from 'vitest'
import { BaseCapability } from '../BaseCapability.js'

// Create a fresh registry for each test (don't use singleton)
class TestCapabilityRegistry {
  constructor() {
    this.capabilities = []
  }

  register(capability) {
    if (!capability.name) {
      throw new Error('Capability must have a name')
    }
    const existing = this.capabilities.find(c => c.name === capability.name)
    if (existing) {
      this.capabilities = this.capabilities.filter(c => c.name !== capability.name)
    }
    this.capabilities.push(capability)
    this.capabilities.sort((a, b) => b.priority - a.priority)
  }

  unregister(name) {
    this.capabilities = this.capabilities.filter(c => c.name !== name)
  }

  get(name) {
    return this.capabilities.find(c => c.name === name)
  }

  getNames() {
    return this.capabilities.map(c => c.name)
  }

  resolve(analysis) {
    if (analysis.capability) {
      const explicit = this.get(analysis.capability)
      if (explicit && explicit.canHandle(analysis)) {
        return explicit
      }
    }
    for (const cap of this.capabilities) {
      if (cap.canHandle(analysis)) {
        return cap
      }
    }
    return null
  }

  getDefault() {
    if (this.capabilities.length === 0) return null
    return this.capabilities[this.capabilities.length - 1]
  }

  buildRouterPrompt() {
    const sections = this.capabilities.map(cap => {
      const desc = cap.getRouterDescription()
      return `${desc.name}: ${desc.description}`
    }).join('\n')
    return `Router prompt with capabilities:\n${sections}`
  }
}

// Mock capabilities for testing
class MockCodeCapability extends BaseCapability {
  name = 'code'
  priority = 50

  getRouterDescription() {
    return {
      name: 'CODE',
      description: 'code execution tasks',
      conditions: ['calculations', 'transformations'],
      examples: []
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'code' || analysis.canBeCode === true
  }

  async execute(context) {
    return { success: true, result: 'code result', error: null, metadata: {} }
  }
}

class MockVisualizationCapability extends BaseCapability {
  name = 'visualization'
  priority = 60

  getRouterDescription() {
    return {
      name: 'VISUALIZATION',
      description: 'charts and diagrams',
      conditions: ['charts', 'diagrams'],
      examples: []
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'visualization' || analysis.isVisualization === true
  }

  async execute(context) {
    return { success: true, result: { type: 'chart', content: '{}' }, error: null, metadata: {} }
  }
}

class MockTextCapability extends BaseCapability {
  name = 'text'
  priority = 0

  getRouterDescription() {
    return {
      name: 'TEXT',
      description: 'language tasks',
      conditions: ['translation', 'summarization'],
      examples: []
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'text' || analysis.canBeCode === false
  }

  async execute(context) {
    return { success: true, result: 'text result', error: null, metadata: {} }
  }
}

describe('CapabilityRegistry', () => {
  let registry

  beforeEach(() => {
    registry = new TestCapabilityRegistry()
  })

  describe('register', () => {
    it('should register a capability', () => {
      const cap = new MockCodeCapability()
      registry.register(cap)

      expect(registry.get('code')).toBe(cap)
    })

    it('should throw error for capability without name', () => {
      const cap = new BaseCapability()

      expect(() => registry.register(cap)).toThrow('Capability must have a name')
    })

    it('should replace existing capability with same name', () => {
      const cap1 = new MockCodeCapability()
      const cap2 = new MockCodeCapability()

      registry.register(cap1)
      registry.register(cap2)

      expect(registry.capabilities.length).toBe(1)
      expect(registry.get('code')).toBe(cap2)
    })

    it('should sort capabilities by priority (highest first)', () => {
      registry.register(new MockTextCapability())      // priority 0
      registry.register(new MockCodeCapability())       // priority 50
      registry.register(new MockVisualizationCapability()) // priority 60

      const names = registry.getNames()
      expect(names).toEqual(['visualization', 'code', 'text'])
    })
  })

  describe('unregister', () => {
    it('should remove a capability by name', () => {
      registry.register(new MockCodeCapability())
      registry.register(new MockTextCapability())

      registry.unregister('code')

      expect(registry.get('code')).toBeUndefined()
      expect(registry.get('text')).toBeDefined()
    })
  })

  describe('get', () => {
    it('should return capability by name', () => {
      const cap = new MockCodeCapability()
      registry.register(cap)

      expect(registry.get('code')).toBe(cap)
    })

    it('should return undefined for unknown name', () => {
      expect(registry.get('unknown')).toBeUndefined()
    })
  })

  describe('getNames', () => {
    it('should return all registered capability names', () => {
      registry.register(new MockCodeCapability())
      registry.register(new MockVisualizationCapability())
      registry.register(new MockTextCapability())

      const names = registry.getNames()
      expect(names).toContain('code')
      expect(names).toContain('visualization')
      expect(names).toContain('text')
    })
  })

  describe('resolve', () => {
    beforeEach(() => {
      registry.register(new MockVisualizationCapability())
      registry.register(new MockCodeCapability())
      registry.register(new MockTextCapability())
    })

    it('should resolve by explicit capability field', () => {
      const analysis = { capability: 'code' }
      const resolved = registry.resolve(analysis)

      expect(resolved.name).toBe('code')
    })

    it('should resolve visualization by isVisualization flag', () => {
      const analysis = { isVisualization: true }
      const resolved = registry.resolve(analysis)

      expect(resolved.name).toBe('visualization')
    })

    it('should resolve code by canBeCode flag', () => {
      const analysis = { canBeCode: true }
      const resolved = registry.resolve(analysis)

      expect(resolved.name).toBe('code')
    })

    it('should resolve text by canBeCode: false', () => {
      const analysis = { canBeCode: false }
      const resolved = registry.resolve(analysis)

      expect(resolved.name).toBe('text')
    })

    it('should check capabilities in priority order', () => {
      // Both visualization and code could match, but visualization has higher priority
      const analysis = { isVisualization: true, canBeCode: true }
      const resolved = registry.resolve(analysis)

      expect(resolved.name).toBe('visualization')
    })

    it('should return null when no capability matches', () => {
      const analysis = { unknownField: true }
      const resolved = registry.resolve(analysis)

      expect(resolved).toBeNull()
    })
  })

  describe('getDefault', () => {
    it('should return the lowest priority capability', () => {
      registry.register(new MockVisualizationCapability()) // priority 60
      registry.register(new MockCodeCapability())          // priority 50
      registry.register(new MockTextCapability())          // priority 0

      const defaultCap = registry.getDefault()
      expect(defaultCap.name).toBe('text')
    })

    it('should return null when no capabilities registered', () => {
      expect(registry.getDefault()).toBeNull()
    })
  })

  describe('buildRouterPrompt', () => {
    it('should build prompt from all registered capabilities', () => {
      registry.register(new MockCodeCapability())
      registry.register(new MockVisualizationCapability())

      const prompt = registry.buildRouterPrompt()

      expect(prompt).toContain('CODE')
      expect(prompt).toContain('VISUALIZATION')
    })
  })
})
