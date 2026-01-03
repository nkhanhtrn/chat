/**
 * Composable for dynamically compiling Vue tool components at runtime.
 * Provides dependency injection for testability.
 */

import { ref, shallowRef, defineComponent, nextTick, watch as vueWatch, watch, compile as compileTemplate } from 'vue'
import { parseToolCode, validateTemplate, scopeStyles } from '../utils/toolCompiler.js'
import { createProxiedFetch } from '../utils/toolFetch.js'
import { reactive, computed, watchEffect } from 'vue'

/**
 * Special type markers for serialization
 */
const TYPE_MARKERS = {
  DATE: '__date__',
  MAP: '__map__',
  SET: '__set__',
  REGEXP: '__regexp__'
}

/**
 * Serialize a value for storage, preserving type information
 */
function serializeValue(value) {
  if (value instanceof Date) {
    return { [TYPE_MARKERS.DATE]: value.toISOString() }
  }
  if (value instanceof Map) {
    return { [TYPE_MARKERS.MAP]: Array.from(value.entries()) }
  }
  if (value instanceof Set) {
    return { [TYPE_MARKERS.SET]: Array.from(value) }
  }
  if (value instanceof RegExp) {
    return { [TYPE_MARKERS.REGEXP]: { source: value.source, flags: value.flags } }
  }
  // For other objects (including arrays), return as-is (JSON.stringify will handle)
  return value
}

/**
 * Deserialize a value from storage, restoring type information
 */
function deserializeValue(value) {
  // Handle null and primitives first
  if (value === null) {
    return value
  }

  // Check for ISO date strings (legacy support for old saved data)
  // Must check before the object check since strings are primitives
  if (typeof value === 'string') {
    // More specific ISO 8601 date regex
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
    if (isoDateRegex.test(value)) {
      const date = new Date(value)
      // Validate that it's a valid date
      if (!isNaN(date.getTime())) {
        return date
      }
    }
    return value
  }

  // Handle objects with type markers
  if (typeof value === 'object') {
    // Check for type markers
    if (TYPE_MARKERS.DATE in value) {
      return new Date(value[TYPE_MARKERS.DATE])
    }
    if (TYPE_MARKERS.MAP in value) {
      return new Map(value[TYPE_MARKERS.MAP])
    }
    if (TYPE_MARKERS.SET in value) {
      return new Set(value[TYPE_MARKERS.SET])
    }
    if (TYPE_MARKERS.REGEXP in value) {
      const { source, flags } = value[TYPE_MARKERS.REGEXP]
      return new RegExp(source, flags)
    }
  }

  return value
}

/**
 * Deep serialize an object for storage
 * Handles circular references using WeakSet
 */
function deepSerialize(obj, seen = new WeakSet()) {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return serializeValue(obj)
  }

  // Handle circular references
  if (seen.has(obj)) {
    return '[Circular]'
  }
  seen.add(obj)

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSerialize(item, seen))
  }

  // Handle special objects before processing as plain object
  const serialized = serializeValue(obj)
  // If serializeValue returned a special format, return it
  if (serialized !== obj) {
    return serialized
  }

  // Handle plain objects
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip internal Vue properties
    if (key.startsWith('__v_') || key === '__ob__' || key === '__proto__') {
      continue
    }
    try {
      result[key] = deepSerialize(value, seen)
    } catch (e) {
      // Skip properties that can't be serialized
      console.warn('[deepSerialize] Failed to serialize key:', key, e)
    }
  }
  return result
}

/**
 * Deep deserialize an object from storage
 */
