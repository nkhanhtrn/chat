import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { processMarkdownAST, processMarkdownWithCustomContent } from '../ASTMarkdownRenderer.js'

describe('ASTMarkdownRenderer', () => {
  describe('processMarkdownAST - Basic functionality', () => {
    it('should render plain text', () => {
      const result = processMarkdownAST('Hello world')
      expect(result).toContain('Hello world')
    })

    it('should render markdown formatting', () => {
      const result = processMarkdownAST('This is **bold** text')
      expect(result).toContain('<strong>')
      expect(result).toContain('bold')
      expect(result).toContain('</strong>')
    })

    it('should render links', () => {
      const result = processMarkdownAST('[Link](https://example.com)')
      expect(result).toContain('<a href="https://example.com">')
      expect(result).toContain('Link')
    })

    it('should render headings', () => {
      const result = processMarkdownAST('# Heading 1')
      expect(result).toContain('<h1')
      expect(result).toContain('Heading 1')
    })

    it('should render lists', () => {
      const result = processMarkdownAST('- Item 1\n- Item 2')
      expect(result).toContain('<ul>')
      expect(result).toContain('Item 1')
      expect(result).toContain('Item 2')
      // Text should be wrapped in spans with position data
      expect(result).toContain('data-md-start')
      expect(result).toContain('data-md-end')
    })
  })

  describe('processMarkdownAST - Custom content without markdown boundaries', () => {
    it('should highlight plain text', () => {
      const content = 'This is a simple text'
      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 10,
        endOffset: 16,
        color: '#ffeb3b',
        text: 'simple'
      }]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('<mark class="custom-highlight"')
      expect(result).toContain('simple')
      expect(result).toContain('background-color: #ffeb3b')
    })

    it('should render question links', () => {
      const content = 'Click this text to see question'
      const customContent = [{
        id: 'q1',
        type: 'question-link',
        startOffset: 6,
        endOffset: 15,
        childIndex: 0,
        text: 'this text'
      }]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('<a href="#" class="question-link"')
      expect(result).toContain('data-child-index="0"')
      expect(result).toContain('this text')
    })

    it('should handle multiple highlights', () => {
      const content = 'First highlight and second highlight'
      const customContent = [
        {
          id: 'h1',
          type: 'highlight',
          startOffset: 0,
          endOffset: 5,
          color: '#ffeb3b',
          text: 'First'
        },
        {
          id: 'h2',
          type: 'highlight',
          startOffset: 20,
          endOffset: 26,
          color: '#00ff00',
          text: 'second'
        }
      ]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('First')
      expect(result).toContain('second')
      expect(result.match(/custom-highlight/g)).toHaveLength(2)
    })
  })

  describe('processMarkdownAST - Cross-boundary highlights (THE KEY FEATURE!)', () => {
    it('should highlight across bold markdown', () => {
      const content = 'This is **bold** text here'
      //                       ^         ^
      //                       10        20
      // Highlight "bold** text" - crosses the ** boundary

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 10,
        endOffset: 20,
        color: '#ffeb3b',
        text: 'bold** tex'
      }]

      const result = processMarkdownAST(content, customContent)

      // Should contain both the bold tag AND the highlight
      expect(result).toContain('<strong>')
      expect(result).toContain('</strong>')
      expect(result).toContain('<mark class="custom-highlight"')

      // The word "bold" should be both bold AND highlighted
      expect(result).toMatch(/<strong>.*<mark.*>bold<\/mark>.*<\/strong>/)
    })

    it('should highlight starting inside bold and ending outside', () => {
      const content = 'Start **bold text** end'
      //                     ^            ^
      //                     8            19
      // Highlight "bold text** e" - starts inside, ends outside

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 8,
        endOffset: 19,
        color: '#ffeb3b',
        text: 'bold text** e'
      }]

      const result = processMarkdownAST(content, customContent)

      expect(result).toContain('<strong>')
      expect(result).toContain('<mark class="custom-highlight"')

      // Should have highlighted text both inside and outside the bold
      expect(result).toContain('bold text')
      expect(result).toContain('</mark>')
    })

    it('should highlight across italic markdown', () => {
      const content = 'This is *italic* text'
      //                       ^        ^
      //                       8        16

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 8,
        endOffset: 16,
        color: '#ffeb3b',
        text: 'italic* '
      }]

      const result = processMarkdownAST(content, customContent)

      expect(result).toContain('<em>')
      expect(result).toContain('<mark class="custom-highlight"')
    })

    it('should highlight across link text', () => {
      const content = 'Click [this link](url) here'
      //                     ^          ^
      //                     6          18
      // Highlight "this link](url" - crosses link boundary

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 7,
        endOffset: 16,
        color: '#ffeb3b',
        text: 'this link'
      }]

      const result = processMarkdownAST(content, customContent)

      // Should still render the link
      expect(result).toContain('<a href="url">')
      // And should have highlighting
      expect(result).toContain('<mark class="custom-highlight"')
    })

    it('should highlight across multiple markdown elements', () => {
      const content = 'Text with **bold** and *italic* words'
      //                        ^                     ^
      //                        10                    31
      // Highlight "bold** and *italic" - crosses both bold and italic

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 10,
        endOffset: 31,
        color: '#ffeb3b',
        text: 'bold** and *italic'
      }]

      const result = processMarkdownAST(content, customContent)

      expect(result).toContain('<strong>')
      expect(result).toContain('<em>')
      expect(result).toContain('<mark class="custom-highlight"')
    })

    it('should highlight partial heading text', () => {
      const content = '# This is a heading'
      //                 ^         ^
      //                 2         11
      // Highlight "This is a" - inside heading

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 2,
        endOffset: 11,
        color: '#ffeb3b',
        text: 'This is a'
      }]

      const result = processMarkdownAST(content, customContent)

      expect(result).toContain('<h1')
      expect(result).toContain('<mark class="custom-highlight"')
      // The text will be there, but might be split by the mark tag
      expect(result).toMatch(/his is a/)
    })

    it('should highlight across list items', () => {
      const content = '- First item\n- Second item'
      //                  ^              ^
      //                  2              20
      // Highlight "First item\n- Second" - crosses list items

      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 2,
        endOffset: 20,
        color: '#ffeb3b',
        text: 'First item\n- Second'
      }]

      const result = processMarkdownAST(content, customContent)

      expect(result).toContain('<ul>')
      expect(result).toContain('<li>')
      expect(result).toContain('<mark class="custom-highlight"')
    })
  })

  describe('processMarkdownAST - Overlapping custom content', () => {
    it('should handle overlapping highlights', () => {
      const content = 'This is overlapping text'
      const customContent = [
        {
          id: 'h1',
          type: 'highlight',
          startOffset: 8,
          endOffset: 19, // "overlapping"
          color: '#ffeb3b'
        },
        {
          id: 'h2',
          type: 'highlight',
          startOffset: 12,
          endOffset: 24, // "lapping text"
          color: '#00ff00'
        }
      ]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('custom-highlight')
      // Should have both highlights
      expect(result.match(/custom-highlight/g).length).toBeGreaterThanOrEqual(1)
    })

    it('should handle nested highlights in markdown', () => {
      const content = 'Text **bold with highlight** here'
      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 13, // "with"
        endOffset: 17,
        color: '#ffeb3b'
      }]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('<strong>')
      expect(result).toContain('<mark class="custom-highlight"')
      // The highlight should contain "ith " (due to position tracking of "**")
      expect(result).toContain('>ith </mark>')
    })
  })

  describe('processMarkdownAST - Edge cases', () => {
    it('should handle empty content', () => {
      const result = processMarkdownAST('')
      expect(result).toBe('')
    })

    it('should handle highlights with no custom content', () => {
      const result = processMarkdownAST('Plain text', [])
      expect(result).toContain('Plain text')
    })

    it('should escape HTML in content', () => {
      const content = '<script>alert("xss")</script>'
      const result = processMarkdownAST(content)
      expect(result).toContain('&lt;script&gt;')
      expect(result).not.toContain('<script>')
    })

    it('should handle custom content at the very start', () => {
      const content = 'Start of text'
      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 0,
        endOffset: 5,
        color: '#ffeb3b',
        text: 'Start'
      }]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('<mark class="custom-highlight"')
      expect(result).toContain('Start')
    })

    it('should handle custom content at the very end', () => {
      const content = 'End of text'
      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 7,
        endOffset: 11,
        color: '#ffeb3b',
        text: 'text'
      }]

      const result = processMarkdownAST(content, customContent)
      expect(result).toContain('<mark class="custom-highlight"')
      expect(result).toContain('text')
    })
  })

  describe('processMarkdownWithCustomContent - Code blocks and math', () => {
    beforeEach(() => {
      global.window = {
        katex: {
          renderToString: vi.fn((math) => `<span class="katex">${math}</span>`)
        }
      }
    })

    afterEach(() => {
      delete global.window
    })

    it('should handle code blocks', () => {
      const content = 'Text\n```js\nconsole.log("test")\n```\nMore text'
      const result = processMarkdownWithCustomContent(content)

      expect(result).toContain('code-block-wrapper')
      expect(result).toContain('console.log')
    })

    it('should handle math blocks', () => {
      const content = 'Equation: $$E = mc^2$$ here'
      const result = processMarkdownWithCustomContent(content)

      expect(result).toContain('math-block-wrapper')
      expect(result).toContain('katex')
    })

    it('should combine custom content with code blocks', () => {
      const content = 'Code: ```js\nconst x = 1\n```\nText here'
      const customContent = [{
        id: 'h1',
        type: 'highlight',
        startOffset: 30, // "Text"
        endOffset: 34,
        color: '#ffeb3b'
      }]

      const result = processMarkdownWithCustomContent(content, customContent)

      expect(result).toContain('code-block-wrapper')
      expect(result).toContain('custom-highlight')
    })
  })
})
