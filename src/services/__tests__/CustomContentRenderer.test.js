import { describe, it, expect, vi } from 'vitest'
import { CustomContentRenderer } from '../CustomContentRenderer.js'

describe('CustomContentRenderer', () => {
  let renderer
  let highlightPlugin
  let notePlugin

  beforeEach(() => {
    renderer = new CustomContentRenderer()
    highlightPlugin = {
      extract: vi.fn((text, item) => ({
        processed: text.replace(item.text, `__HIGHLIGHT_${item.id}__`),
        placeholder: { ...item, id: `__HIGHLIGHT_${item.id}__`, type: 'highlight' }
      })),
      render: vi.fn((placeholder) => `<mark>${placeholder.text}</mark>`)
    }
    notePlugin = {
      extract: vi.fn((text, item) => ({
        processed: text.replace(item.text, `__NOTE_${item.id}__`),
        placeholder: { ...item, id: `__NOTE_${item.id}__`, type: 'note' }
      })),
      render: vi.fn((placeholder) => `<span class="note">${placeholder.text}</span>`)
    }
    renderer.register('highlight', highlightPlugin)
    renderer.register('note', notePlugin)
  })

  it('registers plugins and stores them', () => {
    expect(renderer.plugins.get('highlight')).toBe(highlightPlugin)
    expect(renderer.plugins.get('note')).toBe(notePlugin)
  })

  it('extract returns original text and empty placeholders if no items', () => {
    const result = renderer.extract('abc', [])
    expect(result.processed).toBe('abc')
    expect(result.placeholders).toEqual([])
  })

  it('extract calls plugin.extract and replaces text', () => {
    const items = [{ id: 1, type: 'highlight', text: 'foo' }]
    const result = renderer.extract('foo bar', items)
    expect(highlightPlugin.extract).toHaveBeenCalled()
    expect(result.processed).toContain('__HIGHLIGHT_1__')
    expect(result.placeholders[0].id).toBe('__HIGHLIGHT_1__')
  })

  it('extract processes multiple items in reverse order', () => {
    const items = [
      { id: 1, type: 'highlight', text: 'foo', startOffset: 0 },
      { id: 2, type: 'note', text: 'bar', startOffset: 4 }
    ]
    const result = renderer.extract('foo bar', items)
    // Both plugins called
    expect(highlightPlugin.extract).toHaveBeenCalled()
    expect(notePlugin.extract).toHaveBeenCalled()
    // Placeholders present
    expect(result.processed).toContain('__HIGHLIGHT_1__')
    expect(result.processed).toContain('__NOTE_2__')
  })

  it('render replaces placeholders with plugin.render output', () => {
    const html = 'abc __HIGHLIGHT_1__ xyz __NOTE_2__'
    const placeholders = [
      { id: '__HIGHLIGHT_1__', type: 'highlight', text: 'foo' },
      { id: '__NOTE_2__', type: 'note', text: 'bar' }
    ]
    const result = renderer.render(html, placeholders)
    expect(result).toContain('<mark>foo</mark>')
    expect(result).toContain('<span class="note">bar</span>')
  })

  it('render skips missing plugin.render', () => {
    renderer.plugins.delete('highlight')
    const html = 'abc __HIGHLIGHT_1__'
    const placeholders = [
      { id: '__HIGHLIGHT_1__', type: 'highlight', text: 'foo' }
    ]
    const result = renderer.render(html, placeholders)
    expect(result).toContain('__HIGHLIGHT_1__')
  })

  it('extract skips missing plugin.extract', () => {
    renderer.plugins.delete('highlight')
    const items = [{ id: 1, type: 'highlight', text: 'foo' }]
    const result = renderer.extract('foo bar', items)
    expect(result.processed).toBe('foo bar')
    expect(result.placeholders).toEqual([])
  })

  it('works end-to-end: extract then render', () => {
    const items = [
      { id: 1, type: 'highlight', text: 'foo' },
      { id: 2, type: 'note', text: 'bar' }
    ]
    const { processed, placeholders } = renderer.extract('foo bar', items)
    const html = renderer.render(processed, placeholders)
    expect(html).toContain('<mark>foo</mark>')
    expect(html).toContain('<span class="note">bar</span>')
  })
})
