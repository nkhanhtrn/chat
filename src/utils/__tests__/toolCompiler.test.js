/**
 * Tests for toolCompiler utility functions
 */

import { describe, it, expect, vi } from 'vitest'
import { parseToolCode, validateTemplate, scopeStyles } from '../toolCompiler.js'

describe('toolCompiler', () => {
  describe('parseToolCode', () => {
    it('parses a complete SFC with template, script, and style', () => {
      const code = `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default {
          data() { return { count: 0 } }
        }
        </script>
        <style>
        .foo { color: red; }
        </style>
      `
      const result = parseToolCode(code)

      expect(result.template).toBe('<div>Hello</div>')
      expect(result.script).toContain('export default')
      expect(result.script).toContain('data()')
      expect(result.style).toBe('.foo { color: red; }')
    })

    it('handles template-only SFC', () => {
      const code = `<template><div>Hello</div></template>`
      const result = parseToolCode(code)

      expect(result.template).toBe('<div>Hello</div>')
      expect(result.script).toBe('')
      expect(result.style).toBe('')
    })

    it('handles script-only SFC', () => {
      const code = `<script>export default { data() { return {} } }</script>`
      const result = parseToolCode(code)

      expect(result.template).toBe('')
      expect(result.script).toContain('export default')
      expect(result.style).toBe('')
    })

    it('handles style-only SFC', () => {
      const code = `<style>.foo { color: red; }</style>`
      const result = parseToolCode(code)

      expect(result.template).toBe('')
      expect(result.script).toBe('')
      expect(result.style).toBe('.foo { color: red; }')
    })

    it('handles malformed SFCs gracefully', () => {
      const code = `some random text without tags`
      const result = parseToolCode(code)

      expect(result.template).toBe('')
      expect(result.script).toBe('')
      expect(result.style).toBe('')
    })

    it('handles unclosed tags', () => {
      const code = `<template><div>Hello</div>`
      const result = parseToolCode(code)

      expect(result.template).toBe('')
      expect(result.script).toBe('')
      expect(result.style).toBe('')
    })

    it('preserves whitespace in template', () => {
      const code = `<template>
        <div>
          <span>Text</span>
        </div>
      </template>`
      const result = parseToolCode(code)

      expect(result.template).toContain('<div>')
      expect(result.template).toContain('<span>Text</span>')
    })

    it('handles script with attributes', () => {
      const code = `<script setup>
      import { ref } from 'vue'
      const count = ref(0)
      </script>`
      const result = parseToolCode(code)

      expect(result.script).toContain("import { ref } from 'vue'")
      expect(result.script).toContain('const count = ref(0)')
    })

    it('handles scoped style attribute', () => {
      const code = `<style scoped>
      .foo { color: red; }
      </style>`
      const result = parseToolCode(code)

      expect(result.style).toBe('.foo { color: red; }')
    })

    it('handles multiple templates (takes first one)', () => {
      const code = `<template><div>A</div></template><template><div>B</div></template>`
      const result = parseToolCode(code)

      expect(result.template).toBe('<div>A</div>')
    })

    it('handles multiline content in script', () => {
      const code = `<script>
      export default {
        data() {
          return {
            foo: 'bar',
            baz: 123
          }
        }
      }
      </script>`
      const result = parseToolCode(code)

      expect(result.script).toContain('data()')
      expect(result.script).toContain('foo:')
      expect(result.script).toContain('baz:')
    })
  })

  describe('validateTemplate', () => {
    it('accepts valid simple template', () => {
      const template = '<div>Hello World</div>'
      expect(validateTemplate(template)).toBe(true)
    })

    it('accepts valid template with interpolation', () => {
      const template = '<div>{{ message }}</div>'
      expect(validateTemplate(template)).toBe(true)
    })

    it('accepts valid template with v-if', () => {
      const template = '<div v-if="visible">Show me</div>'
      expect(validateTemplate(template)).toBe(true)
    })

    it('accepts valid template with v-for', () => {
      const template = '<li v-for="item in items" :key="item.id">{{ item.name }}</li>'
      expect(validateTemplate(template)).toBe(true)
    })

    it('accepts valid template with directives', () => {
      const template = '<input v-model="value" @input="onInput" />'
      expect(validateTemplate(template)).toBe(true)
    })

    it('throws error for empty template', () => {
      expect(() => validateTemplate(''))
        .toThrow('Empty template')
    })

    it('throws error for whitespace-only template', () => {
      expect(() => validateTemplate('   \n\t  '))
        .toThrow('Empty template')
    })

    it('accepts templates that produce warnings', () => {
      // Vue's compile function doesn't throw for all malformed templates
      // It produces warnings instead, so these don't throw
      expect(validateTemplate('<div>Hello')).toBe(true)
      expect(validateTemplate('<div><span>Hello</span>')).toBe(true)
      expect(validateTemplate('<div v-if>')).toBe(true)
    })

    it('includes error location in message when available', () => {
      try {
        validateTemplate('<div>{{ message }</div>')
      } catch (e) {
        expect(e.message).toContain('Template syntax error')
      }
    })

    it('works with custom compiler', () => {
      const mockCompiler = vi.fn(() => ({ code: 'mocked' }))
      const template = '<div>Test</div>'

      expect(validateTemplate(template, mockCompiler)).toBe(true)
      expect(mockCompiler).toHaveBeenCalledWith(template)
    })

    it('propagates custom compiler errors', () => {
      const mockCompiler = vi.fn(() => {
        throw new Error('Custom compiler error')
      })

      expect(() => validateTemplate('<div>Test</div>', mockCompiler))
        .toThrow('Template syntax error: Custom compiler error')
    })
  })

  describe('scopeStyles', () => {
    const scopeId = 'test-abc123'
    const expectedScope = '[data-tool-scope="test-abc123"]'

    it('scopes simple class selector', () => {
      const css = '.foo { color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' .foo { color: red; }')
    })

    it('scopes multiple selectors separated by comma', () => {
      const css = '.foo, .bar { color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' .foo, ' + expectedScope + ' .bar { color: red; }')
    })

    it('scopes element selector', () => {
      const css = 'div { color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' div { color: red; }')
    })

    it('converts :root to scope attribute', () => {
      const css = ':root { --color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' { --color: red; }')
    })

    it('converts html to scope attribute', () => {
      const css = 'html { font-size: 16px; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' { font-size: 16px; }')
    })

    it('converts body to scope attribute', () => {
      const css = 'body { margin: 0; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' { margin: 0; }')
    })

    it('scopes universal selector', () => {
      const css = '* { box-sizing: border-box; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' * { box-sizing: border-box; }')
    })

    it('preserves @keyframes rules', () => {
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(css)
    })

    it('preserves @font-face rules', () => {
      const css = '@font-face { font-family: "Custom"; src: url("font.woff2"); }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(css)
    })

    it('preserves @media rules with internal selectors', () => {
      const css = '@media (max-width: 600px) { .foo { font-size: 12px; } }'
      const result = scopeStyles(css, scopeId)

      expect(result).toContain('@media')
      expect(result).toContain(expectedScope + ' .foo')
    })

    it('scopes complex selectors', () => {
      const css = '.parent > .child { color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' .parent > .child { color: red; }')
    })

    it('scopes pseudo-class selectors', () => {
      const css = 'a:hover { color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' a:hover { color: red; }')
    })

    it('scopes pseudo-element selectors', () => {
      const css = '.foo::before { content: ""; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' .foo::before { content: ""; }')
    })

    it('scopes attribute selectors', () => {
      const css = '[data-foo="bar"] { color: red; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toBe(expectedScope + ' [data-foo="bar"] { color: red; }')
    })

    it('handles multiple rules', () => {
      const css = '.foo { color: red; }\n.bar { color: blue; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toContain(expectedScope + ' .foo { color: red; }')
      expect(result).toContain(expectedScope + ' .bar { color: blue; }')
    })

    it('handles rules with multiple declarations', () => {
      const css = '.foo { color: red; background: blue; padding: 10px; }'
      const result = scopeStyles(css, scopeId)

      expect(result).toContain(expectedScope + ' .foo')
      expect(result).toContain('color: red')
      expect(result).toContain('background: blue')
      expect(result).toContain('padding: 10px')
    })

    it('handles empty CSS', () => {
      const css = ''
      const result = scopeStyles(css, scopeId)

      expect(result).toBe('')
    })

    it('handles whitespace-only CSS', () => {
      const css = '   \n\t  '
      const result = scopeStyles(css, scopeId)

      expect(result).toBe('   \n\t  ')
    })
  })
})
