import { describe, it, expect } from 'vitest'
import { useMessageParser } from '../useMessageParser.js'

describe('useMessageParser', () => {
  const {
    parseMessage,
    parseTextFormattingWithEscaping,
    escapeHtml,
    escapeHtmlExceptCode,
    parseInlineElementsWithoutEscaping,
    parseInlineElements,
    isTableSeparator,
    parseBlockquote,
    parseTable,
    parseTextFormatting
  } = useMessageParser()

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
      expect(escapeHtml('&')).toBe('&amp;')
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;')
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should handle strings without HTML', () => {
      expect(escapeHtml('plain text')).toBe('plain text')
    })
  })

  describe('escapeHtmlExceptCode', () => {
    it('should escape HTML but preserve inline code', () => {
      const result = escapeHtmlExceptCode('Use `<div>` tag')
      expect(result).toBe('Use `<div>` tag')
    })

    it('should escape HTML but preserve URLs', () => {
      const result = escapeHtmlExceptCode('Visit https://example.com for more')
      expect(result).toBe('Visit https://example.com for more')
    })

    it('should escape HTML outside of code and URLs', () => {
      const result = escapeHtmlExceptCode('Use `code` and <div>')
      expect(result).toBe('Use `code` and &lt;div&gt;')
    })
  })

  describe('isTableSeparator', () => {
    it('should identify valid table separators', () => {
      expect(isTableSeparator('| --- | --- |')).toBe(true)
      expect(isTableSeparator('| :--- | :---: | ---: |')).toBe(true)
      expect(isTableSeparator('|---|---|')).toBe(true)
      // Note: Single column tables require at least one pipe separator
      expect(isTableSeparator(':---:|---:')).toBe(true)
    })

    it('should reject invalid table separators', () => {
      expect(isTableSeparator('regular text')).toBe(false)
      expect(isTableSeparator('| header | header |')).toBe(false)
      expect(isTableSeparator('')).toBe(false)
      // Single dash without multiple columns
      expect(isTableSeparator('---')).toBe(false)
    })
  })

  describe('parseTextFormatting', () => {
    it('should parse bold text', () => {
      const result = parseTextFormatting('**bold**')
      expect(result).toEqual([
        { type: 'bold', text: 'bold' }
      ])
    })

    it('should parse italic text', () => {
      const result = parseTextFormatting('*italic*')
      expect(result).toEqual([
        { type: 'italic', text: 'italic' }
      ])
    })

    it('should parse inline code', () => {
      const result = parseTextFormatting('`code`')
      expect(result).toEqual([
        { type: 'code', text: 'code' }
      ])
    })

    it('should parse links', () => {
      const result = parseTextFormatting('https://example.com')
      expect(result).toEqual([
        { type: 'link', text: 'https://example.com' }
      ])
    })

    it('should parse mixed formatting', () => {
      const result = parseTextFormatting('plain **bold** text `code`')
      expect(result).toEqual([
        { type: 'plain', text: 'plain ' },
        { type: 'bold', text: 'bold' },
        { type: 'plain', text: ' text ' },
        { type: 'code', text: 'code' }
      ])
    })

    it('should handle plain text', () => {
      const result = parseTextFormatting('plain text')
      expect(result).toEqual([
        { type: 'plain', text: 'plain text' }
      ])
    })
  })

  describe('parseTextFormattingWithEscaping', () => {
    it('should parse and escape HTML in plain text', () => {
      const result = parseTextFormattingWithEscaping('<div>text</div>')
      expect(result).toEqual([
        { type: 'plain', text: '&lt;div&gt;text&lt;/div&gt;' }
      ])
    })

    it('should parse bold and escape HTML', () => {
      const result = parseTextFormattingWithEscaping('**<bold>**')
      expect(result).toEqual([
        { type: 'bold', text: '&lt;bold&gt;' }
      ])
    })

    it('should not escape URLs', () => {
      const result = parseTextFormattingWithEscaping('https://example.com')
      expect(result).toEqual([
        { type: 'link', text: 'https://example.com' }
      ])
    })

    it('should not escape inline code content', () => {
      const result = parseTextFormattingWithEscaping('`<div>`')
      expect(result).toEqual([
        { type: 'code', text: '<div>' }
      ])
    })

    it('should handle mixed content with escaping', () => {
      const result = parseTextFormattingWithEscaping('<div> **bold** `code`')
      expect(result).toEqual([
        { type: 'plain', text: '&lt;div&gt; ' },
        { type: 'bold', text: 'bold' },
        { type: 'plain', text: ' ' },
        { type: 'code', text: 'code' }
      ])
    })
  })

  describe('parseBlockquote', () => {
    it('should parse single line blockquote', () => {
      const lines = ['> quote text']
      const result = parseBlockquote(lines, 0)
      
      expect(result.nextIndex).toBe(1)
      expect(result.element.type).toBe('blockquote')
      expect(result.element.content).toEqual([
        { type: 'plain', text: 'quote text' }
      ])
    })

    it('should parse multi-line blockquote', () => {
      const lines = ['> line 1', '> line 2', 'not quote']
      const result = parseBlockquote(lines, 0)
      
      expect(result.nextIndex).toBe(2)
      expect(result.element.type).toBe('blockquote')
    })

    it('should parse blockquote with formatting', () => {
      const lines = ['> **bold** text']
      const result = parseBlockquote(lines, 0)
      
      expect(result.element.content).toContainEqual({ type: 'bold', text: 'bold' })
    })
  })

  describe('parseTable', () => {
    it('should parse a simple table', () => {
      const lines = [
        '| Header 1 | Header 2 |',
        '| --- | --- |',
        '| Cell 1 | Cell 2 |'
      ]
      const result = parseTable(lines, 0)
      
      expect(result.element.type).toBe('table')
      expect(result.element.headers).toHaveLength(2)
      expect(result.element.rows).toHaveLength(1)
      expect(result.element.alignments).toEqual(['left', 'left'])
    })

    it('should parse table with alignments', () => {
      const lines = [
        '| Left | Center | Right |',
        '| :--- | :---: | ---: |',
        '| L | C | R |'
      ]
      const result = parseTable(lines, 0)
      
      expect(result.element.alignments).toEqual(['left', 'center', 'right'])
    })

    it('should parse table with formatted content', () => {
      const lines = [
        '| **Bold** | `Code` |',
        '| --- | --- |',
        '| *Italic* | Text |'
      ]
      const result = parseTable(lines, 0)
      
      expect(result.element.headers[0]).toContainEqual({ type: 'bold', text: 'Bold' })
      expect(result.element.headers[1]).toContainEqual({ type: 'code', text: 'Code' })
    })

    it('should stop parsing at empty line', () => {
      const lines = [
        '| Header |',
        '| --- |',
        '| Row 1 |',
        '',
        '| Row 2 |'
      ]
      const result = parseTable(lines, 0)
      
      expect(result.element.rows).toHaveLength(1)
      expect(result.nextIndex).toBe(3)
    })

    it('should return null for invalid table', () => {
      const lines = [
        '||',
        '| --- |'
      ]
      const result = parseTable(lines, 0)
      
      expect(result).toBeNull()
    })
  })

  describe('parseInlineElements', () => {
    it('should parse headers', () => {
      const result = parseInlineElements('# Header 1')
      
      expect(result).toContainEqual({
        type: 'header',
        level: 1,
        content: [{ type: 'plain', text: 'Header 1' }]
      })
    })

    it('should parse blockquotes', () => {
      const result = parseInlineElements('> quote')
      
      expect(result[0].type).toBe('blockquote')
    })

    it('should parse horizontal rules', () => {
      const result = parseInlineElements('---')
      
      expect(result).toContainEqual({ type: 'hr' })
    })

    it('should parse tables', () => {
      // Test with proper table format with at least 2 columns
      const result = parseInlineElements('| H1 | H2 |\n| --- | --- |\n| C1 | C2 |')
      
      // The table should be parsed
      const tableElement = result.find(el => el.type === 'table')
      expect(tableElement).toBeDefined()
      expect(tableElement.type).toBe('table')
    })

    it('should parse plain text with line breaks', () => {
      const result = parseInlineElements('line 1\nline 2')
      
      expect(result).toContainEqual({
        type: 'text',
        content: [{ type: 'plain', text: 'line 1' }]
      })
      expect(result).toContainEqual({ type: 'linebreak' })
      expect(result).toContainEqual({
        type: 'text',
        content: [{ type: 'plain', text: 'line 2' }]
      })
    })

    describe('linebreaks after blockquotes and text', () => {
      it('should add linebreak after blockquote in parseInlineElementsWithoutEscaping', () => {
        const result = parseInlineElementsWithoutEscaping('>quote\ntext')
        // Should have blockquote, linebreak, then text
        expect(result[0].type).toBe('blockquote')
        expect(result[1].type).toBe('linebreak')
        expect(result[2].type).toBe('text')
      })
      it('should add linebreak after blockquote in parseInlineElements', () => {
        const result = parseInlineElements('>quote\ntext')
        // Should have blockquote, linebreak, then text
        expect(result[0].type).toBe('blockquote')
        expect(result[1].type).toBe('linebreak')
        expect(result[2].type).toBe('text')
      })
      it('should add linebreak after text in parseInlineElements', () => {
        const result = parseInlineElements('line 1\nline 2')
        // Should have text, linebreak, then text
        expect(result[0].type).toBe('text')
        expect(result[1].type).toBe('linebreak')
        expect(result[2].type).toBe('text')
      })
    })
  })

  describe('parseInlineElementsWithoutEscaping', () => {
    it('should parse headers with escaping', () => {
      const result = parseInlineElementsWithoutEscaping('# <Header>')
      
      expect(result[0].type).toBe('header')
      expect(result[0].content).toContainEqual({
        type: 'plain',
        text: '&lt;Header&gt;'
      })
    })

    it('should parse text with HTML escaping', () => {
      const result = parseInlineElementsWithoutEscaping('<div>text</div>')
      
      expect(result[0].content).toContainEqual({
        type: 'plain',
        text: '&lt;div&gt;text&lt;/div&gt;'
      })
    })

    it('should handle blockquotes starting with optional space', () => {
      const result = parseInlineElementsWithoutEscaping('>quote\n>another')
      
      expect(result[0].type).toBe('blockquote')
    })

    describe('linebreaks after blockquotes and text', () => {
      it('should add linebreak after blockquote in parseInlineElementsWithoutEscaping', () => {
        const result = parseInlineElementsWithoutEscaping('>quote\ntext')
        // Should have blockquote, linebreak, then text
        expect(result[0].type).toBe('blockquote')
        expect(result[1].type).toBe('linebreak')
        expect(result[2].type).toBe('text')
      })
      it('should add linebreak after blockquote in parseInlineElements', () => {
        const result = parseInlineElements('>quote\ntext')
        // Should have blockquote, linebreak, then text
        expect(result[0].type).toBe('blockquote')
        expect(result[1].type).toBe('linebreak')
        expect(result[2].type).toBe('text')
      })
      it('should add linebreak after text in parseInlineElements', () => {
        const result = parseInlineElements('line 1\nline 2')
        // Should have text, linebreak, then text
        expect(result[0].type).toBe('text')
        expect(result[1].type).toBe('linebreak')
        expect(result[2].type).toBe('text')
      })
    })
  })

  describe('parseMessage', () => {
        it('should parse special tags for reply message', () => {
          const content = '<|channel|>commentary to=final <|constrain|>response<|message|>5'
          const result = parseMessage(content)
          expect(result).toEqual([
            { type: 'channel', value: 'commentary', to: 'final' },
            { type: 'constrain', value: 'response' },
            { type: 'message', value: '5' }
          ])
        })
    it('should return empty array for empty content', () => {
      expect(parseMessage('')).toEqual([])
      expect(parseMessage(null)).toEqual([])
    })

    it('should parse code blocks', () => {
      const content = '```javascript\nconst x = 1;\n```'
      const result = parseMessage(content)
      
      expect(result).toContainEqual({
        type: 'codeblock',
        language: 'javascript',
        code: 'const x = 1;'
      })
    })

    it('should parse code blocks without language', () => {
      const content = '```\ncode\n```'
      const result = parseMessage(content)
      
      expect(result).toContainEqual({
        type: 'codeblock',
        language: 'plaintext',
        code: 'code'
      })
    })

    it('should parse text before and after code blocks', () => {
      const content = 'text before\n```js\ncode\n```\ntext after'
      const result = parseMessage(content)
      
      expect(result.some(el => el.type === 'text')).toBe(true)
      expect(result.some(el => el.type === 'codeblock')).toBe(true)
    })

    it('should parse complex message with multiple elements', () => {
      const content = '# Title\n\nSome **bold** text\n\n```python\nprint("hi")\n```\n\n> Quote'
      const result = parseMessage(content)
      
      expect(result.some(el => el.type === 'header')).toBe(true)
      expect(result.some(el => el.type === 'text')).toBe(true)
      expect(result.some(el => el.type === 'codeblock')).toBe(true)
      expect(result.some(el => el.type === 'blockquote')).toBe(true)
    })

    it('should parse tables in messages', () => {
      const content = '| A | B |\n| --- | --- |\n| 1 | 2 |'
      const result = parseMessage(content)
      
      expect(result[0].type).toBe('table')
      expect(result[0].headers).toHaveLength(2)
    })

    it('should handle messages with only text', () => {
      const content = 'Simple text message'
      const result = parseMessage(content)
      
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
    })

    it('should preserve HTML escaping in text', () => {
      const content = '<script>alert("XSS")</script>'
      const result = parseMessage(content)
      
      expect(result[0].content[0].text).toContain('&lt;script&gt;')
    })

    it('should not escape HTML in code blocks', () => {
      const content = '```html\n<div>test</div>\n```'
      const result = parseMessage(content)
      
      expect(result[0].code).toBe('<div>test</div>')
    })
  })
})
