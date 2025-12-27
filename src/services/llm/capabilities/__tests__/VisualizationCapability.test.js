import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VisualizationCapability, visualizationHandlers } from '../VisualizationCapability.js'

// Mock the LM Studio provider
vi.mock('../../providers/lmstudio.js', () => ({
  lmstudioProvider: {
    sendMessage: vi.fn()
  }
}))

describe('VisualizationCapability', () => {
  let capability

  beforeEach(() => {
    capability = new VisualizationCapability()
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('visualization')
    })

    it('should have priority 60 (higher than code)', () => {
      expect(capability.priority).toBe(60)
    })
  })

  describe('getRouterDescription', () => {
    it('should return description with name and description', () => {
      const desc = capability.getRouterDescription()

      expect(desc.name).toBe('visualization')
      expect(desc.description).toContain('VISUAL')
    })

    it('should include conditions for visual output types', () => {
      const desc = capability.getRouterDescription()

      expect(desc.conditions).toBeDefined()
      expect(desc.conditions.length).toBeGreaterThan(0)
      // Check it mentions charts or diagrams
      expect(desc.conditions.some(c => c.toLowerCase().includes('chart') || c.toLowerCase().includes('diagram'))).toBe(true)
    })

    it('should include examples', () => {
      const desc = capability.getRouterDescription()

      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples[0]).toHaveProperty('input')
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "visualization"', () => {
      expect(capability.canHandle({ capability: 'visualization' })).toBe(true)
    })

    it('should handle when isVisualization is true', () => {
      expect(capability.canHandle({ isVisualization: true })).toBe(true)
    })

    it('should handle when visualizationType is "chart"', () => {
      expect(capability.canHandle({ visualizationType: 'chart' })).toBe(true)
    })

    it('should handle when visualizationType is "mermaid"', () => {
      expect(capability.canHandle({ visualizationType: 'mermaid' })).toBe(true)
    })

    it('should handle when visualizationType is "svg"', () => {
      expect(capability.canHandle({ visualizationType: 'svg' })).toBe(true)
    })

    it('should not handle code capability', () => {
      expect(capability.canHandle({ capability: 'code' })).toBe(false)
    })

    it('should not handle unknown visualization type', () => {
      expect(capability.canHandle({ visualizationType: 'unknown' })).toBe(false)
    })
  })

  describe('formatOutput', () => {
    it('should format chart result', () => {
      const result = { type: 'chart', content: '{"series":[]}' }
      const output = capability.formatOutput(result, {})

      expect(output.type).toBe('visualization')
      expect(output.displayHint).toBe('chart')
      expect(output.content).toBe(result)
    })

    it('should format mermaid result', () => {
      const result = { type: 'mermaid', content: 'flowchart TD\nA-->B' }
      const output = capability.formatOutput(result, {})

      expect(output.displayHint).toBe('mermaid')
    })

    it('should format svg result', () => {
      const result = { type: 'svg', content: '<svg></svg>' }
      const output = capability.formatOutput(result, {})

      expect(output.displayHint).toBe('svg')
    })
  })
})

describe('visualizationHandlers', () => {
  describe('chart handler', () => {
    const handler = visualizationHandlers.chart

    it('should have correct type', () => {
      expect(handler.type).toBe('chart')
    })

    it('should have system prompt for ECharts', () => {
      const prompt = handler.getSystemPrompt()

      expect(prompt).toContain('ECharts')
      expect(prompt).toContain('JSON')
    })

    describe('cleanOutput', () => {
      it('should remove markdown code blocks', () => {
        const input = '```json\n{"title":{}}\n```'
        const output = handler.cleanOutput(input)

        expect(output).toBe('{"title":{}}')
      })

      it('should extract JSON object from text', () => {
        const input = 'Here is the chart config: {"title":{}} end.'
        const output = handler.cleanOutput(input)

        expect(output).toBe('{"title":{}}')
      })

      it('should handle clean JSON', () => {
        const input = '{"title":{"text":"Test"}}'
        const output = handler.cleanOutput(input)

        expect(output).toBe('{"title":{"text":"Test"}}')
      })
    })
  })

  describe('mermaid handler', () => {
    const handler = visualizationHandlers.mermaid

    it('should have correct type', () => {
      expect(handler.type).toBe('mermaid')
    })

    it('should have system prompt for Mermaid diagrams', () => {
      const prompt = handler.getSystemPrompt()

      expect(prompt).toContain('Mermaid')
      expect(prompt).toContain('flowchart')
      expect(prompt).toContain('sequenceDiagram')
    })

    describe('cleanOutput', () => {
      it('should remove mermaid code blocks', () => {
        const input = '```mermaid\nflowchart TD\nA-->B\n```'
        const output = handler.cleanOutput(input)

        expect(output).toBe('flowchart TD\nA-->B')
      })

      it('should handle clean mermaid syntax', () => {
        const input = 'sequenceDiagram\nA->>B: Hello'
        const output = handler.cleanOutput(input)

        expect(output).toBe('sequenceDiagram\nA->>B: Hello')
      })
    })
  })

  describe('svg handler', () => {
    const handler = visualizationHandlers.svg

    it('should have correct type', () => {
      expect(handler.type).toBe('svg')
    })

    it('should have system prompt for SVG', () => {
      const prompt = handler.getSystemPrompt()

      expect(prompt).toContain('SVG')
      expect(prompt).toContain('viewBox')
    })

    describe('cleanOutput', () => {
      it('should remove svg code blocks', () => {
        const input = '```svg\n<svg viewBox="0 0 100 100"></svg>\n```'
        const output = handler.cleanOutput(input)

        expect(output).toBe('<svg viewBox="0 0 100 100"></svg>')
      })

      it('should extract SVG from text', () => {
        const input = 'Here is the svg: <svg><circle/></svg> done.'
        const output = handler.cleanOutput(input)

        expect(output).toBe('<svg><circle/></svg>')
      })

      it('should handle clean SVG', () => {
        const input = '<svg viewBox="0 0 200 200"><rect/></svg>'
        const output = handler.cleanOutput(input)

        expect(output).toBe('<svg viewBox="0 0 200 200"><rect/></svg>')
      })
    })
  })
})
