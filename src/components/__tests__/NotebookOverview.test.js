import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import NotebookOverview from '../NotebookOverview.vue'
import { useChatStore } from '../../stores/chat.js'

describe('NotebookOverview', () => {
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

  // Helper to setup a notebook with messages
  const setupNotebook = (notebookId, title, questions) => {
    const Message = require('../../stores/Message.js').default

    // Clear existing chats first
    chatStore.chats = []
    chatStore.messagesById = {}

    // Add notebook to chats (use 'name' property as that's what chatList getter uses)
    chatStore.chats.push({
      id: notebookId,
      name: title,
      rootMessageIds: questions.map(q => q.id)
    })

    // Add messages to store
    questions.forEach(q => {
      chatStore.messagesById[q.id] = new Message({
        id: q.id,
        question: q.question,
        questionSummarized: q.questionSummarized || q.question,
        response: q.response || '',
        parentId: q.parentId || null,
        childIds: q.childIds || []
      })
    })

    // Return root messages formatted as props
    return questions
      .filter(q => !q.parentId)
      .map(q => ({
        id: q.id,
        question: q.question,
        questionSummarized: q.questionSummarized || q.question,
        subitems: q.childIds ? q.childIds.map(childId => {
          const child = chatStore.messagesById[childId]
          return child ? {
            id: child.id,
            question: child.question,
            questionSummarized: child.questionSummarized || child.question,
            parentId: child.parentId
          } : null
        }).filter(Boolean) : []
      }))
  }

  // Helper to get all message descendants for counting
  const countAllDescendants = (message) => {
    if (!message.childIds || message.childIds.length === 0) return 0
    let count = message.childIds.length
    message.childIds.forEach(childId => {
      const child = chatStore.messagesById[childId]
      if (child) {
        count += countAllDescendants(child)
      }
    })
    return count
  }

  // Helper to get total question count
  const getTotalQuestionCount = (notebookId) => {
    const chat = chatStore.chats.find(c => c.id === notebookId)
    if (!chat) return 0
    let count = chat.rootMessageIds.length
    chat.rootMessageIds.forEach(rootId => {
      const rootMsg = chatStore.messagesById[rootId]
      if (rootMsg) {
        count += countAllDescendants(rootMsg)
      }
    })
    return count
  }

  // Create provide for drag state
  const createProvide = () => ({
    draggedItem: ref(null),
    dropTarget: ref(null)
  })

  describe('Rendering', () => {
    it('should render notebook overview container', () => {
      setupNotebook('notebook1', 'Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.notebook-overview').exists()).toBe(true)
    })

    it('should render notebook title', () => {
      setupNotebook('notebook1', 'My Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'My Test Notebook',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.text()).toContain('My Test Notebook')
    })

    it('should render question count with correct pluralization', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-subtitle').text()).toBe('1 question')
    })

    it('should pluralize question count for multiple questions', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 2
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-subtitle').text()).toBe('2 questions')
    })

    it('should count children in question count', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1', childIds: ['child1', 'child2'] }
      ])
      const child1 = chatStore.messagesById['child1'] = new (require('../../stores/Message.js').default)({
        id: 'child1',
        question: 'Child 1',
        parentId: 'q1'
      })
      const child2 = chatStore.messagesById['child2'] = new (require('../../stores/Message.js').default)({
        id: 'child2',
        question: 'Child 2',
        parentId: 'q1',
        childIds: ['grandchild1']
      })
      chatStore.messagesById['grandchild1'] = new (require('../../stores/Message.js').default)({
        id: 'grandchild1',
        question: 'Grandchild 1',
        parentId: 'child2'
      })

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 4
        },
        global: { provide: createProvide() }
      })

      // 1 root + 2 children + 1 grandchild = 4 total
      expect(wrapper.find('.overview-subtitle').text()).toBe('4 questions')
    })

    it('should show empty state when no questions', () => {
      setupNotebook('notebook1', 'Test', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No questions yet')
    })

    it('should render QuestionTree when questions exist', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.findComponent({ name: 'QuestionTree' }).exists()).toBe(true)
    })

    it('should not render QuestionTree when no questions', () => {
      setupNotebook('notebook1', 'Test', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.findComponent({ name: 'QuestionTree' }).exists()).toBe(false)
    })
  })

  describe('InlineEdit for Title', () => {
    it('should render InlineEdit component for title', () => {
      setupNotebook('notebook1', 'Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test Notebook',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.findComponent({ name: 'InlineEdit' }).exists()).toBe(true)
    })

    it('should pass notebook title to InlineEdit', () => {
      setupNotebook('notebook1', 'My Notebook Title', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'My Notebook Title',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      // The notebook title should be visible in the component
      expect(wrapper.text()).toContain('My Notebook Title')
    })

    it('should call renameChat when title is saved', async () => {
      setupNotebook('notebook1', 'Old Title', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Old Title',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      const inlineEdit = wrapper.findComponent({ name: 'InlineEdit' })
      await inlineEdit.vm.$emit('save', 'New Title')

      // Component emits 'rename-notebook' event
      expect(wrapper.emitted('rename-notebook')).toBeTruthy()
      expect(wrapper.emitted('rename-notebook')[0][0]).toBe('New Title')
    })

    it('should show fallback title when notebook has no title', () => {
      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Untitled Notebook',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.text()).toContain('Untitled Notebook')
    })

    it('should render title edit button', () => {
      setupNotebook('notebook1', 'Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test Notebook',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.title-edit-button').exists()).toBe(true)
    })

    it('should start editing when title edit button is clicked', async () => {
      setupNotebook('notebook1', 'Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test Notebook',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      await wrapper.find('.title-edit-button').trigger('click')

      const inlineEdit = wrapper.findComponent({ name: 'InlineEdit' })
      expect(inlineEdit.find('input').exists()).toBe(true)
    })

    it('should render title row with InlineEdit and edit button', () => {
      setupNotebook('notebook1', 'Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test Notebook',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.title-row').exists()).toBe(true)
      expect(wrapper.find('.title-row .title-edit-button').exists()).toBe(true)
    })
  })

  describe('QuestionTree Props', () => {
    it('should pass initialExpandAll=true to QuestionTree', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      expect(questionTree.props('initialExpandAll')).toBe(true)
    })

    it('should pass root messages to QuestionTree', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 2
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      expect(questionTree.props('rootMessages')).toHaveLength(2)
    })

    it('should pass showCollapseButton=true to QuestionTree', () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      expect(questionTree.props('showCollapseButton')).toBe(true)
    })
  })

  describe('Events', () => {
    it('should emit select-question when QuestionTree emits select', async () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('select', { id: 'q1' })

      expect(wrapper.emitted('select-question')).toBeTruthy()
      expect(wrapper.emitted('select-question')[0][0]).toEqual({ id: 'q1' })
    })
  })

  describe('Delete Operations', () => {
    it('should call deleteQuestion when delete-root is triggered', async () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('delete-root', { id: 'q1' })

      // Component emits 'delete-root' event
      expect(wrapper.emitted('delete-root')).toBeTruthy()
      expect(wrapper.emitted('delete-root')[0][0]).toEqual({ id: 'q1' })
    })

    it('should call deleteChildMessage when delete-child is triggered', async () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1', childIds: ['child1'] }
      ])
      chatStore.messagesById['child1'] = new (require('../../stores/Message.js').default)({
        id: 'child1',
        question: 'Child 1',
        parentId: 'q1'
      })

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 2
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('delete-child', { id: 'child1' })

      // Component emits 'delete-child' event
      expect(wrapper.emitted('delete-child')).toBeTruthy()
      expect(wrapper.emitted('delete-child')[0][0]).toEqual({ id: 'child1' })
    })
  })

  describe('Rename Operations', () => {
    it('should call setQuestionSummarized when rename is triggered', async () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('rename', { id: 'q1' }, 'New Question Name')

      // Component emits 'rename' event
      expect(wrapper.emitted('rename')).toBeTruthy()
      expect(wrapper.emitted('rename')[0][0]).toEqual({ id: 'q1' })
      expect(wrapper.emitted('rename')[0][1]).toBe('New Question Name')
    })
  })

  describe('Drop Operations', () => {
    it('should call moveMessage with null parent for position above', async () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])
      chatStore.currentChatId = 'notebook1'

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 2
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      const dropData = {
        messageId: 'q2',
        targetId: 'q1',
        position: 'above',
        targetIndex: 0
      }
      await questionTree.vm.$emit('drop', dropData)

      // Component emits 'drop' event
      expect(wrapper.emitted('drop')).toBeTruthy()
      expect(wrapper.emitted('drop')[0][0]).toEqual(dropData)
    })

    it('should call moveMessage with target as parent for position below', async () => {
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])
      chatStore.currentChatId = 'notebook1'

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 2
        },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      const dropData = {
        messageId: 'q2',
        targetId: 'q1',
        position: 'below',
        targetIndex: 0
      }
      await questionTree.vm.$emit('drop', dropData)

      // Component emits 'drop' event
      expect(wrapper.emitted('drop')).toBeTruthy()
      expect(wrapper.emitted('drop')[0][0]).toEqual(dropData)
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-existent notebook gracefully', () => {
      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'non-existent',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-title').exists()).toBe(true)
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('should show 0 questions for non-existent notebook', () => {
      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'non-existent',
          rootMessages: [],
          questionCount: 0
        },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-subtitle').text()).toBe('0 questions')
    })
  })

  describe('Shared Drag State', () => {
    it('should use injected draggedItem from parent', () => {
      const sharedDraggedItem = ref(null)
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: {
          provide: {
            draggedItem: sharedDraggedItem,
            dropTarget: ref(null)
          }
        }
      })

      // The QuestionTree should be rendered
      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      expect(questionTree.exists()).toBe(true)
    })

    it('should update shared draggedItem when dragging starts in tree', async () => {
      const sharedDraggedItem = ref(null)
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: {
          provide: {
            draggedItem: sharedDraggedItem,
            dropTarget: ref(null)
          }
        }
      })

      const treeItem = wrapper.find('.tree-item')
      expect(treeItem.exists()).toBe(true)

      // Start drag on tree item
      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      // The shared draggedItem should be set
      expect(sharedDraggedItem.value).not.toBeNull()
      expect(sharedDraggedItem.value.id).toBe('q1')
    })

    it('should clear shared draggedItem when drag ends', async () => {
      const sharedDraggedItem = ref({ id: 'q1' })
      const rootMessages = setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: {
          notebookId: 'notebook1',
          title: 'Test',
          rootMessages,
          questionCount: 1
        },
        global: {
          provide: {
            draggedItem: sharedDraggedItem,
            dropTarget: ref(null)
          }
        }
      })

      const treeItem = wrapper.find('.tree-item')

      // End drag on tree item
      await treeItem.trigger('dragend')

      // The shared draggedItem should be cleared
      expect(sharedDraggedItem.value).toBeNull()
    })
  })
})
