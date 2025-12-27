import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaygroundMessages from '../PlaygroundMessages.vue'
import PlaygroundMessage from '../PlaygroundMessage.vue'

describe('PlaygroundMessages', () => {
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
    it('should render the messages area', () => {
      wrapper = mount(PlaygroundMessages, {
        props: defaultProps,
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      expect(wrapper.find('.messages-area').exists()).toBe(true)
    })

    it('should show empty state when no messages', () => {
      wrapper = mount(PlaygroundMessages, {
        props: { ...defaultProps, messages: [] },
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('should display empty state title', () => {
      wrapper = mount(PlaygroundMessages, {
        props: { ...defaultProps, messages: [] },
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      expect(wrapper.find('.empty-title').text()).toBe('Start a conversation')
    })

    it('should display empty state hint', () => {
      wrapper = mount(PlaygroundMessages, {
        props: { ...defaultProps, messages: [] },
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      expect(wrapper.find('.empty-hint').text()).toContain('ephemeral')
    })

    it('should hide empty state when there are messages', () => {
      wrapper = mount(PlaygroundMessages, {
        props: {
          ...defaultProps,
          messages: [{ role: 'user', content: 'Hello' }]
        },
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  describe('Message Rendering', () => {
    it('should render PlaygroundMessage for each message', () => {
      wrapper = mount(PlaygroundMessages, {
        props: {
          ...defaultProps,
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' }
          ]
        },
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      const messages = wrapper.findAllComponents({ name: 'PlaygroundMessage' })
      expect(messages).toHaveLength(2)
    })

    it('should pass correct props to PlaygroundMessage', () => {
      const testMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ]
      wrapper = mount(PlaygroundMessages, {
        props: {
          ...defaultProps,
          messages: testMessages,
          isStreaming: true,
          isSearching: true,
          searchQuery: 'test query',
          currentPlanningStep: 2
        },
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      const messageComponents = wrapper.findAllComponents({ name: 'PlaygroundMessage' })

      // First message
      expect(messageComponents[0].props('msg')).toEqual(testMessages[0])
      expect(messageComponents[0].props('isLastMessage')).toBe(false)
      expect(messageComponents[0].props('isStreaming')).toBe(true)
      expect(messageComponents[0].props('isSearching')).toBe(true)
      expect(messageComponents[0].props('searchQuery')).toBe('test query')
      expect(messageComponents[0].props('currentPlanningStep')).toBe(2)

      // Last message
      expect(messageComponents[1].props('isLastMessage')).toBe(true)
    })
  })

  describe('Container Ref', () => {
    it('should expose containerRef', () => {
      wrapper = mount(PlaygroundMessages, {
        props: defaultProps,
        global: {
          stubs: {
            PlaygroundMessage: true
          }
        }
      })
      expect(wrapper.vm.containerRef).toBeDefined()
    })
  })
})
