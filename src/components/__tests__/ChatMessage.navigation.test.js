import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { reactive, nextTick } from 'vue'
import ChatMessage from '../ChatMessage.vue'
import Message from '../../stores/Message.js'

// Helper to access state from setup script
function getState(wrapper) {
  return wrapper.vm.$.setupState.state
}

describe('ChatMessage - Navigation Buttons', () => {
  let wrapper
  let pinia

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    pinia = createPinia()
  })

  describe('switchToParent function', () => {

    it('should do nothing when already at root (no parent)', async () => {
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
            MarkdownRenderer: true,
            ContextMenu: true
          }
        }
      })

      const state = getState(wrapper)
      const originalMessage = state.currentMessage

      wrapper.vm.switchToParent()
      await nextTick()

      // Should still be at the same message
      expect(state.currentMessage).toBe(originalMessage)
    })

  })

  describe('switchToRoot function', () => {

    it('should do nothing when already at root', async () => {
      const root = reactive(new Message({
        id: 'root',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

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

      const state = getState(wrapper)
      const originalMessage = state.currentMessage

      wrapper.vm.switchToRoot()
      await nextTick()

      expect(state.currentMessage).toBe(originalMessage)
    })

  })

  describe('switchToLastChild function', () => {

    it('should do nothing when message has no children', async () => {
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
            MarkdownRenderer: true,
            ContextMenu: true
          }
        }
      })

      const state = getState(wrapper)
      const originalMessage = state.currentMessage

      wrapper.vm.switchToLastChild()
      await nextTick()

      expect(state.currentMessage).toBe(originalMessage)
    })

  })

  describe('Navigation Button Rendering', () => {
    it('should render navigation buttons when viewing a message with response', async () => {
      const message = reactive(new Message({
        id: '1',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

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
      expect(wrapper.find('.nav-buttons').exists()).toBe(true)
      expect(wrapper.findAll('.nav-btn').length).toBe(3) // parent, root, child buttons
    })

    it('should disable parent button when at root level', async () => {
      const root = reactive(new Message({
        id: 'root',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

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
      const buttons = wrapper.findAll('.nav-btn')
      const parentButton = buttons[0] // First button is parent button
      expect(parentButton.attributes('disabled')).toBeDefined()
    })


    it('should disable child button when message has no children', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

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
      const buttons = wrapper.findAll('.nav-btn')
      const childButton = buttons[2] // Third button is child button
      expect(childButton.attributes('disabled')).toBeDefined()
    })


    it('should render home button with SVG icon', async () => {
      const message = reactive(new Message({
        id: '1',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

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
      const homeButton = wrapper.find('.home-btn')
      expect(homeButton.exists()).toBe(true)
      expect(homeButton.find('svg').exists()).toBe(true)
    })
  })
})
