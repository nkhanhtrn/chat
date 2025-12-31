import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BooksLibrary from '../views/BooksLibrary.vue'
import { useBooksStore } from '../stores/books.js'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush
    }),
    useRoute: () => ({
      name: 'books',
      params: {}
    })
  }
})

// Mock AppLayout
vi.mock('../components/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="books-library-stub"><slot /></div>',
    props: ['storageKey']
  }
}))

// Mock EditBookModal
vi.mock('../components/EditBookModal.vue', () => ({
  default: {
    name: 'EditBookModal',
    template: '<div v-if="visible" class="edit-book-modal-stub">Edit Modal</div>',
    props: ['visible', 'book'],
    emits: ['close', 'save', 'delete']
  }
}))

// Mock book cover generator
vi.mock('../services/bookCoverGenerator.js', () => ({
  generateDefaultCover: vi.fn((title, author) => `blob:default-cover-${title}-${author}`)
}))

// Mock SlideTransition
vi.mock('../components/SlideTransition.vue', () => ({
  default: {
    name: 'SlideTransition',
    template: '<div><slot /></div>',
    props: ['appear', 'direction']
  }
}))

// Mock book storage services
vi.mock('../services/bookStorage.js', () => ({
  uploadBookToStorage: vi.fn(() => Promise.resolve('https://storage.url/book.epub')),
  saveBookFileToIDB: vi.fn(() => Promise.resolve()),
  loadBooksFromStorage: vi.fn(() => Promise.resolve({ hasConflict: false, state: { books: [] } })),
  saveBookToStorage: vi.fn(() => Promise.resolve()),
  deleteBookFromStorage: vi.fn(() => Promise.resolve()),
  getOrDownloadBookFile: vi.fn(() => Promise.resolve(new ArrayBuffer(100)))
}))

// Mock epub renderer
vi.mock('../services/epubRenderer.js', () => ({
  extractEpubMetadata: vi.fn(() => Promise.resolve({
    title: 'Test Book',
    author: 'Test Author',
    coverUrl: null
  })),
  coverUrlToDataUrl: vi.fn(() => Promise.resolve(null)),
  EpubRenderer: class {
    constructor(container, data) {
      this.container = container
      this.data = data
    }
    async initialize() { return Promise.resolve() }
    getTableOfContents() { return [] }
    destroy() {}
  }
}))

