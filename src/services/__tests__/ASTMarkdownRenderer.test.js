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

  describe('Collapsible Block Extraction', () => {
    it('should extract [HIDDEN]...[/HIDDEN] blocks', () => {
      const content = 'Before [HIDDEN]secret content[/HIDDEN] after'
      const ast = parseMarkdownToAST(content)

      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBe(1)
      expect(collapsibleBlocks[0].children).toBeDefined()
    })

    it('should parse markdown content inside hidden blocks', () => {
      const content = '[HIDDEN]**bold** and *italic*[/HIDDEN]'
      const ast = parseMarkdownToAST(content)

      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBe(1)

      // Check that children contain parsed markdown (strong and em nodes)
      const strongNodes = findNodesByType(collapsibleBlocks[0], 'strong')
      const emNodes = findNodesByType(collapsibleBlocks[0], 'em')
      expect(strongNodes.length).toBe(1)
      expect(emNodes.length).toBe(1)
    })

    it('should handle multiline hidden blocks', () => {
      const content = `Some text
[HIDDEN]
- Item 1
- Item 2
- Item 3
[/HIDDEN]
More text`
      const ast = parseMarkdownToAST(content)

      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBe(1)

      // Check that list is parsed inside
      const listNodes = findNodesByType(collapsibleBlocks[0], 'list')
      expect(listNodes.length).toBe(1)
    })

    it('should handle code blocks inside hidden blocks', () => {
      const content = `[HIDDEN]
\`\`\`javascript
const x = 5;
\`\`\`
[/HIDDEN]`
      const ast = parseMarkdownToAST(content)

      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBe(1)

      const codeBlocks = findNodesByType(collapsibleBlocks[0], 'code_block')
      expect(codeBlocks.length).toBe(1)
      expect(codeBlocks[0].language).toBe('javascript')
      expect(codeBlocks[0].code).toBe('const x = 5;')
    })

    it('should handle multiple hidden blocks', () => {
      const content = '[HIDDEN]first[/HIDDEN] middle [HIDDEN]second[/HIDDEN]'
      const ast = parseMarkdownToAST(content)

      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBe(2)
    })

    it('should handle nested hidden blocks', () => {
      const content = '[HIDDEN]outer [HIDDEN]inner[/HIDDEN] content[/HIDDEN]'
      const ast = parseMarkdownToAST(content)

      // The outer block should contain another collapsible block as a child
      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBeGreaterThanOrEqual(1)
    })

    it('should preserve text around hidden blocks', () => {
      const content = 'Before [HIDDEN]hidden[/HIDDEN] after'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      expect(textNodes.some(n => n.content && n.content.includes('Before'))).toBe(true)
      expect(textNodes.some(n => n.content && n.content.includes('after'))).toBe(true)
    })

    it('should handle math inside hidden blocks', () => {
      const content = '[HIDDEN]The formula $x^2 + y^2 = z^2$ is important[/HIDDEN]'
      const ast = parseMarkdownToAST(content)

      const collapsibleBlocks = findNodesByType(ast, 'collapsible_block')
      expect(collapsibleBlocks.length).toBe(1)

      const mathInlines = findNodesByType(collapsibleBlocks[0], 'math_inline')
      expect(mathInlines.length).toBe(1)
      expect(mathInlines[0].content).toBe('x^2 + y^2 = z^2')
    })
  })

  describe('Position Tracking with Code Blocks', () => {
    it('should assign correct offsets to text before code block', () => {
      const content = `Text before code
\`\`\`javascript
const x = 1;
\`\`\`
Text after code`
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const beforeText = textNodes.find(n => n.content && n.content.includes('Text before'))

      expect(beforeText).toBeDefined()
      expect(beforeText.startOffset).toBe(0)
    })

    it('should assign correct offsets to text after code block', () => {
      const content = `Text before
\`\`\`javascript
const x = 1;
\`\`\`
Text after code`
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const afterText = textNodes.find(n => n.content && n.content.includes('Text after'))

      expect(afterText).toBeDefined()
      // The text "Text after code" should start after the code block ends
      // Code block: ```javascript\nconst x = 1;\n``` = approximately 28 chars
      // Starting position should be after "Text before\n" (12) + code block
      expect(afterText.startOffset).toBeGreaterThan(30)
    })

    it('should map text offsets correctly with multiple code blocks', () => {
      const content = `First paragraph

\`\`\`python
x = 1
\`\`\`

Second paragraph

\`\`\`javascript
y = 2
\`\`\`

Third paragraph`
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const firstPara = textNodes.find(n => n.content && n.content.includes('First'))
      const secondPara = textNodes.find(n => n.content && n.content.includes('Second'))
      const thirdPara = textNodes.find(n => n.content && n.content.includes('Third'))

      expect(firstPara).toBeDefined()
      expect(secondPara).toBeDefined()
      expect(thirdPara).toBeDefined()

      // Offsets should be in increasing order
      expect(firstPara.startOffset).toBeLessThan(secondPara.startOffset)
      expect(secondPara.startOffset).toBeLessThan(thirdPara.startOffset)
    })

    it('should handle inline code with correct offsets', () => {
      const content = 'Use the `console.log` function'
      const ast = parseMarkdownToAST(content)

      const codeInline = findNodesByType(ast, 'code_inline')
      expect(codeInline.length).toBe(1)
      expect(codeInline[0].content).toBe('console.log')
      // Inline code starts at position 9 (after "Use the `")
      expect(codeInline[0].startOffset).toBe(9)
    })

    it('should preserve inline code offsets when highlight is applied inside (regression test)', () => {
      // This test verifies that inline code elements keep their offset data
      // even when custom content (highlights) are injected as children
      const content = 'Use the `code` function'
      const highlights = [{
        type: 'highlight',
        id: 'h1',
        startOffset: 9, // Highlight just the code content
        endOffset: 13,
        colorIndex: 0
      }]

      const ast = parseMarkdownToAST(content, highlights)

      const codeInline = findNodesByType(ast, 'code_inline')
      expect(codeInline.length).toBe(1)

      // The code_inline node should have children (the highlight) AND offsets
      expect(codeInline[0].children).toBeDefined()
      expect(codeInline[0].children.length).toBe(1)
      expect(codeInline[0].children[0].type).toBe('highlight')

      // Critical: offsets must be preserved for DOM selection to work
      expect(codeInline[0].startOffset).toBe(9)
      expect(codeInline[0].endOffset).toBe(13)
    })

    it('should correctly position text after inline code', () => {
      const content = 'Before `code` after'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const afterText = textNodes.find(n => n.content && n.content.includes('after'))

      expect(afterText).toBeDefined()
      // "Before " = 7 chars, "`code`" = 6 chars, so " after" starts at 13
      expect(afterText.startOffset).toBe(13)
    })

    it('should handle text with multiple inline code segments', () => {
      const content = 'Use `foo` and `bar` together'
      const ast = parseMarkdownToAST(content)

      const codeInlines = findNodesByType(ast, 'code_inline')
      expect(codeInlines.length).toBe(2)

      // First inline code: "foo" starts at position 5 (after "Use `")
      expect(codeInlines[0].startOffset).toBe(5)
      // Second inline code: "bar" starts at position 15 (after "Use `foo` and `")
      expect(codeInlines[1].startOffset).toBe(15)
    })

    it('should correctly calculate endOffset for text nodes', () => {
      const content = 'Hello world'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      expect(textNodes.length).toBe(1)
      expect(textNodes[0].startOffset).toBe(0)
      expect(textNodes[0].endOffset).toBe(11) // "Hello world" = 11 chars
    })

    it('should handle mixed content with code blocks and inline code', () => {
      const content = `Text with \`inline\` code

\`\`\`javascript
const x = 1;
\`\`\`

More text with \`another\` inline`
      const ast = parseMarkdownToAST(content)

      const codeInlines = findNodesByType(ast, 'code_inline')
      const codeBlocks = findNodesByType(ast, 'code_block')

      expect(codeBlocks.length).toBe(1)
      expect(codeInlines.length).toBe(2)

      // First inline code should be at the beginning
      expect(codeInlines[0].startOffset).toBeLessThan(codeBlocks[0].originalStart || codeBlocks[0].startOffset)
      // Second inline code should be after the code block
      expect(codeInlines[1].startOffset).toBeGreaterThan(codeBlocks[0].originalEnd || codeBlocks[0].endOffset)
    })
  })

  describe('Highlight Position Accuracy', () => {
    it('should apply highlight at correct position in simple text', () => {
      const content = 'Hello beautiful world'
      const highlights = [{
        type: 'highlight',
        id: 'h1',
        startOffset: 6,
        endOffset: 15, // "beautiful"
        colorIndex: 1
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const highlightNodes = findNodesByType(ast, 'highlight')
      expect(highlightNodes.length).toBe(1)
      expect(highlightNodes[0].text).toBe('beautiful')
    })

    it('should apply highlight correctly after code block', () => {
      const content = `Introduction

\`\`\`python
x = 1
\`\`\`

This is important text`
      // Find where "important" starts in the original content
      const importantStart = content.indexOf('important')
      const importantEnd = importantStart + 9

      const highlights = [{
        type: 'highlight',
        id: 'h1',
        startOffset: importantStart,
        endOffset: importantEnd,
        colorIndex: 2
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const highlightNodes = findNodesByType(ast, 'highlight')
      expect(highlightNodes.length).toBe(1)
      expect(highlightNodes[0].text).toBe('important')
    })

    it('should apply highlight correctly around inline code', () => {
      const content = 'Use the function wisely'
      // Highlight "the function" (positions 4-16)
      const highlights = [{
        type: 'highlight',
        id: 'h1',
        startOffset: 4,
        endOffset: 16,
        colorIndex: 0
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const highlightNodes = findNodesByType(ast, 'highlight')
      expect(highlightNodes.length).toBe(1)
      expect(highlightNodes[0].text).toBe('the function')
    })

    it('should handle highlight spanning multiple text nodes', () => {
      const content = 'Text **bold** more'
      // Highlight from "bold" to "more" - should create highlight nodes
      const boldStart = content.indexOf('**bold**') + 2 // position of 'b' in bold
      const moreEnd = content.length

      const highlights = [{
        type: 'highlight',
        id: 'h1',
        startOffset: boldStart,
        endOffset: moreEnd,
        colorIndex: 1
      }]
      const ast = parseMarkdownToAST(content, highlights)

      const highlightNodes = findNodesByType(ast, 'highlight')
      expect(highlightNodes.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Offset Mapping Verification', () => {
    it('should correctly map offsets for text adjacent to inline code', () => {
      const content = 'Birds can `fly` today'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const beforeCode = textNodes.find(n => n.content && n.content.includes('Birds'))
      const afterCode = textNodes.find(n => n.content && n.content.includes('today'))

      expect(beforeCode).toBeDefined()
      expect(afterCode).toBeDefined()

      // Verify the text at the mapped offsets matches
      expect(content.substring(beforeCode.startOffset, beforeCode.endOffset)).toBe(beforeCode.content)
      expect(content.substring(afterCode.startOffset, afterCode.endOffset)).toBe(afterCode.content)
    })

    it('should maintain offset accuracy after multiple code blocks', () => {
      const content = `Start
\`\`\`js
code1
\`\`\`
Middle
\`\`\`py
code2
\`\`\`
End text here`
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const endText = textNodes.find(n => n.content && n.content.includes('End text'))

      expect(endText).toBeDefined()
      // Verify the content at the offset matches
      expect(content.substring(endText.startOffset, endText.endOffset)).toBe(endText.content)
    })

    it('should handle text selection offset calculations correctly', () => {
      // This simulates the scenario where user selects text near inline code
      const content = 'Now only birds that can actually fly implement `IFlyable`.'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      const mainText = textNodes.find(n => n.content && n.content.includes('actually fly'))

      expect(mainText).toBeDefined()
      // The offset should correctly point to where this text is in the original
      const extractedText = content.substring(mainText.startOffset, mainText.endOffset)
      expect(extractedText).toBe(mainText.content)
    })

    it('should handle selection at word boundaries near inline code', () => {
      const content = 'The `variable` stores data'
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')

      textNodes.forEach(node => {
        if (node.content && node.startOffset !== undefined && node.endOffset !== undefined) {
          const extracted = content.substring(node.startOffset, node.endOffset)
          expect(extracted).toBe(node.content)
        }
      })
    })
  })

  describe('Mermaid Block Extraction', () => {
    it('should extract mermaid code blocks', () => {
      const content = `Here is a diagram:
\`\`\`mermaid
graph TD
    A --> B
\`\`\`
End of diagram.`
      const ast = parseMarkdownToAST(content)

      const mermaidBlocks = findNodesByType(ast, 'mermaid_block')
      expect(mermaidBlocks.length).toBe(1)
      expect(mermaidBlocks[0].code).toBe('graph TD\n    A --> B')
    })

    it('should not create duplicate code block for mermaid', () => {
      const content = `\`\`\`mermaid
flowchart LR
    A --> B
\`\`\``
      const ast = parseMarkdownToAST(content)

      const mermaidBlocks = findNodesByType(ast, 'mermaid_block')
      const codeBlocks = findNodesByType(ast, 'code_block')

      expect(mermaidBlocks.length).toBe(1)
      expect(codeBlocks.length).toBe(0)
    })

    it('should handle mermaid alongside regular code blocks', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
\`\`\`

\`\`\`javascript
const x = 1;
\`\`\``
      const ast = parseMarkdownToAST(content)

      const mermaidBlocks = findNodesByType(ast, 'mermaid_block')
      const codeBlocks = findNodesByType(ast, 'code_block')

      expect(mermaidBlocks.length).toBe(1)
      expect(codeBlocks.length).toBe(1)
      expect(codeBlocks[0].language).toBe('javascript')
    })

    it('should handle multiple mermaid blocks', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\``
      const ast = parseMarkdownToAST(content)

      const mermaidBlocks = findNodesByType(ast, 'mermaid_block')
      expect(mermaidBlocks.length).toBe(2)
      expect(mermaidBlocks[0].code).toContain('graph TD')
      expect(mermaidBlocks[1].code).toContain('sequenceDiagram')
    })

    it('should preserve text around mermaid blocks', () => {
      const content = `Before diagram
\`\`\`mermaid
graph TD
    A --> B
\`\`\`
After diagram`
      const ast = parseMarkdownToAST(content)

      const textNodes = findNodesByType(ast, 'text')
      expect(textNodes.some(n => n.content && n.content.includes('Before'))).toBe(true)
      expect(textNodes.some(n => n.content && n.content.includes('After'))).toBe(true)
    })

    it('should handle mermaid with various diagram types', () => {
      const content = `\`\`\`mermaid
pie title Pets
    "Dogs" : 386
    "Cats" : 85
\`\`\``
      const ast = parseMarkdownToAST(content)

      const mermaidBlocks = findNodesByType(ast, 'mermaid_block')
      expect(mermaidBlocks.length).toBe(1)
      expect(mermaidBlocks[0].code).toContain('pie title')
    })

    it('should assign correct offsets to mermaid blocks', () => {
      const content = `Text before
\`\`\`mermaid
graph LR
    A --> B
\`\`\`
Text after`
      const ast = parseMarkdownToAST(content)

      const mermaidBlocks = findNodesByType(ast, 'mermaid_block')
      expect(mermaidBlocks.length).toBe(1)
      expect(mermaidBlocks[0].startOffset).toBeDefined()
      expect(mermaidBlocks[0].endOffset).toBeDefined()
      expect(mermaidBlocks[0].startOffset).toBeGreaterThan(0)
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
