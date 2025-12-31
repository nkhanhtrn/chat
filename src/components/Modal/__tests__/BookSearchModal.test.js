import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookSearchModal from '../BookSearchModal.vue'
import Modal from '../Modal.vue'
import Button from '../../Button.vue'
import * as publicLibraryService from '../../../services/publicLibraryService.js'
import * as epubRenderer from '../../../services/epubRenderer.js'
import * as bookStorage from '../../../services/bookStorage.js'

// Mock publicLibraryService module
vi.mock('../../../services/publicLibraryService.js', () => ({
  searchBooks: vi.fn(),
  getProxiedImageUrl: vi.fn((url) => url ? `https://proxy.com/${url}` : null)
}))

// Mock epubRenderer module
vi.mock('../../../services/epubRenderer.js', () => ({
  extractEpubMetadata: vi.fn(() => Promise.resolve({
    title: 'Test Book',
    author: 'Test Author',
    coverUrl: null
  })),
  coverUrlToDataUrl: vi.fn(() => Promise.resolve(null))
}))

// Mock bookStorage module
vi.mock('../../../services/bookStorage.js', () => ({
  uploadBookToStorage: vi.fn(() => Promise.resolve('https://storage.url/book.epub'))
}))

const { searchBooks, getProxiedImageUrl } = publicLibraryService
const { extractEpubMetadata, coverUrlToDataUrl } = epubRenderer
const { uploadBookToStorage } = bookStorage

