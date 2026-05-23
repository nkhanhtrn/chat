import { ref, shallowRef, defineComponent, nextTick, watch as vueWatch, compile as compileTemplate, type Component } from 'vue'
import { parseToolCode, validateTemplate, scopeStyles } from '@/utils/toolCompiler'
import { createToolPersistence, type ToolPersistApi } from '@/services/builder/toolPersistence'
import { createProxiedFetch } from '@/services/builder/toolFetch'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

const TYPE_MARKERS = {
  DATE: '__date__',
  MAP: '__map__',
  SET: '__set__',
  REGEXP: '__regexp__',
} as const

function deepSerialize(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (seen.has(obj as object)) return '[Circular]'
  seen.add(obj as object)

  if (obj instanceof Date) return { [TYPE_MARKERS.DATE]: obj.toISOString() }
  if (obj instanceof Map) return { [TYPE_MARKERS.MAP]: Array.from(obj.entries()) }
  if (obj instanceof Set) return { [TYPE_MARKERS.SET]: Array.from(obj) }
  if (obj instanceof RegExp) return { [TYPE_MARKERS.REGEXP]: { source: obj.source, flags: obj.flags } }

  if (Array.isArray(obj)) return obj.map(item => deepSerialize(item, seen))

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('__v_') || key === '__ob__' || key === '__proto__') continue
    try { result[key] = deepSerialize(value, seen) } catch { /* skip */ }
  }
  return result
}

function deepDeserialize(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj

  if (typeof obj === 'string') {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
    if (isoDateRegex.test(obj)) {
      const d = new Date(obj)
      if (!isNaN(d.getTime())) return d
    }
    return obj
  }

  const o = obj as Record<string, unknown>
  if (TYPE_MARKERS.DATE in o) return new Date(o[TYPE_MARKERS.DATE] as string)
  if (TYPE_MARKERS.MAP in o) return new Map(o[TYPE_MARKERS.MAP] as [unknown, unknown][])
  if (TYPE_MARKERS.SET in o) return new Set(o[TYPE_MARKERS.SET] as unknown[])
  if (TYPE_MARKERS.REGEXP in o) {
    const { source, flags } = o[TYPE_MARKERS.REGEXP] as { source: string; flags: string }
    return new RegExp(source, flags)
  }

  if (Array.isArray(obj)) return obj.map(deepDeserialize)

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepDeserialize(value)
  }
  return result
}

export interface DynamicCompilerOptions {
  projectId: string
  windowId: string
}

