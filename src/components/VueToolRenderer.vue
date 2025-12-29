<template>
  <div class="vue-tool-renderer themed-tool" :data-tool-scope="scopeId">
    <div v-if="error" class="error-message">
      <strong>Error:</strong> {{ error }}
    </div>
    <component v-else-if="compiledComponent" :is="compiledComponent" />
  </div>
</template>

<script setup>
import { ref, watch, shallowRef, defineComponent, onErrorCaptured, onUnmounted, provide, nextTick, watch as vueWatch } from 'vue'
import { useToolInstanceStore } from '../composables/studio/useToolInstanceStore.js'

const props = defineProps({
  code: { type: String, required: true },
  toolId: { type: String, default: () => `inst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` },  // Falls back to random ID for tests
  sessionId: { type: String, default: 'default' },  // Session ID for isolation
  toolName: { type: String, default: 'unknown' }
})

const compiledComponent = shallowRef(null)
const error = ref(null)
const styleEl = ref(null)

// Generate unique scope ID for this instance
const scopeId = `tool-${Math.random().toString(36).slice(2, 9)}`

// Scope CSS selectors to prevent style leakage
function scopeStyles(css) {
  const scopeAttr = `[data-tool-scope="${scopeId}"]`

  // Split by rules while preserving @-rules
  return css.replace(
    /([^{}@]+)(\{[^{}]*\})/g,
    (match, selectors, block) => {
      // Don't scope @keyframes content or @font-face
      if (selectors.trim().startsWith('@')) {
        return match
      }

      // Scope each selector
      const scopedSelectors = selectors
        .split(',')
        .map(sel => {
          sel = sel.trim()
          if (!sel) return sel

          // Handle :root, html, body - scope them to our container
          if (sel === ':root' || sel === 'html' || sel === 'body') {
            return scopeAttr
          }

          // Handle * selector
          if (sel === '*') {
            return `${scopeAttr} *`
          }

          // Prefix other selectors
          return `${scopeAttr} ${sel}`
        })
        .join(', ')

      return scopedSelectors + block
    }
  )
}

onErrorCaptured((err) => {
  error.value = err.message
  console.error('Component error:', err)
  return false
})

function compile(code) {
  error.value = null

  // Clean up old styles
  if (styleEl.value) {
    styleEl.value.remove()
    styleEl.value = null
  }

  try {
    const { template, script, style } = parse(code)

    if (!template) throw new Error('No template found')

    // Inject scoped styles
    if (style) {
      styleEl.value = document.createElement('style')
      styleEl.value.textContent = scopeStyles(style)
      document.head.appendChild(styleEl.value)
    }

    // Build component from Options API
    compiledComponent.value = buildComponent(template, script)
  } catch (e) {
    error.value = e.message
    console.error('Compile error:', e)
  }
}

function parse(code) {
  const template = code.match(/<template>([\s\S]*?)<\/template>/)?.[1]?.trim() || ''
  const script = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]?.trim() || ''
  const style = code.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]?.trim() || ''
  return { template, script, style }
}

function buildComponent(template, script) {
  if (!script) {
    return defineComponent({ template })
  }

  // Extract export default { ... }
  const match = script.match(/export\s+default\s+(\{[\s\S]*\})/)

  if (match) {
    try {
      const options = new Function(`return ${match[1]}`)()

      // Wrap the data() function to merge saved data before initial render
      const originalData = options.data
      const wrappedData = originalData
        ? function () {
            const initialData = typeof originalData === 'function' ? originalData.call(this) : originalData
            // Merge saved data into initial data
            const persist = useToolInstanceStore(props.toolName, props.toolId, props.sessionId)
            const savedData = persist.getState()
            console.log('[VueToolRenderer] Restoring data for', props.toolName, props.toolId, { initialData, savedData })
            return { ...initialData, ...savedData }
          }
        : () => ({})

      // Create wrapper component that injects persist API and auto-saves data
      return defineComponent({
        ...options,
        data: wrappedData,
        template,
        setup() {
          // Create persist store for this instance
          const persist = useToolInstanceStore(props.toolName, props.toolId, props.sessionId)

          console.log('[VueToolRenderer] Options API setup - toolName:', props.toolName, 'toolId:', props.toolId, 'persist:', persist)

          // Run original setup if present
          const originalResult = options.setup ? options.setup() : {}

          // Inject persist API and instance ID into the component (use non-reserved names)
          return {
            ...originalResult,
            persistApi: persist,
            toolInstanceId: props.toolId
          }
        },
        mounted() {
          console.log('[VueToolRenderer] Options API mounted - persistApi:', this.persistApi, 'toolInstanceId:', this.toolInstanceId)
          // Set up auto-save watchers for all data properties
          setupAutoSaveWatchers(this, this.persistApi)
          // Call original mounted if present
          if (options.mounted) {
            return options.mounted.call(this)
          }
        }
      })
    } catch (e) {
      console.error('Options parse error:', e)
    }
  }

  // Fallback: try to evaluate as setup-style code
  return buildSetupComponent(template, script)
}

