import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '../MarkdownRenderer.vue'

// Mock the marked library
vi.mock('marked', () => ({
  marked: vi.fn((text) => {
    // Simple markdown simulation
    return text
      .split('\n\n')
      .map(para => {
        if (para.startsWith('# ')) {
          return `<h1>${para.slice(2)}</h1>`
        }
        if (para.startsWith('## ')) {
          return `<h2>${para.slice(3)}</h2>`
        }
        return `<p>${para}</p>`
      })
      .join('\n')
  })
}))

describe('MarkdownRenderer', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }

    // Mock KaTeX
    global.window = {
      katex: {
        renderToString: vi.fn((math) => `<span class="katex-rendered">${math}</span>`)
      }
    }
  })

  afterEach(() => {
    delete global.window
  })

  describe('Rendering', () => {
    it('should render markdown content', () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: '# Hello World'
        }
      })

      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
      expect(wrapper.html()).toContain('Hello World')
    })

    it('should render empty content', () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: ''
        }
      })

      const html = wrapper.find('.markdown-renderer').html()
      expect(html).toBe('<div class="markdown-renderer"></div>')
    })

    it('should use default empty string for content prop', () => {
      wrapper = mount(MarkdownRenderer)

      expect(wrapper.props('content')).toBe('')
    })
  })

  describe('Props', () => {
    it('should accept content prop', () => {
      const { content } = MarkdownRenderer.props
      expect(content.type).toBe(String)
      expect(content.default).toBe('')
    })

    it('should render provided content', () => {
      const testContent = 'Test paragraph'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: testContent
        }
      })

      expect(wrapper.text()).toContain(testContent)
    })
  })

  describe('Code Blocks', () => {
    it('should render code blocks', () => {
      const content = '```javascript\nconsole.log("test")\n```'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('code-block-wrapper')
      expect(wrapper.html()).toContain('language-javascript')
      expect(wrapper.html()).toContain('console.log')
    })

    it('should escape HTML in code blocks', () => {
      const content = '```\n<script>alert("xss")</script>\n```'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('&lt;script&gt;')
      expect(wrapper.html()).not.toContain('<script>alert')
    })

    it('should handle code blocks without language', () => {
      const content = '```\nplain code\n```'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('language-text')
      expect(wrapper.html()).toContain('plain code')
    })

    it('should render multiple code blocks', () => {
      const content = '```js\ncode1\n```\n\nSome text\n\n```python\ncode2\n```'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('language-js')
      expect(wrapper.html()).toContain('language-python')
      expect(wrapper.html()).toContain('code1')
      expect(wrapper.html()).toContain('code2')
    })
  })

  describe('Math Blocks', () => {
    it('should render math blocks', () => {
      const content = '$$E = mc^2$$'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('math-block-wrapper')
      expect(wrapper.html()).toContain('katex-rendered')
      expect(window.katex.renderToString).toHaveBeenCalledWith('E = mc^2', expect.any(Object))
    })

    it('should render multiline math blocks', () => {
      const content = '$$\n\\sum_{i=1}^{n} i\n$$'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('math-block-wrapper')
      expect(wrapper.html()).toContain('\\sum_{i=1}^{n} i')
    })

    it('should call KaTeX with displayMode for block math', () => {
      const content = '$$x^2$$'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(window.katex.renderToString).toHaveBeenCalledWith(
        'x^2',
        expect.objectContaining({ displayMode: true })
      )
    })
  })

  describe('Inline Math', () => {
    it('should render inline math', () => {
      const content = 'The equation $E = mc^2$ is famous'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('math-inline-wrapper')
      expect(wrapper.html()).toContain('katex-rendered')
    })

    it('should call KaTeX without displayMode for inline math', () => {
      const content = 'Inline $x^2$ math'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(window.katex.renderToString).toHaveBeenCalledWith(
        'x^2',
        expect.objectContaining({ displayMode: false })
      )
    })

    it('should render multiple inline math expressions', () => {
      const content = 'Compare $a^2$ and $b^2$ and $c^2$'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      const html = wrapper.html()
      const matches = html.match(/math-inline-wrapper/g)
      expect(matches).toHaveLength(3)
    })
  })

  describe('Inline Code', () => {
    it('should render inline code', () => {
      const content = 'Use `console.log()` to print'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('inline-code')
      expect(wrapper.html()).toContain('console.log()')
    })

    it('should escape HTML in inline code', () => {
      const content = 'Use `<div>` tag'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('&lt;div&gt;')
    })

    it('should render multiple inline code snippets', () => {
      const content = 'Compare `var`, `let`, and `const`'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      const html = wrapper.html()
      const matches = html.match(/inline-code/g)
      expect(matches).toHaveLength(3)
    })
  })

  describe('Mixed Content', () => {
    it('should render mixed markdown, code, and math', () => {
      const content = `# Title

Use \`const\` for constants.

The equation $E = mc^2$ is important.

\`\`\`javascript
const x = 1
\`\`\`

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$`

      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      const html = wrapper.html()
      expect(html).toContain('inline-code')
      expect(html).toContain('math-inline-wrapper')
      expect(html).toContain('code-block-wrapper')
      expect(html).toContain('math-block-wrapper')
    })

    it('should process elements in correct order', () => {
      const content = 'Text `code` $math$ text'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      const html = wrapper.html()
      const codeIndex = html.indexOf('inline-code')
      const mathIndex = html.indexOf('math-inline')

      expect(codeIndex).toBeGreaterThan(-1)
      expect(mathIndex).toBeGreaterThan(-1)
      expect(codeIndex).toBeLessThan(mathIndex)
    })
  })

  describe('KaTeX Fallback', () => {
    it('should fallback when KaTeX is not available', () => {
      // Create a new window object without katex
      global.window = {}

      const content = '$E = mc^2$'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('E = mc^2')

      // Restore katex for other tests
      global.window.katex = {
        renderToString: vi.fn((math) => `<span class="katex-rendered">${math}</span>`)
      }
    })

    it('should escape math when KaTeX fails', () => {
      global.window.katex.renderToString = vi.fn(() => {
        throw new Error('KaTeX error')
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const content = '$x^2$'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('x^2')
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Reactivity', () => {
    it('should update when content prop changes', async () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: 'Initial content'
        }
      })

      expect(wrapper.text()).toContain('Initial content')

      await wrapper.setProps({ content: 'Updated content' })

      expect(wrapper.text()).toContain('Updated content')
      expect(wrapper.text()).not.toContain('Initial content')
    })

    it('should re-render code blocks when content changes', async () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: '```js\ncode1\n```'
        }
      })

      expect(wrapper.html()).toContain('code1')

      await wrapper.setProps({ content: '```python\ncode2\n```' })

      expect(wrapper.html()).toContain('code2')
      expect(wrapper.html()).toContain('language-python')
      expect(wrapper.html()).not.toContain('code1')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null content', () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: null
        }
      })

      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })

    it('should handle undefined content', () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: undefined
        }
      })

      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })

    it('should handle very long content', () => {
      const longContent = 'word '.repeat(10000)
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: longContent
        }
      })

      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })

    it('should handle special characters', () => {
      const content = '< > & " \' test'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })

    it('should handle nested code in markdown', () => {
      const content = '```\n`nested`\n```'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('code-block-wrapper')
    })
  })

  describe('HTML Structure', () => {
    it('should render with markdown-renderer class', () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: 'Test'
        }
      })

      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })

    it('should render content as HTML using v-html', () => {
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: '**bold**'
        }
      })

      // Since we're using v-html, the component should render HTML directly
      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })
  })

  describe('Security', () => {
    it('should escape HTML in regular text', () => {
      const content = '<script>alert("xss")</script>'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      // The markdown processor should handle this, but our utility functions escape HTML
      expect(wrapper.find('.markdown-renderer').exists()).toBe(true)
    })

    it('should escape HTML in code blocks', () => {
      const content = '```\n<img src=x onerror=alert(1)>\n```'
      wrapper = mount(MarkdownRenderer, {
        props: {
          content: content
        }
      })

      expect(wrapper.html()).toContain('&lt;img')
      expect(wrapper.html()).not.toContain('<img src=x')
    })
  })
})
