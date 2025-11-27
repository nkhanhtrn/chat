import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { reactive, nextTick } from 'vue'
import ChatMessage, { escapeRegex, createHighlightedLink } from '../ChatMessage.vue'
import Message from '../../stores/Message.js'

describe('ChatMessage - Highlighted Text Links', () => {
  let wrapper
  let pinia

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    pinia = createPinia()
  })

  describe('Helper Functions', () => {
    describe('escapeRegex', () => {
      it('should escape special regex characters', () => {
        expect(escapeRegex('.')).toBe('\\.')
        expect(escapeRegex('*')).toBe('\\*')
        expect(escapeRegex('+')).toBe('\\+')
        expect(escapeRegex('?')).toBe('\\?')
        expect(escapeRegex('[')).toBe('\\[')
        expect(escapeRegex(']')).toBe('\\]')
        expect(escapeRegex('(')).toBe('\\(')
        expect(escapeRegex(')')).toBe('\\)')
        expect(escapeRegex('{')).toBe('\\{')
        expect(escapeRegex('}')).toBe('\\}')
        expect(escapeRegex('|')).toBe('\\|')
        expect(escapeRegex('\\')).toBe('\\\\')
        expect(escapeRegex('^')).toBe('\\^')
        expect(escapeRegex('$')).toBe('\\$')
      })

      it('should escape multiple special characters', () => {
        expect(escapeRegex('. * + ?')).toBe('\\. \\* \\+ \\?')
        expect(escapeRegex('test.*pattern')).toBe('test\\.\\*pattern')
      })

      it('should not modify regular text', () => {
        expect(escapeRegex('hello world')).toBe('hello world')
        expect(escapeRegex('JavaScript')).toBe('JavaScript')
      })
    })

    describe('createHighlightedLink', () => {
      it('should create a link with correct attributes', () => {
        const result = createHighlightedLink('test text', 0)
        expect(result).toBe('<a href="#" data-child-index="0" class="highlighted-link">test text</a>')
      })

      it('should handle different child indices', () => {
        expect(createHighlightedLink('text', 0)).toContain('data-child-index="0"')
        expect(createHighlightedLink('text', 5)).toContain('data-child-index="5"')
        expect(createHighlightedLink('text', 99)).toContain('data-child-index="99"')
      })

      it('should preserve text content exactly', () => {
        const result = createHighlightedLink('special <>&" chars', 0)
        expect(result).toContain('special <>&" chars')
      })
    })
  })

  describe('processedResponse computed property', () => {
    it('should return unchanged response when there are no children', async () => {
      const message = reactive(new Message({
        id: '1',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      wrapper = mount(ChatMessage, {
        props: { message },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub">{{ content }}</div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const markdownRenderer = wrapper.find('.markdown-stub')
      expect(markdownRenderer.text()).toBe('Vue is a JavaScript framework')
    })

    it('should replace highlightedText in response with a link for each child', async () => {
      // Parent message with a response containing the highlighted text
      const parent = reactive(new Message({
        id: 'parent',
        question: 'Q',
        response: 'This is a highlight and another highlight.',
        childIds: ['child1', 'child2']
      }))
      // Two children, both highlight the same word
      const child1 = new Message({
        id: 'child1',
        question: 'Follow up 1',
        response: '',
        parentId: 'parent',
        highlightedText: 'highlight'
      })
      const child2 = new Message({
        id: 'child2',
        question: 'Follow up 2',
        response: '',
        parentId: 'parent',
        highlightedText: 'another'
      })

      // Pinia store setup
      const store = pinia._s.get('chat') || pinia.state.value.chat
      if (store) {
        // If store already exists, clear it
        store.messagesById = {}
        store.rootMessageIds = []
      }
      // Manually add messages to store
      pinia.state.value.chat = {
        messagesById: {
          parent,
          child1,
          child2
        },
        rootMessageIds: ['parent'],
        currentMessageId: 'parent',
        isStreaming: false,
        error: null,
        currentModel: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub">{{ content }}</div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const stub = wrapper.find('.markdown-stub')
      // The stub will render the anchor tags as escaped text
      expect(stub.text()).toContain('<a href="#" data-child-index="0" class="highlighted-link">highlight</a>')
      expect(stub.text()).toContain('<a href="#" data-child-index="1" class="highlighted-link">another</a>')
    })
  })

  describe('navigateToChild function', () => {


    it('should not navigate if child index is out of bounds', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub">{{ content }}</div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      const initialResponse = wrapper.find('.markdown-stub').text()

      // Try to navigate to non-existent child
      wrapper.vm.navigateToChild(5)
      await nextTick()

      // Should still show parent response
      expect(wrapper.find('.markdown-stub').text()).toBe(initialResponse)
    })
  })

  describe('handleResponseClick function', () => {


    it('should not navigate when clicking non-highlighted content', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub">{{ content }}</div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      const initialResponse = wrapper.find('.markdown-stub').text()

      // Click on the assistant message div (not a link)
      await wrapper.find('.assistant-message').trigger('click')
      await nextTick()

      // Should still show same response
      expect(wrapper.find('.markdown-stub').text()).toBe(initialResponse)
    })
  })
})
