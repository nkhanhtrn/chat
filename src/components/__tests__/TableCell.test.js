import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TableCell from '../TableCell.vue'
import InlineCode from '../InlineCode.vue'

describe('TableCell', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render plain text', () => {
      const content = [
        { type: 'plain', text: 'Hello World' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.text()).toBe('Hello World')
    })

    it('should render bold text', () => {
      const content = [
        { type: 'bold', text: 'Bold Text' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const strong = wrapper.find('strong')
      expect(strong.exists()).toBe(true)
      expect(strong.text()).toBe('Bold Text')
    })

    it('should render italic text', () => {
      const content = [
        { type: 'italic', text: 'Italic Text' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const em = wrapper.find('em')
      expect(em.exists()).toBe(true)
      expect(em.text()).toBe('Italic Text')
    })

    it('should render code with InlineCode component', () => {
      const content = [
        { type: 'code', text: 'const x = 42;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const inlineCode = wrapper.findComponent(InlineCode)
      expect(inlineCode.exists()).toBe(true)
      expect(inlineCode.props('text')).toBe('const x = 42;')
    })

    it('should render mixed content types', () => {
      const content = [
        { type: 'plain', text: 'Normal ' },
        { type: 'bold', text: 'bold ' },
        { type: 'italic', text: 'italic ' },
        { type: 'code', text: 'code' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.find('strong').exists()).toBe(true)
      expect(wrapper.find('em').exists()).toBe(true)
      expect(wrapper.findComponent(InlineCode).exists()).toBe(true)
    })
  })

  describe('HTML Unescaping', () => {
    it('should unescape &lt; to <', () => {
      const content = [
        { type: 'plain', text: '&lt;div&gt;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.html()).toContain('<div>')
    })

    it('should unescape &gt; to >', () => {
      const content = [
        { type: 'plain', text: 'x &gt; 5' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      // Check that the unescapeHtml method is working
      expect(wrapper.vm.unescapeHtml('x &gt; 5')).toBe('x > 5')
    })

    it('should unescape &amp; to &', () => {
      const content = [
        { type: 'plain', text: 'Tom &amp; Jerry' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      // Check that the unescapeHtml method is working
      expect(wrapper.vm.unescapeHtml('Tom &amp; Jerry')).toBe('Tom & Jerry')
    })

    it('should unescape &quot; to "', () => {
      const content = [
        { type: 'plain', text: '&quot;Hello&quot;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.html()).toContain('"Hello"')
    })

    it('should unescape &#39; to \'', () => {
      const content = [
        { type: 'plain', text: 'It&#39;s great' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.html()).toContain("It's great")
    })

    it('should unescape HTML entities in bold text', () => {
      const content = [
        { type: 'bold', text: '&lt;br&gt;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.find('strong').html()).toContain('<br>')
    })

    it('should unescape HTML entities in italic text', () => {
      const content = [
        { type: 'italic', text: '&lt;span&gt;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.find('em').html()).toContain('<span>')
    })

    it('should handle multiple HTML entities in one text', () => {
      const content = [
        { type: 'plain', text: '&lt;div class=&quot;test&quot;&gt;Content&lt;/div&gt;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.html()).toContain('<div class="test">Content</div>')
    })

    it('should render <br> tags as actual line breaks', () => {
      const content = [
        { type: 'plain', text: 'Line 1&lt;br&gt;Line 2' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const html = wrapper.html()
      expect(html).toContain('<br>')
      expect(html).toContain('Line 1')
      expect(html).toContain('Line 2')
    })

    it('should not unescape code content (handled by InlineCode)', () => {
      const content = [
        { type: 'code', text: '&lt;div&gt;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const inlineCode = wrapper.findComponent(InlineCode)
      expect(inlineCode.props('text')).toBe('&lt;div&gt;')
    })
  })

  describe('Props', () => {
    it('should require content prop', () => {
      const { content } = TableCell.props
      expect(content.required).toBe(true)
      expect(content.type).toBe(Array)
    })
  })

  describe('Methods', () => {
    it('should have unescapeHtml method', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.vm.unescapeHtml).toBeDefined()
      expect(typeof wrapper.vm.unescapeHtml).toBe('function')
    })

    it('unescapeHtml should handle empty string', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.vm.unescapeHtml('')).toBe('')
    })

    it('unescapeHtml should handle null/undefined', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.vm.unescapeHtml(null)).toBe('')
      expect(wrapper.vm.unescapeHtml(undefined)).toBe('')
    })

    it('unescapeHtml should handle text without entities', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.vm.unescapeHtml('plain text')).toBe('plain text')
    })

    it('unescapeHtml should unescape all entities correctly', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.vm.unescapeHtml('&amp;')).toBe('&')
      expect(wrapper.vm.unescapeHtml('&lt;')).toBe('<')
      expect(wrapper.vm.unescapeHtml('&gt;')).toBe('>')
      expect(wrapper.vm.unescapeHtml('&quot;')).toBe('"')
      expect(wrapper.vm.unescapeHtml('&#39;')).toBe("'")
    })

    it('unescapeHtml should handle complex nested entities', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      // The function unescapes once: &amp;lt; becomes &lt; then <
      const result = wrapper.vm.unescapeHtml('&amp;lt;div&amp;gt;')
      expect(result).toBe('<div>')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty content array', () => {
      const content = []

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.text()).toBe('')
    })

    it('should handle content with empty text', () => {
      const content = [
        { type: 'plain', text: '' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.text()).toBe('')
    })

    it('should handle multiple parts with some empty', () => {
      const content = [
        { type: 'plain', text: 'Start' },
        { type: 'plain', text: '' },
        { type: 'plain', text: 'End' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.text()).toContain('Start')
      expect(wrapper.text()).toContain('End')
    })

    it('should render various HTML tags correctly', () => {
      const content = [
        { type: 'plain', text: '&lt;strong&gt;Bold&lt;/strong&gt;' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.html()).toContain('<strong>Bold</strong>')
    })

    it('should handle self-closing tags', () => {
      const content = [
        { type: 'plain', text: 'Line 1&lt;br/&gt;Line 2' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      // Browser normalizes <br/> or self-closing tags may become <br>
      const html = wrapper.html()
      expect(html.includes('<br/>') || html.includes('<br>')).toBe(true)
    })

    it('should handle mixed HTML and text content', () => {
      const content = [
        { type: 'plain', text: 'Text ' },
        { type: 'bold', text: '&lt;b&gt;nested&lt;/b&gt;' },
        { type: 'plain', text: ' more text' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const html = wrapper.html()
      expect(html).toContain('Text')
      expect(html).toContain('<b>nested</b>')
      expect(html).toContain('more text')
    })
  })

  describe('Structure', () => {
    it('should wrap content in a span', () => {
      const content = [
        { type: 'plain', text: 'test' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.element.tagName).toBe('SPAN')
    })

    it('should render content in correct order', () => {
      const content = [
        { type: 'plain', text: 'First ' },
        { type: 'bold', text: 'Second ' },
        { type: 'italic', text: 'Third' }
      ]

      wrapper = mount(TableCell, {
        props: { content }
      })

      const text = wrapper.text()
      expect(text.indexOf('First')).toBeLessThan(text.indexOf('Second'))
      expect(text.indexOf('Second')).toBeLessThan(text.indexOf('Third'))
    })
  })

  describe('Component Registration', () => {
    it('should register InlineCode component', () => {
      const content = [{ type: 'plain', text: 'test' }]
      wrapper = mount(TableCell, {
        props: { content }
      })

      expect(wrapper.vm.$options.components.InlineCode).toBeDefined()
    })
  })
})
