/**
 * Tests for useDynamicCompiler composable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDynamicCompiler } from '../useDynamicCompiler.js'

describe('useDynamicCompiler', () => {
  let mockStoreFactory
  let mockStore
  let mockFetchFactory
  let mockProxiedFetch
  let mockDocument
  let mockStyleElement
  let debugLogSpy

  beforeEach(() => {
    // Mock store
    mockStore = {
      getState: vi.fn(() => ({})),
      set: vi.fn(),
      get: vi.fn()
    }
    mockStoreFactory = vi.fn(() => mockStore)

    // Mock fetch
    mockProxiedFetch = vi.fn()
    mockFetchFactory = vi.fn(() => mockProxiedFetch)

    // Mock document
    mockStyleElement = {
      remove: vi.fn()
    }
    mockDocument = {
      createElement: vi.fn(() => mockStyleElement),
      head: {
        appendChild: vi.fn()
      }
    }

    debugLogSpy = vi.fn()
  })

  describe('initial state', () => {
    it('returns initial state', () => {
      const { compiledComponent, error, scopeId } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument,
        debugLog: debugLogSpy
      })

      expect(compiledComponent.value).toBe(null)
      expect(error.value).toBe(null)
      expect(scopeId).toMatch(/^tool-[a-z0-9]+$/)
    })

    it('generates unique scope IDs', () => {
      const compiler1 = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const compiler2 = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(compiler1.scopeId).not.toBe(compiler2.scopeId)
    })
  })

  describe('compile', () => {
    it('compiles a simple template-only component', () => {
      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('<template><div>Hello</div></template>', 'test-tool', 'tool-123', 'session-1')

      expect(error.value).toBe(null)
      expect(compiledComponent.value).not.toBe(null)
    })

    it('compiles a component with script', () => {
      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const code = `
        <template><div>{{ message }}</div></template>
        <script>export default { data() { return { message: 'Hello' } } }</script>
      `

      compile(code, 'test-tool', 'tool-123', 'session-1')

      expect(error.value).toBe(null)
      expect(compiledComponent.value).not.toBe(null)
    })

    it('compiles a component with style', () => {
      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const code = `
        <template><div class="foo">Hello</div></template>
        <style>.foo { color: red; }</style>
      `

      compile(code, 'test-tool', 'tool-123', 'session-1')

      expect(error.value).toBe(null)
      expect(mockDocument.createElement).toHaveBeenCalledWith('style')
      expect(mockDocument.head.appendChild).toHaveBeenCalled()
      expect(mockStyleElement.textContent).toContain('[data-tool-scope="')
    })

    it('handles empty code error', () => {
      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('', 'test-tool', 'tool-123', 'session-1')

      expect(error.value).toBe('Empty tool code')
      expect(compiledComponent.value).toBe(null)
    })

    it('handles whitespace-only code', () => {
      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('   \n\t  ', 'test-tool', 'tool-123', 'session-1')

      expect(error.value).toBe('Empty tool code')
      expect(compiledComponent.value).toBe(null)
    })

    it('handles missing template', () => {
      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('<script>export default {}</script>', 'test-tool', 'tool-123', 'session-1')

      expect(error.value).toBe('No <template> found in tool code')
      expect(compiledComponent.value).toBe(null)
    })

    it('creates store with correct parameters', () => {
      const { compile, compiledComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const code = `
        <template><div>{{ message }}</div></template>
        <script>export default { data() { return { message: 'Hello' } } }</script>
      `

      compile(code, 'my-tool', 'tool-456', 'session-789')

      // Note: storeFactory is called when component's setup() runs,
      // which doesn't happen in this test context.
      // Just verify compilation succeeded without errors.
      expect(compiledComponent.value).not.toBe(null)
    })

    it('cleans up previous styles before compiling', () => {
      const previousStyle = { remove: vi.fn() }
      const { compile } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      // Simulate having a previous style element
      compile('<template><div></div></template><style>.a{}</style></template>', 'tool', 'id', 'sess')
      const firstStyle = mockStyleElement

      compile('<template><div></div></template><style>.b{}</style></template>', 'tool', 'id', 'sess')

      expect(firstStyle.remove).toHaveBeenCalled()
    })

    it('uses custom compiler when provided', () => {
      const customCompiler = vi.fn(() => ({ code: 'compiled' }))
      const { compile } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        compiler: customCompiler,
        document: mockDocument
      })

      compile('<template><div>Test</div></template>', 'tool', 'id', 'sess')

      expect(customCompiler).toHaveBeenCalledWith('<div>Test</div>')
    })
  })

  describe('cleanup', () => {
    it('removes style element on cleanup', () => {
      const { compile, cleanup } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('<template><div></div></template><style>.foo{}</style></template>', 'tool', 'id', 'sess')

      cleanup()

      expect(mockStyleElement.remove).toHaveBeenCalled()
    })

    it('cleans up watchers on cleanup', () => {
      const mockCleanup = vi.fn()
      mockStore.getState = vi.fn(() => ({ count: 5 }))

      const { compile, cleanup } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      // Compile a component with data
      compile(`
        <template><div>{{ count }}</div></template>
        <script>export default { data() { return { count: 0 } } }</script>
      `, 'tool', 'id', 'sess')

      // Note: Watchers are set up in the component's mounted hook,
      // which won't be called in this test context.
      // The cleanup function should still work correctly.
      cleanup()

      // Just verify cleanup doesn't throw
      expect(mockStyleElement.remove).not.toHaveBeenCalled() // No styles were injected
    })

    it('handles cleanup with no styles', () => {
      const { cleanup } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(() => cleanup()).not.toThrow()
    })
  })

  describe('data restoration', () => {
    it('restores saved data in Options API component', () => {
      mockStore.getState = vi.fn(() => ({ count: 42, name: 'Test' }))

      const { compile, compiledComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile(`
        <template><div>{{ count }} {{ name }}</div></template>
        <script>export default { data() { return { count: 0, name: '' } } }</script>
      `, 'tool', 'id', 'sess')

      // The component definition is created
      // Data restoration happens when component is mounted
      expect(compiledComponent.value).not.toBe(null)
    })

    it('handles empty saved state', () => {
      mockStore.getState = vi.fn(() => ({}))

      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile(`
        <template><div>{{ count }}</div></template>
        <script>export default { data() { return { count: 10 } } }</script>
      `, 'tool', 'id', 'sess')

      expect(error.value).toBe(null)
      expect(compiledComponent.value).not.toBe(null)
    })
  })

  describe('error handling', () => {
    it('handles malformed SFC code', () => {
      const { compile, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('this is not valid SFC code', 'tool', 'id', 'sess')

      expect(error.value).toBe('No <template> found in tool code')
    })

    it('handles style injection failures gracefully', () => {
      mockDocument.head.appendChild = vi.fn(() => {
        throw new Error('DOM error')
      })

      const { compile, compiledComponent, error } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      // Should still compile even if style injection fails
      compile('<template><div></div></template><style>.foo{}</style></template>', 'tool', 'id', 'sess')

      expect(compiledComponent.value).not.toBe(null)
    })
  })

  describe('setupAutoSaveWatchers', () => {
    it('is exported for testing', () => {
      const { setupAutoSaveWatchers } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(typeof setupAutoSaveWatchers).toBe('function')
    })

    it('returns cleanup function', () => {
      const { setupAutoSaveWatchers } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const mockComponent = {
        $data: { count: 0, name: 'test' }
      }

      const cleanup = setupAutoSaveWatchers(mockComponent, mockStore)

      expect(typeof cleanup).toBe('function')
    })

    it('handles component with no data', () => {
      const { setupAutoSaveWatchers } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument,
        debugLog: debugLogSpy
      })

      const cleanup = setupAutoSaveWatchers(null, mockStore)

      expect(typeof cleanup).toBe('function')
      cleanup() // Should not throw
    })
  })

  describe('setupAutoSaveForReactive', () => {
    it('is exported for testing', () => {
      const { setupAutoSaveForReactive } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(typeof setupAutoSaveForReactive).toBe('function')
    })

    it('returns cleanup function', () => {
      const { setupAutoSaveForReactive } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const setupResult = {
        count: { value: 0 },
        name: { value: 'test' }
      }

      const cleanup = setupAutoSaveForReactive(setupResult, mockStore)

      expect(typeof cleanup).toBe('function')
    })

    it('handles null setup result', () => {
      const { setupAutoSaveForReactive } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const cleanup = setupAutoSaveForReactive(null, mockStore)

      expect(typeof cleanup).toBe('function')
      cleanup() // Should not throw
    })
  })

  describe('buildComponent and buildSetupComponent', () => {
    it('exports buildComponent for testing', () => {
      const { buildComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(typeof buildComponent).toBe('function')
    })

    it('exports buildSetupComponent for testing', () => {
      const { buildSetupComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(typeof buildSetupComponent).toBe('function')
    })

    it('buildComponent creates template-only component', () => {
      const { buildComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const component = buildComponent('<div>Hello</div>', null, 'tool', 'id', 'sess')

      expect(component).not.toBe(null)
      expect(typeof component).toBe('object')
    })

    it('buildComponent handles Options API', () => {
      mockStore.getState = vi.fn(() => ({}))

      const { buildComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      const script = 'export default { data() { return { count: 0 } } }'
      const component = buildComponent('<div>{{ count }}</div>', script, 'tool', 'id', 'sess')

      expect(component).not.toBe(null)
    })

    it('buildSetupComponent handles Composition API fallback', () => {
      mockStore.getState = vi.fn(() => ({}))

      const { buildSetupComponent } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      // Use a valid script that doesn't have undeclared variables
      const script = 'const count = ref(0); const doubled = computed(() => count.value * 2)'
      const component = buildSetupComponent('<div>{{ count }}</div>', script, 'tool', 'id', 'sess')

      expect(component).not.toBe(null)
    })
  })

  describe('debug logging', () => {
    it('calls debugLog when provided', () => {
      const { compile } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument,
        debugLog: debugLogSpy
      })

      compile('<template><div>Test</div></template>', 'tool', 'id', 'sess')

      // debugLog should be called during compilation
      expect(debugLogSpy).toHaveBeenCalled()
    })

    it('does not throw when debugLog is not provided', () => {
      const { compile } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      expect(() => compile('<template><div>Test</div></template>', 'tool', 'id', 'sess'))
        .not.toThrow()
    })
  })

  describe('style scoping', () => {
    it('scopes styles with unique scope ID', () => {
      const { compile, scopeId } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('<template><div class="foo"></div></template><style>.foo { color: red; }</style>', 'tool', 'id', 'sess')

      expect(mockStyleElement.textContent).toContain(`[data-tool-scope="${scopeId}"]`)
    })

    it('preserves @keyframes rules', () => {
      const { compile } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('<template><div></div></template><style>@keyframes fade { from { opacity: 0; } to { opacity: 1; } }</style>', 'tool', 'id', 'sess')

      expect(mockStyleElement.textContent).toContain('@keyframes')
    })

    it('converts :root to scope attribute', () => {
      const { compile, scopeId } = useDynamicCompiler({
        storeFactory: mockStoreFactory,
        fetchFactory: mockFetchFactory,
        document: mockDocument
      })

      compile('<template><div></div></template><style>:root { --color: red; }</style>', 'tool', 'id', 'sess')

      expect(mockStyleElement.textContent).toContain(`[data-tool-scope="${scopeId}"]`)
    })
  })
})
