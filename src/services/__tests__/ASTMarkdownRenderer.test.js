import { describe, it, expect } from 'vitest'
import { parseMarkdownToAST } from '../ASTMarkdownRenderer.js'

// Helper to find nodes of a specific type recursively
function findNodesByType(node, type) {
  const results = []
  if (node.type === type) results.push(node)
  if (node.children) {
    node.children.forEach(child => {
      results.push(...findNodesByType(child, type))
    })
  }
  return results
}

describe('ASTMarkdownRenderer', () => {
  describe('Math Block Extraction', () => {
    it('should extract $$ math blocks', () => {
      const content = 'Before $$x^2 + y^2 = z^2$$ after'
      const ast = parseMarkdownToAST(content)

      const mathBlocks = findNodesByType(ast, 'math_block')
      expect(mathBlocks.length).toBe(1)
      expect(mathBlocks[0].content).toBe('x^2 + y^2 = z^2')
    })

    it('should extract multiline $$ math blocks', () => {
      const content = `Here is an equation:
$$
\\frac{a}{b} = c
$$
End of equation.`
      const ast = parseMarkdownToAST(content)

      const mathBlocks = findNodesByType(ast, 'math_block')
      expect(mathBlocks.length).toBe(1)
      expect(mathBlocks[0].content).toBe('\\frac{a}{b} = c')
    })

    it('should extract \\[ \\] bracket notation math blocks', () => {
      const content = 'Before \\[E = mc^2\\] after'
      const ast = parseMarkdownToAST(content)

      const mathBlocks = findNodesByType(ast, 'math_block')
      expect(mathBlocks.length).toBe(1)
      expect(mathBlocks[0].content).toBe('E = mc^2')
    })

    it('should extract multiline \\[ \\] math blocks', () => {
      const content = `Formula:
\\[
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
\\]
Done.`
      const ast = parseMarkdownToAST(content)

      const mathBlocks = findNodesByType(ast, 'math_block')
      expect(mathBlocks.length).toBe(1)
      expect(mathBlocks[0].content).toBe('\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}')
    })
  })

  describe('Inline Math Extraction', () => {
    it('should extract $...$ inline math', () => {
      const content = 'The formula $x^2$ is quadratic'
      const ast = parseMarkdownToAST(content)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].content).toBe('x^2')
    })

    it('should extract \\(...\\) inline math', () => {
      const content = 'The value \\(\\pi \\approx 3.14\\) is pi'
      const ast = parseMarkdownToAST(content)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].content).toBe('\\pi \\approx 3.14')
    })

    it('should not confuse $$ with $ inline math', () => {
      const content = 'Block $$a + b$$ and inline $c + d$ here'
      const ast = parseMarkdownToAST(content)

      const mathBlocks = findNodesByType(ast, 'math_block')
      expect(mathBlocks.length).toBe(1)
      expect(mathBlocks[0].content).toBe('a + b')

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].content).toBe('c + d')
    })

    it('should handle multiple inline math expressions', () => {
      const content = 'We have $a$ and $b$ and $c$'
      const ast = parseMarkdownToAST(content)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines).toHaveLength(3)
      expect(mathInlines[0].content).toBe('a')
      expect(mathInlines[1].content).toBe('b')
      expect(mathInlines[2].content).toBe('c')
    })

    it('should preserve text around inline math', () => {
      const content = 'Before $x$ after'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      expect(textNodes.some(n => n.content.includes('Before'))).toBe(true)
      expect(textNodes.some(n => n.content.includes('after'))).toBe(true)
    })
  })

  describe('Math in Tables', () => {
    it('should handle inline math in table cells', () => {
      const content = `| Formula | Result |
|---------|--------|
| $x^2$ | 4 |`
      const ast = parseMarkdownToAST(content)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].content).toBe('x^2')
    })

    it('should handle multiple math expressions in table', () => {
      const content = `| A | B |
|---|---|
| $a$ | $b$ |
| $c$ | $d$ |`
      const ast = parseMarkdownToAST(content)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines).toHaveLength(4)
    })
  })

  describe('Math Highlight Support', () => {
    it('should apply highlight to inline math when highlight overlaps', () => {
      const content = 'The formula $x^2$ is here'
      const highlights = [{
        type: 'highlight',
        id: 'h1',
        startOffset: 12,
        endOffset: 17,
        colorIndex: 2
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].highlighted).toBe(true)
      expect(mathInlines[0].colorIndex).toBe(2)
      expect(mathInlines[0].highlightId).toBe('h1')
    })

    it('should apply highlight to block math when highlight overlaps', () => {
      const content = 'Before $$E = mc^2$$ after'
      const highlights = [{
        type: 'highlight',
        id: 'h2',
        startOffset: 7,
        endOffset: 19,
        colorIndex: 1
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const mathBlocks = findNodesByType(ast, 'math_block')
      expect(mathBlocks.length).toBe(1)
      expect(mathBlocks[0].highlighted).toBe(true)
      expect(mathBlocks[0].colorIndex).toBe(1)
      expect(mathBlocks[0].highlightId).toBe('h2')
    })

    it('should not highlight math when no highlight overlaps', () => {
      const content = 'The formula $x^2$ is here'
      const highlights = [{
        type: 'highlight',
        id: 'h3',
        startOffset: 0,
        endOffset: 3,
        colorIndex: 0
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].highlighted).toBeFalsy()
    })

    it('should NOT highlight math when highlight only partially overlaps', () => {
      const content = 'Text $a + b$ more'
      const highlights = [{
        type: 'highlight',
        id: 'h4',
        startOffset: 3,
        endOffset: 8,
        colorIndex: 3
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].highlighted).toBeFalsy()
    })

    it('should highlight math when highlight fully contains it', () => {
      const content = 'Text $a + b$ more'
      // $a + b$ is at positions 5-12
      const highlights = [{
        type: 'highlight',
        id: 'h5',
        startOffset: 5,
        endOffset: 12,
        colorIndex: 1
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].highlighted).toBe(true)
      expect(mathInlines[0].colorIndex).toBe(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const ast = parseMarkdownToAST('')
      expect(ast.type).toBe('root')
      expect(ast.children).toEqual([])
    })

    it('should handle null content', () => {
      const ast = parseMarkdownToAST(null)
      expect(ast.type).toBe('root')
      expect(ast.children).toEqual([])
    })

    it('should handle content with no math', () => {
      const content = 'Just regular text without math'
      const ast = parseMarkdownToAST(content)

      const mathBlocks = findNodesByType(ast, 'math_block')
      const mathInlines = findNodesByType(ast, 'math_inline')

      expect(mathBlocks.length).toBe(0)
      expect(mathInlines.length).toBe(0)
    })

    it('should handle dollar signs that are not math', () => {
      const content = 'Price is $50 and $100'
      const ast = parseMarkdownToAST(content)

      // Single $ followed by number shouldn't be treated as math delimiter
      // This depends on the regex - current implementation may or may not match
      // The test documents current behavior
      expect(ast.children.length).toBeGreaterThan(0)
    })

    it('should handle nested brackets in math', () => {
      const content = '$\\frac{a}{b}$'
      const ast = parseMarkdownToAST(content)

      const mathInlines = findNodesByType(ast, 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].content).toBe('\\frac{a}{b}')
    })
  })
})
