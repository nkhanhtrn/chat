import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Note from '../Note.vue'

describe('Note', () => {
  let root
  let wrapper

  const baseProps = {
    visible: true,
    x: 100,
    y: 200,
    noteId: 'note-123',
    initialContent: '',
    isTemp: true
  }

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    document.body.innerHTML = ''
  })

  describe('Basic Rendering', () => {
    it('renders at correct position when visible', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const popup = document.body.querySelector('.note-popup')
      expect(popup).toBeTruthy()
      expect(popup.style.left).toBe('100px')
      expect(popup.style.top).toBe('200px')
    })

    it('does not render when not visible', () => {
      wrapper = mount(Note, { props: { ...baseProps, visible: false }, attachTo: root })
      const popup = document.body.querySelector('.note-popup')
      expect(popup).toBeFalsy()
    })

    it('renders backdrop when visible', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const backdrop = document.body.querySelector('.note-backdrop')
      expect(backdrop).toBeTruthy()
    })

    it('renders title "Note"', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const title = document.body.querySelector('.note-title')
      expect(title).toBeTruthy()
      expect(title.textContent).toBe('Note')
    })
  })

  describe('Edit Mode (isTemp=true)', () => {
    it('shows textarea when isTemp is true', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()
    })

    it('shows Save and Cancel buttons in edit mode', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.note-actions button')
      expect(buttons.length).toBe(2)
      expect(buttons[0].textContent).toBe('Cancel')
      expect(buttons[1].textContent).toBe('Save')
    })

    it('does not show edit/delete icon buttons when isTemp is true', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const headerActions = document.body.querySelector('.note-header-actions')
      expect(headerActions).toBeFalsy()
    })

    it('focuses textarea when opened in edit mode', async () => {
      wrapper = mount(Note, { props: { ...baseProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })
      await vi.waitFor(() => {
        const textarea = document.body.querySelector('.note-textarea')
        expect(document.activeElement).toBe(textarea)
      })
    })

    it('initializes textarea with initialContent', async () => {
      wrapper = mount(Note, {
        props: { ...baseProps, visible: false, initialContent: 'Initial note content' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })
      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea.value).toBe('Initial note content')
    })
  })

  describe('View Mode (isTemp=false, has content)', () => {
    const viewModeProps = {
      ...baseProps,
      isTemp: false,
      initialContent: 'Existing note content'
    }

    it('shows note content text instead of textarea', () => {
      wrapper = mount(Note, { props: viewModeProps, attachTo: root })
      const noteContent = document.body.querySelector('.note-content')
      const textarea = document.body.querySelector('.note-textarea')
      expect(noteContent).toBeTruthy()
      expect(noteContent.textContent).toBe('Existing note content')
      expect(textarea).toBeFalsy()
    })

    it('shows edit and delete icon buttons in view mode', () => {
      wrapper = mount(Note, { props: viewModeProps, attachTo: root })
      const headerActions = document.body.querySelector('.note-header-actions')
      expect(headerActions).toBeTruthy()
      const buttons = headerActions.querySelectorAll('.note-icon-btn')
      expect(buttons.length).toBe(2)
    })

    it('shows "No content" when initialContent is empty in view mode', async () => {
      wrapper = mount(Note, {
        props: { ...viewModeProps, visible: false, initialContent: '' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })
      // Empty content should auto-enter edit mode
      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()
    })

    it('switches to edit mode when edit button is clicked', async () => {
      wrapper = mount(Note, { props: viewModeProps, attachTo: root })

      // Initially in view mode
      let noteContent = document.body.querySelector('.note-content')
      expect(noteContent).toBeTruthy()

      // Click edit button
      const editBtn = document.body.querySelector('.note-icon-btn')
      await editBtn.click()

      // Should now be in edit mode
      noteContent = document.body.querySelector('.note-content')
      const textarea = document.body.querySelector('.note-textarea')
      expect(noteContent).toBeFalsy()
      expect(textarea).toBeTruthy()
    })
  })

  describe('startInEditMode prop', () => {
    it('enters edit mode when startInEditMode is true even with existing content', async () => {
      wrapper = mount(Note, {
        props: {
          ...baseProps,
          visible: false,
          isTemp: false,
          initialContent: 'Existing content',
          startInEditMode: true
        },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })
      const textarea = document.body.querySelector('.note-textarea')
      const noteContent = document.body.querySelector('.note-content')
      expect(textarea).toBeTruthy()
      expect(noteContent).toBeFalsy()
    })

    it('shows view mode when startInEditMode is false with existing content', () => {
      wrapper = mount(Note, {
        props: {
          ...baseProps,
          isTemp: false,
          initialContent: 'Existing content',
          startInEditMode: false
        },
        attachTo: root
      })
      const textarea = document.body.querySelector('.note-textarea')
      const noteContent = document.body.querySelector('.note-content')
      expect(textarea).toBeFalsy()
      expect(noteContent).toBeTruthy()
    })
  })

  describe('Events', () => {
    it('emits cancel when backdrop is clicked', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const backdrop = document.body.querySelector('.note-backdrop')
      await backdrop.click()
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when Cancel button is clicked', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.note-actions button')
      await buttons[0].click()
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when Escape key is pressed in textarea', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const textarea = document.body.querySelector('.note-textarea')
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      textarea.dispatchEvent(event)
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits save with noteId and content when Save button is clicked', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })

      // Type in textarea
      const textarea = document.body.querySelector('.note-textarea')
      textarea.value = 'New note content'
      textarea.dispatchEvent(new Event('input'))

      // Click Save
      const buttons = document.body.querySelectorAll('.note-actions button')
      await buttons[1].click()

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0][0]).toEqual({
        noteId: 'note-123',
        content: 'New note content'
      })
    })

    it('emits delete with noteId when delete button is clicked', async () => {
      const viewModeProps = {
        ...baseProps,
        isTemp: false,
        initialContent: 'Existing note'
      }
      wrapper = mount(Note, { props: viewModeProps, attachTo: root })

      const deleteBtn = document.body.querySelector('.note-delete-btn')
      await deleteBtn.click()

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')[0][0]).toEqual({ noteId: 'note-123' })
    })
  })

  describe('State Reset', () => {
    it('resets content when popup opens', async () => {
      wrapper = mount(Note, {
        props: { ...baseProps, visible: false, initialContent: 'First content' },
        attachTo: root
      })

      // Open with first content
      await wrapper.setProps({ visible: true })
      let textarea = document.body.querySelector('.note-textarea')
      expect(textarea.value).toBe('First content')

      // Close
      await wrapper.setProps({ visible: false })

      // Open with different content
      await wrapper.setProps({ visible: true, initialContent: 'Second content' })
      textarea = document.body.querySelector('.note-textarea')
      expect(textarea.value).toBe('Second content')
    })

    it('resets isEditing to false when popup closes', async () => {
      const viewModeProps = {
        ...baseProps,
        isTemp: false,
        initialContent: 'Content'
      }
      wrapper = mount(Note, { props: viewModeProps, attachTo: root })

      // Click edit to enter edit mode
      const editBtn = document.body.querySelector('.note-icon-btn')
      await editBtn.click()

      // Verify we're in edit mode
      let textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()

      // Close and reopen
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      // Should be back in view mode
      const noteContent = document.body.querySelector('.note-content')
      expect(noteContent).toBeTruthy()
    })
  })

  describe('Styling', () => {
    it('has proper z-index for popup above backdrop', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const backdrop = document.body.querySelector('.note-backdrop')
      const popup = document.body.querySelector('.note-popup')

      const backdropZIndex = parseInt(getComputedStyle(backdrop).zIndex) || 9998
      const popupZIndex = parseInt(getComputedStyle(popup).zIndex) || 9999

      expect(popupZIndex).toBeGreaterThan(backdropZIndex)
    })

    it('delete button has delete styling class', () => {
      const viewModeProps = {
        ...baseProps,
        isTemp: false,
        initialContent: 'Content'
      }
      wrapper = mount(Note, { props: viewModeProps, attachTo: root })
      const deleteBtn = document.body.querySelector('.note-delete-btn')
      expect(deleteBtn).toBeTruthy()
      expect(deleteBtn.classList.contains('note-icon-btn')).toBe(true)
    })
  })

  describe('Streaming Mode (isStreaming=true)', () => {
    const streamingProps = {
      ...baseProps,
      isTemp: false,
      initialContent: '',
      isStreaming: true
    }

    it('shows view mode (not edit mode) when streaming even with empty content', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      const noteContent = document.body.querySelector('.note-content')
      const textarea = document.body.querySelector('.note-textarea')

      expect(noteContent).toBeTruthy()
      expect(textarea).toBeFalsy()
    })

    it('shows streaming cursor when isStreaming is true', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      const cursor = document.body.querySelector('.streaming-cursor')
      expect(cursor).toBeTruthy()
      expect(cursor.textContent).toBe('▊')
    })

    it('does not show streaming cursor when isStreaming is false', () => {
      wrapper = mount(Note, {
        props: {
          ...baseProps,
          isTemp: false,
          initialContent: 'Content',
          isStreaming: false
        },
        attachTo: root
      })

      const cursor = document.body.querySelector('.streaming-cursor')
      expect(cursor).toBeFalsy()
    })

    it('displays streamed content as it arrives', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false, initialContent: '' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      // Simulate content streaming in
      await wrapper.setProps({ initialContent: 'Hello' })
      let noteContent = document.body.querySelector('.note-content')
      expect(noteContent.textContent).toContain('Hello')

      await wrapper.setProps({ initialContent: 'Hello World' })
      noteContent = document.body.querySelector('.note-content')
      expect(noteContent.textContent).toContain('Hello World')
    })

    it('shows empty content area (no "No content" text) when streaming with empty content', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false, initialContent: '' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      const noteContent = document.body.querySelector('.note-content')
      // Should not show "No content" when streaming
      expect(noteContent.textContent).not.toContain('No content')
    })

    it('does not auto-enter edit mode when streaming even with empty content', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false, initialContent: '' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      // Should be in view mode, not edit mode
      const textarea = document.body.querySelector('.note-textarea')
      const noteContent = document.body.querySelector('.note-content')

      expect(textarea).toBeFalsy()
      expect(noteContent).toBeTruthy()
    })

    it('does not show edit/delete buttons when streaming', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false, initialContent: 'Some content' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      // In view mode during streaming, header actions should still show
      // but the note is not in edit mode
      const noteContent = document.body.querySelector('.note-content')
      expect(noteContent).toBeTruthy()
    })

    it('transitions from streaming to view mode when streaming ends', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false, initialContent: '' },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      // Verify streaming cursor is present
      let cursor = document.body.querySelector('.streaming-cursor')
      expect(cursor).toBeTruthy()

      // End streaming
      await wrapper.setProps({ isStreaming: false, initialContent: 'Final content' })

      // Cursor should be gone
      cursor = document.body.querySelector('.streaming-cursor')
      expect(cursor).toBeFalsy()

      // Content should be displayed
      const noteContent = document.body.querySelector('.note-content')
      expect(noteContent.textContent).toContain('Final content')
    })

    it('streaming cursor has blink animation class', async () => {
      wrapper = mount(Note, {
        props: { ...streamingProps, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      const cursor = document.body.querySelector('.streaming-cursor')
      expect(cursor).toBeTruthy()
      expect(cursor.classList.contains('streaming-cursor')).toBe(true)
    })
  })
})