function buildSetupComponent(template, script) {
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

    return defineComponent({
      setup() {
        // Create persist store for this instance
        const persist = useToolInstanceStore(props.toolName, props.toolId, props.sessionId)

        // Get saved data BEFORE running setup
        const savedData = persist.getState()

        console.log('[VueToolRenderer] Composition API - saved data:', savedData)

        // Run the original setup function
        const originalResult = setupFn(Vue)

        // Restore saved data into refs/reactive objects BEFORE setting up watchers
        Object.keys(savedData).forEach(key => {
          if (key === 'persistApi' || key === 'toolInstanceId') return
          const value = originalResult[key]
          if (value && typeof value === 'object') {
            if ('value' in value) {
              // It's a ref - restore its value
              console.log('[VueToolRenderer] Restoring ref', key, '=', savedData[key])
              value.value = savedData[key]
            } else {
              // It's a reactive object - merge saved data
              console.log('[VueToolRenderer] Restoring reactive object', key, savedData[key])
              Object.assign(value, savedData[key])
            }
          }
        })

        // Inject persist API and instance ID into the component (use non-reserved names)
        const result = {
          ...originalResult,
          persistApi: persist,
          toolInstanceId: props.toolId
        }

        // Set up auto-save watchers AFTER restoration (to avoid race condition)
        nextTick(() => {
          setupAutoSaveForReactive(originalResult, persist)
        })

        return result
      },
      template
    })
  } catch (e) {
    console.error('Setup error:', e)
    return defineComponent({ template })
  }
}

// Need to import these for the setup fallback
import { reactive, computed, watchEffect } from 'vue'

/**
 * Set up auto-save watchers for Options API component data properties
 */
function setupAutoSaveWatchers(componentInstance, persist) {
  if (!componentInstance?.$data || !persist) {
    console.log('[VueToolRenderer] setupAutoSaveWatchers skipped - no data or persist', { hasData: !!componentInstance?.$data, hasPersist: !!persist })
    return
  }

  console.log('[VueToolRenderer] Setting up auto-save watchers for', Object.keys(componentInstance.$data).filter(k => !k.startsWith('$') && !k.startsWith('_')))

  // Watch all data properties and auto-save changes
  Object.keys(componentInstance.$data).forEach(key => {
    // Skip internal properties
    if (key.startsWith('$') || key.startsWith('_')) return

    vueWatch(
      () => componentInstance.$data[key],
      (newValue) => {
        console.log('[VueToolRenderer] Auto-saving', key, '=', newValue)
        persist?.set?.(key, newValue)
      },
      { deep: true }
    )
  })
}

/**
 * Set up auto-save for Composition API reactive state
 */
function setupAutoSaveForReactive(setupResult, persist) {
  if (!setupResult || typeof setupResult !== 'object') return

  console.log('[VueToolRenderer] Setting up Composition API watchers for', Object.keys(setupResult).filter(k => k !== 'persistApi' && k !== 'toolInstanceId'))

  // Watch all reactive values from setup
  Object.keys(setupResult).forEach(key => {
    const value = setupResult[key]

    // Skip persistApi and toolInstanceId
    if (key === 'persistApi' || key === 'toolInstanceId') return

    // Check if it's a ref or reactive object
    if (value && typeof value === 'object') {
      if ('value' in value) {
        // It's a ref - watch it
        vueWatch(
          () => value.value,
          (newValue) => {
            console.log('[VueToolRenderer] Composition API auto-saving', key, '=', newValue)
            persist.set(key, newValue)
          },
          { deep: true }
        )
      } else {
        // It's a reactive object - watch it deeply
        vueWatch(
          () => ({ ...value }),
          (newValue) => {
            console.log('[VueToolRenderer] Composition API auto-saving object', key, newValue)
            persist.set(key, newValue)
          },
          { deep: true }
        )
      }
    }
  })
}

watch(() => props.code, compile, { immediate: true })

onUnmounted(() => {
  if (styleEl.value) styleEl.value.remove()
})
</script>

<style scoped>
.vue-tool-renderer {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-base);
  color: var(--color-text-base);
  font-family: inherit;
}

.vue-tool-renderer > :deep(*) {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--color-bg-base) !important;
}

.error-message {
  padding: 1rem;
  background: var(--color-error-bg, #fee2e2);
  color: var(--color-error-text, #991b1b);
  flex: none;
}

/* Theme base styles for generated components */
.themed-tool :deep(button) {
  background: var(--color-bg-button);
  color: var(--color-text-base);
  border: 1px solid var(--color-border-button);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font: inherit;
  transition: all 0.15s ease;
}

.themed-tool :deep(button:hover) {
  background: var(--color-bg-button-hover);
  border-color: var(--color-border-button-hover);
}

.themed-tool :deep(button:active) {
  background: var(--color-bg-button-active);
}

.themed-tool :deep(button.primary) {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.themed-tool :deep(button.primary:hover) {
  background: var(--color-primary-hover);
}

.themed-tool :deep(input),
.themed-tool :deep(textarea),
.themed-tool :deep(select) {
  background: var(--color-bg-input);
  color: var(--color-text-base);
  border: 1px solid var(--color-border-input);
  padding: 0.5rem 0.75rem;
  font: inherit;
}

.themed-tool :deep(input:focus),
.themed-tool :deep(textarea:focus),
.themed-tool :deep(select:focus) {
  outline: none;
  border-color: var(--color-primary);
}

.themed-tool :deep(input::placeholder),
.themed-tool :deep(textarea::placeholder) {
  color: var(--color-text-placeholder);
}
</style>
