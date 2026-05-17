import { describe, it, expect } from 'vitest'
import { parseToolFromResponse } from '../sfcParser'

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
