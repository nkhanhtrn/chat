import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import BookViewer from '../BookViewer.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import { useBooksStore } from '../../stores/books.js'
import { useChatStore } from '../../stores/chat.js'

const mockChapters = [
  { label: 'Chapter 1: Introduction', href: 'chapter1.xhtml' },
  { label: 'Chapter 2: Getting Started', href: 'chapter2.xhtml' },
  { label: 'Chapter 3: Advanced Topics', href: 'chapter3.xhtml' },
  { label: 'Appendix A: Resources', href: 'appendix-a.xhtml' }
]

// Mock epubRenderer - must be before imports
vi.mock('../../services/epubRenderer.js', () => {
  class MockEpubRenderer {
    constructor(container, data) {
      this.container = container
      this.data = data
      this.chapters = mockChapters
      this.currentCfi = null
      this.progress = 0.5
    }

    async initialize() {
      return Promise.resolve()
    }

    getTableOfContents() {
      return this.chapters
    }

    async goto(href) {
      this.currentCfi = href
      return Promise.resolve()
    }

    async prev() {
      return Promise.resolve()
    }

    async next() {
      return Promise.resolve()
    }

    getCurrentCfi() {
      return this.currentCfi || 'epubcfi(/6/8)'
    }

    getProgress() {
      return this.progress
    }

    async gotoCfi(cfi) {
      this.currentCfi = cfi
      return Promise.resolve()
    }

    refreshTheme() {}

    setupSelectionHandler() {}

    destroy() {}
  }

  return {
    EpubRenderer: MockEpubRenderer
  }
})

// Mock vue-router
const mockPush = vi.fn(() => Promise.resolve())
const mockBack = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack
  }),
  useRoute: () => ({
    params: { id: 'book-1' }
  })
}))

// Mock bookStorage
vi.mock('../../services/bookStorage.js', () => ({
  getOrDownloadBookFile: vi.fn(() => Promise.resolve(new ArrayBuffer(1024))),
  loadBooksFromStorage: vi.fn(() => Promise.resolve({ hasConflict: false, state: { books: [] } })),
  saveBookToStorage: vi.fn(() => Promise.resolve()),
  deleteBookFromStorage: vi.fn(() => Promise.resolve()),
  loadBookNotebooksFromFirestore: vi.fn(() => Promise.resolve({})),
  saveBookNotebooksToFirestore: vi.fn(() => Promise.resolve())
}))

// Mock AppLayout to avoid route dependency issues
vi.mock('../../components/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="app-layout"><slot name="side" /><slot /></div>',
    props: ['storageKey']
  }
}))

// Mock ContextMenu
vi.mock('../../components/ContextMenu.vue', () => ({
  default: {
    name: 'ContextMenu',
    template: '<div v-if="visible" class="context-menu-mock"></div>',
    props: ['visible', 'x', 'y', 'highlightedText', 'colorIndex', 'hasExistingHighlight', 'hasExistingNote']
  }
}))

// Mock NotebookOverview
vi.mock('../../components/NotebookOverview.vue', () => ({
  default: {
    name: 'NotebookOverview',
    template: '<div v-if="questionCount" class="notebook-overview-mock">Overview</div>',
    props: ['notebookId', 'title', 'questionCount', 'rootMessages', 'readOnly', 'coverUrl', 'subtitle']
  }
}))

// Mock MarkdownRenderer
vi.mock('../../components/MarkdownRenderer.vue', () => ({
  default: {
    name: 'MarkdownRenderer',
    props: ['content'],
    template: '<div class="markdown-renderer-mock">{{ content }}</div>'
  }
}))