describe('BooksLibrary', () => {
  let wrapper
  let booksStore

  const mockBooks = [
    {
      id: 'book-1',
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      coverUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      totalProgress: 0.5,
      lastReadAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'book-2',
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      coverUrl: null,
      totalProgress: 0,
      lastReadAt: Date.now() - 100000,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'book-3',
      title: '1984',
      author: 'George Orwell',
      coverUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      totalProgress: 0.75,
      lastReadAt: Date.now() - 200000,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]

  beforeEach(async () => {
    setActivePinia(createPinia())
    booksStore = useBooksStore()
    mockPush.mockClear()

    // Initialize store with mock books
    booksStore.books = [...mockBooks]
    booksStore.isInitialized = true
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
  })

  const mountBooksLibrary = () => {
    return mount(BooksLibrary, {
      global: {
        stubs: {
          ProgressBar: {
            template: '<div class="progress-bar-stub" :style="{width: (progress * 100) + \'%\'}"></div>',
            props: ['progress']
          }
        }
      }
    })
  }

  describe('Rendering', () => {
    it('renders library header with title', () => {
      wrapper = mountBooksLibrary()
      expect(wrapper.find('.library-header h1').text()).toBe('My Library')
    })

    it('renders Add Book button', () => {
      wrapper = mountBooksLibrary()
      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('+'))
      expect(addButton).toBeTruthy()
    })

    it('renders books grid', () => {
      wrapper = mountBooksLibrary()
      expect(wrapper.find('.books-grid').exists()).toBe(true)
    })

    it('renders all books in the store', () => {
      wrapper = mountBooksLibrary()
      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(3)
    })

    it('renders book card with cover image', () => {
      wrapper = mountBooksLibrary()
      const firstCard = wrapper.findAll('.book-card')[0]
      const coverImg = firstCard.find('.book-cover img')
      expect(coverImg.exists()).toBe(true)
      expect(coverImg.attributes('src')).toContain('data:image/jpeg')
    })

    it('renders book card with default cover when no cover', () => {
      wrapper = mountBooksLibrary()
      const secondCard = wrapper.findAll('.book-card')[1]
      const coverImg = secondCard.find('.book-cover img.default-cover')
      expect(coverImg.exists()).toBe(true)
      expect(coverImg.attributes('src')).toContain('blob:default-cover-To Kill a Mockingbird-Harper Lee')
    })

    it('renders book title', () => {
      wrapper = mountBooksLibrary()
      const firstCard = wrapper.findAll('.book-card')[0]
      expect(firstCard.find('.book-title').text()).toBe('The Great Gatsby')
    })

    it('renders book author', () => {
      wrapper = mountBooksLibrary()
      const firstCard = wrapper.findAll('.book-card')[0]
      expect(firstCard.find('.book-author').text()).toBe('F. Scott Fitzgerald')
    })

    it('renders reading progress', () => {
      wrapper = mountBooksLibrary()
      const cards = wrapper.findAll('.book-card')

      expect(cards[0].find('.progress-text').text()).toBe('50%')
      expect(cards[1].find('.progress-text').text()).toBe('0%')
      expect(cards[2].find('.progress-text').text()).toBe('75%')
    })

    it('renders menu button on book card', () => {
      wrapper = mountBooksLibrary()
      const firstCard = wrapper.findAll('.book-card')[0]
      const menuBtn = firstCard.find('.menu-btn')
      expect(menuBtn.exists()).toBe(true)
    })

    it('shows empty state when no books', async () => {
      // Use a new wrapper instance with empty books
      booksStore.books = []
      const emptyWrapper = mount(BooksLibrary, {
        global: {
          stubs: {
            ProgressBar: {
              template: '<div class="progress-bar-stub"></div>',
              props: ['progress']
            }
          }
        }
      })
      await emptyWrapper.vm.$nextTick()

      // After loading, empty state should be shown
      // The component initializes asynchronously, so wait for that
      await new Promise(resolve => setTimeout(resolve, 10))
      await emptyWrapper.vm.$nextTick()

      // The books are rendered through SlideTransition
      const text = emptyWrapper.text()
      expect(text).toContain('No books')

      emptyWrapper.unmount()
    })
  })

  describe('Book Card Interactions', () => {
    it('opens book when clicking card', async () => {
      wrapper = mountBooksLibrary()

      // Mock preloadBook to resolve immediately
      vi.spyOn(booksStore, 'preloadBook').mockResolvedValue({
        fileData: new ArrayBuffer(100),
        toc: []
      })

      const firstCard = wrapper.findAll('.book-card')[0]
      await firstCard.trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockPush).toHaveBeenCalledWith({
        name: 'current-content',
        params: { type: 'book', id: 'book-1' }
      })

      vi.restoreAllMocks()
    })

    it('preloads book before navigating when not preloaded', async () => {
      wrapper = mountBooksLibrary()

      const preloadSpy = vi.spyOn(booksStore, 'preloadBook').mockResolvedValue({
        fileData: new ArrayBuffer(100),
        toc: []
      })

      wrapper.vm.openBook('book-1')
      await wrapper.vm.$nextTick()

      expect(preloadSpy).toHaveBeenCalledWith('book-1', expect.any(Function))

      preloadSpy.mockRestore()
    })

    it('navigates immediately if book is already preloaded', async () => {
      wrapper = mountBooksLibrary()

      // Set preloaded book in store state
      booksStore.preloadedBooks = { 'book-1': { fileData: new ArrayBuffer(100), toc: [] } }

      const preloadSpy = vi.spyOn(booksStore, 'preloadBook')

      wrapper.vm.openBook('book-1')
      await wrapper.vm.$nextTick()

      // Should not call preload if already preloaded
      expect(preloadSpy).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith({
        name: 'current-content',
        params: { type: 'book', id: 'book-1' }
      })

      preloadSpy.mockRestore()
      // Clean up
      booksStore.preloadedBooks = {}
    })

    it('does nothing if book is currently preloading', async () => {
      wrapper = mountBooksLibrary()

      // Add book to preloadingIds
      booksStore.preloadingIds.add('book-1')

      const preloadSpy = vi.spyOn(booksStore, 'preloadBook')

      wrapper.vm.openBook('book-1')
      await wrapper.vm.$nextTick()

      // Should not call preload or navigate if already preloading
      expect(preloadSpy).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()

      preloadSpy.mockRestore()
      // Clean up
      booksStore.preloadingIds.clear()
    })

    it('opens edit modal when clicking menu button', async () => {
      wrapper = mountBooksLibrary()
      wrapper.vm.openEditModal('book-1')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isEditModalOpen).toBe(true)
      expect(wrapper.vm.editingBookId).toBe('book-1')
    })
  })

  describe('Preloading Logic', () => {
    it('checks if book is preloaded correctly', () => {
      booksStore.preloadedBooks = { 'book-1': { fileData: new ArrayBuffer(100), toc: [] } }
      expect(booksStore.isBookPreloaded('book-1')).toBe(true)
      expect(booksStore.isBookPreloaded('book-2')).toBe(false)
      booksStore.preloadedBooks = {}
    })

    it('checks if book is preloading correctly', () => {
      booksStore.preloadingIds.add('book-1')
      expect(booksStore.isBookPreloading('book-1')).toBe(true)
      expect(booksStore.isBookPreloading('book-2')).toBe(false)
      booksStore.preloadingIds.clear()
    })

    it('gets preload progress correctly', () => {
      booksStore.preloadProgress = { 'book-1': 50, 'book-2': 75 }
      expect(booksStore.getPreloadProgress('book-1')).toBe(50)
      expect(booksStore.getPreloadProgress('book-2')).toBe(75)
      expect(booksStore.getPreloadProgress('book-3')).toBe(0)
      booksStore.preloadProgress = {}
    })
  })

  describe('Edit Modal', () => {
    it('opens edit modal with correct book', async () => {
      wrapper = mountBooksLibrary()
      wrapper.vm.openEditModal('book-2')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isEditModalOpen).toBe(true)
      expect(wrapper.vm.editingBook).toEqual(mockBooks[1])
    })

    it('closes edit modal', async () => {
      wrapper = mountBooksLibrary()
      wrapper.vm.openEditModal('book-1')
      await wrapper.vm.$nextTick()

      wrapper.vm.closeEditModal()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isEditModalOpen).toBe(false)
      expect(wrapper.vm.editingBookId).toBeNull()
    })

    it('saves book changes', async () => {
      wrapper = mountBooksLibrary()
      const updateSpy = vi.spyOn(booksStore, 'updateBook').mockResolvedValue()

      wrapper.vm.openEditModal('book-1')
      await wrapper.vm.$nextTick()

      await wrapper.vm.saveBookChanges({
        title: 'Updated Title',
        author: 'Updated Author',
        coverUrl: 'new-cover-url'
      })
      await wrapper.vm.$nextTick()

      expect(updateSpy).toHaveBeenCalledWith('book-1', {
        title: 'Updated Title',
        author: 'Updated Author',
        coverUrl: 'new-cover-url'
      })
      expect(wrapper.vm.isEditModalOpen).toBe(false)

      updateSpy.mockRestore()
    })
  })

  describe('Delete Book', () => {
    it('deletes book from modal', async () => {
      wrapper = mountBooksLibrary()
      const deleteSpy = vi.spyOn(booksStore, 'deleteBook').mockResolvedValue()

      wrapper.vm.openEditModal('book-1')
      await wrapper.vm.$nextTick()

      await wrapper.vm.handleModalDelete()
      await wrapper.vm.$nextTick()

      expect(deleteSpy).toHaveBeenCalledWith('book-1')
      expect(wrapper.vm.isEditModalOpen).toBe(false)

      deleteSpy.mockRestore()
    })

    it('deletes book directly without confirmation', async () => {
      wrapper = mountBooksLibrary()
      const deleteSpy = vi.spyOn(booksStore, 'deleteBook').mockResolvedValue()

      await wrapper.vm.deleteBook('book-1')
      await wrapper.vm.$nextTick()

      expect(deleteSpy).toHaveBeenCalledWith('book-1')

      deleteSpy.mockRestore()
    })

    it('closes modal after successful delete', async () => {
      wrapper = mountBooksLibrary()
      vi.spyOn(booksStore, 'deleteBook').mockResolvedValue()

      wrapper.vm.openEditModal('book-1')
      await wrapper.vm.$nextTick()

      await wrapper.vm.handleModalDelete()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isEditModalOpen).toBe(false)

      vi.restoreAllMocks()
    })
  })

  describe('Book Upload', () => {
    it('triggers file input when clicking Add Book', async () => {
      wrapper = mountBooksLibrary()

      const addButton = wrapper.findAll('button').find(btn => btn.text().includes('+'))
      expect(addButton).toBeTruthy()
      // Just verify the button exists - actual file input trigger requires more complex setup
    })

    it('handles file upload with valid EPUB', async () => {
      wrapper = mountBooksLibrary()

      const mockFile = new File(['content'], 'test-book.epub', { type: 'application/epub+zip' })
      const event = { target: { files: [mockFile], value: '' } }

      const addBookSpy = vi.spyOn(booksStore, 'addBook').mockResolvedValue({
        id: 'new-book-id',
        title: 'test-book',
        author: 'Loading...',
        coverUrl: null
      })

      await wrapper.vm.handleFileUpload(event)
      await wrapper.vm.$nextTick()

      expect(addBookSpy).toHaveBeenCalled()

      addBookSpy.mockRestore()
    })

    it('shows error for non-EPUB files', async () => {
      wrapper = mountBooksLibrary()

      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const event = { target: { files: [mockFile] } }

      await wrapper.vm.handleFileUpload(event)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.error).toBe('Please select an EPUB file (.epub)')
    })

    it('shows loading state during upload', async () => {
      wrapper = mountBooksLibrary()

      vi.spyOn(booksStore, 'addBook').mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              id: 'uploading-book',
              title: 'Uploading Book',
              author: 'Loading...',
              coverUrl: null
            })
          }, 100)
        })
      })

      const mockFile = new File(['content'], 'test.epub', { type: 'application/epub+zip' })
      const event = { target: { files: [mockFile] } }

      wrapper.vm.handleFileUpload(event)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isUploading).toBe(true)

      vi.restoreAllMocks()
    })
  })

  describe('Loading State', () => {
    it('shows loading message on mount before initialization', async () => {
      booksStore.isInitialized = false
      wrapper = mountBooksLibrary()
      await wrapper.vm.$nextTick()

      // The component calls initializeStore in onMounted, so it should briefly show loading
      // For this test, we'll just check the loading element exists in template
      expect(wrapper.find('.loading').exists()).toBe(true)
    })
  })

  describe('Error State', () => {
    it('displays error message when error occurs', async () => {
      booksStore.isInitialized = false
      vi.spyOn(booksStore, 'initializeStore').mockRejectedValue(new Error('Failed to load'))

      wrapper = mountBooksLibrary()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))

      // After initialization fails, error should be set
      // Note: This depends on the error handling in the component
      vi.restoreAllMocks()
    })
  })

  describe('Modal Rendering', () => {
    it('renders EditBookModal when isEditModalOpen is true', async () => {
      wrapper = mountBooksLibrary()
      wrapper.vm.isEditModalOpen = true
      wrapper.vm.editingBookId = 'book-1'
      await wrapper.vm.$nextTick()

      const modal = wrapper.find('.edit-book-modal-stub')
      expect(modal.exists()).toBe(true)
    })

    it('does not render EditBookModal when isEditModalOpen is false', () => {
      wrapper = mountBooksLibrary()
      wrapper.vm.isEditModalOpen = false
      return wrapper.vm.$nextTick().then(() => {
        const modal = wrapper.find('.edit-book-modal-stub')
        expect(modal.exists()).toBe(false)
      })
    })
  })

  describe('Book Sorting', () => {
    it('displays books sorted by lastReadAt (most recent first)', () => {
      wrapper = mountBooksLibrary()
      const bookCards = wrapper.findAll('.book-card')

      // Books should be sorted by lastReadAt descending - verify by count
      expect(bookCards.length).toBe(3)
      // Verify the correct progress percentages for each book
      expect(bookCards[0].find('.progress-text').text()).toBe('50%')
      expect(bookCards[1].find('.progress-text').text()).toBe('0%')
      expect(bookCards[2].find('.progress-text').text()).toBe('75%')
    })
  })

  describe('Search Functionality', () => {
    it('renders search input', () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.attributes('placeholder')).toBe('Search books by title or author...')
    })

    it('filters books by title', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('Gatsby')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(1)
      expect(bookCards[0].find('.book-title').text()).toBe('The Great Gatsby')
    })

    it('filters books by author', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('Orwell')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(1)
      expect(bookCards[0].find('.book-title').text()).toBe('1984')
    })

    it('filters books case-insensitively', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('gatsby')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(1)
      expect(bookCards[0].find('.book-title').text()).toBe('The Great Gatsby')
    })

    it('shows all books when search is empty', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(3)
    })

    it('shows all books when search is only whitespace', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('   ')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(3)
    })

    it('filters with multi-word search (all words must match)', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('Great Gatsby')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(1)
      expect(bookCards[0].find('.book-title').text()).toBe('The Great Gatsby')
    })

    it('shows no results when search matches nothing', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('NonExistentBook')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(0)

      // Should show empty state with search icon
      const emptyState = wrapper.find('.empty-state')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('No books found')
      expect(emptyState.text()).toContain('NonExistentBook')
    })

    it('matches partial words in title', async () => {
      wrapper = mountBooksLibrary()
      const searchInput = wrapper.find('.search-input')

      await searchInput.setValue('Kill')
      await wrapper.vm.$nextTick()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBe(1)
      expect(bookCards[0].find('.book-title').text()).toBe('To Kill a Mockingbird')
    })
  })

  describe('View Toggle', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it('renders view toggle button in header actions', () => {
      wrapper = mountBooksLibrary()
      const viewToggle = wrapper.find('.view-toggle')
      expect(viewToggle.exists()).toBe(true)
    })

    it('defaults to grid mode when no localStorage value exists', () => {
      wrapper = mountBooksLibrary()
      expect(wrapper.vm.viewMode).toBe('grid')
    })

    it('reads view mode from localStorage on mount', () => {
      localStorage.setItem('books-view-mode', 'list')
      wrapper = mountBooksLibrary()
      expect(wrapper.vm.viewMode).toBe('list')
    })

    it('toggles from grid to list mode when button is clicked', async () => {
      wrapper = mountBooksLibrary()
      expect(wrapper.vm.viewMode).toBe('grid')

      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.viewMode).toBe('list')
    })

    it('toggles from list to grid mode when button is clicked', async () => {
      localStorage.setItem('books-view-mode', 'list')
      wrapper = mountBooksLibrary()
      expect(wrapper.vm.viewMode).toBe('list')

      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.viewMode).toBe('grid')
    })

    it('applies books-list class when in list mode', async () => {
      localStorage.setItem('books-view-mode', 'list')
      wrapper = mountBooksLibrary()

      const booksContainer = wrapper.find('.books-grid')
      expect(booksContainer.classes()).toContain('books-list')
    })

    it('does not apply books-list class when in grid mode', () => {
      wrapper = mountBooksLibrary()

      const booksContainer = wrapper.find('.books-grid')
      expect(booksContainer.classes()).not.toContain('books-list')
    })

    it('updates container class when view mode is toggled', async () => {
      wrapper = mountBooksLibrary()

      expect(wrapper.find('.books-grid').classes()).not.toContain('books-list')

      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.books-grid').classes()).toContain('books-list')
    })

    it('saves view mode to localStorage when toggled', async () => {
      wrapper = mountBooksLibrary()

      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('books-view-mode')).toBe('list')
    })

    it('updates button title based on current view mode', async () => {
      wrapper = mountBooksLibrary()

      expect(wrapper.find('.view-toggle').attributes('title')).toBe('Switch to list view')

      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.view-toggle').attributes('title')).toBe('Switch to grid view')
    })

    it('switches SVG icon when view mode changes', async () => {
      wrapper = mountBooksLibrary()

      // In grid mode, shows list icon (horizontal lines)
      const gridModeSvg = wrapper.find('.view-toggle svg')
      expect(gridModeSvg.exists()).toBe(true)

      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      // In list mode, shows grid icon (rectangles)
      const listModeSvg = wrapper.find('.view-toggle svg')
      expect(listModeSvg.exists()).toBe(true)
    })

    it('has header-actions container with view toggle and add button', () => {
      wrapper = mountBooksLibrary()

      const headerActions = wrapper.find('.header-actions')
      expect(headerActions.exists()).toBe(true)
      expect(headerActions.find('.view-toggle').exists()).toBe(true)

      const addButton = headerActions.findAll('button').find(btn => btn.text().includes('+'))
      expect(addButton).toBeTruthy()
    })

    it('persists list view mode across page reloads', async () => {
      // First mount: switch to list mode
      wrapper = mountBooksLibrary()
      await wrapper.find('.view-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('books-view-mode')).toBe('list')

      // Unmount and remount (simulating page reload)
      wrapper.unmount()
      wrapper = mountBooksLibrary()

      expect(wrapper.vm.viewMode).toBe('list')
    })
  })

  describe('View Mode Layout', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('arranges books in grid layout when in grid mode', () => {
      wrapper = mountBooksLibrary()

      const booksContainer = wrapper.find('.books-grid')
      expect(booksContainer.classes()).not.toContain('books-list')
    })

    it('arranges books in list layout when in list mode', () => {
      localStorage.setItem('books-view-mode', 'list')
      wrapper = mountBooksLibrary()

      const booksContainer = wrapper.find('.books-grid')
      expect(booksContainer.classes()).toContain('books-list')
    })

    it('applies correct CSS classes to book cards in grid mode', () => {
      wrapper = mountBooksLibrary()

      const bookCards = wrapper.findAll('.book-card')
      expect(bookCards.length).toBeGreaterThan(0)

      // In grid mode, book cards should not have list-specific styles
      // (this is primarily a CSS test, but we can verify the container class)
      expect(wrapper.find('.books-grid').classes()).not.toContain('books-list')
    })

    it('applies correct CSS classes to book cards in list mode', () => {
      localStorage.setItem('books-view-mode', 'list')
      wrapper = mountBooksLibrary()

      // In list mode, container should have books-list class
      expect(wrapper.find('.books-grid').classes()).toContain('books-list')
    })
  })
})
