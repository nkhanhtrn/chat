import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageList from '../MessageList.vue'
import StudioChatMessage from '../StudioChatMessage.vue'

// Mock StudioChatMessage to simplify testing
vi.mock('../StudioChatMessage.vue', () => ({
  default: {
    name: 'StudioChatMessage',
    props: ['msg', 'isLastMessage', 'isStreaming', 'isSearching', 'searchQuery', 'currentPlanningStep'],
    template: '<div class="mock-chat-message" :data-role="msg.role">{{ msg.content }}</div>'
  }
}))

describe('MessageList', () => {
  let wrapper

  const defaultProps = {
    messages: [],
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
    it('should render the messages container', () => {
      wrapper = mount(MessageList, { props: defaultProps })
      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no messages', () => {
      wrapper = mount(MessageList, { props: defaultProps })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('should display start conversation text', () => {
      wrapper = mount(MessageList, { props: defaultProps })
      expect(wrapper.find('.empty-state').text()).toContain('Start a conversation')
    })

    it('should display hint about messages not being saved', () => {
      wrapper = mount(MessageList, { props: defaultProps })
      expect(wrapper.find('.hint').text()).toContain('Messages are not saved')
    })

    it('should hide empty state when messages exist', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Hello' }]
        }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  describe('Message Rendering', () => {
    it('should render StudioChatMessage for each message', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' }
          ]
        }
      })
      expect(wrapper.findAll('.mock-chat-message')).toHaveLength(2)
    })

    it('should pass correct msg prop to each message', () => {
      const messages = [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' }
      ]
      wrapper = mount(MessageList, {
        props: { ...defaultProps, messages }
      })
      const chatMessages = wrapper.findAll('.mock-chat-message')
      expect(chatMessages[0].text()).toBe('Question')
      expect(chatMessages[1].text()).toBe('Answer')
    })

    it('should set isLastMessage correctly', () => {
      const messages = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' }
      ]
      wrapper = mount(MessageList, {
        props: { ...defaultProps, messages }
      })
      // The last message component should have isLastMessage=true
      // Since we're using mocks, we check the component instances
      const components = wrapper.findAllComponents({ name: 'StudioChatMessage' })
      expect(components[0].props('isLastMessage')).toBe(false)
      expect(components[1].props('isLastMessage')).toBe(false)
      expect(components[2].props('isLastMessage')).toBe(true)
    })
  })

  describe('Props Passing', () => {
    it('should pass isStreaming to all messages', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Test' }],
          isStreaming: true
        }
      })
      const component = wrapper.findComponent({ name: 'StudioChatMessage' })
      expect(component.props('isStreaming')).toBe(true)
    })

    it('should pass isSearching to all messages', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Test' }],
          isSearching: true
        }
      })
      const component = wrapper.findComponent({ name: 'StudioChatMessage' })
      expect(component.props('isSearching')).toBe(true)
    })

    it('should pass searchQuery to all messages', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Test' }],
          searchQuery: 'bitcoin price'
        }
      })
      const component = wrapper.findComponent({ name: 'StudioChatMessage' })
      expect(component.props('searchQuery')).toBe('bitcoin price')
    })

    it('should pass currentPlanningStep to all messages', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Test' }],
          currentPlanningStep: 2
        }
      })
      const component = wrapper.findComponent({ name: 'StudioChatMessage' })
      expect(component.props('currentPlanningStep')).toBe(2)
    })
  })

  describe('Exposed Refs', () => {
    it('should expose containerRef', () => {
      wrapper = mount(MessageList, { props: defaultProps })
      expect(wrapper.vm.containerRef).toBeDefined()
    })

    it('should reference the messages container element', () => {
      wrapper = mount(MessageList, { props: defaultProps })
      expect(wrapper.vm.containerRef).toBe(wrapper.find('.messages-container').element)
    })
  })

  describe('Message Order', () => {
    it('should render messages in order', () => {
      const messages = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Second' },
        { role: 'user', content: 'Third' }
      ]
      wrapper = mount(MessageList, {
        props: { ...defaultProps, messages }
      })
      const chatMessages = wrapper.findAll('.mock-chat-message')
      expect(chatMessages[0].text()).toBe('First')
      expect(chatMessages[1].text()).toBe('Second')
      expect(chatMessages[2].text()).toBe('Third')
    })

    it('should handle single message', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Only one' }]
        }
      })
      expect(wrapper.findAll('.mock-chat-message')).toHaveLength(1)
      const component = wrapper.findComponent({ name: 'StudioChatMessage' })
      expect(component.props('isLastMessage')).toBe(true)
    })
  })

  describe('Message Roles', () => {
    it('should pass user role correctly', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'User message' }]
        }
      })
      expect(wrapper.find('.mock-chat-message').attributes('data-role')).toBe('user')
    })

    it('should pass assistant role correctly', () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'assistant', content: 'AI response' }]
        }
      })
      expect(wrapper.find('.mock-chat-message').attributes('data-role')).toBe('assistant')
    })
  })

  describe('Dynamic Updates', () => {
    it('should update when messages prop changes', async () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Initial' }]
        }
      })
      expect(wrapper.findAll('.mock-chat-message')).toHaveLength(1)

      await wrapper.setProps({
        messages: [
          { role: 'user', content: 'Initial' },
          { role: 'assistant', content: 'Response' }
        ]
      })
      expect(wrapper.findAll('.mock-chat-message')).toHaveLength(2)
    })

    it('should show empty state when messages cleared', async () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Hello' }]
        }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(false)

      await wrapper.setProps({ messages: [] })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('should update isLastMessage when new message added', async () => {
      wrapper = mount(MessageList, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'First' }]
        }
      })

      let components = wrapper.findAllComponents({ name: 'StudioChatMessage' })
      expect(components[0].props('isLastMessage')).toBe(true)

      await wrapper.setProps({
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Second' }
        ]
      })

      components = wrapper.findAllComponents({ name: 'StudioChatMessage' })
      expect(components[0].props('isLastMessage')).toBe(false)
      expect(components[1].props('isLastMessage')).toBe(true)
    })
  })

  describe('Large Message Lists', () => {
    it('should handle many messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }))
      wrapper = mount(MessageList, {
        props: { ...defaultProps, messages }
      })
      expect(wrapper.findAll('.mock-chat-message')).toHaveLength(100)
    })

    it('should mark only the last message as isLastMessage in large list', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }))
      wrapper = mount(MessageList, {
        props: { ...defaultProps, messages }
      })
      const components = wrapper.findAllComponents({ name: 'StudioChatMessage' })
      for (let i = 0; i < 49; i++) {
        expect(components[i].props('isLastMessage')).toBe(false)
      }
      expect(components[49].props('isLastMessage')).toBe(true)
    })
  })
})
