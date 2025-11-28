import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getMarkdownOffsetsFromSelection, getSelectedTextAndPosition } from '../DOMSelectionHelper.js'

describe('DOMSelectionHelper', () => {
  let container

  beforeEach(() => {
    // Create a container div for our tests
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    // Clean up
    document.body.removeChild(container)
    window.getSelection().removeAllRanges()
  })

  describe('getMarkdownOffsetsFromSelection', () => {
    it('should return null for empty selection', () => {
      const result = getMarkdownOffsetsFromSelection()
      expect(result).toBeNull()
    })

    it('should get offsets from single element selection', () => {
      // Create HTML with position markers (as rendered by AST renderer)
      container.innerHTML = '<span data-md-start="0" data-md-end="11">Hello world</span>'

      // Select "world" (offset 6-11 in text, 6-11 in markdown)
      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 6)
      range.setEnd(textNode, 11)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('world')
      expect(result.startOffset).toBe(6)
      expect(result.endOffset).toBe(11)
    })

    it('should get offsets across markdown boundaries', () => {
      // Simulate "This is **bold** text" rendered with position markers
      // Raw markdown positions: "This is " (0-8), "bold" (10-14), " text" (16-21)
      container.innerHTML = '<span data-md-start="0" data-md-end="8">This is </span><strong><span data-md-start="10" data-md-end="14">bold</span></strong><span data-md-start="16" data-md-end="21"> text</span>'

      // Select "bold text" - crosses the bold boundary
      const range = document.createRange()
      const boldText = container.querySelector('strong span').firstChild
      const afterText = container.querySelectorAll('span')[2].firstChild

      range.setStart(boldText, 0) // Start of "bold"
      range.setEnd(afterText, 5) // End of " text"

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('bold text')
      // Should map to markdown positions: 10 (start of "bold") to 21 (end of "text")
      expect(result.startOffset).toBe(10)
      expect(result.endOffset).toBe(21)
    })

    it('should handle selection in the middle of text', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="13">Hello, world!</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 7) // "world"
      range.setEnd(textNode, 12)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('world')
      expect(result.startOffset).toBe(7)
      expect(result.endOffset).toBe(12)
    })

    it('should handle selection with custom highlight already present', () => {
      // Simulate existing highlight with position markers
      container.innerHTML = `
        <span data-md-start="0" data-md-end="5">This </span>
        <mark class="custom-highlight" data-md-start="5" data-md-end="7">is</mark>
        <span data-md-start="7" data-md-end="12"> text</span>
      `

      // Select " text" after the highlight
      const range = document.createRange()
      const afterMark = container.querySelectorAll('span')[1].firstChild

      range.setStart(afterMark, 0)
      range.setEnd(afterMark, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe(' text')
      expect(result.startOffset).toBe(7)
      expect(result.endOffset).toBe(12)
    })
  })

  describe('getSelectedTextAndPosition', () => {
    it('should return position and offsets for selection', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="11">Hello world</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 6)
      range.setEnd(textNode, 11)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getSelectedTextAndPosition(selection)

      expect(result.selectedText).toBe('world')
      expect(result.visible).toBe(true)
      expect(result.x).toBeGreaterThanOrEqual(0)
      expect(result.y).toBeGreaterThanOrEqual(0)
      expect(result.startOffset).toBe(6)
      expect(result.endOffset).toBe(11)
    })

    it('should return empty result for no selection', () => {
      const result = getSelectedTextAndPosition()

      expect(result.selectedText).toBe('')
      expect(result.visible).toBe(false)
    })
  })

  describe('Complex markdown scenarios', () => {
    it('should handle selection across nested formatting', () => {
      // "Text with **bold *and italic* text** here"
      container.innerHTML = '<span data-md-start="0" data-md-end="10">Text with </span><strong><span data-md-start="12" data-md-end="17">bold </span><em><span data-md-start="18" data-md-end="28">and italic</span></em><span data-md-start="29" data-md-end="34"> text</span></strong><span data-md-start="36" data-md-end="41"> here</span>'

      // Select from "and italic" to "here"
      const range = document.createRange()
      const italicText = container.querySelector('em span').firstChild
      const afterText = container.querySelectorAll('span')[4].firstChild // Index 4 because we have more spans now

      range.setStart(italicText, 0)
      range.setEnd(afterText, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.startOffset).toBe(18) // Start of "and italic"
      expect(result.endOffset).toBe(41) // End of " here"
    })

    it('should handle selection in list items', () => {
      container.innerHTML = `
        <ul>
          <li><span data-md-start="2" data-md-end="8">Item 1</span></li>
          <li><span data-md-start="10" data-md-end="16">Item 2</span></li>
        </ul>
      `

      // Select "Item 2"
      const range = document.createRange()
      const item2Text = container.querySelectorAll('span')[1].firstChild

      range.setStart(item2Text, 0)
      range.setEnd(item2Text, 6)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('Item 2')
      expect(result.startOffset).toBe(10)
      expect(result.endOffset).toBe(16)
    })
  })
})
