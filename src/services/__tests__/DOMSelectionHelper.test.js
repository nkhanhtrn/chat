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

  describe('Multi-word mobile selection scenarios', () => {
    it('should handle selection when common ancestor is the positioned element itself', () => {
      // When selecting multiple words within a single span, the common ancestor
      // is the span itself (the positioned element)
      container.innerHTML = '<span data-md-start="0" data-md-end="26">The quick brown fox jumps</span>'

      // Select "quick brown" (multiple words)
      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 4)  // Start of "quick"
      range.setEnd(textNode, 15)   // End of "brown"

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('quick brown')
      expect(result.startOffset).toBe(4)
      expect(result.endOffset).toBe(15)
    })

    it('should handle selection across sibling spans (multi-word on mobile)', () => {
      // Simulate formatted text where words might be in separate spans
      // This can happen with mixed formatting: "Hello **world** today"
      container.innerHTML = '<p><span data-md-start="0" data-md-end="6">Hello </span><strong><span data-md-start="8" data-md-end="13">world</span></strong><span data-md-start="15" data-md-end="21"> today</span></p>'

      // Select "world today" (across formatting boundary)
      const range = document.createRange()
      const worldText = container.querySelector('strong span').firstChild
      const todayText = container.querySelectorAll('span')[2].firstChild

      range.setStart(worldText, 0)
      range.setEnd(todayText, 6)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('world today')
      expect(result.startOffset).toBe(8)
      expect(result.endOffset).toBe(21)
    })

    it('should find positioned elements by walking up DOM tree when none in direct children', () => {
      // Scenario where selection is inside deeply nested elements
      // and we need to walk up to find positioned siblings
      container.innerHTML = '<div class="paragraph"><span data-md-start="0" data-md-end="5">Hello</span><span data-md-start="5" data-md-end="6"> </span><span data-md-start="6" data-md-end="11">world</span></div>'

      // Select "Hello world" - starts in first span, ends in last span
      const range = document.createRange()
      const helloText = container.querySelectorAll('span')[0].firstChild
      const worldText = container.querySelectorAll('span')[2].firstChild

      range.setStart(helloText, 0)
      range.setEnd(worldText, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('Hello world')
      expect(result.startOffset).toBe(0)
      expect(result.endOffset).toBe(11)
    })

    it('should handle selection across multiple separate text spans (typical paragraph)', () => {
      // A typical paragraph with inline elements
      container.innerHTML = '<p><span data-md-start="0" data-md-end="4">This</span><span data-md-start="4" data-md-end="8"> is </span><span data-md-start="8" data-md-end="9">a</span><span data-md-start="9" data-md-end="14"> test</span></p>'

      // Select "is a test" (spans multiple elements)
      const range = document.createRange()
      const isText = container.querySelectorAll('span')[1].firstChild
      const testText = container.querySelectorAll('span')[3].firstChild

      range.setStart(isText, 1)  // Start after space, at "is"
      range.setEnd(testText, 5)  // End of " test"

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('is a test')
      expect(result.startOffset).toBe(5)  // 4 + 1
      expect(result.endOffset).toBe(14)
    })

    it('should handle selection where root element has position attributes', () => {
      // Edge case: the root/positioned element itself is selected
      container.innerHTML = '<span data-md-start="10" data-md-end="20">some text!</span>'

      // Select entire content
      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 10)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      const result = getMarkdownOffsetsFromSelection(selection)

      expect(result).not.toBeNull()
      expect(result.selectedText).toBe('some text!')
      expect(result.startOffset).toBe(10)
      expect(result.endOffset).toBe(20)
    })
  })

  describe('Context menu positioning', () => {
    it('should position context menu below selection when there is space', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="5">Hello</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      // Mock getBoundingClientRect to simulate element near top of page
      // window.innerHeight is 768 in jsdom, plenty of space below
      range.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 100
      })

      const result = getSelectedTextAndPosition(selection)

      expect(result.visible).toBe(true)
      // With plenty of space below, should position at rect.bottom
      expect(result.y).toBe(120 + window.scrollY)
    })

    it('should position context menu above selection when near page bottom', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="5">Hello</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      // Mock getBoundingClientRect to simulate element near bottom
      // window.innerHeight is 768 in jsdom, only 48px space below (less than 300)
      range.getBoundingClientRect = () => ({
        top: 700,
        bottom: 720,
        left: 50,
        right: 100
      })

      const result = getSelectedTextAndPosition(selection)

      expect(result.visible).toBe(true)
      // When near bottom, y should be positioned above
      // 700 (top) - 300 (menu height) = 400
      expect(result.y).toBe(700 + window.scrollY - 300)
    })

    it('should position context menu below when exactly enough space', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="5">Hello</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      // Mock getBoundingClientRect to simulate element with exactly enough space below
      // window.innerHeight is 768 in jsdom, menu height is 300
      // So if rect.bottom is 468, there's exactly 300px below
      range.getBoundingClientRect = () => ({
        top: 450,
        bottom: 468,
        left: 50,
        right: 100
      })

      const result = getSelectedTextAndPosition(selection)

      expect(result.visible).toBe(true)
      // With exactly enough space, should position below (at rect.bottom)
      expect(result.y).toBe(468 + window.scrollY)
    })

    it('should keep context menu on screen when selection is near right edge', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="5">Hello</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      // Mock getBoundingClientRect to simulate element near right edge
      // window.innerWidth is 1024 in jsdom, menu width is 250
      // Selection at x=900 would push menu off-screen
      range.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: 900,
        right: 950
      })

      const result = getSelectedTextAndPosition(selection)

      expect(result.visible).toBe(true)
      // Menu should be positioned so it doesn't go off right edge
      // 1024 (viewport) - 250 (menu width) = 774
      expect(result.x).toBe(1024 - 250 + window.scrollX)
    })

    it('should keep context menu on screen when selection is near left edge', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="5">Hello</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      // Mock getBoundingClientRect to simulate element at left edge
      // Negative left would be off-screen (can happen with scroll)
      range.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: -50,
        right: 50
      })

      const result = getSelectedTextAndPosition(selection)

      expect(result.visible).toBe(true)
      // Menu should be clamped to left edge (0 + scrollX)
      expect(result.x).toBe(window.scrollX)
    })

    it('should position normally when plenty of horizontal space', () => {
      container.innerHTML = '<span data-md-start="0" data-md-end="5">Hello</span>'

      const range = document.createRange()
      const textNode = container.firstChild.firstChild
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)

      // Mock getBoundingClientRect for element in middle of screen
      range.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: 300,
        right: 350
      })

      const result = getSelectedTextAndPosition(selection)

      expect(result.visible).toBe(true)
      // Should use selection's left position
      expect(result.x).toBe(300 + window.scrollX)
    })
  })
})
