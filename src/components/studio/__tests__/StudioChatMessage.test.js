import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StudioChatMessage from '../StudioChatMessage.vue'

// Mock child components
vi.mock('../../MarkdownRenderer.vue', () => ({
  default: {
    name: 'MarkdownRenderer',
    props: ['content'],
    template: '<div class="mock-markdown">{{ content }}</div>'
  }
}))

vi.mock('../../markdown/CodeBlock.vue', () => ({
  default: {
    name: 'CodeBlock',
    props: ['language', 'code'],
    template: '<pre class="mock-codeblock">{{ code }}</pre>'
  }
}))

vi.mock('../../ChartRenderer.vue', () => ({
  default: {
    name: 'ChartRenderer',
    props: ['option', 'height'],
    template: '<div class="mock-chart"></div>'
  }
}))

vi.mock('../../markdown/MermaidBlock.vue', () => ({
  default: {
    name: 'MermaidBlock',
    props: ['code'],
    template: '<div class="mock-mermaid"></div>'
  }
}))

vi.mock('../../ToolRenderer.vue', () => ({
  default: {
    name: 'ToolRenderer',
    props: ['tool'],
    template: '<div class="mock-tool"></div>'
  }
}))

vi.mock('../../CapabilityProgress.vue', () => ({
  default: {
    name: 'CapabilityProgress',
    props: ['capability', 'taskDescription', 'status', 'searchQuery', 'webSources', 'planSteps', 'generatedCode', 'attempts', 'executionStatus', 'vizType', 'rawOutput'],
    template: '<div class="mock-capability-progress"></div>'
  }
}))

// Mock utility functions
vi.mock('../../../utils/chart.js', () => ({
  parseChartOption: vi.fn((content) => ({ parsed: content }))
}))

vi.mock('../../../utils/messageAnalysis.js', () => ({
  getCapabilityType: vi.fn(() => 'text'),
  getMessageStatus: vi.fn(() => 'complete'),
  getWebSources: vi.fn(() => []),
  getPlanSteps: vi.fn(() => []),
  getRawOutput: vi.fn(() => null)
}))


