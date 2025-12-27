<template>
  <div class="vue-tool-renderer themed-tool">
    <div v-if="error" class="error-message">
      <strong>Error:</strong> {{ error }}
    </div>
    <component v-else-if="compiledComponent" :is="compiledComponent" />
  </div>
</template>

<script setup>
import { ref, watch, shallowRef, defineComponent, onErrorCaptured, onUnmounted } from 'vue'

const props = defineProps({
  code: { type: String, required: true }
})

const compiledComponent = shallowRef(null)
const error = ref(null)
const styleEl = ref(null)

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

    // Inject styles
    if (style) {
      styleEl.value = document.createElement('style')
      styleEl.value.textContent = style
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
      return defineComponent({ ...options, template })
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
      setup: () => setupFn(Vue),
      template
    })
  } catch (e) {
    console.error('Setup error:', e)
    return defineComponent({ template })
  }
}

// Need to import these for the setup fallback
import { reactive, computed, watchEffect } from 'vue'

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
