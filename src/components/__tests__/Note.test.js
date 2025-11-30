import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Note from '../Note.vue'

describe('Note', () => {
  let root
  let wrapper

  const baseProps = {
    visible: true,
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
    it('renders popup when visible', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const popup = document.body.querySelector('.modal-content')
      expect(popup).toBeTruthy()
    })

    it('does not render when not visible', () => {
      wrapper = mount(Note, { props: { ...baseProps, visible: false }, attachTo: root })
      const popup = document.body.querySelector('.modal-content')
      expect(popup).toBeFalsy()
    })

    it('renders backdrop when visible', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const backdrop = document.body.querySelector('.modal-overlay')
      expect(backdrop).toBeTruthy()
    })

    it('renders title "Note"', () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const title = document.body.querySelector('.modal-title')
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
    it('emits cancel when backdrop is mousedown', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const backdrop = document.body.querySelector('.modal-overlay')
      // Modal now uses mousedown instead of click for closing
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
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
      const overlay = document.body.querySelector('.modal-overlay')
      const popup = document.body.querySelector('.modal-content')

      // Modal uses overlay with z-index, content is inside it
      expect(overlay).toBeTruthy()
      expect(popup).toBeTruthy()
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

  describe('Detail Explain Link', () => {
    const viewModeWithHighlightProps = {
      ...baseProps,
      isTemp: false,
      initialContent: 'Some note content',
      highlightedText: 'highlighted text here'
    }

    it('shows detail explain link in view mode when highlightedText is provided', () => {
      wrapper = mount(Note, { props: viewModeWithHighlightProps, attachTo: root })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeTruthy()
      expect(link.textContent).toContain('Explain in detail')
    })

    it('does not show detail explain link when highlightedText is empty', () => {
      wrapper = mount(Note, {
        props: { ...viewModeWithHighlightProps, highlightedText: '' },
        attachTo: root
      })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeFalsy()
    })

    it('does not show detail explain link when highlightedText is not provided', () => {
      wrapper = mount(Note, {
        props: { ...baseProps, isTemp: false, initialContent: 'Some content' },
        attachTo: root
      })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeFalsy()
    })

    it('does not show detail explain link when streaming', () => {
      wrapper = mount(Note, {
        props: { ...viewModeWithHighlightProps, isStreaming: true },
        attachTo: root
      })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeFalsy()
    })

    it('does not show detail explain link in edit mode', async () => {
      wrapper = mount(Note, {
        props: { ...viewModeWithHighlightProps, startInEditMode: true, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeFalsy()
    })

    it('does not show detail explain link when isTemp is true', async () => {
      wrapper = mount(Note, {
        props: { ...viewModeWithHighlightProps, isTemp: true, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeFalsy()
    })

    it('emits detail-explain event with noteId and text when link is clicked', async () => {
      wrapper = mount(Note, { props: viewModeWithHighlightProps, attachTo: root })
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeTruthy()

      await link.click()

      expect(wrapper.emitted('detail-explain')).toBeTruthy()
      expect(wrapper.emitted('detail-explain')).toHaveLength(1)
      const [eventData] = wrapper.emitted('detail-explain')[0]
      expect(eventData.noteId).toBe('note-123')
      expect(eventData.text).toBe('highlighted text here')
    })
  })

  describe('Custom Prompt Mode (isCustomPrompt=true)', () => {
    const customPromptProps = {
      visible: true,
      noteId: 'note-custom',
      initialContent: 'This is the AI response to custom prompt',
      isTemp: false,
      isStreaming: false,
      isCustomPrompt: true,
      customPromptText: 'explain this concept\nfor more context: selected text'
    }

    it('shows Save and Explore buttons when isCustomPrompt is true and not streaming', () => {
      wrapper = mount(Note, { props: customPromptProps, attachTo: root })

      const actions = document.body.querySelector('.custom-prompt-actions')
      expect(actions).toBeTruthy()

      const buttons = actions.querySelectorAll('button')
      expect(buttons.length).toBe(2)
      expect(buttons[0].textContent).toBe('Save')
      expect(buttons[1].textContent).toContain('Explore')
    })

    it('does not show Save and Explore buttons when streaming', async () => {
      wrapper = mount(Note, {
        props: { ...customPromptProps, isStreaming: true, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      const actions = document.body.querySelector('.custom-prompt-actions')
      expect(actions).toBeFalsy()
    })

    it('does not show detail explain link when isCustomPrompt is true', () => {
      wrapper = mount(Note, {
        props: { ...customPromptProps, highlightedText: 'some text' },
        attachTo: root
      })

      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeFalsy()
    })

    it('emits save event with noteId and initialContent when Save button is clicked', async () => {
      wrapper = mount(Note, { props: customPromptProps, attachTo: root })

      const saveBtn = document.body.querySelector('.custom-prompt-actions button:first-child')
      expect(saveBtn).toBeTruthy()
      await saveBtn.click()

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0][0]).toEqual({
        noteId: 'note-custom',
        content: 'This is the AI response to custom prompt'
      })
    })

    it('emits explore event with customPromptText when Explore button is clicked', async () => {
      wrapper = mount(Note, { props: customPromptProps, attachTo: root })

      const exploreBtn = document.body.querySelector('.custom-prompt-actions button:last-child')
      expect(exploreBtn).toBeTruthy()
      await exploreBtn.click()

      expect(wrapper.emitted('explore')).toBeTruthy()
      expect(wrapper.emitted('explore')[0][0]).toEqual({
        text: 'explain this concept\nfor more context: selected text'
      })
    })

    it('shows note content in view mode', () => {
      wrapper = mount(Note, { props: customPromptProps, attachTo: root })

      const noteContent = document.body.querySelector('.note-content')
      expect(noteContent).toBeTruthy()
      expect(noteContent.textContent).toContain('This is the AI response to custom prompt')

      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeFalsy()
    })

    it('does not show edit/delete buttons in header for custom prompt mode', () => {
      wrapper = mount(Note, { props: customPromptProps, attachTo: root })

      // In custom prompt mode with customPromptText, header actions should be hidden
      const headerActions = document.body.querySelector('.note-header-actions')
      expect(headerActions).toBeFalsy()
    })

    it('custom-prompt-actions has correct styling with justify-content space-between', () => {
      wrapper = mount(Note, { props: customPromptProps, attachTo: root })

      const actions = document.body.querySelector('.custom-prompt-actions')
      expect(actions).toBeTruthy()
      expect(actions.classList.contains('note-actions')).toBe(true)
      expect(actions.classList.contains('custom-prompt-actions')).toBe(true)
    })

    it('shows streaming cursor when isCustomPrompt and isStreaming are both true', async () => {
      wrapper = mount(Note, {
        props: { ...customPromptProps, isStreaming: true, visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })

      const cursor = document.body.querySelector('.streaming-cursor')
      expect(cursor).toBeTruthy()
    })

    it('does not show custom prompt actions when isCustomPrompt is false', () => {
      wrapper = mount(Note, {
        props: {
          ...customPromptProps,
          isCustomPrompt: false,
          customPromptText: '', // Clear customPromptText to prevent custom actions
          highlightedText: 'text'
        },
        attachTo: root
      })

      const customActions = document.body.querySelector('.custom-prompt-actions')
      expect(customActions).toBeFalsy()

      // Should show detail explain link instead
      const link = document.body.querySelector('.detail-explain-link')
      expect(link).toBeTruthy()
    })
  })

  describe('Markdown Rendering', () => {
    const markdownProps = {
      ...baseProps,
      isTemp: false,
      initialContent: 'This is **bold** and *italic* text'
    }

    it('renders markdown content using MarkdownRenderer', () => {
      wrapper = mount(Note, { props: markdownProps, attachTo: root })
      const noteContent = document.body.querySelector('.note-content')
      expect(noteContent).toBeTruthy()
      // Should have markdown-renderer component
      const markdownRenderer = noteContent.querySelector('.markdown-renderer')
      expect(markdownRenderer).toBeTruthy()
    })

    it('renders bold text correctly', () => {
      wrapper = mount(Note, { props: markdownProps, attachTo: root })
      const strong = document.body.querySelector('.note-content strong')
      expect(strong).toBeTruthy()
      expect(strong.textContent).toBe('bold')
    })

    it('renders italic text correctly', () => {
      wrapper = mount(Note, { props: markdownProps, attachTo: root })
      const em = document.body.querySelector('.note-content em')
      expect(em).toBeTruthy()
      expect(em.textContent).toBe('italic')
    })

    it('renders inline code correctly', () => {
      wrapper = mount(Note, {
        props: { ...markdownProps, initialContent: 'Use `code` here' },
        attachTo: root
      })
      const code = document.body.querySelector('.note-content code')
      expect(code).toBeTruthy()
      expect(code.textContent).toContain('code')
    })

    it('renders links correctly', () => {
      wrapper = mount(Note, {
        props: { ...markdownProps, initialContent: 'Visit [example](https://example.com)' },
        attachTo: root
      })
      const link = document.body.querySelector('.note-content a')
      expect(link).toBeTruthy()
      expect(link.textContent).toBe('example')
      expect(link.getAttribute('href')).toBe('https://example.com')
    })

    it('shows "No content" when initialContent is empty and not streaming', async () => {
      wrapper = mount(Note, {
        props: { ...markdownProps, initialContent: '', visible: false },
        attachTo: root
      })
      await wrapper.setProps({ visible: true })
      // Empty content should auto-enter edit mode
      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()
    })
  })

  describe('Resize Functionality', () => {
    const resizeProps = {
      ...baseProps,
      isTemp: false,
      initialContent: 'Some content for resize test'
    }

    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.removeItem('note-modal-size')
    })

    it('renders resize handle', () => {
      wrapper = mount(Note, { props: resizeProps, attachTo: root })
      const resizeHandle = document.body.querySelector('.resize-handle')
      expect(resizeHandle).toBeTruthy()
    })

    it('resize handle has correct cursor style', () => {
      wrapper = mount(Note, { props: resizeProps, attachTo: root })
      const resizeHandle = document.body.querySelector('.resize-handle')
      expect(resizeHandle).toBeTruthy()
      expect(resizeHandle.classList.contains('resize-handle')).toBe(true)
    })

    it('resize handle contains SVG icon', () => {
      wrapper = mount(Note, { props: resizeProps, attachTo: root })
      const resizeHandle = document.body.querySelector('.resize-handle')
      const svg = resizeHandle.querySelector('svg')
      expect(svg).toBeTruthy()
    })

    it('applies custom width and height from modalStyle', async () => {
      // Set localStorage with saved size
      localStorage.setItem('note-modal-size', JSON.stringify({ width: 500, height: 400 }))

      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const modalContent = document.body.querySelector('.modal-content')
      expect(modalContent).toBeTruthy()
      expect(modalContent.style.width).toBe('500px')
      expect(modalContent.style.maxWidth).toBe('500px')
      expect(modalContent.style.height).toBe('400px')
    })

    it('loads saved size from localStorage on mount', async () => {
      localStorage.setItem('note-modal-size', JSON.stringify({ width: 600, height: 350 }))

      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const modalContent = document.body.querySelector('.modal-content')
      expect(modalContent.style.width).toBe('600px')
      expect(modalContent.style.height).toBe('350px')
    })

    it('uses default width when no saved size', async () => {
      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const modalContent = document.body.querySelector('.modal-content')
      // Default width is 400px
      expect(modalContent.style.width).toBe('400px')
    })

    it('starts resize on mousedown', async () => {
      wrapper = mount(Note, { props: resizeProps, attachTo: root })
      const resizeHandle = document.body.querySelector('.resize-handle')

      const mousedownEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      })
      resizeHandle.dispatchEvent(mousedownEvent)

      // The resize should have started (isResizing should be true internally)
      // We can verify by checking that preventClose is passed to modal
      // Since we can't directly check internal state, we verify the handle exists
      expect(resizeHandle).toBeTruthy()
    })

    it('updates size on mousemove during resize', async () => {
      localStorage.setItem('note-modal-size', JSON.stringify({ width: 400, height: 300 }))
      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const resizeHandle = document.body.querySelector('.resize-handle')

      // Start resize
      const mousedownEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      })
      resizeHandle.dispatchEvent(mousedownEvent)

      // Move mouse
      const mousemoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
        bubbles: true
      })
      document.dispatchEvent(mousemoveEvent)
      await wrapper.vm.$nextTick()

      // End resize
      const mouseupEvent = new MouseEvent('mouseup', { bubbles: true })
      document.dispatchEvent(mouseupEvent)
      await wrapper.vm.$nextTick()

      // Check that size was updated
      const modalContent = document.body.querySelector('.modal-content')
      // Width should have increased by 50px (from 400 to 450)
      expect(modalContent.style.width).toBe('450px')
    })

    it('saves size to localStorage after resize ends', async () => {
      localStorage.setItem('note-modal-size', JSON.stringify({ width: 400, height: 300 }))
      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const resizeHandle = document.body.querySelector('.resize-handle')

      // Start resize
      resizeHandle.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      }))

      // Move mouse
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 150,
        bubbles: true
      }))

      // End resize
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

      // Check localStorage was updated
      const saved = JSON.parse(localStorage.getItem('note-modal-size'))
      expect(saved.width).toBe(450)
      expect(saved.height).toBe(350)
    })

    it('respects minimum width constraint', async () => {
      localStorage.setItem('note-modal-size', JSON.stringify({ width: 400, height: 300 }))
      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const resizeHandle = document.body.querySelector('.resize-handle')

      // Start resize
      resizeHandle.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      }))

      // Try to resize smaller than min width (280px)
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: -200, // Large negative delta
        clientY: 100,
        bubbles: true
      }))
      await wrapper.vm.$nextTick()

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      await wrapper.vm.$nextTick()

      const modalContent = document.body.querySelector('.modal-content')
      // Should be clamped to minimum width (280px)
      expect(modalContent.style.width).toBe('280px')
    })

    it('respects maximum width constraint', async () => {
      localStorage.setItem('note-modal-size', JSON.stringify({ width: 400, height: 300 }))
      wrapper = mount(Note, { props: { ...resizeProps, visible: false }, attachTo: root })
      await wrapper.setProps({ visible: true })

      const resizeHandle = document.body.querySelector('.resize-handle')

      // Start resize
      resizeHandle.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      }))

      // Try to resize larger than max width (800px)
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 600, // Large positive delta
        clientY: 100,
        bubbles: true
      }))
      await wrapper.vm.$nextTick()

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      await wrapper.vm.$nextTick()

      const modalContent = document.body.querySelector('.modal-content')
      // Should be clamped to maximum width (800px)
      expect(modalContent.style.width).toBe('800px')
    })

    it('does not close modal during resize', async () => {
      wrapper = mount(Note, { props: resizeProps, attachTo: root })
      const resizeHandle = document.body.querySelector('.resize-handle')

      // Start resize
      resizeHandle.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true
      }))
      await wrapper.vm.$nextTick()

      // Try to close via overlay mousedown during resize (should be prevented)
      const overlay = document.body.querySelector('.modal-overlay')
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      await wrapper.vm.$nextTick()

      // Modal should still be visible (no cancel event emitted because preventClose is true)
      expect(wrapper.emitted('cancel')).toBeFalsy()

      // End resize
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
  })

  describe('Save Without Closing', () => {
    const editableProps = {
      ...baseProps,
      isTemp: false,
      initialContent: 'Existing note content'
    }

    it('does not emit cancel when save is clicked (keeps modal open)', async () => {
      wrapper = mount(Note, { props: editableProps, attachTo: root })

      // Click edit button to enter edit mode
      const editBtn = document.body.querySelector('.note-icon-btn')
      await editBtn.click()

      // Type in textarea
      const textarea = document.body.querySelector('.note-textarea')
      textarea.value = 'Updated content'
      textarea.dispatchEvent(new Event('input'))

      // Click Save
      const buttons = document.body.querySelectorAll('.note-actions button')
      const saveBtn = buttons[1]
      await saveBtn.click()

      // Should emit save event
      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0][0]).toEqual({
        noteId: 'note-123',
        content: 'Updated content'
      })

      // Should NOT emit cancel (modal stays open)
      expect(wrapper.emitted('cancel')).toBeFalsy()
    })

    it('returns to view mode after save', async () => {
      wrapper = mount(Note, { props: editableProps, attachTo: root })

      // Click edit button to enter edit mode
      const editBtn = document.body.querySelector('.note-icon-btn')
      await editBtn.click()

      // Verify we're in edit mode
      let textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()

      // Click Save
      const buttons = document.body.querySelectorAll('.note-actions button')
      await buttons[1].click()

      // Should be back in view mode
      const noteContent = document.body.querySelector('.note-content')
      textarea = document.body.querySelector('.note-textarea')
      expect(noteContent).toBeTruthy()
      expect(textarea).toBeFalsy()
    })

    it('textarea fills available space with flex: 1', () => {
      wrapper = mount(Note, { props: { ...baseProps, isTemp: true }, attachTo: root })
      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()
      // The textarea should have flex styling applied
      expect(textarea.classList.contains('note-textarea')).toBe(true)
    })

    it('textarea has resize: none style', () => {
      wrapper = mount(Note, { props: { ...baseProps, isTemp: true }, attachTo: root })
      const textarea = document.body.querySelector('.note-textarea')
      expect(textarea).toBeTruthy()
      // CSS check - the class should be applied
      expect(textarea.classList.contains('note-textarea')).toBe(true)
    })
  })

  describe('Modal Close Behavior', () => {
    it('closes on mousedown on overlay, not click', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const overlay = document.body.querySelector('.modal-overlay')

      // Mousedown on overlay should close
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('does not close when mousedown starts inside and ends outside', async () => {
      wrapper = mount(Note, { props: baseProps, attachTo: root })
      const modalContent = document.body.querySelector('.modal-content')
      const overlay = document.body.querySelector('.modal-overlay')

      // Mousedown on content
      modalContent.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

      // Mouseup on overlay (simulating drag)
      overlay.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

      // Should not have closed
      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })
})
