import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import ChatMessage from '../ChatMessage.vue'
import Message from '../../stores/Message.js'
import { useChatStore } from '../../stores/chat.js'

describe('ChatMessage - Navigation Buttons', () => {
  let wrapper
  let pinia
  let chatStore

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    pinia = createPinia()
    chatStore = useChatStore(pinia)
  })

  describe('switchToParent function', () => {

    it('should do nothing when already at root (no parent)', async () => {
      const parent = new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      })

      chatStore.addRootMessage(parent)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: true,
            ContextMenu: true,
            MessageNavigation: true
          }
        }
      })

      await nextTick()
      const originalMessageId = chatStore.currentMessageId

      // Call navigateToParent via store
      chatStore.navigateToParent(parent.id)
      await nextTick()

      // Should still be at the same message since it has no parent
      expect(chatStore.currentMessageId).toBe(originalMessageId)
    })

  })

  describe('switchToLastChild function', () => {
    it('should do nothing when switchToLastVisitedChild is called and message has no lastVisitedChild', async () => {
      const parent = new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        childIds: []
      })
      // Explicitly ensure lastVisitedChild is undefined
      parent.lastVisitedChild = undefined

      chatStore.addRootMessage(parent)

      wrapper = mount(ChatMessage, {
        props: { message: parent },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: true,
            ContextMenu: true,
            MessageNavigation: true
          }
        }
      })

      await nextTick()
      const originalMessageId = chatStore.currentMessageId

      // Call navigateToLastVisitedChild via store
      chatStore.navigateToLastVisitedChild(parent.id)
      await nextTick()

      expect(chatStore.currentMessageId).toBe(originalMessageId)
    })

  })

  describe('Navigation Button Rendering', () => {
    it('should render navigation component when viewing a message with response', async () => {
      const message = new Message({
        id: '1',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      })

      chatStore.addRootMessage(message)

      wrapper = mount(ChatMessage, {
        props: { message },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: true,
            ContextMenu: true
          }
        }
      })

      await nextTick()
      expect(wrapper.findComponent({ name: 'MessageNavigation' }).exists()).toBe(true)
    })

    it('should pass currentMessage to MessageNavigation component', async () => {
      const root = new Message({
        id: 'root',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      })

      chatStore.addRootMessage(root)

      wrapper = mount(ChatMessage, {
        props: { message: root },
        global: {
          plugins: [pinia],
          stubs: {
            MarkdownRenderer: true,
            ContextMenu: true
          }
        }
      })

      await nextTick()
      const navComponent = wrapper.findComponent({ name: 'MessageNavigation' })
      expect(navComponent.exists()).toBe(true)
      expect(navComponent.props('currentMessage')).toBeTruthy()
    })


    it('should render MessageNavigation component when message has response', async () => {
      const parent = new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      })

      chatStore.addRootMessage(parent)

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
      const navComponent = wrapper.findComponent({ name: 'MessageNavigation' })
      expect(navComponent.exists()).toBe(true)
    })
  })
})