describe('StudioChatMessage', () => {
  let wrapper

  const defaultProps = {
    msg: {
      role: 'user',
      content: 'Hello world'
    },
    isLastMessage: false,
    isStreaming: false,
    isSearching: false,
    searchQuery: '',
    currentPlanningStep: -1
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render message container', () => {
      wrapper = mount(StudioChatMessage, { props: defaultProps })
      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should have user class for user messages', () => {
      wrapper = mount(StudioChatMessage, { props: defaultProps })
      expect(wrapper.find('.message').classes()).toContain('user')
    })

    it('should have assistant class for assistant messages', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Hello' }
        }
      })
      expect(wrapper.find('.message').classes()).toContain('assistant')
    })

    it('should render message content container', () => {
      wrapper = mount(StudioChatMessage, { props: defaultProps })
      expect(wrapper.find('.message-content').exists()).toBe(true)
    })
  })

  describe('Message Role Display', () => {
    it('should show "You" for user messages', () => {
      wrapper = mount(StudioChatMessage, { props: defaultProps })
      expect(wrapper.find('.message-role').text()).toBe('You')
    })

    it('should show "AI" for assistant messages', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Response' }
        }
      })
      expect(wrapper.find('.message-role').text()).toBe('AI')
    })
  })

  describe('User Message Content', () => {
    it('should display user message as plain text', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'user', content: 'User question' }
        }
      })
      expect(wrapper.find('.message-content').text()).toBe('User question')
    })
  })

  describe('Assistant Message Content', () => {
    it('should render MarkdownRenderer for assistant text response', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'AI response' }
        }
      })
      expect(wrapper.find('.mock-markdown').exists()).toBe(true)
    })
  })

  describe('Canvas Output Indicator', () => {
    it('should show canvas indicator for chart visualization', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: '',
            visualization: { type: 'chart', content: '{}' }
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(true)
    })

    it('should show canvas indicator for mermaid visualization', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: '',
            visualization: { type: 'mermaid', content: 'graph TD' }
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(true)
    })

    it('should show canvas indicator for svg visualization', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: '',
            visualization: { type: 'svg', content: '<svg></svg>' }
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(true)
    })

    it('should show canvas indicator when tool is present', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: '',
            tool: { type: 'calculator', spec: {} }
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(true)
    })

    it('should show canvas indicator for successful execution', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'result: 42',
            execution: { success: true, result: 42 }
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(true)
    })

    it('should not show canvas indicator for failed execution', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Error occurred',
            execution: { success: false, error: 'Error' }
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(false)
    })

    it('should not show canvas indicator for plain assistant messages', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Just a text response'
          }
        }
      })
      expect(wrapper.find('.canvas-output-indicator').exists()).toBe(false)
    })
  })

  describe('CapabilityProgress', () => {
    it('should show CapabilityProgress for assistant messages with analysis', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Response',
            analysis: { capability: 'text' }
          }
        }
      })
      expect(wrapper.find('.mock-capability-progress').exists()).toBe(true)
    })

    it('should not show CapabilityProgress for user messages', () => {
      wrapper = mount(StudioChatMessage, { props: defaultProps })
      expect(wrapper.find('.mock-capability-progress').exists()).toBe(false)
    })

    it('should not show CapabilityProgress for assistant without analysis', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Simple response' }
        }
      })
      expect(wrapper.find('.mock-capability-progress').exists()).toBe(false)
    })
  })

  describe('Streaming Cursor', () => {
    it('should show cursor when streaming last assistant message', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Generating...' },
          isLastMessage: true,
          isStreaming: true
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(true)
    })

    it('should not show cursor when not streaming', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Done' },
          isLastMessage: true,
          isStreaming: false
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(false)
    })

    it('should not show cursor for non-last messages', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'assistant', content: 'Old message' },
          isLastMessage: false,
          isStreaming: true
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(false)
    })

    it('should not show cursor for user messages', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: { role: 'user', content: 'User text' },
          isLastMessage: true,
          isStreaming: true
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(false)
    })
  })

  describe('Attachments', () => {
    it('should show attachments indicator for user messages with attachments', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Check this',
            attachments: [{ name: 'file.txt', type: 'file' }]
          }
        }
      })
      expect(wrapper.find('.attachments-indicator').exists()).toBe(true)
    })

    it('should not show attachments indicator without attachments', () => {
      wrapper = mount(StudioChatMessage, { props: defaultProps })
      expect(wrapper.find('.attachments-indicator').exists()).toBe(false)
    })

    it('should not show attachments indicator for assistant messages', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Response',
            attachments: [{ name: 'file.txt', type: 'file' }]
          }
        }
      })
      expect(wrapper.find('.attachments-indicator').exists()).toBe(false)
    })

    it('should render each attachment as a badge', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Files here',
            attachments: [
              { name: 'doc.txt', type: 'file' },
              { name: 'image.pdf', type: 'file', readerName: 'pdf' }
            ]
          }
        }
      })
      expect(wrapper.findAll('.attachment-badge')).toHaveLength(2)
    })

    it('should show link icon for URL attachments', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Link',
            attachments: [{ name: 'example.com', type: 'url' }]
          }
        }
      })
      expect(wrapper.find('.attachment-icon').text()).toContain('🔗')
    })

    it('should show PDF icon for PDF attachments', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'PDF',
            attachments: [{ name: 'doc.pdf', type: 'file', readerName: 'pdf' }]
          }
        }
      })
      expect(wrapper.find('.attachment-icon').text()).toContain('📕')
    })

    it('should show document icon for regular files', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'File',
            attachments: [{ name: 'doc.txt', type: 'file' }]
          }
        }
      })
      expect(wrapper.find('.attachment-icon').text()).toContain('📄')
    })

    it('should display attachment name', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'Attached',
            attachments: [{ name: 'important.txt', type: 'file' }]
          }
        }
      })
      expect(wrapper.find('.attachment-name').text()).toBe('important.txt')
    })
  })

  describe('Computed Properties', () => {
    it('should compute capability type based on message analysis', () => {
      // Testing that component correctly uses getCapabilityType
      // by checking the rendered output when analysis indicates websearch
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Search results',
            analysis: { capability: 'websearch', needsWebSearch: true }
          }
        }
      })
      // CapabilityProgress should be rendered for messages with analysis
      expect(wrapper.find('.mock-capability-progress').exists()).toBe(true)
    })

    it('should handle message with web search results', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Here are the results',
            analysis: { needsWebSearch: true },
            webSearchResults: [{ url: 'https://test.com', title: 'Test' }]
          },
          isSearching: false
        }
      })
      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should handle message with planning data', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: 'Planning...',
            analysis: { capability: 'planning' },
            planning: { plan: { steps: [] } }
          },
          currentPlanningStep: 0
        }
      })
      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should handle message with execution result', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'assistant',
            content: '42',
            execution: { success: true, result: 42 }
          }
        }
      })
      expect(wrapper.find('.message').exists()).toBe(true)
    })
  })

  describe('Empty Attachments Array', () => {
    it('should not show attachments indicator for empty array', () => {
      wrapper = mount(StudioChatMessage, {
        props: {
          ...defaultProps,
          msg: {
            role: 'user',
            content: 'No attachments',
            attachments: []
          }
        }
      })
      expect(wrapper.find('.attachments-indicator').exists()).toBe(false)
    })
  })
})
