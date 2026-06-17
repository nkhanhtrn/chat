import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookTocSidebar from '../BookTocSidebar.vue'
import type { TocItem } from '@/types/book'

const BookTocItemStub = {
  name: 'BookTocItem',
  props: ['item', 'depth', 'activeHref'],
  emits: ['navigate'],
  template: `<div class="stub-toc-item" @click="$emit('navigate', item.href)">{{ item.label }}</div>`,
}

const toc: TocItem[] = [
  { id: '1', label: 'Chapter 1', href: 'ch1', subitems: [] },
  { id: '2', label: 'Chapter 2', href: 'ch2', subitems: [] },
]

function mountSidebar(props = {}) {
  return mount(BookTocSidebar, {
    props: { toc, bookTitle: 'My Book', ...props },
    global: { stubs: { BookTocItem: BookTocItemStub } },
  })
}

describe('BookTocSidebar', () => {
  it('shows header with book title by default', () => {
    const wrapper = mountSidebar()
    expect(wrapper.find('.sidebar-header').exists()).toBe(true)
    expect(wrapper.find('.book-title').text()).toBe('My Book')
    wrapper.unmount()
  })

  it('hides header when hideHeader is true', () => {
    const wrapper = mountSidebar({ hideHeader: true })
    expect(wrapper.find('.sidebar-header').exists()).toBe(false)
    expect(wrapper.find('.back-btn').exists()).toBe(false)
    wrapper.unmount()
  })

  it('still shows search when header is hidden', () => {
    const wrapper = mountSidebar({ hideHeader: true })
    expect(wrapper.find('.sidebar-search').exists()).toBe(true)
    expect(wrapper.find('.search-input').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders toc items', () => {
    const wrapper = mountSidebar()
    expect(wrapper.findAll('.stub-toc-item')).toHaveLength(2)
    wrapper.unmount()
  })

  it('shows empty state when toc is empty', () => {
    const wrapper = mountSidebar({ toc: [] })
    expect(wrapper.text()).toContain('No chapters found')
    wrapper.unmount()
  })

  it('shows filtered search results when query is entered', async () => {
    const wrapper = mountSidebar()
    await wrapper.find('.search-input').setValue('Chapter 1')
    expect(wrapper.find('.search-results-list').exists()).toBe(true)
    expect(wrapper.text()).toContain('Chapter 1')
    expect(wrapper.text()).not.toContain('Chapter 2')
    wrapper.unmount()
  })

  it('shows no results message when search finds nothing', async () => {
    const wrapper = mountSidebar()
    await wrapper.find('.search-input').setValue('xyz')
    expect(wrapper.text()).toContain('No results found')
    wrapper.unmount()
  })

  it('clears search on Escape', async () => {
    const wrapper = mountSidebar()
    await wrapper.find('.search-input').setValue('test')
    await wrapper.find('.search-input').trigger('keydown.escape')
    expect(wrapper.find('.search-input').element.value).toBe('')
    wrapper.unmount()
  })

  it('emits navigate when a search result is clicked', async () => {
    const wrapper = mountSidebar()
    await wrapper.find('.search-input').setValue('Chapter 1')
    await wrapper.find('.search-result-item').trigger('click')
    expect(wrapper.emitted('navigate')).toBeTruthy()
    expect(wrapper.emitted('navigate')![0]).toEqual(['ch1'])
    wrapper.unmount()
  })
})
