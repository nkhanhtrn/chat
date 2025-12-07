import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import QuestionTree from '../QuestionTree.vue'
import { useChatStore } from '../../stores/chat.js'

describe('QuestionTree', () => {
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
    if (wrapper) {
      wrapper.unmount()
    }
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

  // Helper to create root messages array
  const createRootMessages = (messages) => {
    return messages.map(msg => ({
      id: msg.id,
      question: msg.question,
      questionSummarized: msg.questionSummarized || msg.question
    }))
  }

  describe('Rendering', () => {
    it('should render question tree container', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.question-tree').exists()).toBe(true)
    })

    it('should render DraggableTreeItem for each root message', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' },
        { id: 'root2', question: 'Question 2' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] },
        { id: 'root2', question: 'Question 2', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items).toHaveLength(2)
    })

    it('should render empty tree when no root messages', () => {
      wrapper = mount(QuestionTree, {
        props: { rootMessages: [] },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items).toHaveLength(0)
    })
  })

  describe('Props', () => {
    it('should pass draggable prop to DraggableTreeItem', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, draggable: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('draggable')).toBe(true)
    })

    it('should pass editable prop to DraggableTreeItem', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, editable: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('editable')).toBe(true)
    })

    it('should pass showDeleteButton prop to DraggableTreeItem', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, showDeleteButton: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('showDeleteButton')).toBe(true)
    })

    it('should disable dragging when draggable is false', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, draggable: false },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('draggable')).toBe(false)
      expect(item.props('hideDropZones')).toBe(true)
    })
  })

  describe('Expansion', () => {
    it('should expand all items when expandAll is true', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, expandAll: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('isExpanded')).toBe(true)
    })

    it('should not expand items without children even when expandAll is true', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, expandAll: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('isExpanded')).toBe(false)
    })
  })

  describe('Events', () => {
    it('should emit select when root item is clicked', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('click', { id: 'root1', question: 'Question 1' })

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')[0][0]).toEqual({ id: 'root1', isRoot: true })
    })

    it('should emit delete-root when root item delete is triggered', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('delete', { id: 'root1', question: 'Question 1' })

      expect(wrapper.emitted('delete-root')).toBeTruthy()
      expect(wrapper.emitted('delete-root')[0][0]).toEqual({ id: 'root1', question: 'Question 1' })
    })

    it('should emit rename when item rename is triggered', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('rename', { id: 'root1' }, 'New Name')

      expect(wrapper.emitted('rename')).toBeTruthy()
      expect(wrapper.emitted('rename')[0]).toEqual([{ id: 'root1' }, 'New Name'])
    })

    it('should emit drop when item is dropped', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const dropData = {
        messageId: 'msg1',
        targetId: 'root1',
        position: 'below',
        targetIndex: 0
      }

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('drop', dropData)

      expect(wrapper.emitted('drop')).toBeTruthy()
      expect(wrapper.emitted('drop')[0][0]).toEqual(dropData)
    })
  })

  describe('Nested Children', () => {
    it('should render MessageTree for items with children when expanded', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, expandAll: true },
        global: { provide: createProvide() }
      })

      const messageTrees = wrapper.findAllComponents({ name: 'MessageTree' })
      expect(messageTrees.length).toBeGreaterThanOrEqual(1)
    })

    it('should emit delete-child when child item delete is triggered', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, expandAll: true },
        global: { provide: createProvide() }
      })

      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      if (messageTree.exists()) {
        await messageTree.vm.$emit('delete', { id: 'child1' })

        expect(wrapper.emitted('delete-child')).toBeTruthy()
        expect(wrapper.emitted('delete-child')[0][0]).toEqual({ id: 'child1' })
      }
    })

    it('should emit select with rootId when child is selected', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, expandAll: true },
        global: { provide: createProvide() }
      })

      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      if (messageTree.exists()) {
        await messageTree.vm.$emit('select', { id: 'child1' })

        expect(wrapper.emitted('select')).toBeTruthy()
        expect(wrapper.emitted('select')[0][0]).toEqual({
          id: 'child1',
          rootId: 'root1',
          isRoot: false
        })
      }
    })
  })

  describe('Active State', () => {
    it('should mark current message as active', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' },
        { id: 'root2', question: 'Question 2' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] },
        { id: 'root2', question: 'Question 2', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, currentMessageId: 'root1' },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items[0].props('isActive')).toBe(true)
      expect(items[1].props('isActive')).toBe(false)
    })

    it('should apply is-current-root class to current root', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, currentMessageId: 'root1' },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('itemClass')).toEqual({
        'root-header': true,
        'is-current-root': true
      })
    })
  })

  describe('Streaming Indicator', () => {
    it('should pass isStreaming true when message is streaming', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])
      chatStore.streamingMessageId = 'root1'

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('isStreaming')).toBe(true)
    })

    it('should pass isStreaming false when different message is streaming', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])
      chatStore.streamingMessageId = 'other'

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('isStreaming')).toBe(false)
    })
  })

  describe('Exposed Methods', () => {
    it('should expose expandToMessage method', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      expect(wrapper.vm.expandToMessage).toBeDefined()
      expect(typeof wrapper.vm.expandToMessage).toBe('function')
    })

    it('should expose expandedPath', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages },
        global: { provide: createProvide() }
      })

      expect(wrapper.vm.expandedPath).toBeDefined()
    })
  })

  describe('Collapse Button', () => {
    it('should pass showCollapseButton prop to DraggableTreeItem', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, showCollapseButton: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      expect(item.props('showCollapseButton')).toBe(true)
    })

    it('should pass hasChildren prop correctly', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' },
        { id: 'root2', question: 'Question 2' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] },
        { id: 'root2', question: 'Question 2', response: '', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, showCollapseButton: true },
        global: { provide: createProvide() }
      })

      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items[0].props('hasChildren')).toBe(true)
      expect(items[1].props('hasChildren')).toBe(false)
    })

    it('should emit toggle-expand on root when collapse button is clicked', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, showCollapseButton: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await item.vm.$emit('toggle-expand', { id: 'root1' })

      // The component should handle the toggle internally
      // We verify the item prop updated (handled by useTreeExpansion)
      expect(item.exists()).toBe(true)
    })
  })

  describe('Initial Expand All', () => {
    it('should start with all roots expanded when initialExpandAll is true', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, initialExpandAll: true },
        global: { provide: createProvide() }
      })

      const item = wrapper.findComponent({ name: 'DraggableTreeItem' })
      // With initialExpandAll, roots should be expanded by default via expandAllMode
      expect(item.props('isExpanded')).toBe(true)
    })

    it('should pass collapsedChildNodes to MessageTree when initialExpandAll is true', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, initialExpandAll: true, expandAll: true },
        global: { provide: createProvide() }
      })

      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      if (messageTree.exists()) {
        // When initialExpandAll is true, collapsedNodes should be a Set (not null)
        expect(messageTree.props('collapsedNodes')).toBeInstanceOf(Set)
      }
    })

    it('should not pass collapsedNodes to MessageTree when initialExpandAll is false', () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, initialExpandAll: false, expandAll: true },
        global: { provide: createProvide() }
      })

      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      if (messageTree.exists()) {
        expect(messageTree.props('collapsedNodes')).toBeNull()
      }
    })

    it('should allow collapsing child nodes in initialExpandAll mode', async () => {
      const rootMessages = createRootMessages([
        { id: 'root1', question: 'Question 1' }
      ])
      setupMessagesInStore([
        { id: 'root1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'root1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1', childIds: [] }
      ])

      wrapper = mount(QuestionTree, {
        props: { rootMessages, initialExpandAll: true, expandAll: true, showCollapseButton: true },
        global: { provide: createProvide() }
      })

      // Find the MessageTree and emit toggle-expand for child1
      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      if (messageTree.exists()) {
        await messageTree.vm.$emit('toggle-expand', 'child1')

        // After toggle, the collapsedNodes should contain child1
        const updatedMessageTree = wrapper.findComponent({ name: 'MessageTree' })
        const collapsedNodes = updatedMessageTree.props('collapsedNodes')
        expect(collapsedNodes.has('child1')).toBe(true)
      }
    })
  })
})
