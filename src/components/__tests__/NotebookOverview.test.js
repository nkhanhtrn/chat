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
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.notebook-overview').exists()).toBe(true)
    })

    it('should render notebook title', () => {
      setupNotebook('notebook1', 'My Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.text()).toContain('My Test Notebook')
    })

    it('should render question count with correct pluralization', () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-subtitle').text()).toBe('1 question')
    })

    it('should pluralize question count for multiple questions', () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-subtitle').text()).toBe('2 questions')
    })

    it('should show empty state when no questions', () => {
      setupNotebook('notebook1', 'Test', [])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No questions yet')
    })

    it('should render QuestionTree when questions exist', () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.findComponent({ name: 'QuestionTree' }).exists()).toBe(true)
    })

    it('should not render QuestionTree when no questions', () => {
      setupNotebook('notebook1', 'Test', [])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.findComponent({ name: 'QuestionTree' }).exists()).toBe(false)
    })
  })

  describe('InlineEdit for Title', () => {
    it('should render InlineEdit component for title', () => {
      setupNotebook('notebook1', 'Test Notebook', [])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      expect(wrapper.findComponent({ name: 'InlineEdit' }).exists()).toBe(true)
    })

    it('should pass notebook title to InlineEdit', () => {
      setupNotebook('notebook1', 'My Notebook Title', [])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      // The notebook title should be visible in the component
      expect(wrapper.text()).toContain('My Notebook Title')
    })

    it('should call renameChat when title is saved', async () => {
      setupNotebook('notebook1', 'Old Title', [])
      const renameSpy = vi.spyOn(chatStore, 'renameChat')

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const inlineEdit = wrapper.findComponent({ name: 'InlineEdit' })
      await inlineEdit.vm.$emit('save', 'New Title')

      expect(renameSpy).toHaveBeenCalledWith('notebook1', 'New Title')
    })

    it('should show fallback title when notebook has no title', () => {
      // Clear store and add notebook without title
      chatStore.chats = []
      chatStore.messagesById = {}
      chatStore.chats.push({
        id: 'notebook1',
        name: '',
        rootMessageIds: []
      })

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      // chatList getter transforms empty title to 'New Subject'
      expect(wrapper.text()).toContain('New Subject')
    })
  })

  describe('QuestionTree Props', () => {
    it('should pass expandAll=true to QuestionTree', () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      expect(questionTree.props('expandAll')).toBe(true)
    })

    it('should pass root messages to QuestionTree', () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      expect(questionTree.props('rootMessages')).toHaveLength(2)
    })
  })

  describe('Events', () => {
    it('should emit select-question when QuestionTree emits select', async () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
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
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])
      const deleteSpy = vi.spyOn(chatStore, 'deleteQuestion').mockImplementation(() => {})

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('delete-root', { id: 'q1' })

      expect(deleteSpy).toHaveBeenCalledWith('q1', 'notebook1')
    })

    it('should call deleteChildMessage when delete-child is triggered', async () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1', childIds: ['child1'] },
        { id: 'child1', question: 'Child 1', parentId: 'q1' }
      ])
      const deleteSpy = vi.spyOn(chatStore, 'deleteChildMessage').mockImplementation(() => ({}))

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('delete-child', { id: 'child1' })

      expect(deleteSpy).toHaveBeenCalledWith('child1')
    })
  })

  describe('Rename Operations', () => {
    it('should call setQuestionSummarized when rename is triggered', async () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])
      const renameSpy = vi.spyOn(chatStore, 'setQuestionSummarized').mockImplementation(() => {})

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('rename', { id: 'q1' }, 'New Question Name')

      expect(renameSpy).toHaveBeenCalledWith('q1', 'New Question Name')
    })
  })

  describe('Drop Operations', () => {
    it('should call moveMessage with null parent for position above', async () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])
      chatStore.currentChatId = 'notebook1'
      const moveSpy = vi.spyOn(chatStore, 'moveMessage').mockImplementation(() => {})

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('drop', {
        messageId: 'q2',
        targetId: 'q1',
        position: 'above',
        targetIndex: 0
      })

      expect(moveSpy).toHaveBeenCalledWith('q2', null, 0)
    })

    it('should call moveMessage with target as parent for position below', async () => {
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' }
      ])
      chatStore.currentChatId = 'notebook1'
      const moveSpy = vi.spyOn(chatStore, 'moveMessage').mockImplementation(() => {})

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
        global: { provide: createProvide() }
      })

      const questionTree = wrapper.findComponent({ name: 'QuestionTree' })
      await questionTree.vm.$emit('drop', {
        messageId: 'q2',
        targetId: 'q1',
        position: 'below',
        targetIndex: 0
      })

      expect(moveSpy).toHaveBeenCalledWith('q2', 'q1', 0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-existent notebook gracefully', () => {
      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'non-existent' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-title').exists()).toBe(true)
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('should show 0 questions for non-existent notebook', () => {
      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'non-existent' },
        global: { provide: createProvide() }
      })

      expect(wrapper.find('.overview-subtitle').text()).toBe('0 questions')
    })
  })

  describe('Shared Drag State', () => {
    it('should use injected draggedItem from parent', () => {
      const sharedDraggedItem = ref(null)
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
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
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
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
      setupNotebook('notebook1', 'Test', [
        { id: 'q1', question: 'Question 1' }
      ])

      wrapper = mount(NotebookOverview, {
        props: { notebookId: 'notebook1' },
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
