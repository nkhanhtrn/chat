import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { BookData } from '@/types/book'

// Stub out the sync/backend layer so refreshBooks() on mount doesn't hit services
vi.mock('@/services/BookSyncService', () => ({
  syncBookList: vi.fn().mockResolvedValue({ books: [], lastSyncedAt: null, hasConflict: false }),
  syncBookContent: vi.fn().mockResolvedValue({ book: null }),
  saveBookList: vi.fn(),
  saveBook: vi.fn(),
  deleteBook: vi.fn(),
  resolveBookListConflict: vi.fn(),
}))
vi.mock('@/services/firestore/firestore-books', () => ({
  saveBookToFirestore: vi.fn(),
  deleteBookFromFirestore: vi.fn(),
  uploadBookFileToStorage: vi.fn(),
  downloadBookFileFromStorage: vi.fn(),
  loadBooksFromFirestore: vi.fn(),
}))
vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: vi.fn(() => ({ currentUser: { uid: 'u1' } })),
}))

import ReaderLibrary from '../ReaderLibrary.vue'
import { useBooksStore } from '@/stores/books'
import { syncBookList } from '@/services/BookSyncService'

function makeBook(overrides: Partial<BookData> = {}): BookData {
  return {
    id: 'b1',
    title: 'Book',
    author: 'Author',
    coverUrl: '',
    fileSize: 0,
    fileInStorage: true,
    fileStoragePath: '',
    createdAt: 0,
    updatedAt: 0,
    lastCfi: null,
    fileCachedAt: null,
    readingProgress: 0,
    fileType: 'epub',
    lastPage: null,
    totalPages: null,
    category: 'book',
    meta: null,
    ...overrides,
  }
}

async function mountWithBooks(books: BookData[]) {
  vi.mocked(syncBookList).mockResolvedValue({ books, lastSyncedAt: null, hasConflict: false })
  const wrapper = mount(ReaderLibrary, { global: { stubs: { RouterView: true } } })
  // let onMounted → refreshBooks() settle
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('ReaderLibrary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('lists EPUB books', async () => {
    const wrapper = await mountWithBooks([
      makeBook({ id: 'b1', title: 'Dune' }),
      makeBook({ id: 'b2', title: 'Hyperion' }),
    ])

    const titles = wrapper.findAll('.lib-title').map(el => el.text())
    expect(titles).toEqual(expect.arrayContaining(['Dune', 'Hyperion']))
    wrapper.unmount()
  })

  it('excludes PDF books and papers', async () => {
    const wrapper = await mountWithBooks([
      makeBook({ id: 'b1', title: 'EPUB One', fileType: 'epub' }),
      makeBook({ id: 'b2', title: 'PDF Doc', fileType: 'pdf' }),
      makeBook({ id: 'b3', title: 'Paper', fileType: 'pdf', category: 'paper' }),
    ])

    const titles = wrapper.findAll('.lib-title').map(el => el.text())
    expect(titles).toEqual(['EPUB One'])
    wrapper.unmount()
  })

  it('sorts by updatedAt descending', async () => {
    const wrapper = await mountWithBooks([
      makeBook({ id: 'old', title: 'Old', updatedAt: 1000 }),
      makeBook({ id: 'new', title: 'New', updatedAt: 3000 }),
      makeBook({ id: 'mid', title: 'Mid', updatedAt: 2000 }),
    ])

    const titles = wrapper.findAll('.lib-title').map(el => el.text())
    expect(titles).toEqual(['New', 'Mid', 'Old'])
    wrapper.unmount()
  })

  it('filters by search query (title or author)', async () => {
    const wrapper = await mountWithBooks([
      makeBook({ id: 'b1', title: 'Dune', author: 'Herbert' }),
      makeBook({ id: 'b2', title: 'Hyperion', author: 'Simmons' }),
    ])

    await wrapper.find('input[type="search"]').setValue('dune')
    await wrapper.vm.$nextTick()

    const titles = wrapper.findAll('.lib-title').map(el => el.text())
    expect(titles).toEqual(['Dune'])
    wrapper.unmount()
  })

  it('search matches author too', async () => {
    const wrapper = await mountWithBooks([
      makeBook({ id: 'b1', title: 'Dune', author: 'Herbert' }),
      makeBook({ id: 'b2', title: 'Hyperion', author: 'Simmons' }),
    ])

    await wrapper.find('input[type="search"]').setValue('herbert')
    await wrapper.vm.$nextTick()

    const titles = wrapper.findAll('.lib-title').map(el => el.text())
    expect(titles).toEqual(['Dune'])
    wrapper.unmount()
  })

  it('shows an empty hint when there are no books', async () => {
    const wrapper = await mountWithBooks([])
    expect(wrapper.find('.lib-empty').text()).toContain('No EPUB books yet')
    wrapper.unmount()
  })

  it('refreshes books from cloud on mount', async () => {
    await mountWithBooks([])
    expect(syncBookList).toHaveBeenCalled()
  })

  describe('theme toggle', () => {
    it('shows the current theme label', async () => {
      const wrapper = await mountWithBooks([])
      expect(wrapper.find('.lib-theme-btn').text()).toBe('Light')
      wrapper.unmount()
    })

    it('cycles to the next theme on click and persists it', async () => {
      const wrapper = await mountWithBooks([])
      await wrapper.find('.lib-theme-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.lib-theme-btn').text()).toBe('Sepia')
      expect(localStorage.getItem('theme')).toBe('sepia')
      expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
      wrapper.unmount()
    })
  })
})
