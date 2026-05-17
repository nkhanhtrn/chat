import { describe, it, expect } from 'vitest'
import { parseToolCode, validateTemplate, scopeStyles } from '../toolCompiler'

describe('parseToolCode', () => {
  it('extracts template, script, and style sections', () => {
    const code = `<template><div>hello</div></template>
<script>export default { data() { return { msg: 'hi' } } }</script>
<style>.container { color: red; }</style>`
    const result = parseToolCode(code)
    expect(result.template).toBe('<div>hello</div>')
    expect(result.script).toBe("export default { data() { return { msg: 'hi' } } }")
    expect(result.style).toBe('.container { color: red; }')
  })

  it('handles missing script', () => {
    const code = `<template><div>hello</div></template>\n<style>.a { color: blue; }</style>`
    const result = parseToolCode(code)
    expect(result.template).toBe('<div>hello</div>')
    expect(result.script).toBe('')
    expect(result.style).toBe('.a { color: blue; }')
  })

  it('handles missing style', () => {
    const code = `<template><div>hello</div></template>\n<script>export default {}</script>`
    const result = parseToolCode(code)
    expect(result.template).toBe('<div>hello</div>')
    expect(result.script).toBe('export default {}')
    expect(result.style).toBe('')
  })

  it('handles empty input', () => {
    const result = parseToolCode('')
    expect(result.template).toBe('')
    expect(result.script).toBe('')
    expect(result.style).toBe('')
  })
})

describe('validateTemplate', () => {
  it('passes for valid templates', () => {
    expect(validateTemplate('<div>hello</div>')).toBe(true)
    expect(validateTemplate('<span>{{ msg }}</span>')).toBe(true)
  })

  it('throws for empty templates', () => {
    expect(() => validateTemplate('')).toThrow('Empty template')
    expect(() => validateTemplate('   ')).toThrow('Empty template')
  })

  it('throws for invalid templates', () => {
    const mockCompiler = () => {
      const err: any = new Error('Compilation failed')
      err.loc = { start: { line: 1, column: 0 } }
      throw err
    }
    expect(() => validateTemplate('<div>bad</div>', mockCompiler)).toThrow(
      'Template syntax error: Compilation failed'
    )
  })
})

describe('scopeStyles', () => {
  it('adds scope attribute to CSS selectors', () => {
    const css = '.container { color: red; }'
    const result = scopeStyles(css, 'abc123')
    expect(result).toContain('[data-tool-scope="abc123"]')
    expect(result).toContain('[data-tool-scope="abc123"] .container { color: red; }')
  })

  it('replaces :root, html, body selectors with scope attribute', () => {
    const css = ':root { --x: 1; }\nbody { margin: 0; }'
    const result = scopeStyles(css, 'test')
    expect(result).not.toContain(':root')
    expect(result).not.toContain('body')
    expect(result).toContain('[data-tool-scope="test"]')
  })

  it('handles * selector', () => {
    const css = '* { box-sizing: border-box; }'
    const result = scopeStyles(css, 'scope1')
    expect(result).toContain('[data-tool-scope="scope1"] *')
  })

  it('preserves @keyframes rules', () => {
    const css = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n.box { animation: spin 1s; }'
    const result = scopeStyles(css, 'scope2')
    expect(result).toContain('@keyframes spin')
    expect(result).toContain('[data-tool-scope="scope2"] .box')
  })

  it('handles multiple selectors separated by commas', () => {
    const css = '.a, .b { color: red; }'
    const result = scopeStyles(css, 's')
    expect(result).toContain('[data-tool-scope="s"] .a')
    expect(result).toContain('[data-tool-scope="s"] .b')
  })
})
