/**
 * Composable for dynamically compiling Vue tool components at runtime.
 * Provides dependency injection for testability.
 */

import { ref, shallowRef, defineComponent, nextTick, watch as vueWatch, watch, compile as compileTemplate } from 'vue'
import { parseToolCode, validateTemplate, scopeStyles } from '../utils/toolCompiler.js'
import { createProxiedFetch } from '../utils/toolFetch.js'
import { reactive, computed, watchEffect } from 'vue'

/**
 * Create a composable for dynamic Vue component compilation.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.storeFactory - Factory function for creating instance stores (default: useToolInstanceStore)
 * @param {Function} options.fetchFactory - Factory function for creating proxied fetch (default: createProxiedFetch)
 * @param {Function} options.compiler - Vue template compiler function (default: compileTemplate)
 * @param {Object} options.document - Document object for DOM manipulation (default: document)
 * @param {Function} options.debugLog - Optional debug logging function
 * @returns {Object} - Compilation API
 */
export function useDynamicCompiler(options = {}) {
  const {
    storeFactory = null, // Must be provided by the component
    fetchFactory = createProxiedFetch,
    compiler = compileTemplate,
    document: doc = typeof document !== 'undefined' ? document : null,
    debugLog = () => {}
  } = options

  // State
  const compiledComponent = shallowRef(null)
  const error = ref(null)
  const styleEl = ref(null)
  const watcherCleanups = ref([])

  // Generate unique scope ID for this instance
  const scopeId = `tool-${Math.random().toString(36).slice(2, 9)}`

  /**
   * Set up auto-save watchers for Options API component data properties
   * Returns a cleanup function to stop all watchers
   */
  function setupAutoSaveWatchers(componentInstance, persist) {
    if (!componentInstance?.$data || !persist) {
      debugLog('[VueToolRenderer] setupAutoSaveWatchers skipped - no data or persist')
      return () => {}
    }

    debugLog('[VueToolRenderer] Setting up auto-save watchers for', Object.keys(componentInstance.$data).filter(k => !k.startsWith('$') && !k.startsWith('_')))

    const stopFns = []

    // Watch all data properties and auto-save changes
    Object.keys(componentInstance.$data).forEach(key => {
      // Skip internal properties
      if (key.startsWith('$') || key.startsWith('_')) return

      const stopFn = vueWatch(
        () => componentInstance.$data[key],
        (newValue) => {
          debugLog('[VueToolRenderer] Auto-saving', key, '=', newValue)
          persist?.set?.(key, newValue)
        },
        { deep: true }
      )
      stopFns.push(stopFn)
    })

    // Return cleanup function
    return () => stopFns.forEach(fn => fn())
  }

  /**
   * Set up auto-save for Composition API reactive state
   * Returns a cleanup function to stop all watchers
   */
  function setupAutoSaveForReactive(setupResult, persist) {
    if (!setupResult || typeof setupResult !== 'object') return () => {}

    debugLog('[VueToolRenderer] Setting up Composition API watchers for', Object.keys(setupResult).filter(k => k !== 'persistApi' && k !== 'toolInstanceId' && k !== 'fetch'))

    const stopFns = []

    // Watch all reactive values from setup
    Object.keys(setupResult).forEach(key => {
      const value = setupResult[key]

      // Skip persistApi, fetch, and toolInstanceId
      if (key === 'persistApi' || key === 'toolInstanceId' || key === 'fetch') return

      // Check if it's a ref or reactive object
      if (value && typeof value === 'object') {
        if ('value' in value) {
          // It's a ref - watch it
          const stopFn = vueWatch(
            () => value.value,
            (newValue) => {
              debugLog('[VueToolRenderer] Composition API auto-saving', key, '=', newValue)
              persist.set(key, newValue)
            },
            { deep: true }
          )
          stopFns.push(stopFn)
        } else {
          // It's a reactive object - watch it deeply
          const stopFn = vueWatch(
            () => ({ ...value }),
            (newValue) => {
              debugLog('[VueToolRenderer] Composition API auto-saving object', key)
              persist.set(key, newValue)
            },
            { deep: true }
          )
          stopFns.push(stopFn)
        }
      }
    })

    // Return cleanup function
    return () => stopFns.forEach(fn => fn())
  }

  /**
   * Build a Vue component from template and script (Options API)
   */
  function buildComponent(template, script, toolName, toolId, sessionId) {
    if (!script) {
      // Template-only component
      try {
        return defineComponent({ template })
      } catch (e) {
        throw new Error(`Template compilation failed: ${e.message}`)
      }
    }

    // Extract export default { ... }
    const match = script.match(/export\s+default\s+(\{[\s\S]*\})/)

    if (match) {
      try {
        const options = new Function(`return ${match[1]}`)()

        // Wrap the data() function to merge saved data
        const originalData = options.data
        const wrappedData = originalData
          ? function () {
              const initialData = typeof originalData === 'function' ? originalData.call(this) : originalData
              // Merge saved data into initial data
              const persist = storeFactory(toolName, toolId, sessionId)
              const savedData = persist.getState()
              debugLog('[VueToolRenderer] Restoring data for', toolName, toolId)
              return { ...initialData, ...savedData }
            }
          : () => ({})

        // Create wrapper component
        try {
          // Create the proxied fetch function
          const proxiedFetch = fetchFactory()

          return defineComponent({
            ...options,
            data: wrappedData,
            template,
            methods: options.methods || {},
            setup() {
              // Create persist store for this instance
              const persist = storeFactory(toolName, toolId, sessionId)

              debugLog('[VueToolRenderer] Options API setup -', toolName, toolId)

              // Override window.fetch with proxied version
              const originalFetch = window.fetch
              window.fetch = proxiedFetch

              // Run original setup if present
              const originalResult = options.setup ? options.setup() : {}

              // Inject persist API and instance ID
              return {
                ...originalResult,
                persistApi: persist,
                toolInstanceId: toolId
              }
            },
            mounted() {
              debugLog('[VueToolRenderer] Options API mounted -', this.toolInstanceId)
              // Set up auto-save watchers
              const cleanup = setupAutoSaveWatchers(this, this.persistApi)
              // Register cleanup
              watcherCleanups.value.push(cleanup)
              // Call original mounted if present
              if (options.mounted) {
                return options.mounted.call(this)
              }
            },
            unmounted() {
              // Call original unmounted if present
              if (options.unmounted) {
                return options.unmounted.call(this)
              }
            }
          })
        } catch (templateErr) {
          throw new Error(`Template compilation failed: ${templateErr.message}`)
        }
      } catch (e) {
        console.error('Options parse error:', e)
        throw new Error(`Script parsing failed: ${e.message}`)
      }
    }

    // Fallback: try to evaluate as setup-style code
    return buildSetupComponent(template, script, toolName, toolId, sessionId)
  }

  /**
   * Build a Vue component from template and script (Composition API fallback)
   */
  function buildSetupComponent(template, script, toolName, toolId, sessionId) {
    // Strip imports
    const clean = script.replace(/import\s*\{[^}]*\}\s*from\s*['"]vue['"]\s*;?/g, '')

    // Wrap in setup function - return all declared variables
    const names = [...script.matchAll(/\b(?:const|let|var|function)\s+([a-zA-Z_$]\w*)/g)].map(m => m[1])
    const filtered = names.filter(n => !['ref', 'reactive', 'computed', 'watch', 'onMounted'].includes(n))

    const setupCode = `
      const { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted } = Vue;
      ${clean}
      return { ${filtered.join(', ')} };
    `

    try {
      const setupFn = new Function('Vue', setupCode)
      const Vue = { ref, reactive, computed, watch, watchEffect: () => {}, onMounted: () => {}, onUnmounted: () => {} }

      // Wrap defineComponent in try-catch for template compilation errors
      try {
        // Create the proxied fetch function
        const proxiedFetch = fetchFactory()

        return defineComponent({
          setup() {
            // Override window.fetch with proxied version
            const originalFetch = window.fetch
            window.fetch = proxiedFetch

            // Create persist store for this instance
            const persist = storeFactory(toolName, toolId, sessionId)

            // Get saved data BEFORE running setup
            const savedData = persist.getState()

            debugLog('[VueToolRenderer] Composition API - saved data keys:', Object.keys(savedData))

            // Run the original setup function
            const originalResult = setupFn(Vue)

            // Restore saved data into refs/reactive objects
            Object.keys(savedData).forEach(key => {
              if (key === 'persistApi' || key === 'toolInstanceId') return
              const value = originalResult[key]
              if (value && typeof value === 'object') {
                if ('value' in value) {
                  debugLog('[VueToolRenderer] Restoring ref', key)
                  value.value = savedData[key]
                } else {
                  debugLog('[VueToolRenderer] Restoring reactive object', key)
                  Object.assign(value, savedData[key])
                }
              }
            })

            // Inject persist API and instance ID
            const result = {
              ...originalResult,
              persistApi: persist,
              toolInstanceId: toolId
            }

            // Set up auto-save watchers AFTER restoration
            nextTick(() => {
              const cleanup = setupAutoSaveForReactive(originalResult, persist)
              // Register cleanup
              watcherCleanups.value.push(cleanup)
            })

            return result
          },
          template,
          unmounted() {
            // Restore original fetch
            // Note: This simple approach may not work well with multiple tools
          }
        })
      } catch (templateErr) {
        throw new Error(`Template compilation failed: ${templateErr.message}`)
      }
    } catch (e) {
      console.error('Setup error:', e)
      throw new Error(`Script execution failed: ${e.message}`)
    }
  }

  /**
   * Compile tool code into a Vue component
   */
  function compile(code, toolName, toolId, sessionId) {
    debugLog('[useDynamicCompiler] Compiling tool:', toolName, toolId)
    error.value = null

    // Clean up old watchers
    cleanupWatchers()

    // Clean up old styles
    if (styleEl.value) {
      styleEl.value.remove()
      styleEl.value = null
    }

    // Don't try to compile empty code
    if (!code || !code.trim()) {
      error.value = 'Empty tool code'
      return
    }

    try {
      const { template, script, style } = parseToolCode(code)

      if (!template) {
        error.value = 'No <template> found in tool code'
        return
      }

      // Validate template syntax
      try {
        validateTemplate(template, compiler)
      } catch (validationErr) {
        error.value = validationErr.message
        console.error('Template validation error:', validationErr)
        compiledComponent.value = null
        return
      }

      // Inject scoped styles
      if (style && doc) {
        try {
          styleEl.value = doc.createElement('style')
          styleEl.value.textContent = scopeStyles(style, scopeId)
          doc.head.appendChild(styleEl.value)
        } catch (styleErr) {
          console.warn('Failed to inject styles:', styleErr)
          // Non-fatal, continue without styles
        }
      }

      // Build component
      try {
        compiledComponent.value = buildComponent(template, script, toolName, toolId, sessionId)
      } catch (buildErr) {
        error.value = `Component build error: ${buildErr.message}`
        console.error('Component build error:', buildErr)
        compiledComponent.value = null
      }
    } catch (e) {
      error.value = `Parse error: ${e.message}`
      console.error('Compile error:', e)
      compiledComponent.value = null
    }
  }

  /**
   * Clean up all active watchers
   */
  function cleanupWatchers() {
    watcherCleanups.value.forEach(cleanup => {
      try {
        cleanup()
      } catch (e) {
        // Ignore cleanup errors
      }
    })
    watcherCleanups.value = []
  }

  /**
   * Clean up all resources
   */
  function cleanup() {
    cleanupWatchers()
    if (styleEl.value) {
      styleEl.value.remove()
      styleEl.value = null
    }
  }

  return {
    // State
    compiledComponent,
    error,
    scopeId,

    // Methods
    compile,
    cleanup,

    // Internal (for testing)
    setupAutoSaveWatchers,
    setupAutoSaveForReactive,
    buildComponent,
    buildSetupComponent
  }
}