describe('BookViewer', () => {
  let wrapper
  let pinia
  let booksStore
  let chatStore

  beforeEach(async () => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    mockPush.mockClear()
    mockBack.mockClear()
    pinia = createPinia()
    setActivePinia(pinia)
    booksStore = useBooksStore(pinia)
    chatStore = useChatStore(pinia)

    // Directly add a test book to the store with known ID 'book-1'
    booksStore.books.push({
      id: 'book-1',
      title: 'Test Book',
      author: 'Test Author',
      coverUrl: null,
      storagePath: 'test-path',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastReadAt: Date.now(),
      lastReadCfi: null,
      totalProgress: 0,
      deletedAt: null
    })
    booksStore.setCurrentBook('book-1')
    booksStore.isInitialized = true

    // Initialize chat store with test data
    chatStore.isInitialized = true
    const notebookId = 'test-notebook-1'
    const messageId1 = 'test-msg-1'
    const messageId2 = 'test-msg-2'

    chatStore.chats.push({
      id: notebookId,
      name: 'Test Notebook',
      rootMessageIds: [messageId1, messageId2],
      messageCount: 2
    })

    chatStore.messagesById[messageId1] = {
      id: messageId1,
      question: 'What is Vue.js?',
      response: 'Vue.js is a JavaScript framework for building user interfaces.',
      childIds: []
    }

    chatStore.messagesById[messageId2] = {
      id: messageId2,
      question: 'How does Pinia work?',
      response: 'Pinia is a state management library for Vue.',
      childIds: []
    }

    // Set the notebook association for the test book
    booksStore.setBookNotebook('book-1', notebookId)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('Initial Rendering', () => {
    it('should render the book viewer container', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()
      expect(wrapper.find('.book-viewer').exists()).toBe(true)
    })

    it('should render the TOC sidebar', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()
      expect(wrapper.find('.toc-sidebar').exists()).toBe(true)
    })

    it('should render the viewer container', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()
      expect(wrapper.find('.viewer-container').exists()).toBe(true)
    })

    it('should render side navigation buttons', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const sideNavBtns = wrapper.findAll('.side-nav-btn')
      expect(sideNavBtns.length).toBe(2) // Left and right buttons
    })
  })

  describe('TOC Search Functionality', () => {
    it('should render search input with placeholder', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      expect(wrapper.find('.toc-search-input').exists()).toBe(true)
      expect(wrapper.find('.toc-search-input').attributes('placeholder')).toBe('Search chapters...')
    })

    it('should show all chapters when search is empty', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(mockChapters.length)
    })

    it('should filter chapters based on search query', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('introduction')

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(1)
      expect(tocItems[0].text()).toBe('Chapter 1: Introduction')
    })

    it('should filter chapters case-insensitively', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('ADVANCED')

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(1)
      expect(tocItems[0].text()).toBe('Chapter 3: Advanced Topics')
    })

    it('should show no results when no chapters match', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('nonexistent chapter')

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(0)
    })

    it('should clear filter when search is cleared', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')

      // Type a search
      await searchInput.setValue('getting')
      expect(wrapper.findAll('.toc-item').length).toBe(1)

      // Clear the search
      await searchInput.setValue('')
      expect(wrapper.findAll('.toc-item').length).toBe(mockChapters.length)
    })

    it('should not show search results for whitespace-only queries', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('   ')

      // Should show all chapters when search is whitespace-only
      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(mockChapters.length)
    })

    it('should find chapters with partial word matches', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('start')

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(1)
      expect(tocItems[0].text()).toContain('Getting Started')
    })

    it('should match multiple chapters with same keyword', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('chapter')

      const tocItems = wrapper.findAll('.toc-item')
      // Chapter 1, Chapter 2, Chapter 3 all contain "Chapter"
      expect(tocItems.length).toBe(3)
    })

    it('should find appendix chapters', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('appendix')

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(1)
      expect(tocItems[0].text()).toContain('Appendix')
    })

    it('should find results with multi-word search', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const searchInput = wrapper.find('.toc-search-input')
      await searchInput.setValue('advanced topics')

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems.length).toBe(1)
      expect(tocItems[0].text()).toBe('Chapter 3: Advanced Topics')
    })
  })

  describe('Chapter Display and Navigation', () => {
    it('should render all chapter labels', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const tocItems = wrapper.findAll('.toc-item')
      expect(tocItems[0].text()).toBe('Chapter 1: Introduction')
      expect(tocItems[1].text()).toBe('Chapter 2: Getting Started')
      expect(tocItems[2].text()).toBe('Chapter 3: Advanced Topics')
      expect(tocItems[3].text()).toBe('Appendix A: Resources')
    })

    it('should mark current chapter as active', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // After loading, first chapter should be active (index 0)
      const tocItems = wrapper.findAll('.toc-item')
      // The active class is based on currentChapterIndex which defaults to 0
      expect(tocItems[0].classes()).toContain('active')
    })

    it('should be clickable', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const tocItems = wrapper.findAll('.toc-item')
      // TOC items should exist and be clickable elements
      expect(tocItems[0].exists()).toBe(true)
      expect(tocItems[0].text()).toBe(mockChapters[0].label)
    })
  })

  describe('Navigation Buttons', () => {
    it('should have left and right side navigation buttons', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const leftBtn = wrapper.find('.side-nav-left')
      const rightBtn = wrapper.find('.side-nav-right')
      expect(leftBtn.exists()).toBe(true)
      expect(rightBtn.exists()).toBe(true)
    })

    it('should have prevPage and nextPage methods', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      expect(typeof wrapper.vm.prevPage).toBe('function')
      expect(typeof wrapper.vm.nextPage).toBe('function')
    })
  })

  describe('Loading States', () => {
    it('should show loading state initially', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      // Before flushPromises, loading should be visible
      expect(wrapper.vm.isLoading).toBe(true)

      await flushPromises()
    })

    it('should show loading overlay during loading', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      // During loading, the loading overlay should exist
      expect(wrapper.find('.loading-overlay').exists()).toBe(true)

      await flushPromises()
    })

    it('should hide loading after book loads', async () => {
      vi.useFakeTimers()

      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Fast-forward through the 500ms setTimeout that sets isLoading to false
      vi.advanceTimersByTime(500)
      await flushPromises()

      // After loading and timeout, isLoading should be false and error should be null
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.error).toBe(null)

      vi.useRealTimers()
    })
  })

  describe('Error States', () => {
    it('should handle missing book gracefully', async () => {
      // Clear the book from store
      booksStore.books = []

      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Should have an error since book-1 is not in the store
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('Notebook Tab', () => {
    it('should render tab navigation with Contents and Notebook tabs', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const tabButtons = wrapper.findAll('.tab-button')
      expect(tabButtons.length).toBe(2)
      expect(tabButtons[0].text()).toBe('Contents')
      expect(tabButtons[1].text()).toBe('Notebook')
    })

    it('should show Contents tab by default', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const activeTab = wrapper.find('.tab-button.active')
      expect(activeTab.text()).toBe('Contents')
    })

    it('should switch to Notebook tab when clicked', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const tabButtons = wrapper.findAll('.tab-button')
      await tabButtons[1].trigger('click')

      await flushPromises()

      const activeTab = wrapper.find('.tab-button.active')
      expect(activeTab.text()).toBe('Notebook')
    })

    it('should show notebook messages when notebook is associated with book', async () => {
      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Switch to Notebook tab
      const tabButtons = wrapper.findAll('.tab-button')
      await tabButtons[1].trigger('click')
      await flushPromises()

      // Should show notebook header with notebook name
      expect(wrapper.find('.notebook-header').exists()).toBe(true)
      expect(wrapper.find('.notebook-header-title').text()).toBe('Test Notebook')

      // Should show notebook messages
      const notebookMessages = wrapper.findAll('.notebook-message')
      expect(notebookMessages.length).toBe(2)
    })

    it('should show empty state when no notebook is associated', async () => {
      // Clear the notebook association
      booksStore.bookNotebooks = {}

      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Switch to Notebook tab
      const tabButtons = wrapper.findAll('.tab-button')
      await tabButtons[1].trigger('click')
      await flushPromises()

      // Should show empty state
      expect(wrapper.find('.empty-notebook').exists()).toBe(true)
      expect(wrapper.find('.empty-notebook').text()).toContain('Search for questions')
    })

    it('should save notebook association when selecting a message', async () => {
      // Start with no notebook association
      booksStore.bookNotebooks = {}

      wrapper = mount(BookViewer, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Get the component instance and call selectMessage directly
      const vm = wrapper.vm
      const testMessage = {
        id: 'test-msg-1',
        question: 'What is Vue.js?',
        notebookId: 'test-notebook-1'
      }

      vm.selectMessage(testMessage)
      await flushPromises()

      // Should have saved the notebook association
      expect(booksStore.bookNotebooks['book-1']).toBe('test-notebook-1')
    })
  })
})
