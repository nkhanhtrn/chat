import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaygroundMessage from '../PlaygroundMessage.vue'

describe('PlaygroundMessage', () => {
  let wrapper

  const defaultProps = {
    msg: { role: 'user', content: 'Hello' },
    isLastMessage: false,
    isStreaming: false,
    isSearching: false,
    searchQuery: '',
    currentPlanningStep: -1
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the message container', () => {
      wrapper = mount(PlaygroundMessage, {
        props: defaultProps,
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.pg-message').exists()).toBe(true)
    })

    it('should have user class for user messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: { ...defaultProps, msg: { role: 'user', content: 'Hello' } },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.pg-message').classes()).toContain('user')
    })

    it('should have assistant class for assistant messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: { ...defaultProps, msg: { role: 'assistant', content: 'Hi' } },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.pg-message').classes()).toContain('assistant')
    })
  })

  describe('Avatar', () => {
    it('should show U avatar for user messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: { ...defaultProps, msg: { role: 'user', content: 'Hello' } },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.user-avatar').text()).toBe('U')
    })

    it('should show AI avatar for assistant messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: { ...defaultProps, msg: { role: 'assistant', content: 'Hi' } },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.ai-avatar').text()).toBe('AI')
    })
  })

  describe('User Messages', () => {
    it('should display user message content in user-text div', () => {
      wrapper = mount(PlaygroundMessage, {
        props: { ...defaultProps, msg: { role: 'user', content: 'Hello world' } },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.user-text').text()).toBe('Hello world')
    })
  })

  describe('Assistant Messages', () => {
    it('should use MarkdownRenderer for regular assistant messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: { ...defaultProps, msg: { role: 'assistant', content: 'Hello' } },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.findComponent({ name: 'MarkdownRenderer' }).exists()).toBe(true)
    })
  })

  describe('Streaming Cursor', () => {
    it('should show cursor when streaming last assistant message', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Hello' },
          isLastMessage: true,
          isStreaming: true
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(true)
    })

    it('should not show cursor when not streaming', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Hello' },
          isLastMessage: true,
          isStreaming: false
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(false)
    })

    it('should not show cursor for user messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'user', content: 'Hello' },
          isLastMessage: true,
          isStreaming: true
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(false)
    })

    it('should not show cursor for non-last messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Hello' },
          isLastMessage: false,
          isStreaming: true
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(false)
    })
  })

  describe('Attachments', () => {
    it('should display attachments for user messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Hello',
            attachments: [
              { name: 'file.pdf', type: 'file', readerName: 'pdf' },
              { name: 'https://example.com', type: 'url' }
            ]
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      const chips = wrapper.findAll('.attachment-chip')
      expect(chips).toHaveLength(2)
    })

    it('should not display attachments section for assistant messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Hello',
            attachments: [{ name: 'file.pdf', type: 'file' }]
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.attachments').exists()).toBe(false)
    })

    it('should show correct icon for URL attachments', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Hello',
            attachments: [{ name: 'https://example.com', type: 'url' }]
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.att-icon').text()).toContain('🔗')
    })

    it('should show correct icon for PDF attachments', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Hello',
            attachments: [{ name: 'file.pdf', type: 'file', readerName: 'pdf' }]
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.att-icon').text()).toContain('📕')
    })

    it('should show correct icon for generic file attachments', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Hello',
            attachments: [{ name: 'file.txt', type: 'file' }]
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.find('.att-icon').text()).toContain('📄')
    })
  })

  describe('Capability Progress', () => {
    it('should show CapabilityProgress for assistant messages with analysis', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Hello',
            analysis: { taskDescription: 'Test task' }
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.findComponent({ name: 'CapabilityProgress' }).exists()).toBe(true)
    })

    it('should not show CapabilityProgress for user messages', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Hello',
            analysis: { taskDescription: 'Test task' }
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.findComponent({ name: 'CapabilityProgress' }).exists()).toBe(false)
    })

    it('should not show CapabilityProgress for messages without analysis', () => {
      wrapper = mount(PlaygroundMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Hello' }
        },
        global: {
          stubs: {
            MarkdownRenderer: true,
            CodeBlock: true,
            ChartRenderer: true,
            MermaidBlock: true,
            ToolRenderer: true,
            CapabilityProgress: true
          }
        }
      })
      expect(wrapper.findComponent({ name: 'CapabilityProgress' }).exists()).toBe(false)
    })
  })
})
