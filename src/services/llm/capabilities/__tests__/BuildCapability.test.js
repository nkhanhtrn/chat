import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuildCapability } from '../BuildCapability.js'

vi.mock('../../../indexedDB.js', () => ({
  saveTool: vi.fn().mockResolvedValue({}),
  syncToolsFromCloud: vi.fn().mockResolvedValue(0)
}))

describe('BuildCapability', () => {
  let capability
  let mockProvider

  beforeEach(() => {
    capability = new BuildCapability()
    mockProvider = {
      sendMessage: vi.fn()
    }
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('build')
    })

    it('should have priority 55', () => {
      expect(capability.priority).toBe(55)
    })
  })

  describe('getRouterDescription', () => {
    it('should return description with name and description', () => {
      const desc = capability.getRouterDescription()
      expect(desc.name).toBe('build')
      expect(desc.description).toContain('INTERACTIVE')
    })

    it('should have conditions for tool creation', () => {
      const desc = capability.getRouterDescription()
      expect(desc.conditions.length).toBeGreaterThan(0)
      expect(desc.conditions.some(c => c.toLowerCase().includes('tool'))).toBe(true)
    })

    it('should include examples', () => {
      const desc = capability.getRouterDescription()
      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples[0]).toHaveProperty('input')
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "build"', () => {
      expect(capability.canHandle({ capability: 'build' })).toBe(true)
    })

    it('should handle when isBuildTool is true', () => {
      expect(capability.canHandle({ isBuildTool: true })).toBe(true)
    })

    it('should handle when toolType is defined', () => {
      expect(capability.canHandle({ toolType: 'calculator' })).toBe(true)
    })

    it('should not handle without explicit build signals', () => {
      expect(capability.canHandle({ taskDescription: 'Build a calculator' })).toBe(false)
    })

    it('should not handle other capabilities', () => {
      expect(capability.canHandle({ capability: 'text' })).toBe(false)
      expect(capability.canHandle({ capability: 'code' })).toBe(false)
    })
  })

  describe('_parseOutput', () => {
    it('should extract Vue SFC from clean code', () => {
      const code = `<template>
  <div>Hello</div>
</template>

<script>
export default {
  data() { return {} }
}
</script>`

      const result = capability._parseOutput(code)
      expect(result.type).toBe('vue-sfc')
      expect(result.code).toContain('<template>')
      expect(result.code).toContain('</script>')
    })

    it('should remove markdown code fences', () => {
      const code = '```vue\n<template><div>Test</div></template>\n<script>export default {}</script>\n```'
      const result = capability._parseOutput(code)
      expect(result.code).not.toContain('```')
      expect(result.code).toContain('<template>')
    })

    it('should throw error for invalid Vue component', () => {
      expect(() => capability._parseOutput('not a vue component')).toThrow('Invalid Vue component')
    })

    it('should handle code with style block', () => {
      const code = `<template><div>Test</div></template>
<script>export default {}</script>
<style>.test { color: red; }</style>`

      const result = capability._parseOutput(code)
      expect(result.code).toContain('<style>')
      expect(result.code).toContain('</style>')
    })
  })

  describe('execute', () => {
    it('should return success with valid Vue component', async () => {
      const vueComponent = `<template>
  <div class="calculator">
    <div class="display">{{ display }}</div>
    <button @click="add">+</button>
  </div>
</template>

<script>
export default {
  data() {
    return { display: '0' }
  },
  methods: {
    add() { this.display = '1' }
  }
}
</script>

<style>
.calculator { padding: 1rem; }
</style>`

      mockProvider.sendMessage.mockResolvedValue(vueComponent)

      const context = {
        fullContext: 'build a calculator',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result.type).toBe('vue-sfc')
      expect(result.result.code).toContain('<template>')
      expect(result.error).toBeNull()
    })

    it('should handle Vue code wrapped in markdown', async () => {
      const wrappedCode = '```vue\n<template><div>Test</div></template>\n<script>export default {}</script>\n```'
      mockProvider.sendMessage.mockResolvedValue(wrappedCode)

      const context = {
        fullContext: 'build a test tool',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result.code).not.toContain('```')
    })

    it('should return error for invalid output', async () => {
      mockProvider.sendMessage.mockResolvedValue('not a vue component at all')

      const context = {
        fullContext: 'build something',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid Vue component')
    })

    it('should call onToolGenerated callback', async () => {
      const vueCode = '<template><div>Test</div></template>\n<script>export default {}</script>'
      mockProvider.sendMessage.mockResolvedValue(vueCode)

      const onToolGenerated = vi.fn()
      const context = {
        fullContext: 'build a test',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: { onToolGenerated }
      }

      await capability.execute(context)

      expect(onToolGenerated).toHaveBeenCalledTimes(1)
      expect(onToolGenerated).toHaveBeenCalledWith(expect.objectContaining({
        type: 'vue-sfc'
      }))
    })

    it('should make single LLM call', async () => {
      const vueCode = '<template><div>Test</div></template>\n<script>export default {}</script>'
      mockProvider.sendMessage.mockResolvedValue(vueCode)

      const context = {
        fullContext: 'build a test tool',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      await capability.execute(context)

      expect(mockProvider.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('should include piped data in prompt', async () => {
      const vueCode = '<template><div>Test</div></template>\n<script>export default {}</script>'
      mockProvider.sendMessage.mockResolvedValue(vueCode)

      const context = {
        fullContext: 'build a data viewer',
        models: { executorId: 'test-model' },
        config: {},
        provider: mockProvider,
        signal: new AbortController().signal,
        callbacks: {}
      }

      await capability.execute(context, { data: { items: [1, 2, 3] } })

      const callArgs = mockProvider.sendMessage.mock.calls[0]
      const userMessage = callArgs[1].find(m => m.role === 'user')
      expect(userMessage.content).toContain('items')
    })

  })

  describe('editTool', () => {
    it('should send consolidated code and request to LLM', async () => {
      const currentCode = '<template><div>Old</div></template>\n<script>export default {}</script>'
      const newCode = '<template><div>New</div></template>\n<script>export default {}</script>'

      mockProvider.sendMessage.mockResolvedValue(newCode)

      const result = await capability.editTool(
        currentCode,
        'change text to New',
        'test-model',
        mockProvider,
        {},
        new AbortController().signal
      )

      expect(result.type).toBe('vue-sfc')
      expect(result.code).toContain('New')

      const callArgs = mockProvider.sendMessage.mock.calls[0]
      const userMessage = callArgs[1].find(m => m.role === 'user')
      expect(userMessage.content).toContain('<template>')
      expect(userMessage.content).toContain('change text to New')
    })

    it('should instruct LLM to consolidate code', async () => {
      const newCode = '<template><div>New</div></template>\n<script>export default {}</script>'
      mockProvider.sendMessage.mockResolvedValue(newCode)

      await capability.editTool(
        '<template><div>Test</div></template>\n<script>export default {}</script>',
        'update',
        'test-model',
        mockProvider,
        {},
        new AbortController().signal
      )

      const callArgs = mockProvider.sendMessage.mock.calls[0]
      const systemMessage = callArgs[1].find(m => m.role === 'system')
      expect(systemMessage.content).toContain('consolidate')
      expect(systemMessage.content).toContain('Remove comments')
    })

    it('should include all consolidation instructions in system prompt', async () => {
      const newCode = '<template><div>New</div></template>\n<script>export default {}</script>'
      mockProvider.sendMessage.mockResolvedValue(newCode)

      await capability.editTool(
        '<template><div>Test</div></template>\n<script>export default {}</script>',
        'update',
        'test-model',
        mockProvider,
        {},
        new AbortController().signal
      )

      const callArgs = mockProvider.sendMessage.mock.calls[0]
      const systemMessage = callArgs[1].find(m => m.role === 'system')
      expect(systemMessage.content).toContain('Remove comments and unused code')
      expect(systemMessage.content).toContain('Simplify verbose patterns')
      expect(systemMessage.content).toContain('Keep functionality identical')
    })

    it('should include full code in user prompt for consolidation', async () => {
      const currentCode = `<template>
  <div class="container">
    <h1>Title</h1>
    <p>Content</p>
  </div>
</template>
<script>
export default {
  data() { return { count: 0 } }
}
</script>`
      const newCode = '<template><div>New</div></template>\n<script>export default {}</script>'
      mockProvider.sendMessage.mockResolvedValue(newCode)

      await capability.editTool(
        currentCode,
        'simplify',
        'test-model',
        mockProvider,
        {},
        new AbortController().signal
      )

      const callArgs = mockProvider.sendMessage.mock.calls[0]
      const userMessage = callArgs[1].find(m => m.role === 'user')
      expect(userMessage.content).toContain('container')
      expect(userMessage.content).toContain('count')
      expect(userMessage.content).toContain('simplify')
    })

    it('should log token estimate', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const currentCode = '<template><div>Test</div></template>\n<script>export default {}</script>'
      const newCode = '<template><div>New</div></template>\n<script>export default {}</script>'

      mockProvider.sendMessage.mockResolvedValue(newCode)

      await capability.editTool(
        currentCode,
        'update',
        'test-model',
        mockProvider,
        {},
        new AbortController().signal
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BuildCapability] Edit tokens:')
      )

      consoleSpy.mockRestore()
    })

    it('should return parsed Vue component', async () => {
      const newCode = `<template>
  <div>Updated</div>
</template>

<script>
export default {
  data() { return { count: 0 } }
}
</script>`

      mockProvider.sendMessage.mockResolvedValue(newCode)

      const result = await capability.editTool(
        '<template><div>Old</div></template><script>export default {}</script>',
        'add a counter',
        'test-model',
        mockProvider,
        {},
        new AbortController().signal
      )

      expect(result.type).toBe('vue-sfc')
      expect(result.code).toContain('Updated')
      expect(result.code).toContain('count')
    })
  })

  describe('formatOutput', () => {
    it('should return tool type and displayHint', () => {
      const result = { code: '<template></template>', type: 'vue-sfc' }
      const output = capability.formatOutput(result)

      expect(output.type).toBe('tool')
      expect(output.displayHint).toBe('tool')
      expect(output.content).toEqual(result)
    })
  })

  describe('receiveInput', () => {
    it('should extract data from pipe input', () => {
      const context = { fullContext: 'test' }
      const pipeInput = { data: { items: [1, 2, 3] } }

      const result = capability.receiveInput(pipeInput, context)

      expect(result.data).toEqual({ items: [1, 2, 3] })
      expect(result.context).toBe(context)
    })

    it('should handle null pipe input', () => {
      const context = { fullContext: 'test' }

      const result = capability.receiveInput(null, context)

      expect(result.data).toBeNull()
      expect(result.context).toBe(context)
    })
  })
})
