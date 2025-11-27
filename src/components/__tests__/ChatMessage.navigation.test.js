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
    it('should navigate from child to parent message', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
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

      const state = getState(wrapper)

      // Navigate to child first
      state.currentMessage = child
      state.currentMessageResponse = child.response
      await nextTick()

      // Now navigate back to parent
      wrapper.vm.switchToParent()
      await nextTick()

      expect(state.currentMessage).toBe(parent)
      expect(state.currentMessageResponse).toBe(parent.response)
    })

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

    it('should navigate through multiple levels', async () => {
      const root = reactive(new Message({
        id: 'root',
        question: 'What is programming?',
        response: 'Programming is writing code',
        children: []
      }))

      const child = reactive(Message.createChildMessage(root, 'About code'))
      child.response = 'Code is instructions'
      root.children.push(child)

      const grandchild = reactive(Message.createChildMessage(child, 'About instructions'))
      grandchild.response = 'Instructions tell computers what to do'
      child.children.push(grandchild)

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

      // Navigate to grandchild
      state.currentMessage = grandchild
      state.currentMessageResponse = grandchild.response
      await nextTick()

      // Navigate to child
      wrapper.vm.switchToParent()
      await nextTick()
      expect(state.currentMessage).toBe(child)

      // Navigate to root
      wrapper.vm.switchToParent()
      await nextTick()
      expect(state.currentMessage).toBe(root)
    })
  })

  describe('switchToRoot function', () => {
    it('should navigate directly to root from any level', async () => {
      const root = reactive(new Message({
        id: 'root',
        question: 'What is programming?',
        response: 'Programming is writing code',
        children: []
      }))

      const child = reactive(Message.createChildMessage(root, 'About code'))
      child.response = 'Code is instructions'
      root.children.push(child)

      const grandchild = reactive(Message.createChildMessage(child, 'About instructions'))
      grandchild.response = 'Instructions tell computers what to do'
      child.children.push(grandchild)

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

      // Start at grandchild
      state.currentMessage = grandchild
      state.currentMessageResponse = grandchild.response
      await nextTick()

      // Navigate directly to root
      wrapper.vm.switchToRoot()
      await nextTick()

      expect(state.currentMessage).toBe(root)
      expect(state.currentMessageResponse).toBe(root.response)
    })

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

    it('should navigate to root from child level', async () => {
      const root = reactive(new Message({
        id: 'root',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(root, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
      root.children.push(child)

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

      // Start at child
      state.currentMessage = child
      state.currentMessageResponse = child.response
      await nextTick()

      // Navigate to root
      wrapper.vm.switchToRoot()
      await nextTick()

      expect(state.currentMessage).toBe(root)
      expect(state.currentMessageResponse).toBe(root.response)
    })
  })

  describe('switchToLastChild function', () => {
    it('should navigate to last accessed child', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child1 = reactive(Message.createChildMessage(parent, 'About JavaScript'))
      child1.response = 'JavaScript is a language'
      parent.children.push(child1)

      const child2 = reactive(Message.createChildMessage(parent, 'About frameworks'))
      child2.response = 'Frameworks provide structure'
      parent.children.push(child2)

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

      // Should navigate to the last child (child2)
      wrapper.vm.switchToLastChild()
      await nextTick()

      expect(state.currentMessage).toBe(child2)
      expect(state.currentMessageResponse).toBe(child2.response)
    })

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

    it('should navigate to the only child when there is one child', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a JavaScript framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
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

      const state = getState(wrapper)

      wrapper.vm.switchToLastChild()
      await nextTick()

      expect(state.currentMessage).toBe(child)
      expect(state.currentMessageResponse).toBe(child.response)
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

    it('should enable parent button when viewing child message', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
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

      const state = getState(wrapper)
      state.currentMessage = child
      state.currentMessageResponse = child.response
      await nextTick()

      const buttons = wrapper.findAll('.nav-btn')
      const parentButton = buttons[0]
      expect(parentButton.attributes('disabled')).toBeUndefined()
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

    it('should enable child button when message has children', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
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
      const buttons = wrapper.findAll('.nav-btn')
      const childButton = buttons[2]
      expect(childButton.attributes('disabled')).toBeUndefined()
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

  describe('Navigation Button Click Events', () => {
    it('should call switchToParent when parent button is clicked', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
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

      const state = getState(wrapper)
      state.currentMessage = child
      state.currentMessageResponse = child.response
      await nextTick()

      const buttons = wrapper.findAll('.nav-btn')
      const parentButton = buttons[0]
      await parentButton.trigger('click')
      await nextTick()

      expect(state.currentMessage).toBe(parent)
    })

    it('should call switchToRoot when home button is clicked', async () => {
      const root = reactive(new Message({
        id: 'root',
        question: 'What is programming?',
        response: 'Programming is writing code',
        children: []
      }))

      const child = reactive(Message.createChildMessage(root, 'About code'))
      child.response = 'Code is instructions'
      root.children.push(child)

      const grandchild = reactive(Message.createChildMessage(child, 'About instructions'))
      grandchild.response = 'Instructions tell computers what to do'
      child.children.push(grandchild)

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
      state.currentMessage = grandchild
      state.currentMessageResponse = grandchild.response
      await nextTick()

      const buttons = wrapper.findAll('.nav-btn')
      const homeButton = buttons[1] // Second button is home button
      await homeButton.trigger('click')
      await nextTick()

      expect(state.currentMessage).toBe(root)
    })

    it('should call switchToLastChild when child button is clicked', async () => {
      const parent = reactive(new Message({
        id: 'parent',
        question: 'What is Vue?',
        response: 'Vue is a framework',
        children: []
      }))

      const child = reactive(Message.createChildMessage(parent, 'Tell me more'))
      child.response = 'Vue was created by Evan You'
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

      const buttons = wrapper.findAll('.nav-btn')
      const childButton = buttons[2]
      await childButton.trigger('click')
      await nextTick()

      const state = getState(wrapper)
      expect(state.currentMessage).toBe(child)
    })
  })
})
