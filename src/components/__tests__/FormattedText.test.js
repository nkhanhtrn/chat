import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FormattedText from '../FormattedText.vue'
import InlineCode from '../InlineCode.vue'

describe('FormattedText', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render text content', () => {
      const content = [
        { type: 'text', text: 'Hello world' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.text()).toBe('Hello world')
    })

    it('should render bold text', () => {
      const content = [
        { type: 'bold', text: 'Bold text' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.find('strong').exists()).toBe(true)
      expect(wrapper.find('strong').text()).toBe('Bold text')
    })

    it('should render italic text', () => {
      const content = [
        { type: 'italic', text: 'Italic text' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.find('em').exists()).toBe(true)
      expect(wrapper.find('em').text()).toBe('Italic text')
    })

    it('should render inline code', () => {
      const content = [
        { type: 'code', text: 'const x = 10' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      const inlineCode = wrapper.findComponent(InlineCode)
      expect(inlineCode.exists()).toBe(true)
      expect(inlineCode.props('text')).toBe('const x = 10')
    })

    it('should render mixed content', () => {
      const content = [
        { type: 'text', text: 'This is ' },
        { type: 'bold', text: 'bold' },
        { type: 'text', text: ' and ' },
        { type: 'italic', text: 'italic' },
        { type: 'text', text: ' with ' },
        { type: 'code', text: 'code' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.find('strong').exists()).toBe(true)
      expect(wrapper.find('em').exists()).toBe(true)
      expect(wrapper.findComponent(InlineCode).exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('should require content prop', () => {
      const { content } = FormattedText.props
      expect(content.required).toBe(true)
      expect(content.type).toBe(Array)
    })

    it('should have default type of "text"', () => {
      const { type } = FormattedText.props
      expect(type.default).toBe('text')
      expect(type.type).toBe(String)
    })

    it('should have default level of null', () => {
      const { level } = FormattedText.props
      expect(level.default).toBe(null)
      expect(level.type).toBe(Number)
    })
  })

  describe('Element Tag Computed Property', () => {
    it('should render as div by default', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.element.tagName).toBe('DIV')
    })

    it('should render as div when type is text', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'text' }
      })

      expect(wrapper.element.tagName).toBe('DIV')
    })

    it('should render as h1 when type is header and level is 1', () => {
      const content = [{ type: 'text', text: 'Heading 1' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 1 }
      })

      expect(wrapper.element.tagName).toBe('H1')
    })

    it('should render as h2 when type is header and level is 2', () => {
      const content = [{ type: 'text', text: 'Heading 2' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 2 }
      })

      expect(wrapper.element.tagName).toBe('H2')
    })

    it('should render as h3 when type is header and level is 3', () => {
      const content = [{ type: 'text', text: 'Heading 3' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 3 }
      })

      expect(wrapper.element.tagName).toBe('H3')
    })

    it('should render as h4 when type is header and level is 4', () => {
      const content = [{ type: 'text', text: 'Heading 4' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 4 }
      })

      expect(wrapper.element.tagName).toBe('H4')
    })

    it('should render as h5 when type is header and level is 5', () => {
      const content = [{ type: 'text', text: 'Heading 5' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 5 }
      })

      expect(wrapper.element.tagName).toBe('H5')
    })

    it('should render as h6 when type is header and level is 6', () => {
      const content = [{ type: 'text', text: 'Heading 6' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 6 }
      })

      expect(wrapper.element.tagName).toBe('H6')
    })

    it('should render as div when type is header but level is null', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: null }
      })

      expect(wrapper.element.tagName).toBe('DIV')
    })

    it('should render as div when type is not header', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'other', level: 1 }
      })

      expect(wrapper.element.tagName).toBe('DIV')
    })
  })

  describe('Element Class Computed Property', () => {
    it('should have message-text class by default', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.classes()).toContain('message-text')
    })

    it('should have message-text class when type is text', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'text' }
      })

      expect(wrapper.classes()).toContain('message-text')
    })

    it('should have markdown-h1 class when type is header and level is 1', () => {
      const content = [{ type: 'text', text: 'Heading' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 1 }
      })

      expect(wrapper.classes()).toContain('markdown-h1')
    })

    it('should have markdown-h2 class when type is header and level is 2', () => {
      const content = [{ type: 'text', text: 'Heading' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 2 }
      })

      expect(wrapper.classes()).toContain('markdown-h2')
    })

    it('should have markdown-h3 class when type is header and level is 3', () => {
      const content = [{ type: 'text', text: 'Heading' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 3 }
      })

      expect(wrapper.classes()).toContain('markdown-h3')
    })

    it('should have markdown-h4 class when type is header and level is 4', () => {
      const content = [{ type: 'text', text: 'Heading' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 4 }
      })

      expect(wrapper.classes()).toContain('markdown-h4')
    })

    it('should have markdown-h5 class when type is header and level is 5', () => {
      const content = [{ type: 'text', text: 'Heading' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 5 }
      })

      expect(wrapper.classes()).toContain('markdown-h5')
    })

    it('should have markdown-h6 class when type is header and level is 6', () => {
      const content = [{ type: 'text', text: 'Heading' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: 6 }
      })

      expect(wrapper.classes()).toContain('markdown-h6')
    })

    it('should have message-text class when type is header but level is null', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'header', level: null }
      })

      expect(wrapper.classes()).toContain('message-text')
    })

    it('should have message-text class when type is not header', () => {
      const content = [{ type: 'text', text: 'Text' }]

      wrapper = mount(FormattedText, {
        props: { content, type: 'other', level: 1 }
      })

      expect(wrapper.classes()).toContain('message-text')
    })
  })

  describe('Edge Cases', () => {
    it('should render empty content array', () => {
      wrapper = mount(FormattedText, {
        props: { content: [] }
      })

      expect(wrapper.element).toBeTruthy()
    })

    it('should handle content with empty text', () => {
      const content = [
        { type: 'text', text: '' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      expect(wrapper.text()).toBe('')
    })

    it('should handle multiple parts of same type', () => {
      const content = [
        { type: 'bold', text: 'First bold' },
        { type: 'bold', text: 'Second bold' }
      ]

      wrapper = mount(FormattedText, {
        props: { content }
      })

      const boldElements = wrapper.findAll('strong')
      expect(boldElements).toHaveLength(2)
    })
  })
})
