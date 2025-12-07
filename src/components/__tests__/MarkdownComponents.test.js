import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownParagraph from '../markdown/MarkdownParagraph.vue'
import MarkdownHeading from '../markdown/MarkdownHeading.vue'
import MarkdownList from '../markdown/MarkdownList.vue'
import MarkdownListItem from '../markdown/MarkdownListItem.vue'
import MarkdownBlockquote from '../markdown/MarkdownBlockquote.vue'
import MarkdownLink from '../markdown/MarkdownLink.vue'
import MarkdownStrong from '../markdown/MarkdownStrong.vue'
import MarkdownEmphasis from '../markdown/MarkdownEmphasis.vue'
import InlineCode from '../markdown/InlineCode.vue'
import CodeBlock from '../markdown/CodeBlock.vue'
import MathBlock from '../markdown/MathBlock.vue'
import MathInline from '../markdown/MathInline.vue'
import HighlightSpan from '../markdown/HighlightSpan.vue'
import QuestionLinkSpan from '../markdown/QuestionLinkSpan.vue'
import TextSpan from '../markdown/TextSpan.vue'
import MarkdownTable from '../markdown/MarkdownTable.vue'
import CollapsibleBlock from '../markdown/CollapsibleBlock.vue'

describe('Markdown Components', () => {
  describe('MarkdownParagraph', () => {
    it('should render paragraph with correct class', () => {
      const wrapper = mount(MarkdownParagraph, {
        slots: {
          default: 'This is a paragraph'
        }
      })
      expect(wrapper.find('.markdown-paragraph').exists()).toBe(true)
      expect(wrapper.html()).toContain('This is a paragraph')
    })

    it('should render as p element', () => {
      const wrapper = mount(MarkdownParagraph, {
        slots: {
          default: 'Test paragraph'
        }
      })
      expect(wrapper.element.tagName).toBe('P')
    })
  })

  describe('MarkdownHeading', () => {
    it('should render h1 heading', () => {
      const wrapper = mount(MarkdownHeading, {
        props: { level: 1 },
        slots: { default: 'Heading 1' }
      })
      expect(wrapper.element.tagName).toBe('H1')
      expect(wrapper.text()).toBe('Heading 1')
      expect(wrapper.classes()).toContain('markdown-heading-1')
    })

    it('should render h2 heading', () => {
      const wrapper = mount(MarkdownHeading, {
        props: { level: 2 },
        slots: { default: 'Heading 2' }
      })
      expect(wrapper.element.tagName).toBe('H2')
      expect(wrapper.classes()).toContain('markdown-heading-2')
    })

    it('should render h3 heading', () => {
      const wrapper = mount(MarkdownHeading, {
        props: { level: 3 },
        slots: { default: 'Heading 3' }
      })
      expect(wrapper.element.tagName).toBe('H3')
      expect(wrapper.classes()).toContain('markdown-heading-3')
    })

    it('should render h6 heading', () => {
      const wrapper = mount(MarkdownHeading, {
        props: { level: 6 },
        slots: { default: 'Heading 6' }
      })
      expect(wrapper.element.tagName).toBe('H6')
      expect(wrapper.classes()).toContain('markdown-heading-6')
    })

    it('should validate level prop range', () => {
      const component = MarkdownHeading
      const validator = component.props.level.validator
      expect(validator(1)).toBe(true)
      expect(validator(6)).toBe(true)
      expect(validator(0)).toBe(false)
      expect(validator(7)).toBe(false)
    })
  })

  describe('MarkdownList', () => {
    it('should render unordered list by default', () => {
      const wrapper = mount(MarkdownList, {
        slots: {
          default: '<li>Item 1</li>'
        }
      })
      expect(wrapper.element.tagName).toBe('UL')
      expect(wrapper.classes()).toContain('markdown-list')
    })

    it('should render ordered list when ordered prop is true', () => {
      const wrapper = mount(MarkdownList, {
        props: { ordered: true },
        slots: {
          default: '<li>Item 1</li>'
        }
      })
      expect(wrapper.element.tagName).toBe('OL')
      expect(wrapper.classes()).toContain('markdown-list')
    })
  })

  describe('MarkdownListItem', () => {
    it('should render list item with correct class', () => {
      const wrapper = mount(MarkdownListItem, {
        slots: {
          default: 'List item content'
        }
      })
      expect(wrapper.element.tagName).toBe('LI')
      expect(wrapper.classes()).toContain('markdown-list-item')
      expect(wrapper.text()).toBe('List item content')
    })
  })

  describe('MarkdownBlockquote', () => {
    it('should render blockquote with correct class', () => {
      const wrapper = mount(MarkdownBlockquote, {
        slots: {
          default: 'Quoted text'
        }
      })
      expect(wrapper.element.tagName).toBe('BLOCKQUOTE')
      expect(wrapper.classes()).toContain('markdown-blockquote')
      expect(wrapper.text()).toBe('Quoted text')
    })
  })

  describe('MarkdownLink', () => {
    it('should render link with href', () => {
      const wrapper = mount(MarkdownLink, {
        props: {
          href: 'https://example.com'
        },
        slots: {
          default: 'Click here'
        }
      })
      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.attributes('href')).toBe('https://example.com')
      expect(wrapper.text()).toBe('Click here')
      expect(wrapper.classes()).toContain('markdown-link')
    })

    it('should open in new tab with security attributes', () => {
      const wrapper = mount(MarkdownLink, {
        props: {
          href: 'https://example.com'
        },
        slots: {
          default: 'Link'
        }
      })
      expect(wrapper.attributes('target')).toBe('_blank')
      expect(wrapper.attributes('rel')).toBe('noopener noreferrer')
    })

    it('should render with title attribute', () => {
      const wrapper = mount(MarkdownLink, {
        props: {
          href: 'https://example.com',
          title: 'Example Site'
        },
        slots: {
          default: 'Link'
        }
      })
      expect(wrapper.attributes('title')).toBe('Example Site')
    })
  })

  describe('MarkdownStrong', () => {
    it('should render strong element', () => {
      const wrapper = mount(MarkdownStrong, {
        slots: {
          default: 'Bold text'
        }
      })
      expect(wrapper.element.tagName).toBe('STRONG')
      expect(wrapper.classes()).toContain('markdown-strong')
      expect(wrapper.text()).toBe('Bold text')
    })
  })

  describe('MarkdownEmphasis', () => {
    it('should render em element', () => {
      const wrapper = mount(MarkdownEmphasis, {
        slots: {
          default: 'Italic text'
        }
      })
      expect(wrapper.element.tagName).toBe('EM')
      expect(wrapper.classes()).toContain('markdown-emphasis')
      expect(wrapper.text()).toBe('Italic text')
    })
  })

  describe('MarkdownHorizontalRule', () => {
    it('should render hr element', async () => {
      const { default: MarkdownHorizontalRule } = await import('../markdown/MarkdownHorizontalRule.vue')
      const wrapper = mount(MarkdownHorizontalRule)
      expect(wrapper.element.tagName).toBe('HR')
    })
  })

  describe('MarkdownBreak', () => {
    it('should render br element', async () => {
      const { default: MarkdownBreak } = await import('../markdown/MarkdownBreak.vue')
      const wrapper = mount(MarkdownBreak)
      expect(wrapper.element.tagName).toBe('BR')
    })
  })

  describe('InlineCode', () => {
    let clipboardWriteTextSpy

    beforeEach(() => {
      // Mock clipboard API
      clipboardWriteTextSpy = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: clipboardWriteTextSpy
        },
        writable: true,
        configurable: true
      })
    })

    it('should render inline code with content prop', () => {
      const wrapper = mount(InlineCode, {
        props: {
          content: 'console.log()'
        }
      })
      expect(wrapper.find('.inline-code').exists()).toBe(true)
      expect(wrapper.text()).toContain('console.log()')
    })

    it('should render inline code with slot', () => {
      const wrapper = mount(InlineCode, {
        slots: {
          default: 'const x = 5'
        }
      })
      expect(wrapper.find('.inline-code').exists()).toBe(true)
      expect(wrapper.text()).toContain('const x = 5')
    })

    it('should have copy button', () => {
      const wrapper = mount(InlineCode, {
        props: {
          content: 'test'
        }
      })
      expect(wrapper.find('.copy-btn').exists()).toBe(true)
    })

    it('should copy code to clipboard when copy button is clicked', async () => {
      const wrapper = mount(InlineCode, {
        props: {
          content: 'test code'
        }
      })
      await wrapper.find('.copy-btn').trigger('click')
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith('test code')
    })

    it('should flash when code is copied', async () => {
      const wrapper = mount(InlineCode, {
        props: {
          content: 'test'
        }
      })
      await wrapper.find('.copy-btn').trigger('click')
      expect(wrapper.find('.inline-code').classes()).toContain('flashing')
    })
  })

  describe('CodeBlock', () => {
    let clipboardWriteTextSpy

    beforeEach(() => {
      clipboardWriteTextSpy = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: clipboardWriteTextSpy
        },
        writable: true,
        configurable: true
      })
    })

    it('should render code block with language and code', () => {
      const wrapper = mount(CodeBlock, {
        props: {
          language: 'javascript',
          code: 'const x = 5;'
        }
      })
      expect(wrapper.find('.code-block').exists()).toBe(true)
      expect(wrapper.find('.code-header').text()).toContain('javascript')
      expect(wrapper.find('code').text()).toBe('const x = 5;')
    })

    it('should use plaintext as default language', () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'some code'
        }
      })
      expect(wrapper.find('.code-header').text()).toContain('plaintext')
    })

    it('should have copy button in header', () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })
      expect(wrapper.find('.code-header .copy-btn').exists()).toBe(true)
    })

    it('should copy code to clipboard when copy button is clicked', async () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'function test() { return true; }'
        }
      })
      await wrapper.find('.copy-btn').trigger('click')
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith('function test() { return true; }')
    })

    it('should flash when code is copied', async () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })
      await wrapper.find('.copy-btn').trigger('click')
      expect(wrapper.find('pre').classes()).toContain('flashing')
    })

    it('should start in expanded state', () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'const x = 5;'
        }
      })
      expect(wrapper.find('.code-container').exists()).toBe(true)
      expect(wrapper.find('.collapse-row').exists()).toBe(false)
      expect(wrapper.find('.code-block').exists()).toBe(true)
    })

    it('should collapse when collapse button is clicked', async () => {
      const wrapper = mount(CodeBlock, {
        props: {
          language: 'javascript',
          code: 'const x = 5;'
        }
      })

      // Initially expanded
      expect(wrapper.find('.code-container').exists()).toBe(true)

      // Click collapse button
      await wrapper.find('.collapse-btn').trigger('click')

      // Should now be collapsed
      expect(wrapper.find('.collapse-row').exists()).toBe(true)
      expect(wrapper.find('.code-container').exists()).toBe(false)
    })

    it('should expand when expand button is clicked', async () => {
      const wrapper = mount(CodeBlock, {
        props: {
          language: 'javascript',
          code: 'const x = 5;'
        }
      })

      // Collapse first
      await wrapper.find('.collapse-btn').trigger('click')
      expect(wrapper.find('.collapse-row').exists()).toBe(true)

      // Click expand button
      await wrapper.find('.collapse-btn').trigger('click')

      // Should now be expanded
      expect(wrapper.find('.code-container').exists()).toBe(true)
      expect(wrapper.find('.collapse-row').exists()).toBe(false)
    })

    it('should show language and line count when collapsed', async () => {
      const wrapper = mount(CodeBlock, {
        props: {
          language: 'python',
          code: 'line1\nline2\nline3'
        }
      })

      await wrapper.find('.collapse-btn').trigger('click')

      const label = wrapper.find('.collapsed-label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toContain('python')
      expect(label.text()).toContain('3 lines')
    })

    it('should expand when collapsed label is clicked', async () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'test code'
        }
      })

      // Collapse
      await wrapper.find('.collapse-btn').trigger('click')
      expect(wrapper.find('.collapse-row').exists()).toBe(true)

      // Click label
      await wrapper.find('.collapsed-label').trigger('click')

      // Should expand
      expect(wrapper.find('.code-container').exists()).toBe(true)
    })

    it('should compute line count correctly', () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'line1\nline2\nline3\nline4\nline5'
        }
      })
      expect(wrapper.vm.lineCount).toBe(5)
    })

    it('should compute line count as 1 for single line', () => {
      const wrapper = mount(CodeBlock, {
        props: {
          code: 'single line'
        }
      })
      expect(wrapper.vm.lineCount).toBe(1)
    })
  })

  describe('MathBlock', () => {
    beforeEach(() => {
      vi.mock('../../services/katex', () => ({
        renderKatex: vi.fn((content) => {
          return `<span class="katex-rendered">${content}</span>`
        })
      }))
    })

    it('should render math block', async () => {
      const wrapper = mount(MathBlock, {
        props: {
          content: 'E = mc^2'
        }
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('span').exists()).toBe(true)
    })
  })

  describe('MathInline', () => {
    beforeEach(() => {
      vi.mock('../../services/katex', () => ({
        renderKatex: vi.fn((content) => {
          return `<span class="katex-rendered">${content}</span>`
        })
      }))
    })

    it('should render inline math', async () => {
      const wrapper = mount(MathInline, {
        props: {
          content: 'x^2 + y^2 = z^2'
        }
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('span').exists()).toBe(true)
    })
  })

  describe('HighlightSpan', () => {
    it('should render highlighted text', () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'highlighted text',
          highlightId: 'test-id-123',
          startOffset: 0,
          endOffset: 16
        }
      })
      // Root element is now a wrapper span, with mark inside
      expect(wrapper.element.tagName).toBe('SPAN')
      expect(wrapper.classes()).toContain('highlight-wrapper')
      const mark = wrapper.find('mark')
      expect(mark.exists()).toBe(true)
      expect(mark.classes()).toContain('custom-highlight')
      expect(mark.text()).toBe('highlighted text')
    })

    it('should have data attributes for offsets', () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'text',
          highlightId: 'id-123',
          startOffset: 10,
          endOffset: 20
        }
      })
      const mark = wrapper.find('mark')
      expect(mark.attributes('data-highlight-id')).toBe('id-123')
      expect(mark.attributes('data-md-start')).toBe('10')
      expect(mark.attributes('data-md-end')).toBe('20')
    })

    it('should apply custom color via colorIndex', () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'text',
          colorIndex: 2,
          highlightId: 'id',
          startOffset: 0,
          endOffset: 4
        }
      })
      const mark = wrapper.find('mark')
      expect(mark.attributes('style')).toContain('background-color: var(--color-highlight-2)')
    })

    it('should render slot content', () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          highlightId: 'id',
          startOffset: 0,
          endOffset: 4
        },
        slots: {
          default: 'Slot content'
        }
      })
      expect(wrapper.text()).toBe('Slot content')
    })

    it('should emit highlight-click event when clicked', async () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'highlighted text',
          highlightId: 'test-id-123',
          startOffset: 10,
          endOffset: 26
        }
      })

      await wrapper.find('.custom-highlight').trigger('click')

      expect(wrapper.emitted('highlight-click')).toBeTruthy()
      expect(wrapper.emitted('highlight-click')).toHaveLength(1)
    })

    it('should emit highlight-click event with correct data', async () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'test highlight',
          highlightId: 'highlight-123',
          startOffset: 5,
          endOffset: 19
        }
      })

      const clickEvent = {
        clientX: 150,
        clientY: 250,
        stopPropagation: vi.fn()
      }

      await wrapper.find('.custom-highlight').trigger('click', clickEvent)

      const emittedEvents = wrapper.emitted('highlight-click')
      expect(emittedEvents).toHaveLength(1)

      const [eventData] = emittedEvents[0]
      expect(eventData).toEqual({
        highlightId: 'highlight-123',
        text: 'test highlight',
        colorIndex: 0,
        startOffset: 5,
        endOffset: 19,
        x: 150,
        y: 250
      })
    })

    it('should call stopPropagation when clicked', async () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'text',
          highlightId: 'id-123',
          startOffset: 0,
          endOffset: 4
        }
      })

      const mockEvent = {
        clientX: 100,
        clientY: 200,
        stopPropagation: vi.fn()
      }

      // Click on the mark element, not the wrapper span
      const mark = wrapper.find('mark')
      await mark.trigger('click', mockEvent)

      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should have cursor pointer style', () => {
      const wrapper = mount(HighlightSpan, {
        props: {
          text: 'text',
          highlightId: 'id',
          startOffset: 0,
          endOffset: 4
        }
      })

      // Check if the CSS class is applied (cursor: pointer is in the scoped style)
      const mark = wrapper.find('mark')
      expect(mark.classes()).toContain('custom-highlight')
    })

    describe('Note Button', () => {
      it('should not render note button when hasNote is false', () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'highlighted text',
            highlightId: 'h-123',
            startOffset: 0,
            endOffset: 16,
            hasNote: false
          }
        })
        expect(wrapper.find('.note-button').exists()).toBe(false)
      })

      it('should render note button when hasNote is true', () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'highlighted text',
            highlightId: 'h-123',
            startOffset: 0,
            endOffset: 16,
            hasNote: true
          }
        })
        expect(wrapper.find('.note-button').exists()).toBe(true)
      })

      it('should have data-note-id attribute on note button', () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'text',
            highlightId: 'highlight-456',
            startOffset: 0,
            endOffset: 4,
            hasNote: true
          }
        })
        const noteButton = wrapper.find('.note-button')
        expect(noteButton.attributes('data-note-id')).toBe('highlight-456')
      })

      it('should emit note-click event when note button is clicked', async () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'highlighted text',
            highlightId: 'h-789',
            startOffset: 10,
            endOffset: 26,
            hasNote: true,
            noteContent: 'This is my note'
          }
        })

        const clickEvent = {
          clientX: 200,
          clientY: 300,
          stopPropagation: vi.fn()
        }

        await wrapper.find('.note-button').trigger('click', clickEvent)

        expect(wrapper.emitted('note-click')).toBeTruthy()
        expect(wrapper.emitted('note-click')).toHaveLength(1)

        const [eventData] = wrapper.emitted('note-click')[0]
        expect(eventData).toEqual({
          noteId: 'h-789',
          text: 'highlighted text',
          noteContent: 'This is my note',
          startOffset: 10,
          endOffset: 26,
          x: 200,
          y: 300
        })
      })

      it('should not emit highlight-click when note button is clicked', async () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'highlighted text',
            highlightId: 'h-123',
            startOffset: 0,
            endOffset: 16,
            hasNote: true
          }
        })

        await wrapper.find('.note-button').trigger('click')

        // Note button click should NOT trigger highlight-click
        expect(wrapper.emitted('highlight-click')).toBeFalsy()
        // But should emit note-click
        expect(wrapper.emitted('note-click')).toBeTruthy()
      })

      it('should emit note-click with empty noteContent when not provided', async () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'text',
            highlightId: 'h-123',
            startOffset: 0,
            endOffset: 4,
            hasNote: true
            // noteContent not provided, should default to ''
          }
        })

        const clickEvent = {
          clientX: 100,
          clientY: 100,
          stopPropagation: vi.fn()
        }

        await wrapper.find('.note-button').trigger('click', clickEvent)

        const [eventData] = wrapper.emitted('note-click')[0]
        expect(eventData.noteContent).toBe('')
      })

      it('should render note button with + symbol', () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'text',
            highlightId: 'h-123',
            startOffset: 0,
            endOffset: 4,
            hasNote: true
          }
        })
        const noteButton = wrapper.find('.note-button')
        expect(noteButton.text()).toBe('+')
      })

      it('should have title attribute on note button', () => {
        const wrapper = mount(HighlightSpan, {
          props: {
            text: 'text',
            highlightId: 'h-123',
            startOffset: 0,
            endOffset: 4,
            hasNote: true
          }
        })
        const noteButton = wrapper.find('.note-button')
        expect(noteButton.attributes('title')).toBe('Open note')
      })
    })
  })

  describe('QuestionLinkSpan', () => {
    it('should render question link', () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'question text',
          targetMessageId: 'msg-0',
          questionId: 'q-123',
          startOffset: 0,
          endOffset: 13
        }
      })
      expect(wrapper.element.tagName).toBe('A')
      expect(wrapper.classes()).toContain('question-link')
      expect(wrapper.text()).toBe('question text')
    })

    it('should have required data attributes', () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'text',
          targetMessageId: 'msg-2',
          questionId: 'q-456',
          startOffset: 5,
          endOffset: 10
        }
      })
      expect(wrapper.attributes('data-target-message-id')).toBe('msg-2')
      expect(wrapper.attributes('data-question-id')).toBe('q-456')
      expect(wrapper.attributes('data-md-start')).toBe('5')
      expect(wrapper.attributes('data-md-end')).toBe('10')
    })

    it('should have href attribute with fallback when store is not available', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'text',
          targetMessageId: 'msg-0',
          questionId: 'q-123',
          startOffset: 0,
          endOffset: 4
        }
      })
      // When store is not available (like in tests), should return '#' as fallback
      expect(wrapper.attributes('href')).toBe('#')
    })

    it('should prevent default on regular click', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'link text',
          targetMessageId: 'msg-1',
          questionId: 'q-123',
          startOffset: 0,
          endOffset: 9
        }
      })

      const preventDefaultMock = vi.fn()
      await wrapper.find('a').trigger('click', {
        preventDefault: preventDefaultMock
      })

      expect(preventDefaultMock).toHaveBeenCalled()
    })

    it('should not emit highlight-click on regular click', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'link text',
          targetMessageId: 'msg-1',
          questionId: 'q-123',
          startOffset: 0,
          endOffset: 9
        }
      })

      await wrapper.find('a').trigger('click')

      expect(wrapper.emitted('highlight-click')).toBeFalsy()
    })

    it('should emit highlight-click on Ctrl+click', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'link text',
          targetMessageId: 'msg-1',
          questionId: 'q-123',
          startOffset: 5,
          endOffset: 14
        }
      })

      await wrapper.find('a').trigger('click', {
        ctrlKey: true,
        clientX: 100,
        clientY: 200
      })

      expect(wrapper.emitted('highlight-click')).toBeTruthy()
      expect(wrapper.emitted('highlight-click')).toHaveLength(1)
    })

    it('should emit highlight-click with correct data on Ctrl+click', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'test link',
          targetMessageId: 'msg-2',
          questionId: 'q-456',
          startOffset: 10,
          endOffset: 19
        }
      })

      await wrapper.find('a').trigger('click', {
        ctrlKey: true,
        clientX: 150,
        clientY: 250
      })

      const emittedEvents = wrapper.emitted('highlight-click')
      expect(emittedEvents).toHaveLength(1)

      const [eventData] = emittedEvents[0]
      expect(eventData).toEqual({
        highlightId: 'q-456',
        text: 'test link',
        colorIndex: 0,
        startOffset: 10,
        endOffset: 19,
        x: 150,
        y: 250
      })
    })

    it('should emit highlight-click on Meta+click (Cmd on Mac)', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'link text',
          targetMessageId: 'msg-1',
          questionId: 'q-123',
          startOffset: 0,
          endOffset: 9
        }
      })

      await wrapper.find('a').trigger('click', {
        metaKey: true,
        clientX: 100,
        clientY: 200
      })

      expect(wrapper.emitted('highlight-click')).toBeTruthy()
      expect(wrapper.emitted('highlight-click')).toHaveLength(1)
    })

    it('should prevent default and stop propagation on Ctrl+click', async () => {
      const wrapper = mount(QuestionLinkSpan, {
        props: {
          text: 'link text',
          targetMessageId: 'msg-1',
          questionId: 'q-123',
          startOffset: 0,
          endOffset: 9
        }
      })

      const preventDefaultMock = vi.fn()
      const stopPropagationMock = vi.fn()

      await wrapper.find('a').trigger('click', {
        ctrlKey: true,
        preventDefault: preventDefaultMock,
        stopPropagation: stopPropagationMock
      })

      expect(preventDefaultMock).toHaveBeenCalled()
      expect(stopPropagationMock).toHaveBeenCalled()
    })
  })

  describe('TextSpan', () => {
    it('should render text content', () => {
      const wrapper = mount(TextSpan, {
        props: {
          content: 'plain text',
          startOffset: 0,
          endOffset: 10
        }
      })
      expect(wrapper.element.tagName).toBe('SPAN')
      expect(wrapper.text()).toBe('plain text')
    })

    it('should have offset data attributes', () => {
      const wrapper = mount(TextSpan, {
        props: {
          content: 'text',
          startOffset: 15,
          endOffset: 25
        }
      })
      expect(wrapper.attributes('data-md-start')).toBe('15')
      expect(wrapper.attributes('data-md-end')).toBe('25')
    })

    it('should render slot content', () => {
      const wrapper = mount(TextSpan, {
        props: {
          startOffset: 0,
          endOffset: 4
        },
        slots: {
          default: 'Slotted text'
        }
      })
      expect(wrapper.text()).toBe('Slotted text')
    })
  })

  describe('MarkdownTable', () => {
    it('should render table with headers and rows', () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header 1' }], align: null },
                  { type: 'th', children: [{ type: 'text', text: 'Header 2' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Cell 1' }] },
                  { type: 'td', children: [{ type: 'text', text: 'Cell 2' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: {
          node: tableNode
        }
      })

      expect(wrapper.find('.markdown-table').exists()).toBe(true)
      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)
      expect(wrapper.findAll('th').length).toBe(2)
      expect(wrapper.findAll('td').length).toBe(2)
    })

    it('should handle table alignment', () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Left' }], align: 'text-align:left' },
                  { type: 'th', children: [{ type: 'text', text: 'Center' }], align: 'text-align:center' },
                  { type: 'th', children: [{ type: 'text', text: 'Right' }], align: 'text-align:right' }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'L' }] },
                  { type: 'td', children: [{ type: 'text', text: 'C' }] },
                  { type: 'td', children: [{ type: 'text', text: 'R' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: {
          node: tableNode
        }
      })

      const cells = wrapper.findAll('td')
      expect(cells[0].attributes('style')).toContain('text-align: left')
      expect(cells[1].attributes('style')).toContain('text-align: center')
      expect(cells[2].attributes('style')).toContain('text-align: right')
    })

    it('should bubble highlight-click event from table cell', async () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  {
                    type: 'td',
                    children: [
                      {
                        type: 'highlight',
                        text: 'table highlight',
                        highlightId: 'h-in-table',
                        colorIndex: 3,
                        startOffset: 0,
                        endOffset: 15
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: {
          node: tableNode
        }
      })

      const highlight = wrapper.findComponent(HighlightSpan)
      expect(highlight.exists()).toBe(true)

      // Click on the mark element inside HighlightSpan
      const mark = highlight.find('mark')
      const clickEvent = {
        clientX: 100,
        clientY: 200,
        stopPropagation: vi.fn()
      }

      await mark.trigger('click', clickEvent)

      expect(wrapper.emitted('highlight-click')).toBeTruthy()
      expect(wrapper.emitted('highlight-click')).toHaveLength(1)

      const [eventData] = wrapper.emitted('highlight-click')[0]
      expect(eventData.highlightId).toBe('h-in-table')
      expect(eventData.text).toBe('table highlight')
      expect(eventData.colorIndex).toBe(3)
    })

    it('should bubble highlight-click event from table header cell', async () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  {
                    type: 'th',
                    children: [
                      {
                        type: 'highlight',
                        text: 'header highlight',
                        highlightId: 'h-in-header',
                        colorIndex: 1,
                        startOffset: 0,
                        endOffset: 16
                      }
                    ],
                    align: null
                  }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Cell' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: {
          node: tableNode
        }
      })

      const highlight = wrapper.findComponent(HighlightSpan)
      expect(highlight.exists()).toBe(true)

      // Click on the mark element inside HighlightSpan
      const mark = highlight.find('mark')
      const clickEvent = {
        clientX: 50,
        clientY: 100,
        stopPropagation: vi.fn()
      }

      await mark.trigger('click', clickEvent)

      expect(wrapper.emitted('highlight-click')).toBeTruthy()
      const [eventData] = wrapper.emitted('highlight-click')[0]
      expect(eventData.highlightId).toBe('h-in-header')
    })

    it('should start in expanded state', () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Cell' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: { node: tableNode }
      })

      expect(wrapper.find('.table-container').exists()).toBe(true)
      expect(wrapper.find('.collapse-row').exists()).toBe(false)
      expect(wrapper.find('.markdown-table').exists()).toBe(true)
    })

    it('should collapse when collapse button is clicked', async () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Cell' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: { node: tableNode }
      })

      // Initially expanded
      expect(wrapper.find('.table-container').exists()).toBe(true)

      // Click collapse button
      await wrapper.find('.collapse-btn').trigger('click')

      // Should now be collapsed
      expect(wrapper.find('.collapse-row').exists()).toBe(true)
      expect(wrapper.find('.table-container').exists()).toBe(false)
    })

    it('should expand when expand button is clicked', async () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Cell' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: { node: tableNode }
      })

      // Collapse first
      await wrapper.find('.collapse-btn').trigger('click')
      expect(wrapper.find('.collapse-row').exists()).toBe(true)

      // Click expand button
      await wrapper.find('.collapse-btn').trigger('click')

      // Should now be expanded
      expect(wrapper.find('.table-container').exists()).toBe(true)
      expect(wrapper.find('.collapse-row').exists()).toBe(false)
    })

    it('should show row count when collapsed', async () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Row 1' }] }
                ]
              },
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Row 2' }] }
                ]
              },
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Row 3' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: { node: tableNode }
      })

      await wrapper.find('.collapse-btn').trigger('click')

      const label = wrapper.find('.collapsed-label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toContain('Table')
      expect(label.text()).toContain('3 rows')
    })

    it('should expand when collapsed label is clicked', async () => {
      const tableNode = {
        type: 'table',
        children: [
          {
            type: 'thead',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                ]
              }
            ]
          },
          {
            type: 'tbody',
            children: [
              {
                type: 'tr',
                children: [
                  { type: 'td', children: [{ type: 'text', text: 'Cell' }] }
                ]
              }
            ]
          }
        ]
      }

      const wrapper = mount(MarkdownTable, {
        props: { node: tableNode }
      })

      // Collapse
      await wrapper.find('.collapse-btn').trigger('click')
      expect(wrapper.find('.collapse-row').exists()).toBe(true)

      // Click label
      await wrapper.find('.collapsed-label').trigger('click')

      // Should expand
      expect(wrapper.find('.table-container').exists()).toBe(true)
    })
  })

  describe('TableCell', () => {
    let TableCell

    beforeEach(async () => {
      const module = await import('../markdown/TableCell.vue')
      TableCell = module.default
    })

    describe('Basic Rendering', () => {
      it('should render cell with text content', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              { type: 'text', content: 'Cell content', startOffset: 0, endOffset: 12 }
            ]
          }
        })
        expect(wrapper.element.tagName).toBe('SPAN')
        expect(wrapper.text()).toBe('Cell content')
      })

      it('should render cell with text property', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              { type: 'text', text: 'Text property' }
            ]
          }
        })
        expect(wrapper.text()).toContain('Text property')
      })

      it('should render multiple text nodes', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              { type: 'text', content: 'First', startOffset: 0, endOffset: 5 },
              { type: 'text', content: ' Second', startOffset: 5, endOffset: 12 }
            ]
          }
        })
        expect(wrapper.text()).toBe('First Second')
      })

      it('should render empty cell with empty children', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: []
          }
        })
        expect(wrapper.element.tagName).toBe('SPAN')
        expect(wrapper.text()).toBe('')
      })
    })

    describe('Component Type Mapping', () => {
      it('should render highlight span', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'highlight',
                text: 'highlighted',
                color: '#ffff00',
                highlightId: 'h-123',
                startOffset: 0,
                endOffset: 11
              }
            ]
          }
        })
        expect(wrapper.find('mark').exists()).toBe(true)
        expect(wrapper.text()).toBe('highlighted')
      })

      it('should render question-link span', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'question-link',
                text: 'question',
                targetMessageId: 'msg-1',
                questionId: 'q-123',
                startOffset: 0,
                endOffset: 8
              }
            ]
          }
        })
        expect(wrapper.find('a.question-link').exists()).toBe(true)
        expect(wrapper.text()).toBe('question')
      })

      it('should render inline code', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'code_inline',
                content: 'console.log()'
              }
            ]
          }
        })
        expect(wrapper.find('.inline-code').exists()).toBe(true)
        expect(wrapper.text()).toContain('console.log()')
      })

      it('should render strong element', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'strong',
                children: [
                  { type: 'text', content: 'bold', startOffset: 0, endOffset: 4 }
                ]
              }
            ]
          }
        })
        expect(wrapper.find('strong').exists()).toBe(true)
        expect(wrapper.text()).toBe('bold')
      })

      it('should render emphasis element', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'em',
                children: [
                  { type: 'text', content: 'italic', startOffset: 0, endOffset: 6 }
                ]
              }
            ]
          }
        })
        expect(wrapper.find('em').exists()).toBe(true)
        expect(wrapper.text()).toBe('italic')
      })

      it('should render link element', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                title: 'Example',
                children: [
                  { type: 'text', content: 'link text', startOffset: 0, endOffset: 9 }
                ]
              }
            ]
          }
        })
        expect(wrapper.find('a.markdown-link').exists()).toBe(true)
        expect(wrapper.find('a').attributes('href')).toBe('https://example.com')
        expect(wrapper.text()).toBe('link text')
      })

      it('should use fallback span for unknown type', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'unknown_type',
                content: 'fallback'
              }
            ]
          }
        })
        expect(wrapper.find('span').exists()).toBe(true)
      })
    })

    describe('Node Props Mapping', () => {
      it('should pass correct props for text node', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'text',
                content: 'test',
                startOffset: 10,
                endOffset: 14
              }
            ]
          }
        })
        const textSpan = wrapper.findComponent(TextSpan)
        expect(textSpan.exists()).toBe(true)
        expect(textSpan.props('content')).toBe('test')
        expect(textSpan.props('startOffset')).toBe(10)
        expect(textSpan.props('endOffset')).toBe(14)
      })

      it('should pass correct props for highlight node', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'highlight',
                text: 'highlighted',
                colorIndex: 3,
                highlightId: 'h-456',
                startOffset: 5,
                endOffset: 16
              }
            ]
          }
        })
        const highlight = wrapper.findComponent(HighlightSpan)
        expect(highlight.exists()).toBe(true)
        expect(highlight.props('text')).toBe('highlighted')
        expect(highlight.props('colorIndex')).toBe(3)
        expect(highlight.props('highlightId')).toBe('h-456')
        expect(highlight.props('startOffset')).toBe(5)
        expect(highlight.props('endOffset')).toBe(16)
      })

      it('should pass correct props for question-link node', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'question-link',
                text: 'question',
                targetMessageId: 'msg-3',
                questionId: 'q-789',
                startOffset: 20,
                endOffset: 28
              }
            ]
          }
        })
        const questionLink = wrapper.findComponent(QuestionLinkSpan)
        expect(questionLink.exists()).toBe(true)
        expect(questionLink.props('text')).toBe('question')
        expect(questionLink.props('targetMessageId')).toBe('msg-3')
        expect(questionLink.props('questionId')).toBe('q-789')
        expect(questionLink.props('startOffset')).toBe(20)
        expect(questionLink.props('endOffset')).toBe(28)
      })

      it('should pass correct props for code_inline node', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'code_inline',
                content: 'const x = 5'
              }
            ]
          }
        })
        const inlineCode = wrapper.findComponent(InlineCode)
        expect(inlineCode.exists()).toBe(true)
        expect(inlineCode.props('content')).toBe('const x = 5')
      })

      it('should pass correct props for link node', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'link',
                href: 'https://test.com',
                title: 'Test Link',
                children: [
                  { type: 'text', content: 'click', startOffset: 0, endOffset: 5 }
                ]
              }
            ]
          }
        })
        const link = wrapper.findComponent(MarkdownLink)
        expect(link.exists()).toBe(true)
        expect(link.props('href')).toBe('https://test.com')
        expect(link.props('title')).toBe('Test Link')
      })

      it('should return empty props for unknown node type', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'unknown',
                someProperty: 'value'
              }
            ]
          }
        })
        // Should not crash and render fallback span
        expect(wrapper.find('span').exists()).toBe(true)
      })
    })

    describe('Nested Children', () => {
      it('should render nested children recursively', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'strong',
                children: [
                  {
                    type: 'em',
                    children: [
                      { type: 'text', content: 'nested', startOffset: 0, endOffset: 6 }
                    ]
                  }
                ]
              }
            ]
          }
        })
        expect(wrapper.find('strong').exists()).toBe(true)
        expect(wrapper.find('em').exists()).toBe(true)
        expect(wrapper.text()).toBe('nested')
      })

      it('should render mixed inline elements', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              { type: 'text', content: 'Normal ', startOffset: 0, endOffset: 7 },
              {
                type: 'strong',
                children: [
                  { type: 'text', content: 'bold', startOffset: 7, endOffset: 11 }
                ]
              },
              { type: 'text', content: ' and ', startOffset: 11, endOffset: 16 },
              {
                type: 'em',
                children: [
                  { type: 'text', content: 'italic', startOffset: 16, endOffset: 22 }
                ]
              }
            ]
          }
        })
        expect(wrapper.text()).toBe('Normal bold and italic')
        expect(wrapper.find('strong').exists()).toBe(true)
        expect(wrapper.find('em').exists()).toBe(true)
      })

      it('should handle complex nested structure', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                children: [
                  {
                    type: 'strong',
                    children: [
                      { type: 'text', content: 'Bold Link', startOffset: 0, endOffset: 9 }
                    ]
                  }
                ]
              }
            ]
          }
        })
        expect(wrapper.find('a').exists()).toBe(true)
        expect(wrapper.find('strong').exists()).toBe(true)
        expect(wrapper.text()).toBe('Bold Link')
      })
    })

    describe('Event Handling', () => {
      it('should render QuestionLinkSpan with proper href', async () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'question-link',
                text: 'click me',
                targetMessageId: 'msg-5',
                questionId: 'q-123',
                startOffset: 0,
                endOffset: 8
              }
            ]
          }
        })

        const questionLink = wrapper.findComponent(QuestionLinkSpan)
        expect(questionLink.exists()).toBe(true)
        expect(questionLink.attributes('href')).toBe('#') // Fallback when store not available
      })

      it('should render nested question-link within strong element', async () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'strong',
                children: [
                  {
                    type: 'question-link',
                    text: 'nested question',
                    targetMessageId: 'msg-7',
                    questionId: 'q-456',
                    startOffset: 0,
                    endOffset: 15
                  }
                ]
              }
            ]
          }
        })

        const questionLink = wrapper.findComponent(QuestionLinkSpan)
        expect(questionLink.exists()).toBe(true)
        expect(wrapper.find('strong').exists()).toBe(true)
      })

      it('should render deeply nested question-link', async () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'link',
                href: '#',
                children: [
                  {
                    type: 'strong',
                    children: [
                      {
                        type: 'question-link',
                        text: 'deep question',
                        targetMessageId: 'msg-9',
                        questionId: 'q-deep',
                        startOffset: 0,
                        endOffset: 13
                      }
                    ]
                  }
                ]
              }
            ]
          }
        })

        const questionLink = wrapper.findComponent(QuestionLinkSpan)
        expect(questionLink.exists()).toBe(true)
        expect(questionLink.text()).toBe('deep question')
        expect(wrapper.find('a.markdown-link').exists()).toBe(true)
        expect(wrapper.find('strong').exists()).toBe(true)
      })

      it('should render regular links without question-link class', async () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                children: [
                  { type: 'text', content: 'regular link', startOffset: 0, endOffset: 12 }
                ]
              }
            ]
          }
        })

        const link = wrapper.find('a.markdown-link')
        expect(link.exists()).toBe(true)
        expect(wrapper.findComponent(QuestionLinkSpan).exists()).toBe(false)
      })

      it('should bubble highlight-click event from HighlightSpan', async () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'highlight',
                text: 'highlighted text',
                highlightId: 'h-table-123',
                colorIndex: 2,
                startOffset: 0,
                endOffset: 16
              }
            ]
          }
        })

        const highlight = wrapper.findComponent(HighlightSpan)
        expect(highlight.exists()).toBe(true)

        // Click on the mark element inside HighlightSpan
        const mark = highlight.find('mark')
        const clickEvent = {
          clientX: 200,
          clientY: 300,
          stopPropagation: vi.fn()
        }

        await mark.trigger('click', clickEvent)

        expect(wrapper.emitted('highlight-click')).toBeTruthy()
        expect(wrapper.emitted('highlight-click')).toHaveLength(1)

        const [eventData] = wrapper.emitted('highlight-click')[0]
        expect(eventData.highlightId).toBe('h-table-123')
        expect(eventData.text).toBe('highlighted text')
        expect(eventData.colorIndex).toBe(2)
      })

      it('should bubble highlight-click from nested TableCell children', async () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'strong',
                children: [
                  {
                    type: 'highlight',
                    text: 'nested highlight',
                    highlightId: 'h-nested-456',
                    colorIndex: 1,
                    startOffset: 0,
                    endOffset: 16
                  }
                ]
              }
            ]
          }
        })

        // Find the nested HighlightSpan and click on its mark element
        const highlight = wrapper.findComponent(HighlightSpan)
        expect(highlight.exists()).toBe(true)

        const mark = highlight.find('mark')
        const clickEvent = {
          clientX: 150,
          clientY: 250,
          stopPropagation: vi.fn()
        }

        await mark.trigger('click', clickEvent)

        expect(wrapper.emitted('highlight-click')).toBeTruthy()
        const [eventData] = wrapper.emitted('highlight-click')[0]
        expect(eventData.highlightId).toBe('h-nested-456')
      })
    })

    describe('Edge Cases', () => {
      it('should handle node with content property', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'text',
                content: 'content property'
              }
            ]
          }
        })
        expect(wrapper.text()).toContain('content property')
      })

      it('should handle node with text property', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'text',
                text: 'text property'
              }
            ]
          }
        })
        expect(wrapper.text()).toContain('text property')
      })

      it('should handle link without title', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                children: [
                  { type: 'text', content: 'link', startOffset: 0, endOffset: 4 }
                ]
              }
            ]
          }
        })
        const link = wrapper.findComponent(MarkdownLink)
        expect(link.exists()).toBe(true)
        expect(link.props('href')).toBe('https://example.com')
        // MarkdownLink has a default value of '' for title prop
        expect(link.props('title')).toBe('')
      })

      it('should handle highlight without colorIndex (uses default)', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              {
                type: 'highlight',
                text: 'highlighted',
                highlightId: 'h-1',
                startOffset: 0,
                endOffset: 11
              }
            ]
          }
        })
        const highlight = wrapper.findComponent(HighlightSpan)
        expect(highlight.exists()).toBe(true)
        // HighlightSpan has a default value for colorIndex prop (0)
        expect(highlight.props('colorIndex')).toBe(0)
      })

      it('should render multiple different child types', () => {
        const wrapper = mount(TableCell, {
          props: {
            children: [
              { type: 'text', content: 'Text ', startOffset: 0, endOffset: 5 },
              { type: 'code_inline', content: 'code' },
              { type: 'text', content: ' and ', startOffset: 5, endOffset: 10 },
              {
                type: 'highlight',
                text: 'highlight',
                highlightId: 'h-1',
                startOffset: 10,
                endOffset: 19
              }
            ]
          }
        })
        expect(wrapper.text()).toContain('Text')
        expect(wrapper.text()).toContain('code')
        expect(wrapper.text()).toContain('and')
        expect(wrapper.text()).toContain('highlight')
        expect(wrapper.find('.inline-code').exists()).toBe(true)
        expect(wrapper.find('mark').exists()).toBe(true)
      })
    })
  })

  describe('ASTNode', () => {
    let ASTNode

    beforeEach(async () => {
      const module = await import('../ASTNode.vue')
      ASTNode = module.default
    })

    describe('Component Mapping', () => {
      it('should render paragraph node', () => {
        const node = {
          type: 'paragraph',
          children: [{ type: 'text', content: 'Test paragraph', startOffset: 0, endOffset: 14 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.markdown-paragraph').exists()).toBe(true)
        expect(wrapper.text()).toContain('Test paragraph')
      })

      it('should render heading node with level', () => {
        const node = {
          type: 'heading',
          level: 2,
          children: [{ type: 'text', content: 'Heading', startOffset: 0, endOffset: 7 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('H2')
        expect(wrapper.classes()).toContain('markdown-heading-2')
      })

      it('should render unordered list node', () => {
        const node = {
          type: 'list',
          ordered: false,
          children: [
            { type: 'list_item', children: [{ type: 'text', content: 'Item 1', startOffset: 0, endOffset: 6 }] }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('UL')
      })

      it('should render ordered list node', () => {
        const node = {
          type: 'list',
          ordered: true,
          children: [
            { type: 'list_item', children: [{ type: 'text', content: 'Item 1', startOffset: 0, endOffset: 6 }] }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('OL')
      })

      it('should render list item node', () => {
        const node = {
          type: 'list_item',
          children: [{ type: 'text', content: 'Item content', startOffset: 0, endOffset: 12 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('LI')
      })

      it('should render blockquote node', () => {
        const node = {
          type: 'blockquote',
          children: [{ type: 'text', content: 'Quote', startOffset: 0, endOffset: 5 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('BLOCKQUOTE')
      })

      it('should render link node with href and title', () => {
        const node = {
          type: 'link',
          href: 'https://example.com',
          title: 'Example',
          children: [{ type: 'text', content: 'Link text', startOffset: 0, endOffset: 9 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('A')
        expect(wrapper.attributes('href')).toBe('https://example.com')
        expect(wrapper.attributes('title')).toBe('Example')
      })

      it('should render strong node', () => {
        const node = {
          type: 'strong',
          children: [{ type: 'text', content: 'Bold', startOffset: 0, endOffset: 4 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('STRONG')
      })

      it('should render emphasis node', () => {
        const node = {
          type: 'em',
          children: [{ type: 'text', content: 'Italic', startOffset: 0, endOffset: 6 }]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('EM')
      })

      it('should render horizontal rule node', () => {
        const node = { type: 'hr' }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('HR')
      })

      it('should render break node', () => {
        const node = { type: 'br' }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('BR')
      })

      it('should render text node with offsets', () => {
        const node = {
          type: 'text',
          content: 'Plain text',
          startOffset: 5,
          endOffset: 15
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('SPAN')
        expect(wrapper.text()).toBe('Plain text')
        expect(wrapper.attributes('data-md-start')).toBe('5')
        expect(wrapper.attributes('data-md-end')).toBe('15')
      })

      it('should render highlight node', () => {
        const node = {
          type: 'highlight',
          text: 'highlighted',
          color: '#ffff00',
          highlightId: 'h-123',
          startOffset: 0,
          endOffset: 11
        }
        const wrapper = mount(ASTNode, { props: { node } })
        // Root element is now a wrapper span
        expect(wrapper.element.tagName).toBe('SPAN')
        expect(wrapper.classes()).toContain('highlight-wrapper')
        const mark = wrapper.find('mark')
        expect(mark.exists()).toBe(true)
        expect(mark.classes()).toContain('custom-highlight')
        expect(mark.attributes('data-highlight-id')).toBe('h-123')
      })

      it('should render question-link node', () => {
        const node = {
          type: 'question-link',
          text: 'question',
          targetMessageId: 'msg-2',
          questionId: 'q-456',
          startOffset: 0,
          endOffset: 8
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.element.tagName).toBe('A')
        expect(wrapper.classes()).toContain('question-link')
        expect(wrapper.attributes('data-target-message-id')).toBe('msg-2')
        expect(wrapper.attributes('data-question-id')).toBe('q-456')
      })

      it('should render code block node', () => {
        const node = {
          type: 'code_block',
          language: 'javascript',
          code: 'const x = 5;'
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.code-block').exists()).toBe(true)
        expect(wrapper.find('code').text()).toBe('const x = 5;')
      })

      it('should render inline code node', () => {
        const node = {
          type: 'code_inline',
          content: 'console.log()'
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.inline-code').exists()).toBe(true)
        expect(wrapper.text()).toContain('console.log()')
      })

      it('should render math block node', async () => {
        vi.mock('../../services/katex', () => ({
          renderKatex: vi.fn((content) => {
            return `<span class="katex-rendered">${content}</span>`
          })
        }))

        const node = {
          type: 'math_block',
          content: 'E = mc^2'
        }
        const wrapper = mount(ASTNode, { props: { node } })
        await wrapper.vm.$nextTick()
        expect(wrapper.find('span').exists()).toBe(true)
      })

      it('should render table node', () => {
        const node = {
          type: 'table',
          children: [
            {
              type: 'thead',
              children: [
                {
                  type: 'tr',
                  children: [
                    { type: 'th', children: [{ type: 'text', text: 'Header' }], align: null }
                  ]
                }
              ]
            }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.markdown-table').exists()).toBe(true)
      })
    })

    describe('Recursive Children Rendering', () => {
      it('should render nested children recursively', () => {
        const node = {
          type: 'paragraph',
          children: [
            { type: 'text', content: 'Start ', startOffset: 0, endOffset: 6 },
            {
              type: 'strong',
              children: [
                { type: 'text', content: 'bold', startOffset: 6, endOffset: 10 }
              ]
            },
            { type: 'text', content: ' end', startOffset: 10, endOffset: 14 }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toBe('Start bold end')
        expect(wrapper.find('strong').exists()).toBe(true)
      })

      it('should render deeply nested structures', () => {
        const node = {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'strong',
                  children: [
                    {
                      type: 'em',
                      children: [
                        { type: 'text', content: 'nested', startOffset: 0, endOffset: 6 }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('blockquote').exists()).toBe(true)
        expect(wrapper.find('strong').exists()).toBe(true)
        expect(wrapper.find('em').exists()).toBe(true)
        expect(wrapper.text()).toBe('nested')
      })

      it('should render list with nested items', () => {
        const node = {
          type: 'list',
          ordered: false,
          children: [
            {
              type: 'list_item',
              children: [
                { type: 'text', content: 'Item 1', startOffset: 0, endOffset: 6 }
              ]
            },
            {
              type: 'list_item',
              children: [
                { type: 'text', content: 'Item 2', startOffset: 7, endOffset: 13 }
              ]
            }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        const items = wrapper.findAll('li')
        expect(items.length).toBe(2)
        expect(items[0].text()).toBe('Item 1')
        expect(items[1].text()).toBe('Item 2')
      })
    })

    describe('Content Rendering', () => {
      it('should render text property when present', () => {
        const node = {
          type: 'text',
          text: 'Text via text property',
          startOffset: 0,
          endOffset: 22
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toBe('Text via text property')
      })

      it('should render content property when present', () => {
        const node = {
          type: 'text',
          content: 'Text via content property',
          startOffset: 0,
          endOffset: 26
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toBe('Text via content property')
      })

      it('should prioritize children over content', () => {
        const node = {
          type: 'paragraph',
          content: 'Should not render',
          children: [
            { type: 'text', content: 'Should render', startOffset: 0, endOffset: 13 }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toBe('Should render')
        expect(wrapper.text()).not.toContain('Should not render')
      })

      it('should prioritize content over text', () => {
        const node = {
          type: 'text',
          content: 'Content property',
          text: 'Text property',
          startOffset: 0,
          endOffset: 16
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toBe('Content property')
      })
    })

    describe('Event Handling', () => {
      it('should render question-link with proper href', async () => {
        const node = {
          type: 'question-link',
          text: 'click me',
          targetMessageId: 'msg-5',
          questionId: 'q-789',
          startOffset: 0,
          endOffset: 8
        }
        const wrapper = mount(ASTNode, { props: { node } })

        const link = wrapper.find('a.question-link')
        expect(link.exists()).toBe(true)
        expect(link.attributes('href')).toBe('#') // Fallback when store not available
      })

      it('should render nested question-link', async () => {
        const node = {
          type: 'paragraph',
          children: [
            {
              type: 'question-link',
              text: 'nested link',
              targetMessageId: 'msg-3',
              questionId: 'q-123',
              startOffset: 0,
              endOffset: 11
            }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })

        const link = wrapper.find('a.question-link')
        expect(link.exists()).toBe(true)
        expect(link.text()).toBe('nested link')
      })

      it('should render deeply nested question-link', async () => {
        const node = {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'strong',
                  children: [
                    {
                      type: 'question-link',
                      text: 'deep link',
                      targetMessageId: 'msg-7',
                      questionId: 'q-deep',
                      startOffset: 0,
                      endOffset: 9
                    }
                  ]
                }
              ]
            }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })

        const link = wrapper.find('a.question-link')
        expect(link.exists()).toBe(true)
        expect(link.text()).toBe('deep link')
      })
    })

    describe('Props Binding', () => {
      it('should bind heading level correctly', () => {
        const levels = [1, 2, 3, 4, 5, 6]
        levels.forEach(level => {
          const node = {
            type: 'heading',
            level,
            children: [{ type: 'text', content: `H${level}`, startOffset: 0, endOffset: 2 }]
          }
          const wrapper = mount(ASTNode, { props: { node } })
          expect(wrapper.element.tagName).toBe(`H${level}`)
        })
      })

      it('should bind list ordered property', () => {
        const orderedNode = {
          type: 'list',
          ordered: true,
          children: [{ type: 'list_item', children: [{ type: 'text', content: 'Item', startOffset: 0, endOffset: 4 }] }]
        }
        const unorderedNode = {
          type: 'list',
          ordered: false,
          children: [{ type: 'list_item', children: [{ type: 'text', content: 'Item', startOffset: 0, endOffset: 4 }] }]
        }

        const orderedWrapper = mount(ASTNode, { props: { node: orderedNode } })
        const unorderedWrapper = mount(ASTNode, { props: { node: unorderedNode } })

        expect(orderedWrapper.element.tagName).toBe('OL')
        expect(unorderedWrapper.element.tagName).toBe('UL')
      })

      it('should bind text offsets correctly', () => {
        const node = {
          type: 'text',
          content: 'test',
          startOffset: 100,
          endOffset: 104
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.attributes('data-md-start')).toBe('100')
        expect(wrapper.attributes('data-md-end')).toBe('104')
      })

      it('should bind highlight properties', () => {
        const node = {
          type: 'highlight',
          text: 'highlighted text',
          colorIndex: 1,
          highlightId: 'test-highlight',
          startOffset: 10,
          endOffset: 26
        }
        const wrapper = mount(ASTNode, { props: { node } })
        const mark = wrapper.find('mark')
        expect(mark.attributes('data-highlight-id')).toBe('test-highlight')
        expect(mark.attributes('style')).toContain('background-color: var(--color-highlight-1)')
        expect(mark.attributes('data-md-start')).toBe('10')
        expect(mark.attributes('data-md-end')).toBe('26')
      })

      it('should bind question-link properties', () => {
        const node = {
          type: 'question-link',
          text: 'question text',
          targetMessageId: 'msg-42',
          questionId: 'q-unique',
          startOffset: 20,
          endOffset: 33
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.attributes('data-target-message-id')).toBe('msg-42')
        expect(wrapper.attributes('data-question-id')).toBe('q-unique')
        expect(wrapper.attributes('data-md-start')).toBe('20')
        expect(wrapper.attributes('data-md-end')).toBe('33')
      })

      it('should bind code block language and code', () => {
        const node = {
          type: 'code_block',
          language: 'python',
          code: 'print("hello")'
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.code-header').text()).toContain('python')
        expect(wrapper.find('code').text()).toBe('print("hello")')
      })

      it('should bind inline code content', () => {
        const node = {
          type: 'code_inline',
          content: 'const x = 42'
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toContain('const x = 42')
      })

      it('should return empty props for unknown node types', () => {
        const node = {
          type: 'unknown_type',
          children: [{ type: 'text', content: 'test', startOffset: 0, endOffset: 4 }]
        }
        // This should not crash and should render as undefined component
        const wrapper = mount(ASTNode, { props: { node } })
        // Component should handle gracefully
        expect(wrapper.exists()).toBe(true)
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty children array', () => {
        const node = {
          type: 'paragraph',
          children: []
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.markdown-paragraph').exists()).toBe(true)
        expect(wrapper.text()).toBe('')
      })

      it('should handle node with no children, content, or text', () => {
        const node = {
          type: 'paragraph'
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.markdown-paragraph').exists()).toBe(true)
      })

      it('should handle mixed text and child nodes', () => {
        const node = {
          type: 'paragraph',
          children: [
            { type: 'text', content: 'Regular ', startOffset: 0, endOffset: 8 },
            {
              type: 'highlight',
              text: 'highlighted',
              highlightId: 'h1',
              startOffset: 8,
              endOffset: 19
            },
            { type: 'text', content: ' text', startOffset: 19, endOffset: 24 }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.text()).toBe('Regular highlighted text')
        expect(wrapper.find('mark').exists()).toBe(true)
      })

      it('should handle inline code with children instead of content', () => {
        const node = {
          type: 'code_inline',
          children: [
            { type: 'text', content: 'code', startOffset: 0, endOffset: 4 }
          ]
        }
        const wrapper = mount(ASTNode, { props: { node } })
        expect(wrapper.find('.inline-code').exists()).toBe(true)
      })
    })
  })

  describe('CollapsibleBlock', () => {
    it('should render collapsible block wrapper', () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })
      expect(wrapper.find('.collapsible-block-wrapper').exists()).toBe(true)
    })

    it('should render header with collapse button', () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })
      expect(wrapper.find('.collapsible-header').exists()).toBe(true)
      expect(wrapper.find('.collapse-btn').exists()).toBe(true)
    })

    it('should start in collapsed state', () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })
      expect(wrapper.vm.isCollapsed).toBe(true)
      expect(wrapper.find('.collapse-label').text()).toBe('Show hidden content')
    })

    it('should hide content when collapsed', () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })
      // Content should be hidden (v-show="!isCollapsed")
      const content = wrapper.find('.collapsible-content')
      expect(content.exists()).toBe(true)
      // v-show sets display: none
      expect(content.element.style.display).toBe('none')
    })

    it('should expand when header is clicked', async () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })

      await wrapper.find('.collapsible-header').trigger('click')

      expect(wrapper.vm.isCollapsed).toBe(false)
      expect(wrapper.find('.collapse-label').text()).toBe('Hide content')
      // v-show removes display: none when expanded
      expect(wrapper.find('.collapsible-content').element.style.display).not.toBe('none')
    })

    it('should collapse when header is clicked again', async () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })

      // Expand first
      await wrapper.find('.collapsible-header').trigger('click')
      expect(wrapper.vm.isCollapsed).toBe(false)

      // Collapse
      await wrapper.find('.collapsible-header').trigger('click')
      expect(wrapper.vm.isCollapsed).toBe(true)
      expect(wrapper.find('.collapse-label').text()).toBe('Show hidden content')
    })

    it('should expand when collapse button is clicked', async () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Hidden content'
        }
      })

      await wrapper.find('.collapse-btn').trigger('click')

      expect(wrapper.vm.isCollapsed).toBe(false)
    })

    it('should render slot content', async () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: '<p>Slot content here</p>'
        }
      })

      // Expand to see content
      await wrapper.find('.collapsible-header').trigger('click')

      expect(wrapper.find('.collapsible-content').text()).toContain('Slot content here')
    })

    it('should render nested components in slot', async () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: '<strong>Bold</strong> and <em>italic</em>'
        }
      })

      await wrapper.find('.collapsible-header').trigger('click')

      expect(wrapper.find('.collapsible-content strong').exists()).toBe(true)
      expect(wrapper.find('.collapsible-content em').exists()).toBe(true)
    })

    it('should toggle arrow direction when expanded/collapsed', async () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Content'
        }
      })

      // Check collapsed arrow (points down: 6 9 12 15 18 9)
      let polyline = wrapper.find('.collapse-btn polyline')
      expect(polyline.attributes('points')).toBe('6 9 12 15 18 9')

      // Expand
      await wrapper.find('.collapsible-header').trigger('click')

      // Check expanded arrow (points up: 18 15 12 9 6 15)
      polyline = wrapper.find('.collapse-btn polyline')
      expect(polyline.attributes('points')).toBe('18 15 12 9 6 15')
    })

    it('should have correct CSS classes for styling', () => {
      const wrapper = mount(CollapsibleBlock, {
        slots: {
          default: 'Content'
        }
      })

      expect(wrapper.find('.collapsible-block-wrapper').exists()).toBe(true)
      expect(wrapper.find('.collapsible-header').exists()).toBe(true)
      expect(wrapper.find('.collapse-btn').exists()).toBe(true)
      expect(wrapper.find('.collapse-label').exists()).toBe(true)
      expect(wrapper.find('.collapsible-content').exists()).toBe(true)
    })
  })
})
