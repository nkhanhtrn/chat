import { describe, it, expect } from 'vitest'
import { parseToolFromResponse, parseToolEditFromResponse, applyToolEdits } from '../sfcParser'

describe('parseToolFromResponse', () => {
  it('returns null when no <template> is present', () => {
    expect(parseToolFromResponse('just some text')).toBeNull()
    expect(parseToolFromResponse('')).toBeNull()
  })

  it('extracts name and emoji from <!-- @tool: Name Emoji --> marker', () => {
    const result = parseToolFromResponse(
      `<!-- @tool: Calculator 🧮 -->\n<template><div>calc</div></template>\n<script>export default {}</script>`
    )
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Calculator')
    expect(result!.emoji).toBe('🧮')
  })

  it('extracts name without emoji', () => {
    const result = parseToolFromResponse(
      `<!-- @tool: Timer -->\n<template><div>timer</div></template>\n<script>export default {}</script>`
    )
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Timer')
    expect(result!.emoji).toBeNull()
  })

  it('extracts code between <template> and </style>', () => {
    const input = `<template><div>hi</div></template>\n<script>export default {}</script>\n<style>.a { color: red; }</style>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.code).toContain('<template>')
    expect(result!.code).toContain('</style>')
  })

  it('extracts code between <template> and </script> when no style', () => {
    const input = `<template><div>hi</div></template>\n<script>export default {}</script>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.code).toContain('<template>')
    expect(result!.code).toContain('</script>')
  })

  it('handles code wrapped in markdown fences', () => {
    const input = '```vue\n<template><div>fenced</div></template>\n<script>export default {}</script>\n```'
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.code).not.toContain('```')
    expect(result!.code).toContain('<template>')
  })

  it('strips :root { ... } from code', () => {
    const input = `<template><div>hi</div></template>\n<style>:root { --color: red; } .a { color: blue; }</style>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.code).not.toContain(':root')
    expect(result!.code).toContain('.a { color: blue; }')
  })

  it('falls back to component name from h1', () => {
    const input = `<template><h1>My Widget</h1></template>\n<script>export default {}</script>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('My Widget')
  })

  it('falls back to component name from name property', () => {
    const input = `<template><div>hi</div></template>\n<script>export default { name: 'CoolTool' }</script>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('CoolTool')
  })

  it('returns textBeforeCode for content before <template>', () => {
    const input = `Here is your tool:\n\n<template><div>hi</div></template>\n<script>export default {}</script>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.textBeforeCode).toBe('Here is your tool:')
  })

  it('sets textBeforeCode to empty when @tool marker precedes template', () => {
    const input = `<!-- @tool: Test -->\n<template><div>hi</div></template>\n<script>export default {}</script>`
    const result = parseToolFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.textBeforeCode).toBe('')
  })
})

describe('parseToolEditFromResponse', () => {
  it('returns null when no @tool marker', () => {
    expect(parseToolEditFromResponse('just text')).toBeNull()
  })

  it('returns null when @tool present but no @edit marker', () => {
    const input = '<!-- @tool: Calculator 🧮 -->\n<template><div>hi</div></template>'
    expect(parseToolEditFromResponse(input)).toBeNull()
  })

  it('returns null when @edit present but no search/replace blocks', () => {
    const input = '<!-- @tool: Calculator 🧮 -->\n<!-- @edit -->\nsome text'
    expect(parseToolEditFromResponse(input)).toBeNull()
  })

  it('parses a single search/replace patch', () => {
    const input = `<!-- @tool: Calculator 🧮 -->
<!-- @edit -->
<search>
<button>0</button>
</search>
<replace>
<button>{{ count }}</button>
</replace>`
    const result = parseToolEditFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Calculator')
    expect(result!.emoji).toBe('🧮')
    expect(result!.patches).toHaveLength(1)
    expect(result!.patches[0].search).toBe('<button>0</button>')
    expect(result!.patches[0].replace).toBe('<button>{{ count }}</button>')
  })

  it('parses multiple search/replace patches', () => {
    const input = `<!-- @tool: Calculator -->
<!-- @edit -->
<search>
count: 0
</search>
<replace>
count: 10
</replace>
<search>
increment() { this.count++ }
</search>
<replace>
increment() { this.count += 2 }
</replace>`
    const result = parseToolEditFromResponse(input)
    expect(result).not.toBeNull()
    expect(result!.patches).toHaveLength(2)
  })
})

describe('applyToolEdits', () => {
  it('applies a single patch', () => {
    const code = '<template>\n<button>0</button>\n</template>'
    const edit = parseToolEditFromResponse(`<!-- @tool: Test -->
<!-- @edit -->
<search>
<button>0</button>
</search>
<replace>
<button>{{ count }}</button>
</replace>`)!
    const result = applyToolEdits(code, edit)
    expect(result.code).toBe('<template>\n<button>{{ count }}</button>\n</template>')
    expect(result.applied).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('applies multiple patches in order', () => {
    const code = '<template>\n<h1>Hello</h1>\n<p>World</p>\n</template>'
    const edit = parseToolEditFromResponse(`<!-- @tool: Test -->
<!-- @edit -->
<search>
<h1>Hello</h1>
</search>
<replace>
<h1>Hi</h1>
</replace>
<search>
<p>World</p>
</search>
<replace>
<p>Universe</p>
</replace>`)!
    const result = applyToolEdits(code, edit)
    expect(result.code).toContain('<h1>Hi</h1>')
    expect(result.code).toContain('<p>Universe</p>')
    expect(result.code).not.toContain('Hello')
    expect(result.code).not.toContain('World')
    expect(result.applied).toBe(2)
    expect(result.failed).toBe(0)
  })

  it('reports failed patches when search not found', () => {
    const code = '<template><button>0</button></template>'
    const edit = parseToolEditFromResponse(`<!-- @tool: Test -->
<!-- @edit -->
<search>
not found text
</search>
<replace>
replacement
</replace>`)!
    const result = applyToolEdits(code, edit)
    expect(result.code).toBe(code)
    expect(result.applied).toBe(0)
    expect(result.failed).toBe(1)
  })
})
