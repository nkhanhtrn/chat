import { describe, it, expect, beforeEach, vi } from 'vitest'
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

    it('should convert highlighted text to link when child has highlightedText', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework for building user interfaces',
        children: []
      }))

      const child = Message.createChildMessage(parent, 'Tell me more', 'JavaScript framework')
      child.response = 'JavaScript frameworks help...'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const markdownRenderer = wrapper.find('.markdown-stub')
      const html = markdownRenderer.html()

      expect(html).toContain('data-child-index="0"')
      expect(html).toContain('class="highlighted-link"')
      expect(html).toContain('JavaScript framework')
    })

    it('should handle multiple children with different highlighted text', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is programming?',
        response: 'Programming involves writing code using languages like Python and JavaScript',
        children: []
      }))

      const child1 = Message.createChildMessage(parent, 'About Python', 'Python')
      child1.response = 'Python is...'
      parent.children.push(child1)

      const child2 = Message.createChildMessage(parent, 'About JavaScript', 'JavaScript')
      child2.response = 'JavaScript is...'
      parent.children.push(child2)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const markdownRenderer = wrapper.find('.markdown-stub')
      const html = markdownRenderer.html()

      expect(html).toContain('data-child-index="0"')
      expect(html).toContain('data-child-index="1"')
      expect(html).toContain('>Python<')
      expect(html).toContain('>JavaScript<')
    })

    it('should escape special regex characters in highlighted text', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is regex?',
        response: 'Regular expressions use special characters like . * + ? [ ] ( ) { }',
        children: []
      }))

      const child = Message.createChildMessage(parent, 'About special chars', '. * + ?')
      child.response = 'These are...'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const markdownRenderer = wrapper.find('.markdown-stub')
      const html = markdownRenderer.html()

      // Should contain the link without breaking
      expect(html).toContain('data-child-index="0"')
      expect(html).toContain('. * + ?')
    })

    it('should not create links for children without highlightedText', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = Message.createChildMessage(parent, 'Tell me more')
      child.response = 'Vue was created...'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const markdownRenderer = wrapper.find('.markdown-stub')
      const html = markdownRenderer.html()

      expect(html).not.toContain('data-child-index')
      expect(html).not.toContain('highlighted-link')
    })
  })

  describe('navigateToChild function', () => {
    it('should navigate to child message when valid index is provided', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more', 'JavaScript'))
      child.response = 'JavaScript is a programming language'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      // Initially showing parent response
      let markdownRenderer = wrapper.find('.markdown-stub')
      expect(markdownRenderer.text()).toContain('Vue is a JavaScript framework')

      // Call navigateToChild directly
      wrapper.vm.navigateToChild(0)
      await nextTick()

      // Should now show child response
      markdownRenderer = wrapper.find('.markdown-stub')
      expect(markdownRenderer.text()).toBe('JavaScript is a programming language')
    })

    it('should show parent button when viewing child message', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more', 'JavaScript'))
      child.response = 'JavaScript is...'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: true,
            ContextMenu: true
          }
        }
      })

      await nextTick()
      expect(wrapper.find('.parent-switch-btn').exists()).toBe(false)

      wrapper.vm.navigateToChild(0)
      await nextTick()

      expect(wrapper.find('.parent-switch-btn').exists()).toBe(true)
    })

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
    it('should navigate to child when clicking highlighted link', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more', 'JavaScript'))
      child.response = 'JavaScript is a programming language'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      // Find and click the highlighted link
      const link = wrapper.find('a.highlighted-link')
      expect(link.exists()).toBe(true)

      await link.trigger('click')
      await nextTick()

      // Should now show child response
      const markdownRenderer = wrapper.find('.markdown-stub')
      expect(markdownRenderer.text()).toBe('JavaScript is a programming language')
    })

    it('should prevent default behavior when clicking highlighted link', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more', 'JavaScript'))
      child.response = 'JavaScript is...'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      const link = wrapper.find('a.highlighted-link')
      const event = new MouseEvent('click', { bubbles: true })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      await link.element.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

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

  describe('Integration: Full workflow', () => {
    it('should support navigating from parent to child and back', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more', 'JavaScript'))
      child.response = 'JavaScript is a programming language'
      parent.children.push(child)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      // Start with parent
      expect(wrapper.find('.markdown-stub').text()).toContain('Vue is a JavaScript framework')
      expect(wrapper.find('.parent-switch-btn').exists()).toBe(false)

      // Navigate to child by clicking link
      await wrapper.find('a.highlighted-link').trigger('click')
      await nextTick()

      // Should show child
      expect(wrapper.find('.markdown-stub').text()).toBe('JavaScript is a programming language')
      expect(wrapper.find('.parent-switch-btn').exists()).toBe(true)

      // Navigate back to parent
      await wrapper.find('.parent-switch-btn').trigger('click')
      await nextTick()

      // Should show parent again
      expect(wrapper.find('.markdown-stub').text()).toContain('Vue is a JavaScript framework')
      expect(wrapper.find('.parent-switch-btn').exists()).toBe(false)
    })

    it('should support nested navigation with multiple children', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is programming?',
        response: 'Programming uses languages like Python and JavaScript',
        children: []
      }))

      const child1 = reactive(Message.createChildMessage(parent, 'About Python', 'Python'))
      child1.response = 'Python is a high-level language used for data science'
      parent.children.push(child1)

      const grandchild = reactive(Message.createChildMessage(child1, 'About data science', 'data science'))
      grandchild.response = 'Data science involves analyzing data'
      child1.children.push(grandchild)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: {
              template: '<div class="markdown-stub" v-html="content"></div>',
              props: ['content']
            },
            ContextMenu: true
          }
        }
      })

      await nextTick()

      // Navigate to child
      const links = wrapper.findAll('a.highlighted-link')
      await links[0].trigger('click')
      await nextTick()

      expect(wrapper.find('.markdown-stub').text()).toContain('Python is a high-level language')

      // Navigate to grandchild
      await wrapper.find('a.highlighted-link').trigger('click')
      await nextTick()

      expect(wrapper.find('.markdown-stub').text()).toBe('Data science involves analyzing data')

      // Navigate back to child
      await wrapper.find('.parent-switch-btn').trigger('click')
      await nextTick()

      expect(wrapper.find('.markdown-stub').text()).toContain('Python is a high-level language')

      // Navigate back to parent
      await wrapper.find('.parent-switch-btn').trigger('click')
      await nextTick()

      expect(wrapper.find('.markdown-stub').text()).toContain('Programming uses languages')
    })
  })
})
