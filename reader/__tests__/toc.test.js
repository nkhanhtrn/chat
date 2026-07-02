import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadViews } from './helper'

describe('flattenToc', () => {
  it('returns empty array for empty input', () => {
    const { flattenToc } = loadViews()
    expect(flattenToc([], 0, [])).toEqual([])
  })

  it('flattens a flat list with depth 0', () => {
    const { flattenToc } = loadViews()
    var items = [
      { href: 'a.xhtml', label: 'Chapter A' },
      { href: 'b.xhtml', label: 'Chapter B' },
    ]
    var result = flattenToc(items, 0, [])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ href: 'a.xhtml', label: 'Chapter A', depth: 0 })
    expect(result[1]).toEqual({ href: 'b.xhtml', label: 'Chapter B', depth: 0 })
  })

  it('flattens nested subitems with increasing depth', () => {
    const { flattenToc } = loadViews()
    var items = [
      { href: 'a.xhtml', label: 'A', subitems: [
        { href: 'a1.xhtml', label: 'A1', subitems: [
          { href: 'a1x.xhtml', label: 'A1x' },
        ] },
      ] },
      { href: 'b.xhtml', label: 'B' },
    ]
    var result = flattenToc(items, 0, [])
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({ href: 'a.xhtml', label: 'A', depth: 0 })
    expect(result[1]).toEqual({ href: 'a1.xhtml', label: 'A1', depth: 1 })
    expect(result[2]).toEqual({ href: 'a1x.xhtml', label: 'A1x', depth: 2 })
    expect(result[3]).toEqual({ href: 'b.xhtml', label: 'B', depth: 0 })
  })

  it('uses (untitled) for items without label', () => {
    const { flattenToc } = loadViews()
    var result = flattenToc([{ href: 'a.xhtml' }], 0, [])
    expect(result[0].label).toBe('(untitled)')
  })
})

describe('TOC Modal', () => {
  let views

  beforeEach(() => {
    localStorage.clear()
    views = loadViews()
  })

  afterEach(() => {
    if (views) views.hideTocModal()
  })

  it('showTocModal creates overlay', () => {
    views.state.toc = [{ href: 'ch1.xhtml', label: 'Chapter 1' }]
    views.showTocModal()
    expect(document.getElementById('toc-overlay')).toBeTruthy()
    expect(document.getElementById('toc-body')).toBeTruthy()
    expect(document.getElementById('toc-footer')).toBeTruthy()
  })

  it('renders toc items on first page', () => {
    views.state.toc = [
      { href: 'ch1.xhtml', label: 'Chapter 1' },
      { href: 'ch2.xhtml', label: 'Chapter 2' },
    ]
    views.showTocModal()
    var items = document.querySelectorAll('.toc-item')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('Chapter 1')
    expect(items[1].textContent).toBe('Chapter 2')
  })

  it('shows empty message when toc is empty', () => {
    views.state.toc = []
    views.showTocModal()
    var empty = document.querySelector('.toc-empty')
    expect(empty).toBeTruthy()
    expect(empty.textContent).toContain('No contents')
  })

  it('hides overlay on hideTocModal', () => {
    views.state.toc = [{ href: 'ch1.xhtml', label: 'Chapter 1' }]
    views.showTocModal()
    expect(document.getElementById('toc-overlay')).toBeTruthy()
    views.hideTocModal()
    var overlay = document.getElementById('toc-overlay')
    expect(!overlay || overlay.style.display === 'none').toBe(true)
  })

  it('does not create duplicate overlay', () => {
    views.state.toc = [{ href: 'ch1.xhtml', label: 'Chapter 1' }]
    views.showTocModal()
    views.showTocModal()
    expect(document.querySelectorAll('#toc-overlay')).toHaveLength(1)
  })

  it('paginates - page 0 shows first 10 items', () => {
    views.state.toc = []
    for (var i = 0; i < 25; i++) {
      views.state.toc.push({ href: 'ch' + i + '.xhtml', label: 'Chapter ' + i })
    }
    views.showTocModal()
    var items = document.querySelectorAll('.toc-item')
    expect(items).toHaveLength(10)
    expect(items[0].textContent).toBe('Chapter 0')
    expect(items[9].textContent).toBe('Chapter 9')
  })

  it('paginates - page 1 shows items 10-19', () => {
    views.state.toc = []
    for (var i = 0; i < 25; i++) {
      views.state.toc.push({ href: 'ch' + i + '.xhtml', label: 'Chapter ' + i })
    }
    views.showTocModal()
    views.renderTocPage(1)
    var items = document.querySelectorAll('.toc-item')
    expect(items).toHaveLength(10)
    expect(items[0].textContent).toBe('Chapter 10')
    expect(items[9].textContent).toBe('Chapter 19')
  })

  it('paginates - last page shows remaining items', () => {
    views.state.toc = []
    for (var i = 0; i < 25; i++) {
      views.state.toc.push({ href: 'ch' + i + '.xhtml', label: 'Chapter ' + i })
    }
    views.showTocModal()
    views.renderTocPage(2)
    var items = document.querySelectorAll('.toc-item')
    expect(items).toHaveLength(5)
    expect(items[0].textContent).toBe('Chapter 20')
    expect(items[4].textContent).toBe('Chapter 24')
  })

  it('footer shows page numbers when multiple pages', () => {
    views.state.toc = []
    for (var i = 0; i < 25; i++) {
      views.state.toc.push({ href: 'ch' + i + '.xhtml', label: 'Chapter ' + i })
    }
    views.showTocModal()
    var pager = document.querySelector('.toc-footer .pager-info')
    expect(pager).toBeTruthy()
    expect(pager.textContent).toBe('1 / 3')
  })

  it('footer hidden when single page', () => {
    views.state.toc = [{ href: 'ch1.xhtml', label: 'Chapter 1' }]
    views.showTocModal()
    expect(document.querySelector('.toc-footer .pager-info')).toBeNull()
  })

  it('clicking item calls rendition.display and closes modal', () => {
    var displayedHref = null
    views.state.currentRendition = {
      display: function (href) { displayedHref = href },
    }
    views.state.toc = [{ href: 'ch1.xhtml', label: 'Chapter 1' }]
    views.showTocModal()

    var item = document.querySelector('.toc-item')
    item.click()

    expect(displayedHref).toBe('ch1.xhtml')
    var overlay = document.getElementById('toc-overlay')
    expect(!overlay || overlay.style.display === 'none').toBe(true)
  })

  it('nested items get deeper padding-left', () => {
    views.state.toc = [
      { href: 'a.xhtml', label: 'A', subitems: [
        { href: 'a1.xhtml', label: 'A1' },
      ] },
    ]
    views.showTocModal()
    var items = document.querySelectorAll('.toc-item')
    expect(items).toHaveLength(2)
    var pad0 = items[0].getAttribute('style')
    var pad1 = items[1].getAttribute('style')
    expect(pad0).toContain('padding-left:1rem')
    expect(pad1).toContain('padding-left:2.5rem')
  })
})
