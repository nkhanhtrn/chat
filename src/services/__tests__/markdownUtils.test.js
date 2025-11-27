import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  escapeHtml,
  renderMath,
  extractCodeBlocks,
  extractMathBlocks,
  extractInlineMath,
  extractInlineCode,
  replacePlaceholders,
  processMarkdown
} from '../markdownUtils.js'

describe('markdownUtils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>'
      const result = escapeHtml(input)
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
    })

    it('should escape ampersands', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B')
    })

    it('should escape quotes', () => {
      expect(escapeHtml('"Hello"')).toBe('&quot;Hello&quot;')
    })

    it('should escape apostrophes', () => {
      expect(escapeHtml("It's")).toBe('It&#039;s')
    })

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should handle plain text without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })

    it('should escape multiple special characters', () => {
      const input = '<div class="test">A & B</div>'
      const result = escapeHtml(input)
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
      expect(result).toContain('&amp;')
    })
  })

  describe('renderMath', () => {
    beforeEach(() => {
      // Mock KaTeX
      global.window = {
        katex: {
          renderToString: vi.fn((math, options) => `<span class="katex">${math}</span>`)
        }
      }
    })

    afterEach(() => {
      delete global.window
    })

    it('should render math using KaTeX when available', () => {
      const result = renderMath('E = mc^2', false)
      expect(result).toBe('<span class="katex">E = mc^2</span>')
      expect(window.katex.renderToString).toHaveBeenCalledWith('E = mc^2', {
        displayMode: false,
        throwOnError: false
      })
    })

    it('should use displayMode for block math', () => {
      renderMath('\\sum_{i=1}^{n} i', true)
      expect(window.katex.renderToString).toHaveBeenCalledWith('\\sum_{i=1}^{n} i', {
        displayMode: true,
        throwOnError: false
      })
    })

    it('should fallback to escaped HTML when KaTeX is not available', () => {
      delete global.window
      const result = renderMath('E = mc^2', false)
      expect(result).toBe('E = mc^2')
    })

    it('should handle KaTeX rendering errors', () => {
      global.window.katex.renderToString = vi.fn(() => {
        throw new Error('Invalid math')
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = renderMath('invalid', false)
      expect(result).toBe('invalid')
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('extractCodeBlocks', () => {
    it('should extract code blocks with language', () => {
      const input = '# Title\n```javascript\nconsole.log("test")\n```\nText'
      const { processed, blocks } = extractCodeBlocks(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        id: 'CODE_BLOCK_0',
        lang: 'javascript',
        code: 'console.log("test")'
      })
      expect(processed).toContain('CODE_BLOCK_0')
      expect(processed).not.toContain('```')
    })

    it('should extract code blocks without language', () => {
      const input = '```\nplain code\n```'
      const { processed, blocks } = extractCodeBlocks(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].lang).toBe('text')
      expect(blocks[0].code).toBe('plain code')
    })

    it('should extract multiple code blocks', () => {
      const input = '```js\ncode1\n```\ntext\n```python\ncode2\n```'
      const { processed, blocks } = extractCodeBlocks(input)

      expect(blocks).toHaveLength(2)
      expect(blocks[0].lang).toBe('js')
      expect(blocks[1].lang).toBe('python')
      expect(processed).toContain('CODE_BLOCK_0')
      expect(processed).toContain('CODE_BLOCK_1')
    })

    it('should handle multiline code', () => {
      const input = '```python\ndef hello():\n    print("world")\n```'
      const { processed, blocks } = extractCodeBlocks(input)

      expect(blocks[0].code).toBe('def hello():\n    print("world")')
    })

    it('should handle empty code blocks', () => {
      const input = '```\n```'
      const { processed, blocks } = extractCodeBlocks(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].code).toBe('')
    })

    it('should trim code content', () => {
      const input = '```\n\n  code  \n\n```'
      const { processed, blocks } = extractCodeBlocks(input)

      expect(blocks[0].code).toBe('code')
    })
  })

  describe('extractMathBlocks', () => {
    it('should extract math blocks', () => {
      const input = 'Text $$E = mc^2$$ more text'
      const { processed, blocks } = extractMathBlocks(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        id: 'MATH_BLOCK_0',
        math: 'E = mc^2'
      })
      expect(processed).toContain('MATH_BLOCK_0')
      expect(processed).not.toContain('$$')
    })

    it('should extract multiline math blocks', () => {
      const input = '$$\n\\sum_{i=1}^{n} i\n$$'
      const { processed, blocks } = extractMathBlocks(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].math).toContain('\\sum_{i=1}^{n} i')
    })

    it('should extract multiple math blocks', () => {
      const input = '$$a^2$$ text $$b^2$$'
      const { processed, blocks } = extractMathBlocks(input)

      expect(blocks).toHaveLength(2)
      expect(blocks[0].math).toBe('a^2')
      expect(blocks[1].math).toBe('b^2')
    })

    it('should trim math content', () => {
      const input = '$$  x + y  $$'
      const { processed, blocks } = extractMathBlocks(input)

      expect(blocks[0].math).toBe('x + y')
    })
  })

  describe('extractInlineMath', () => {
    it('should extract inline math', () => {
      const input = 'The equation $E = mc^2$ is famous'
      const { processed, blocks } = extractInlineMath(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        id: 'MATH_INLINE_0',
        math: 'E = mc^2'
      })
      expect(processed).toContain('MATH_INLINE_0')
    })

    it('should not extract across newlines', () => {
      const input = '$not\nmath$'
      const { processed, blocks } = extractInlineMath(input)

      expect(blocks).toHaveLength(0)
      expect(processed).toBe(input)
    })

    it('should extract multiple inline math expressions', () => {
      const input = '$a$ and $b$ and $c$'
      const { processed, blocks } = extractInlineMath(input)

      expect(blocks).toHaveLength(3)
      expect(blocks[0].math).toBe('a')
      expect(blocks[1].math).toBe('b')
      expect(blocks[2].math).toBe('c')
    })
  })

  describe('extractInlineCode', () => {
    it('should extract inline code', () => {
      const input = 'Use `console.log()` to print'
      const { processed, blocks } = extractInlineCode(input)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        id: 'CODE_INLINE_0',
        code: 'console.log()'
      })
      expect(processed).toContain('CODE_INLINE_0')
    })

    it('should extract multiple inline code snippets', () => {
      const input = '`var` and `let` and `const`'
      const { processed, blocks } = extractInlineCode(input)

      expect(blocks).toHaveLength(3)
      expect(blocks.map(b => b.code)).toEqual(['var', 'let', 'const'])
    })

    it('should handle code blocks in input', () => {
      const input = '```\ncode block\n```'
      const { processed, blocks } = extractInlineCode(input)

      // The backticks in code blocks might be extracted as inline code
      // This test just verifies the function doesn't crash
      expect(blocks).toBeDefined()
    })
  })

  describe('replacePlaceholders', () => {
    it('should replace placeholders with rendered content', () => {
      const html = '<p>Hello PLACEHOLDER_0 world</p>'
      const blocks = [{ id: 'PLACEHOLDER_0', value: 'TEST' }]
      const renderFn = (block) => `<span>${block.value}</span>`

      const result = replacePlaceholders(html, blocks, renderFn)
      expect(result).toBe('<p>Hello <span>TEST</span> world</p>')
    })

    it('should replace multiple placeholders', () => {
      const html = 'PH_0 and PH_1 and PH_2'
      const blocks = [
        { id: 'PH_0', text: 'A' },
        { id: 'PH_1', text: 'B' },
        { id: 'PH_2', text: 'C' }
      ]
      const renderFn = (block) => block.text

      const result = replacePlaceholders(html, blocks, renderFn)
      expect(result).toBe('A and B and C')
    })

    it('should handle empty blocks array', () => {
      const html = '<p>No placeholders</p>'
      const result = replacePlaceholders(html, [], () => 'X')

      expect(result).toBe(html)
    })
  })

  describe('processMarkdown', () => {
    const simpleMarkdownRenderer = (text) => `<p>${text}</p>`

    beforeEach(() => {
      global.window = {
        katex: {
          renderToString: vi.fn((math) => `<katex>${math}</katex>`)
        }
      }
    })

    afterEach(() => {
      delete global.window
    })

    it('should process plain text', () => {
      const result = processMarkdown('Hello world', simpleMarkdownRenderer)
      expect(result).toBe('<p>Hello world</p>')
    })

    it('should process code blocks', () => {
      const input = '```js\nconsole.log("test")\n```'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      expect(result).toContain('<div class="code-block-wrapper">')
      // The content should be escaped using our escapeHtml function
      expect(result).toContain('console.log')
      expect(result).toContain('language-js')
    })

    it('should process math blocks', () => {
      const input = '$$E = mc^2$$'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      expect(result).toContain('<div class="math-block-wrapper">')
      expect(result).toContain('<katex>E = mc^2</katex>')
    })

    it('should process inline math', () => {
      const input = 'The equation $x^2$ is simple'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      expect(result).toContain('<span class="math-inline-wrapper">')
      expect(result).toContain('<katex>x^2</katex>')
    })

    it('should process inline code', () => {
      const input = 'Use `const` for constants'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      expect(result).toContain('<code class="inline-code">const</code>')
    })

    it('should handle empty content', () => {
      const result = processMarkdown('', simpleMarkdownRenderer)
      expect(result).toBe('')
    })

    it('should process mixed content', () => {
      const input = '# Title\n\nUse `const` for $x$\n\n```js\nconst x = 1\n```\n\n$$E = mc^2$$'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      expect(result).toContain('inline-code')
      expect(result).toContain('math-inline-wrapper')
      expect(result).toContain('code-block-wrapper')
      expect(result).toContain('math-block-wrapper')
    })

    it('should escape HTML in code blocks', () => {
      const input = '```\n<script>alert("xss")</script>\n```'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      expect(result).toContain('&lt;script&gt;')
      expect(result).not.toContain('<script>')
    })

    it('should preserve order of elements', () => {
      const input = 'Text `code` $math$ more text'
      const result = processMarkdown(input, simpleMarkdownRenderer)

      const codeIndex = result.indexOf('inline-code')
      const mathIndex = result.indexOf('math-inline')
      expect(codeIndex).toBeLessThan(mathIndex)
    })
  })

  describe('Integration with marked', () => {
    beforeEach(() => {
      global.window = {
        katex: {
          renderToString: vi.fn((math) => math)
        }
      }
    })

    afterEach(() => {
      delete global.window
    })

    it('should work with a real markdown parser structure', () => {
      const markdownRenderer = (text) => {
        // Simulate marked behavior
        return text
          .split('\n\n')
          .map(para => `<p>${para}</p>`)
          .join('\n')
      }

      const input = 'First paragraph with `code`.\n\nSecond paragraph with $math$.'
      const result = processMarkdown(input, markdownRenderer)

      expect(result).toContain('<code class="inline-code">code</code>')
      expect(result).toContain('<span class="math-inline-wrapper">math</span>')
    })
  })
})