function deepDeserialize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return deserializeValue(obj)
  }

  // Check if this is a serialized special type
  if (TYPE_MARKERS.DATE in obj || TYPE_MARKERS.MAP in obj ||
      TYPE_MARKERS.SET in obj || TYPE_MARKERS.REGEXP in obj) {
    return deserializeValue(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(deepDeserialize)
  }

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepDeserialize(value)
  }
  return result
}

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
  function setupAutoSaveWatchers(componentInstance, persist, persistKeys = null) {
    if (!componentInstance?.$data || !persist) {
      debugLog('[VueToolRenderer] setupAutoSaveWatchers skipped - no data or persist')
      return () => {}
    }

    // Determine which keys to watch
    let keysToWatch
    if (persistKeys && Array.isArray(persistKeys)) {
      // Explicit list of keys to persist
      keysToWatch = persistKeys
      debugLog('[VueToolRenderer] Auto-saving explicit keys:', keysToWatch)
    } else {
      // Auto-detect: skip internal properties and common temp/state variables
      const commonTempKeys = ['loading', 'isLoading', 'error', 'isError', 'temp', 'tmp', 'hovered', 'focused']
      keysToWatch = Object.keys(componentInstance.$data).filter(k => {
        if (k.startsWith('$') || k.startsWith('_')) return false
        if (commonTempKeys.some(temp => k === temp || k.startsWith(temp))) return false
        return true
      })
      debugLog('[VueToolRenderer] Auto-saving detected keys:', keysToWatch)
    }

    const stopFns = []

    // Wait for next tick before setting up watchers to avoid saving during restoration
    nextTick(() => {
      // Watch only the specified keys
      keysToWatch.forEach(key => {
        if (!(key in componentInstance.$data)) {
          console.warn('[VueToolRenderer] Key not found in data:', key)
          return
        }

        const stopFn = vueWatch(
          () => componentInstance.$data[key],
          (newValue) => {
            persist?.set?.(key, deepSerialize(newValue))
          },
          { deep: true }
        )
        stopFns.push(stopFn)
      })
    })

    // Return cleanup function
    return () => stopFns.forEach(fn => fn())
  }

  /**
   * Set up auto-save for Composition API reactive state
   * Returns a cleanup function to stop all watchers
   */
  function setupAutoSaveForReactive(setupResult, persist, persistKeys = null) {
    if (!setupResult || typeof setupResult !== 'object') return () => {}

    // Determine which keys to watch
    let keysToWatch
    if (persistKeys && Array.isArray(persistKeys)) {
      keysToWatch = persistKeys
      debugLog('[VueToolRenderer] Composition API - explicit keys:', keysToWatch)
    } else {
      const commonTempKeys = ['loading', 'isLoading', 'error', 'isError', 'temp', 'tmp', 'hovered', 'focused']
      keysToWatch = Object.keys(setupResult).filter(k => {
        if (k === 'persistApi' || k === 'toolInstanceId' || k === 'fetch') return false
        if (k.startsWith('$') || k.startsWith('_')) return false
        if (commonTempKeys.some(temp => k === temp || k.startsWith(temp))) return false
        return true
      })
      debugLog('[VueToolRenderer] Composition API - detected keys:', keysToWatch)
    }

    const stopFns = []

    // Wait for next tick before setting up watchers to avoid saving during restoration
    nextTick(() => {
      // Watch only the specified keys
      keysToWatch.forEach(key => {
        const value = setupResult[key]

        if (!(key in setupResult)) {
          console.warn('[VueToolRenderer] Key not found in setup:', key)
          return
        }

        // Check if it's a ref or reactive object
        if (value && typeof value === 'object') {
          if ('value' in value) {
            // It's a ref - watch it
            const stopFn = vueWatch(
              () => value.value,
              (newValue) => {
                debugLog('[VueToolRenderer] Composition API auto-saving', key)
                persist.set(key, deepSerialize(newValue))
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
                persist.set(key, deepSerialize(newValue))
              },
              { deep: true }
            )
            stopFns.push(stopFn)
          }
        }
      })
    })

    // Return cleanup function
    return () => stopFns.forEach(fn => fn())
  }

  /**
   * Build a Vue component from template and script (Options API)
   * @param {string} template - Vue template string
   * @param {string} script - Vue script string
   * @param {string} toolName - Name of the tool
   * @param {string} toolId - Unique tool instance ID
   * @param {string} sessionId - Session ID
   * @param {Object} preLoadedState - Pre-loaded saved state (optional)
   */
  function buildComponent(template, script, toolName, toolId, sessionId, preLoadedState = null) {
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

        // Get persistKeys option to filter restored data
        const persistKeys = options.persistKeys

        // Wrap the data() function to merge saved data
        const originalData = options.data
        // Store pre-loaded state in closure (data() runs before setup(), so can't use this)
        // Deep deserialize to restore Date, Map, Set, RegExp objects
        let savedStateForData = deepDeserialize(preLoadedState || {})

        // Filter saved state to only include keys in persistKeys
        // If persistKeys is an empty array, don't restore any saved data
        if (Array.isArray(persistKeys)) {
          if (persistKeys.length === 0) {
            savedStateForData = {}
          } else {
            const filtered = {}
            for (const key of persistKeys) {
              if (key in savedStateForData) {
                filtered[key] = savedStateForData[key]
              }
            }
            savedStateForData = filtered
          }
        }

        const wrappedData = originalData
          ? function () {
              const initialData = typeof originalData === 'function' ? originalData.call(this) : originalData
              return { ...initialData, ...savedStateForData }
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
              // Set up auto-save watchers with persistKeys option if specified
              const cleanup = setupAutoSaveWatchers(this, this.persistApi, options.persistKeys)
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
   * @param {string} template - Vue template string
   * @param {string} script - Vue script string
   * @param {string} toolName - Name of the tool
   * @param {string} toolId - Unique tool instance ID
   * @param {string} sessionId - Session ID
   * @param {Object} preLoadedState - Pre-loaded saved state (optional)
   */
  function buildSetupComponent(template, script, toolName, toolId, sessionId, preLoadedState = null) {
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

            // Run the original setup function
            const originalResult = setupFn(Vue)

            // Get persistKeys before restoration to filter saved data
            const persistKeys = originalResult._persistKeys || null
            // Remove _persistKeys from result so it's not exposed to template
            delete originalResult._persistKeys

            // Use pre-loaded state if provided, otherwise fall back to sync getter
            // Deep deserialize to restore Date, Map, Set, RegExp objects
            let savedData = deepDeserialize(preLoadedState || persist.getStateSync?.() || {})

            // Filter saved data to only include keys in persistKeys
            // If persistKeys is an empty array, don't restore any saved data
            if (Array.isArray(persistKeys)) {
              if (persistKeys.length === 0) {
                savedData = {}
              } else {
                const filtered = {}
                for (const key of persistKeys) {
                  if (key in savedData) {
                    filtered[key] = savedData[key]
                  }
                }
                savedData = filtered
              }
            }

            debugLog('[VueToolRenderer] Composition API - saved data keys:', Object.keys(savedData))

            // Restore saved data into refs/reactive objects
            Object.keys(savedData).forEach(key => {
              if (key === 'persistApi' || key === 'toolInstanceId') return
              const value = originalResult[key]
              const savedValue = savedData[key]

              if (value && typeof value === 'object') {
                if ('value' in value) {
                  // It's a ref - restore the value (already deserialized)
                  debugLog('[VueToolRenderer] Restoring ref', key)
                  value.value = savedValue
                } else {
                  // It's a reactive object - assign all properties
                  debugLog('[VueToolRenderer] Restoring reactive object', key)
                  Object.assign(value, savedValue)
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
              const cleanup = setupAutoSaveForReactive(originalResult, persist, persistKeys)
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
   * Pre-loads saved state before building to ensure data is available on component mount
   */
  async function compile(code, toolName, toolId, sessionId) {
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
    if (!code || typeof code !== 'string' || !code.trim()) {
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

      // Pre-load state from IndexedDB before building component
      let preLoadedState = null
      if (storeFactory && toolId) {
        try {
          const persist = storeFactory(toolName, toolId, sessionId)
          preLoadedState = await persist.getState()
        } catch (err) {
          console.warn('[useDynamicCompiler] Failed to pre-load state:', err)
          // Continue without pre-loaded state
        }
      }

      // Build component with pre-loaded state
      try {
        compiledComponent.value = buildComponent(template, script, toolName, toolId, sessionId, preLoadedState)
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