export function useDynamicCompiler(options: DynamicCompilerOptions) {
  const { projectId, windowId } = options

  const compiledComponent = shallowRef<Component | null>(null)
  const error = ref<string | null>(null)
  const styleEl = ref<HTMLStyleElement | null>(null)
  const watcherCleanups = ref<(() => void)[]>([])

  const scopeId = `tool-${Math.random().toString(36).slice(2, 9)}`
  let lastCodeHash: string | null = null

  let persistApi: ToolPersistApi | null = null
  let componentInstance: any = null

  function getPersistApi(): ToolPersistApi {
    if (!persistApi) {
      persistApi = createToolPersistence(projectId, windowId)
    }
    return persistApi
  }

  function setupAutoSaveWatchers(
    componentInstance: any,
    persist: ToolPersistApi,
    persistKeys: string[] | undefined,
  ): () => void {
    if (!componentInstance?.$data) return () => {}

    let keysToWatch: string[]
    if (persistKeys && Array.isArray(persistKeys)) {
      keysToWatch = persistKeys
    } else {
      const tempKeys = ['loading', 'isLoading', 'error', 'isError', 'temp', 'tmp', 'hovered', 'focused']
      keysToWatch = Object.keys(componentInstance.$data).filter(k => {
        if (k.startsWith('$') || k.startsWith('_')) return false
        if (tempKeys.some(t => k === t || k.startsWith(t))) return false
        return true
      })
    }

    const stopFns: (() => void)[] = []

    nextTick(() => {
      for (const key of keysToWatch) {
        if (!(key in componentInstance.$data)) continue
        const stopFn = vueWatch(
          () => componentInstance.$data[key],
          (newValue: unknown) => {
            persist.set(key, deepSerialize(newValue))
          },
          { deep: true },
        )
        stopFns.push(stopFn)
      }
    })

    return () => stopFns.forEach(fn => fn())
  }

  function buildComponent(
    template: string,
    script: string,
    preLoadedState: Record<string, unknown> | null,
  ): Component {
    if (!script) {
      return defineComponent({ template, components: { MarkdownRenderer } })
    }

    if (!/export\s+default\s+\{[\s\S]*\}/.test(script)) {
      return defineComponent({ template, components: { MarkdownRenderer } })
    }

    const transformedScript = script.replace(/export\s+default\s+(?=\{)/, 'return ')
    const options = new Function(transformedScript)()
    const persistKeys: string[] | undefined = options.persistKeys

    let savedState = (deepDeserialize(preLoadedState || {}) ?? {}) as Record<string, unknown>

    if (Array.isArray(persistKeys)) {
      if (persistKeys.length === 0) {
        savedState = {}
      } else {
        const filtered: Record<string, unknown> = {}
        for (const key of persistKeys) {
          if (key in savedState) filtered[key] = savedState[key]
        }
        savedState = filtered
      }
    }

    const originalData = options.data
    const wrappedData = originalData
      ? function (this: any) {
          const initial = typeof originalData === 'function' ? originalData.call(this) : originalData
          return { ...initial, ...savedState }
        }
      : () => ({})

    const proxiedFetch = createProxiedFetch()
    const persist = getPersistApi()

    function wrapWithFetchProxy<T extends (...args: any[]) => any>(fn: T): T {
      return function (this: any, ...args: any[]) {
        const prev = window.fetch
        window.fetch = proxiedFetch as typeof fetch
        try {
          return fn.apply(this, args)
        } finally {
          window.fetch = prev
        }
      } as T
    }

    function wrapMethods(obj: Record<string, any>): Record<string, any> {
      const result: Record<string, any> = {}
      for (const key of Object.keys(obj)) {
        const val = obj[key]
        if (typeof val === 'function') {
          result[key] = wrapWithFetchProxy(val)
        } else {
          result[key] = val
        }
      }
      return result
    }

    const wrappedMethods = options.methods ? wrapMethods(options.methods) : {}
    const wrappedMounted = options.mounted ? wrapWithFetchProxy(options.mounted) : undefined
    const wrappedCreated = options.created ? wrapWithFetchProxy(options.created) : undefined
    const wrappedUnmounted = options.unmounted ? wrapWithFetchProxy(options.unmounted) : undefined
    const wrappedSetup = options.setup ? wrapWithFetchProxy(options.setup) : undefined

    return defineComponent({
      ...options,
      components: { ...options.components, MarkdownRenderer },
      data: wrappedData,
      template,
      methods: wrappedMethods,
      created: wrappedCreated,
      mounted(this: any) {
        componentInstance = this
        const cleanup = setupAutoSaveWatchers(this, this.persistApi, options.persistKeys)
        watcherCleanups.value.push(cleanup)
        if (wrappedMounted) return wrappedMounted.call(this)
      },
      unmounted: wrappedUnmounted,
      setup() {
        const canvasApi = {
          openTool(nameOrId: string, data?: Record<string, unknown>) {
            window.dispatchEvent(new CustomEvent('tool-open-request', {
              detail: { toolName: nameOrId, sourceWindowId: windowId, data },
            }))
          },
        }
        return {
          persistApi: persist,
          toolInstanceId: windowId,
          canvasApi,
        }
      },
    })
  }

  async function compile(code: string): Promise<void> {
    error.value = null

    if (!code || typeof code !== 'string' || !code.trim()) {
      lastCodeHash = null
      cleanupWatchers()
      if (styleEl.value) {
        styleEl.value.remove()
        styleEl.value = null
      }
      compiledComponent.value = null
      error.value = 'Empty tool code'
      return
    }

    const codeHash = code
    if (codeHash === lastCodeHash && compiledComponent.value) return
    lastCodeHash = codeHash

    cleanupWatchers()

    if (styleEl.value) {
      styleEl.value.remove()
      styleEl.value = null
    }

    try {
      const { template, script, style } = parseToolCode(code)

      if (!template) {
        error.value = 'No <template> found in tool code'
        return
      }

      try {
        validateTemplate(template, compileTemplate)
      } catch (validationErr: any) {
        error.value = validationErr.message
        compiledComponent.value = null
        return
      }

      if (style && typeof document !== 'undefined') {
        try {
          styleEl.value = document.createElement('style')
          styleEl.value.textContent = scopeStyles(style, scopeId)
          document.head.appendChild(styleEl.value)
        } catch { /* non-fatal */ }
      }

      let preLoadedState: Record<string, unknown> | null = null
      try {
        preLoadedState = (await getPersistApi().getState()) as Record<string, unknown>
      } catch { /* continue without state */ }

      try {
        compiledComponent.value = buildComponent(template, script, preLoadedState)
      } catch (buildErr: any) {
        error.value = `Component build error: ${buildErr.message}`
        compiledComponent.value = null
      }
    } catch (e: any) {
      error.value = `Parse error: ${e.message}`
      compiledComponent.value = null
    }
  }

  function cleanupWatchers() {
    watcherCleanups.value.forEach(cleanup => { try { cleanup() } catch { /* ignore */ } })
    watcherCleanups.value = []
  }

  function cleanup() {
    lastCodeHash = null
    componentInstance = null
    cleanupWatchers()
    if (styleEl.value) {
      styleEl.value.remove()
      styleEl.value = null
    }
  }

  function pushState(state: Record<string, unknown>): void {
    if (!componentInstance?.$data) return
    const persistKeys: string[] | undefined = (componentInstance.$options as any)?.persistKeys
    const keysToApply = persistKeys
      ? Object.entries(state).filter(([k]) => persistKeys.includes(k))
      : Object.entries(state)
    for (const [key, value] of keysToApply) {
      if (key in componentInstance.$data) {
        componentInstance.$data[key] = value
      }
    }
  }

  return {
    compiledComponent,
    error,
    scopeId,
    compile,
    cleanup,
    pushState,
  }
}
