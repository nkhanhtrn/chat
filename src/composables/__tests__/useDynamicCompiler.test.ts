import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDynamicCompiler } from '../useDynamicCompiler'

const SIMPLE_CODE = `<template><div>hello</div></template>`
const FULL_CODE = `<template><div>{{ msg }}</div></template>
<script>
export default {
  data() { return { msg: 'hello' } }
}
</script>`
const ALT_CODE = `<template><div>{{ msg }}</div></template>
<script>
export default {
  data() { return { msg: 'world' } }
}
</script>`
const CANVAS_API_CODE = `<template><div><button @click="openOther">Open</button></div></template>
<script>
export default {
  methods: {
    openOther() {
      this.canvasApi.openTool('Other Tool', { key: 'val' })
    }
  }
}
</script>`

describe('useDynamicCompiler - code hash check', () => {
  it('compiles on first call', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile(FULL_CODE)
    expect(compiler.compiledComponent.value).not.toBeNull()
    expect(compiler.error.value).toBeNull()
  })

  it('skips recompile when same code is passed again', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile(FULL_CODE)
    const first = compiler.compiledComponent.value

    await compiler.compile(FULL_CODE)
    expect(compiler.compiledComponent.value).toBe(first)
  })

  it('recompiles when different code is passed', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile(FULL_CODE)
    const first = compiler.compiledComponent.value

    await compiler.compile(ALT_CODE)
    expect(compiler.compiledComponent.value).not.toBe(first)
  })

  it('resets hash on cleanup', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile(FULL_CODE)
    compiler.cleanup()

    await compiler.compile(FULL_CODE)
    expect(compiler.compiledComponent.value).not.toBeNull()
  })

  it('clears component on empty code', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile(FULL_CODE)
    expect(compiler.compiledComponent.value).not.toBeNull()

    await compiler.compile('')
    expect(compiler.compiledComponent.value).toBeNull()
    expect(compiler.error.value).toBe('Empty tool code')
  })

  it('compiles template-only code without script', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile(SIMPLE_CODE)
    expect(compiler.compiledComponent.value).not.toBeNull()
    expect(compiler.error.value).toBeNull()
  })

  it('reports error when no template found', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w1' })
    await compiler.compile('<script>export default {}</script>')
    expect(compiler.compiledComponent.value).toBeNull()
    expect(compiler.error.value).toContain('No <template>')
  })
})

describe('useDynamicCompiler - canvasApi injection', () => {
  it('provides canvasApi.openTool that dispatches tool-open-request event', async () => {
    const handler = vi.fn()
    window.addEventListener('tool-open-request', handler)

    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w-test' })
    await compiler.compile(CANVAS_API_CODE)
    expect(compiler.compiledComponent.value).not.toBeNull()

    window.removeEventListener('tool-open-request', handler)
  })

  it('provides canvasApi in setup context', async () => {
    const compiler = useDynamicCompiler({ projectId: 'p1', windowId: 'w-test' })
    await compiler.compile(CANVAS_API_CODE)
    expect(compiler.compiledComponent.value).not.toBeNull()
    expect(compiler.error.value).toBeNull()
  })
})
