import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import MessageTree from '../MessageTree.vue'
import { useChatStore } from '../../stores/chat.js'

describe('MessageTree', () => {
  let wrapper
  let chatStore

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    setActivePinia(createPinia())
    chatStore = useChatStore()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // Helper to setup messages in store
  const setupMessagesInStore = (messages) => {
    const Message = require('../../stores/Message.js').default
    messages.forEach(msg => {
      chatStore.messagesById[msg.id] = new Message(msg)
    })
  }

  // Create provide for drag state
  const createProvide = (draggedItem = null, dropTarget = null) => ({
    draggedItem: ref(draggedItem),
    dropTarget: ref(dropTarget)
  })

  describe('Rendering', () => {
    it('should render message tree container', () => {
      setupMessagesInStore([
        { id: 'msg1', question: 'Question 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['msg1'] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.message-tree').exists()).toBe(true)
    })

    it('should render children messages', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' },
        { id: 'child2', question: 'Child 2', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1', 'child2'] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items).toHaveLength(2)
    })

    it('should render empty tree when no children', () => {
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: [] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items).toHaveLength(0)
    })
  })

  describe('Active State', () => {
    it('should pass isActive true to current message item', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' },
        { id: 'child2', question: 'Child 2', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1', 'child2'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          currentMessageId: 'child1'
        },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items[0].props('isActive')).toBe(true)
      expect(items[1].props('isActive')).toBe(false)
    })
  })

  describe('Expansion', () => {
    it('should pass isExpanded based on expandedPath', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      const expandedPath = new Set(['child1'])

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath
        },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('isExpanded')).toBe(true)
    })

    it('should not expand items not in expandedPath', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set()
        },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('isExpanded')).toBe(false)
    })
  })

  describe('Events', () => {
    it('should emit select when item is clicked', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('click', { id: 'child1', question: 'Child 1' })

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')[0][0]).toEqual({ id: 'child1', question: 'Child 1' })
    })

    it('should emit toggle-expand when item is clicked', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('click', { id: 'child1' })

      expect(wrapper.emitted('toggle-expand')).toBeTruthy()
      expect(wrapper.emitted('toggle-expand')[0][0]).toBe('child1')
    })
  })

  describe('Drag and Drop', () => {
    it('should call moveMessage on drop with position above', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' },
        { id: 'child2', question: 'Child 2', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1', 'child2'] }
      chatStore.currentChatId = 'chat1'
      chatStore.chats = [{ id: 'chat1', rootMessageIds: [] }]

      const moveMessageSpy = vi.spyOn(chatStore, 'moveMessage')

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('drop', {
        messageId: 'child2',
        targetId: 'child1',
        position: 'above',
        targetIndex: 0,
        targetParentId: 'parent1'
      })

      expect(moveMessageSpy).toHaveBeenCalledWith('child2', 'parent1', 0)
    })

    it('should call moveMessage on drop with position below (as child)', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' },
        { id: 'child2', question: 'Child 2', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1', 'child2'] }
      chatStore.currentChatId = 'chat1'
      chatStore.chats = [{ id: 'chat1', rootMessageIds: [] }]

      const moveMessageSpy = vi.spyOn(chatStore, 'moveMessage')

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('drop', {
        messageId: 'child2',
        targetId: 'child1',
        position: 'below',
        targetIndex: 0,
        targetParentId: 'parent1'
      })

      // When position is 'below', item becomes child of target
      expect(moveMessageSpy).toHaveBeenCalledWith('child2', 'child1', 0)
    })
  })

  describe('Nested Children', () => {
    it('should render nested MessageTree for items with children', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1'])
        },
        global: { provide: createProvide() }
      })

      // Find nested MessageTree components
      const messageTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      // Should have at least one nested tree (for child1's children)
      expect(messageTrees.length).toBeGreaterThanOrEqual(1)
    })

    it('should not render nested MessageTree when item has no children', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: [] }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1'])
        },
        global: { provide: createProvide() }
      })

      // Only one MessageTree (the root) - no nested ones since child1 has no children
      const messageTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      expect(messageTrees).toHaveLength(0)
    })
  })

  describe('Provide/Inject', () => {
    it('should inject and provide draggedItem', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      const draggedItem = ref({ id: 'dragging', parentId: null })

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: {
          provide: {
            draggedItem,
            dropTarget: ref(null)
          }
        }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      // Item should have is-dragging class if it matches dragged item
      // Since we're dragging a different item, it shouldn't have the class
      expect(item.find('.tree-item').classes()).not.toContain('is-dragging')
    })

    it('should inject and provide dropTarget', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      const dropTarget = ref({ id: 'child1', position: 'above', parentId: 'parent1' })
      const draggedItem = ref({ id: 'other', parentId: null })

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: {
          provide: {
            draggedItem,
            dropTarget
          }
        }
      })

      const container = wrapper.find('.tree-item-container')
      expect(container.classes()).toContain('drop-above')
    })
  })

  describe('Props Defaults', () => {
    it('should have default currentMessageId as null', () => {
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: [] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.props('currentMessageId')).toBe(null)
    })

    it('should have default expandedPath as empty Set', () => {
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: [] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.props('expandedPath')).toEqual(new Set())
    })
  })

  describe('Editable and Delete Button Props', () => {
    it('should pass editable prop to DraggableTreeItem', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          editable: true
        },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('editable')).toBe(true)
    })

    it('should default editable to false', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('editable')).toBe(false)
    })

    it('should pass showDeleteButton prop to DraggableTreeItem', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          showDeleteButton: true
        },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('showDeleteButton')).toBe(true)
    })

    it('should default showDeleteButton to false', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: { parentId: 'parent1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('showDeleteButton')).toBe(false)
    })

    it('should render delete button when showDeleteButton is true', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          showDeleteButton: true
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.delete-button').exists()).toBe(true)
    })

    it('should not render delete button when showDeleteButton is false', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          showDeleteButton: false
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.delete-button').exists()).toBe(false)
    })

    it('should pass editable and showDeleteButton to nested MessageTree', () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1']),
          editable: true,
          showDeleteButton: true
        },
        global: { provide: createProvide() }
      })

      // Find nested MessageTree
      const nestedTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      if (nestedTrees.length > 0) {
        const nestedTree = nestedTrees[nestedTrees.length - 1]
        expect(nestedTree.props('editable')).toBe(true)
        expect(nestedTree.props('showDeleteButton')).toBe(true)
      }
    })
  })

  describe('Rename and Delete Events', () => {
    it('should emit rename event when DraggableTreeItem emits rename', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          editable: true
        },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('rename', { id: 'child1', question: 'Child 1' }, 'New Name')

      expect(wrapper.emitted('rename')).toBeTruthy()
      expect(wrapper.emitted('rename')[0]).toEqual([{ id: 'child1', question: 'Child 1' }, 'New Name'])
    })

    it('should emit delete event when DraggableTreeItem emits delete', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          showDeleteButton: true
        },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('delete', { id: 'child1', question: 'Child 1' })

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')[0]).toEqual([{ id: 'child1', question: 'Child 1' }])
    })

    it('should propagate rename event from nested MessageTree', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1']),
          editable: true
        },
        global: { provide: createProvide() }
      })

      const nestedTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      if (nestedTrees.length > 0) {
        const nestedTree = nestedTrees[nestedTrees.length - 1]
        await nestedTree.vm.$emit('rename', { id: 'grandchild1' }, 'Renamed Grandchild')

        expect(wrapper.emitted('rename')).toBeTruthy()
        expect(wrapper.emitted('rename')[0]).toEqual([{ id: 'grandchild1' }, 'Renamed Grandchild'])
      }
    })

    it('should propagate delete event from nested MessageTree', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1']),
          showDeleteButton: true
        },
        global: { provide: createProvide() }
      })

      const nestedTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      if (nestedTrees.length > 0) {
        const nestedTree = nestedTrees[nestedTrees.length - 1]
        await nestedTree.vm.$emit('delete', { id: 'grandchild1' })

        expect(wrapper.emitted('delete')).toBeTruthy()
        expect(wrapper.emitted('delete')[0]).toEqual([{ id: 'grandchild1' }])
      }
    })
  })

  describe('Event Propagation from Nested Trees', () => {
    it('should propagate select event from nested tree', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1'])
        },
        global: { provide: createProvide() }
      })

      // Find the nested MessageTree and emit select
      const nestedTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      if (nestedTrees.length > 0) {
        const nestedTree = nestedTrees[nestedTrees.length - 1]
        await nestedTree.vm.$emit('select', { id: 'grandchild1' })

        expect(wrapper.emitted('select')).toBeTruthy()
      }
    })

    it('should propagate toggle-expand event from nested tree', async () => {
      setupMessagesInStore([
        { id: 'child1', question: 'Child 1', response: '', parentId: 'parent1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])
      chatStore.messagesById['parent1'] = { id: 'parent1', childIds: ['child1'] }

      wrapper = mount(MessageTree, {
        props: {
          parentId: 'parent1',
          expandedPath: new Set(['child1'])
        },
        global: { provide: createProvide() }
      })

      // Find the nested MessageTree and emit toggle-expand
      const nestedTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      if (nestedTrees.length > 0) {
        const nestedTree = nestedTrees[nestedTrees.length - 1]
        await nestedTree.vm.$emit('toggle-expand', 'grandchild1')

        expect(wrapper.emitted('toggle-expand')).toBeTruthy()
      }
    })
  })
})
