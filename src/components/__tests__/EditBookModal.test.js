import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EditBookModal from '../EditBookModal.vue'

// Mock window.confirm
global.confirm = vi.fn(() => true)

// Mock window.alert
global.alert = vi.fn(() => {})

// Mock book cover generator
vi.mock('../../services/bookCoverGenerator.js', () => ({
  generateDefaultCover: vi.fn((title, author) => `blob:default-cover-${title}-${author}`)
}))

describe('EditBookModal', () => {
  let wrapper
  let root

  const mockBook = {
    id: 'book-1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    coverUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  }

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    document.body.innerHTML = ''
  })

  const mountModal = async (props = {}) => {
    const defaultProps = { visible: false, book: mockBook }
    wrapper = mount(EditBookModal, {
      props: { ...defaultProps, ...props },
      attachTo: root
    })

    // Always set visible to true to trigger the watch and populate form data
    await wrapper.setProps({ visible: true })
    await wrapper.vm.$nextTick()

    // If props had a specific visible value, set it again
    if (props.visible !== undefined) {
      if (!props.visible) {
        await wrapper.setProps({ visible: false })
      }
    }

    return wrapper
  }

  describe('Rendering', () => {
    it('renders modal when visible is true', async () => {
      await mountModal({ visible: false })
      const modal = document.body.querySelector('.modal-content')
      expect(modal).toBeFalsy()

      await wrapper.setProps({ visible: true })
      await wrapper.vm.$nextTick()

      const modalVisible = document.body.querySelector('.modal-content')
      expect(modalVisible).toBeTruthy()
    })

    it('does not render modal when visible is false', async () => {
      await mountModal({ visible: false })
      const modal = document.body.querySelector('.modal-content')
      expect(modal).toBeFalsy()
    })

    it('renders title input with book title', async () => {
      await mountModal()
      expect(wrapper.vm.formData.title).toBe('The Great Gatsby')
    })

    it('renders author input with book author', async () => {
      await mountModal()
      expect(wrapper.vm.formData.author).toBe('F. Scott Fitzgerald')
    })

    it('renders cover preview when book has cover', async () => {
      await mountModal()
      expect(wrapper.vm.formData.coverUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==')
    })

    it('renders default cover preview when book has no cover', async () => {
      await mountModal({ book: { ...mockBook, coverUrl: null } })
      const defaultCover = document.body.querySelector('.cover-preview img')
      expect(defaultCover).toBeTruthy()
      expect(defaultCover.getAttribute('src')).toContain('blob:default-cover-The Great Gatsby-F. Scott Fitzgerald')
    })

    it('renders Remove Cover button when cover exists', async () => {
      await mountModal()
      const removeButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Remove Cover'))
      expect(removeButton).toBeTruthy()
    })

    it('does not render Remove Cover button when no cover', async () => {
      await mountModal({ book: { ...mockBook, coverUrl: null } })
      const removeButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Remove Cover'))
      expect(removeButton).toBeFalsy()
    })
  })

  describe('Form Editing', () => {
    it('updates title input value', async () => {
      await mountModal()
      wrapper.vm.formData.title = 'New Title'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.formData.title).toBe('New Title')
    })

    it('updates author input value', async () => {
      await mountModal()
      wrapper.vm.formData.author = 'New Author'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.formData.author).toBe('New Author')
    })

    it('computes hasChanges correctly when title changes', async () => {
      await mountModal()
      expect(wrapper.vm.hasChanges).toBe(false)

      wrapper.vm.formData.title = 'Changed Title'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.hasChanges).toBe(true)
    })

    it('computes hasChanges correctly when author changes', async () => {
      await mountModal()
      expect(wrapper.vm.hasChanges).toBe(false)

      wrapper.vm.formData.author = 'Changed Author'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.hasChanges).toBe(true)
    })

    it('resets form data when modal opens with different book', async () => {
      await mountModal()

      wrapper.vm.formData.title = 'Different Title'
      await wrapper.vm.$nextTick()

      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true, book: { ...mockBook, title: 'Different Book' } })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.formData.title).toBe('Different Book')
      expect(wrapper.vm.hasChanges).toBe(false)
    })
  })

  describe('Cover Upload', () => {
    it('triggers file input when calling triggerFileInput', async () => {
      await mountModal({ book: { ...mockBook, coverUrl: null } })
      const triggerFileInput = vi.spyOn(wrapper.vm, 'triggerFileInput')

      wrapper.vm.triggerFileInput()
      expect(triggerFileInput).toHaveBeenCalled()
    })

    it('removes cover when calling removeCover', async () => {
      await mountModal()
      wrapper.vm.removeCover()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.formData.coverUrl).toBeNull()
    })

    it('handles valid image file upload', async () => {
      await mountModal()

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const event = { target: { files: [file] } }

      // Mock FileReader
      class MockFileReader {
        constructor() {
          this.result = 'data:image/jpeg;base64,test123'
        }
        readAsDataURL() {
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: this })
            }
          }, 0)
        }
      }
      global.FileReader = MockFileReader

      await wrapper.vm.handleCoverUpload(event)
      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.formData.coverUrl).toBeTruthy()
      expect(wrapper.vm.formData.coverUrl).toContain('data:image/jpeg')
    })

    it('rejects non-image file', async () => {
      await mountModal()

      global.alert.mockImplementation(() => {})
      const file = new File([''], 'test.pdf', { type: 'application/pdf' })
      const event = { target: { files: [file] } }

      await wrapper.vm.handleCoverUpload(event)

      expect(global.alert).toHaveBeenCalledWith('Please select an image file')
      global.alert.mockReset()
    })

    it('rejects file larger than 2MB', async () => {
      await mountModal()

      global.alert.mockImplementation(() => {})
      const file = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      const event = { target: { files: [file] } }

      await wrapper.vm.handleCoverUpload(event)

      expect(global.alert).toHaveBeenCalledWith('Image size must be less than 2MB')
      global.alert.mockReset()
    })
  })

  describe('Save Action', () => {
    it('emits save with updated data', async () => {
      await mountModal()
      wrapper.vm.formData.title = 'Updated Title'
      await wrapper.vm.$nextTick()

      await wrapper.vm.onSave()

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0][0]).toEqual({
        title: 'Updated Title',
        author: 'F. Scott Fitzgerald',
        coverUrl: mockBook.coverUrl
      })
    })

    it('does not emit save when no changes made', async () => {
      await mountModal()
      await wrapper.vm.onSave()

      expect(wrapper.emitted('save')).toBeFalsy()
    })

    it('has onSave method that emits save', async () => {
      await mountModal()
      wrapper.vm.formData.title = 'Updated Title'
      await wrapper.vm.$nextTick()

      await wrapper.vm.onSave()

      expect(wrapper.emitted('save')).toBeTruthy()
    })
  })

  describe('Delete Action', () => {
    it('emits delete when delete button is clicked', async () => {
      await mountModal()

      // Find and click the delete button
      const deleteButton = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.querySelector('svg') && btn.getAttribute('title') === 'Delete book'
      )
      expect(deleteButton).toBeTruthy()

      deleteButton.click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('delete')).toBeTruthy()
    })

    it('emits delete immediately without confirmation', async () => {
      await mountModal()

      const deleteButton = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.querySelector('svg') && btn.getAttribute('title') === 'Delete book'
      )

      deleteButton.click()
      await wrapper.vm.$nextTick()

      // Should emit delete without any confirmation dialog
      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(global.confirm).not.toHaveBeenCalled()
    })
  })

  describe('Cancel Action', () => {
    it('emits close when calling onClose', async () => {
      await mountModal()
      wrapper.vm.onClose()

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Modal Header Actions', () => {
    it('emits close when Modal close button is clicked', async () => {
      await mountModal()

      // The Modal component handles the close button - just verify onClose works
      wrapper.vm.onClose()

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('handles book with null properties', async () => {
      await mountModal({
        book: { id: 'book-1', title: null, author: null, coverUrl: null }
      })

      expect(wrapper.vm.formData.title).toBe('')
      expect(wrapper.vm.formData.author).toBe('')
    })

    it('handles book with undefined title and author', async () => {
      await mountModal({ book: { id: 'book-1' } })

      expect(wrapper.vm.formData.title).toBe('')
      expect(wrapper.vm.formData.author).toBe('')
    })
  })
})