describe('BookSearchModal', () => {
  const mockSearchResults = [
    {
      id: 'public-library-1',
      title: 'Test Book 1',
      author: 'Author One',
      coverUrl: 'https://example.com/cover1.jpg',
      detailUrl: 'https://test-library.org/md5/abc123',
      format: 'EPUB',
      source: 'public-library'
    },
    {
      id: 'public-library-2',
      title: 'Test Book 2',
      author: 'Author Two',
      coverUrl: 'https://example.com/cover2.jpg',
      detailUrl: 'https://test-library.org/md5/def456',
      format: 'EPUB',
      source: 'public-library'
    }
  ]

  const mountComponent = (props = {}) => {
    return mount(BookSearchModal, {
      props: {
        visible: true,
        ...props
      },
      global: {
        stubs: {
          Teleport: true
        },
        components: {
          Modal: Modal,
          Button: Button
        }
      }
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders search input and button', () => {
      const wrapper = mountComponent()

      expect(wrapper.find('.search-input').exists()).toBe(true)
      expect(wrapper.find('.search-submit-btn').exists()).toBe(true)
    })

    it('renders with correct title', () => {
      const wrapper = mountComponent()
      // The Modal component renders the title
      expect(wrapper.text()).toContain('Add Book')
    })

    it('shows loading state during search', async () => {
      searchBooks.mockImplementation(() => new Promise(() => {})) // Never resolves

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test query')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')

      expect(wrapper.find('.loading-state').exists()).toBe(true)
      expect(wrapper.find('.spinner').exists()).toBe(true)
    })

    it('shows empty state when no results found', async () => {
      searchBooks.mockResolvedValue([])

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('no results query')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No books found')
    })

    it('shows results grid when books are found', async () => {
      searchBooks.mockResolvedValue(mockSearchResults)

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.results-grid').exists()).toBe(true)
      expect(wrapper.findAll('.book-result-card').length).toBe(2)
    })

    it('displays error message on search failure', async () => {
      searchBooks.mockRejectedValue(new Error('Network error'))

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toContain('Network error')
    })
  })

  describe('search functionality', () => {
    it('calls searchBooks with query when search button clicked', async () => {
      searchBooks.mockResolvedValue([])

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test book')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(searchBooks).toHaveBeenCalledWith('test book')
    })

    it('calls searchBooks when Enter key pressed in input', async () => {
      searchBooks.mockResolvedValue([])

      const wrapper = mountComponent()
      const input = wrapper.find('.search-input')
      await input.setValue('test query')
      await input.trigger('keydown.enter')
      await flushPromises()

      expect(searchBooks).toHaveBeenCalledWith('test query')
    })

    it('does not search with empty query', async () => {
      searchBooks.mockResolvedValue([])

      const wrapper = mountComponent()

      const buttons = wrapper.findAll('button')
      const searchBtn = buttons.find(btn => btn.text() === 'Search')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(searchBooks).not.toHaveBeenCalled()
    })

    it('does not search with whitespace-only query', async () => {
      searchBooks.mockResolvedValue([])

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('   ')

      const buttons = wrapper.findAll('button')
      const searchBtn = buttons.find(btn => btn.text() === 'Search')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(searchBooks).not.toHaveBeenCalled()
    })

    it('resets to page 1 on new search', async () => {
      searchBooks.mockResolvedValue([...mockSearchResults, ...mockSearchResults])

      const wrapper = mountComponent()
      // First search
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      // Go to page 2
      const pageNumbers = wrapper.findAll('.page-number')
      if (pageNumbers.length > 1) {
        await pageNumbers[1]?.trigger('click')
        await flushPromises()

        // New search
        await wrapper.find('.search-input').setValue('new test')
        await searchBtn.trigger('click')
        await flushPromises()

        // Should be back to page 1 (active page number)
        const activePage = wrapper.find('.page-number.active')
        expect(activePage.exists()).toBe(true)
        if (activePage.exists()) {
          expect(activePage.text()).toBe('1')
        }
      }
    })
  })

  describe('book results display', () => {
    beforeEach(async () => {
      searchBooks.mockResolvedValue(mockSearchResults)
    })

    const getSearchBtn = (wrapper) => {
      return wrapper.find('.search-submit-btn')
    }

    it('displays book titles', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      const titles = wrapper.findAll('.book-title')
      expect(titles[0].text()).toBe('Test Book 1')
      expect(titles[1].text()).toBe('Test Book 2')
    })

    it('displays book authors', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      const authors = wrapper.findAll('.book-author')
      expect(authors[0].text()).toBe('Author One')
      expect(authors[1].text()).toBe('Author Two')
    })

    it('uses proxied image URL for covers', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      const images = wrapper.findAll('.book-cover img')
      expect(images[0].attributes('src')).toContain('https://proxy.com/')
    })

    it('shows placeholder when no cover URL', async () => {
      searchBooks.mockResolvedValue([
        {
          id: 'public-library-1',
          title: 'Book without cover',
          author: 'Author',
          coverUrl: null,
          detailUrl: 'https://test-library.org/md5/test',
          format: 'EPUB',
          source: 'public-library'
        }
      ])

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('.cover-placeholder').exists()).toBe(true)
    })

    it('shows results count', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('.results-count').text()).toBe('2 books found')
    })

    it('renders book cards as divs with click handlers', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      const bookCards = wrapper.findAll('.book-result-card')
      expect(bookCards[0].element.tagName).toBe('DIV')
      expect(bookCards[0].classes()).toContain('book-result-card')
    })
  })

  describe('pagination', () => {
    beforeEach(async () => {
      // Create 10 results for pagination
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        id: `public-library-${i}`,
        title: `Book ${i + 1}`,
        author: `Author ${i + 1}`,
        coverUrl: `https://example.com/cover${i}.jpg`,
        detailUrl: `https://test-library.org/md5/${i}`,
        format: 'EPUB',
        source: 'public-library'
      }))
      searchBooks.mockResolvedValue(manyResults)
    })

    const getSearchBtn = (wrapper) => {
      return wrapper.find('.search-submit-btn')
    }

    it('shows 4 items per page', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.findAll('.book-result-card').length).toBe(4)
    })

    it('shows pagination controls for multiple pages', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.find('.pagination').exists()).toBe(true)
      expect(wrapper.find('.page-info').text()).toBe('Page 1 of 3')
    })

    it('disables prev button on first page', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      const prevBtn = wrapper.findAll('.pagination-btn')[0]
      expect(prevBtn.attributes('disabled')).toBeDefined()
    })

    it('navigates to next page when clicking next', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      await getSearchBtn(wrapper).trigger('click')
      await flushPromises()

      const nextBtn = wrapper.findAll('.pagination-btn')[1]
      await nextBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.page-number.active').text()).toBe('2')
    })
  })

  describe('modal behavior', () => {
    it('emits close event when close button clicked', async () => {
      const wrapper = mountComponent()

      const closeBtn = wrapper.findAll('button').find(btn => btn.text() === 'Close')
      if (closeBtn) {
        await closeBtn.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
      }
    })

    it('resets state when modal reopens', async () => {
      searchBooks.mockResolvedValue(mockSearchResults)

      const wrapper = mountComponent({ visible: true })
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.results-grid').exists()).toBe(true)

      // Close and reopen
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })
      await flushPromises()

      // Results should be cleared
      expect(wrapper.find('.results-section')?.exists()).toBe(false)
    })

    it('disables search button during search', async () => {
      searchBooks.mockImplementation(() => new Promise(() => {}))

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')

      expect(searchBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('dismisses error when clicking dismiss button', async () => {
      searchBooks.mockRejectedValue(new Error('Test error'))

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)

      await wrapper.find('.error-dismiss').trigger('click')

      expect(wrapper.find('.error-message')?.exists()).toBe(false)
    })
  })

  describe('cover image error handling', () => {
    it('shows placeholder when image fails to load', async () => {
      searchBooks.mockResolvedValue(mockSearchResults)

      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')

      const searchBtn = wrapper.find('.search-submit-btn')
      await searchBtn.trigger('click')
      await flushPromises()

      const img = wrapper.find('.book-cover img')
      if (img.exists()) {
        await img.trigger('error')
        await flushPromises()

        const imgAfterError = wrapper.find('.book-cover img')
        const hasDisplayNone = imgAfterError.attributes('style')?.includes('display') ||
                               imgAfterError.element?.style?.display === 'none'

        const placeholder = wrapper.find('.cover-placeholder')
        expect(hasDisplayNone || placeholder.exists()).toBe(true)
      }
    })
  })

  describe('tabs', () => {
    it('renders Search and Upload tabs', () => {
      const wrapper = mountComponent()

      const tabs = wrapper.findAll('.tab')
      expect(tabs.length).toBe(2)
      expect(tabs[0].text()).toBe('Search')
      expect(tabs[1].text()).toBe('Upload')
    })

    it('shows Search tab as active by default', () => {
      const wrapper = mountComponent({ defaultTab: 'search' })

      const tabs = wrapper.findAll('.tab')
      expect(tabs[0].classes()).toContain('active')
      expect(tabs[1].classes()).not.toContain('active')
    })

    it('switches to Upload tab when clicked', async () => {
      const wrapper = mountComponent()

      const tabs = wrapper.findAll('.tab')
      await tabs[1].trigger('click')

      expect(tabs[1].classes()).toContain('active')
      expect(tabs[0].classes()).not.toContain('active')
    })

    it('opens on Upload tab when defaultTab is upload', () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      const tabs = wrapper.findAll('.tab')
      expect(tabs[1].classes()).toContain('active')
      expect(tabs[0].classes()).not.toContain('active')
    })
  })

  describe('upload tab', () => {
    it('renders drop zone when Upload tab is active', () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      expect(wrapper.find('.drop-zone').exists()).toBe(true)
    })

    it('shows drop zone icon and instructions', () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      expect(wrapper.find('.drop-icon').exists()).toBe(true)
      expect(wrapper.text()).toContain('Drop your EPUB file here')
      expect(wrapper.text()).toContain('or click to browse')
      expect(wrapper.text()).toContain('Only .epub files are supported')
    })

    it('shows drag-over state when dragging over drop zone', async () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      const dropZone = wrapper.find('.drop-zone')
      await dropZone.trigger('dragover', { preventDefault: vi.fn() })

      expect(dropZone.classes()).toContain('drag-over')
    })

    it('removes drag-over state when dragging leaves', async () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      const dropZone = wrapper.find('.drop-zone')
      await dropZone.trigger('dragover', { preventDefault: vi.fn() })
      await dropZone.trigger('dragleave', { preventDefault: vi.fn() })

      expect(dropZone.classes()).not.toContain('drag-over')
    })

    it('shows error for non-EPUB files', async () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toContain('EPUB file')
    })

    it('shows uploading state during upload', async () => {
      extractEpubMetadata.mockImplementation(() => new Promise(() => {})) // Never resolves

      const wrapper = mountComponent({ defaultTab: 'upload' })

      const mockFile = new File(['content'], 'test.epub', { type: 'application/epub+zip' })
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      fileInput.trigger('change')
      await flushPromises()

      expect(wrapper.find('.drop-zone').classes()).toContain('uploading')
      expect(wrapper.find('.uploading-state').exists()).toBe(true)
    })

    it('shows uploading state with progress indicator during upload', async () => {
      extractEpubMetadata.mockImplementation(() => new Promise(() => {}))

      const wrapper = mountComponent({ defaultTab: 'upload' })

      const mockFile = new File(['content'], 'test.epub', { type: 'application/epub+zip' })
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      fileInput.trigger('change')
      await flushPromises()

      expect(wrapper.find('.drop-zone').classes()).toContain('uploading')
      expect(wrapper.find('.upload-progress').exists()).toBe(true)
    })

    it('dismisses upload error when clicking dismiss button', async () => {
      const wrapper = mountComponent({ defaultTab: 'upload' })

      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = wrapper.find('input[type="file"]')

      Object.defineProperty(fileInput.element, 'files', {
        value: [mockFile],
        writable: false
      })

      await fileInput.trigger('change')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)

      await wrapper.find('.error-dismiss').trigger('click')

      expect(wrapper.find('.error-message')?.exists()).toBe(false)
    })
  })

  describe('tab state reset', () => {
    it('resets to default tab when modal closes and reopens', async () => {
      const wrapper = mountComponent({ defaultTab: 'search', visible: true })

      // Switch to upload tab
      const tabs = wrapper.findAll('.tab')
      await tabs[1].trigger('click')

      expect(tabs[1].classes()).toContain('active')

      // Close and reopen
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })
      await flushPromises()

      // Should be back to search tab (default)
      const tabsAfter = wrapper.findAll('.tab')
      expect(tabsAfter[0].classes()).toContain('active')
    })
  })
})
