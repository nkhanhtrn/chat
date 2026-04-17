import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useMessageTreeStore } from '@/stores/messageTree'
import QuestionTree from '../QuestionTree.vue'

// Stub DraggableTreeItem to isolate QuestionTree logic
const DraggableTreeItemStub = {
  name: 'DraggableTreeItem',
  props: ['item', 'index', 'parentId', 'isActive', 'isExpanded', 'isDraggable', 'itemClass', 'hideDropZones'],
  emits: ['click', 'delete', 'drop', 'rename'],
  template: `
    <div class="stub-tree-item" :data-id="item.id" :class="{ active: isActive }" @click="$emit('click', item)">
      <span class="item-text">{{ item.questionSummarized || item.question }}</span>
      <button class="stub-delete" @click.stop="$emit('delete', item)">Delete</button>
      <button class="stub-rename" @click.stop="$emit('rename', item, 'renamed')">Rename</button>
      <div v-if="$slots.children" class="stub-children"><slot name="children"></slot></div>
    </div>
  `,
}

function mountTree(props = {}) {
  return mount(QuestionTree, {
    props: {
      rootMessages: [],
      ...props,
    },
    global: {
      stubs: { DraggableTreeItem: DraggableTreeItemStub },
    },
  })
}

describe('QuestionTree', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // happy-dom may not have window.confirm; ensure it exists
    if (!window.confirm) {
      window.confirm = vi.fn().mockReturnValue(true) as any
    } else {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders root messages', () => {
      const wrapper = mountTree({
        rootMessages: [
          { id: 'r1', question: 'Question 1' },
          { id: 'r2', question: 'Question 2' },
        ],
      })
      const items = wrapper.findAll('.stub-tree-item')
      expect(items).toHaveLength(2)
      expect(items[0].text()).toContain('Question 1')
      expect(items[1].text()).toContain('Question 2')
    })

    it('passes isActive for the current message', () => {
      const wrapper = mountTree({
        rootMessages: [
          { id: 'r1', question: 'Q1' },
          { id: 'r2', question: 'Q2' },
        ],
        currentMessageId: 'r2',
      })
      const items = wrapper.findAll('.stub-tree-item')
      expect(items[0].classes()).not.toContain('active')
      expect(items[1].classes()).toContain('active')
    })

    it('renders empty tree without errors', () => {
      const wrapper = mountTree()
      expect(wrapper.findAll('.stub-tree-item')).toHaveLength(0)
    })
  })

  describe('select', () => {
    it('emits select when root item is clicked', async () => {
      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Q1' }],
      })
      await wrapper.find('.stub-tree-item').trigger('click')

      expect(wrapper.emitted('select')).toHaveLength(1)
      expect(wrapper.emitted('select')![0]).toEqual([{ id: 'r1', rootId: 'r1' }])
    })
  })

  describe('delete', () => {
    it('emits delete-root when confirmed for a root item', async () => {
      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Q1' }],
      })
      await wrapper.find('.stub-delete').trigger('click')

      expect(wrapper.emitted('delete-root')).toHaveLength(1)
      expect(wrapper.emitted('delete-root')![0][0]).toEqual({ id: 'r1', question: 'Q1' })
    })

    it('does not emit delete when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Q1' }],
      })
      await wrapper.find('.stub-delete').trigger('click')

      expect(wrapper.emitted('delete-root')).toBeUndefined()
    })
  })

  describe('rename', () => {
    it('re-emits rename event', async () => {
      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Q1' }],
      })
      await wrapper.find('.stub-rename').trigger('click')

      expect(wrapper.emitted('rename')).toHaveLength(1)
      expect(wrapper.emitted('rename')![0]).toEqual([{ id: 'r1', question: 'Q1' }, 'renamed'])
    })
  })

  describe('drop', () => {
    it('re-emits drop event', async () => {
      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Q1' }],
      })
      const dropData = {
        messageId: 'r1',
        targetId: 'r2',
        position: 'above' as const,
        targetIndex: 0,
        targetParentId: null,
      }
      const stubs = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      await stubs[0].vm.$emit('drop', dropData)

      expect(wrapper.emitted('drop')).toHaveLength(1)
      expect(wrapper.emitted('drop')![0]).toEqual([dropData])
    })
  })

  describe('autoExpandAll', () => {
    it('passes isExpanded=true when autoExpandAll is true', () => {
      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Q1' }],
        autoExpandAll: true,
      })
      const items = wrapper.findAllComponents({ name: 'DraggableTreeItem' })
      expect(items[0].props('isExpanded')).toBe(true)
    })
  })

  describe('children', () => {
    it('renders children from message tree store', () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const treeStore = useMessageTreeStore()

      // Set up a root with a child
      treeStore.loadMessages({
        'r1': { id: 'r1', question: 'Root', response: '', childIds: ['c1'] } as any,
        'c1': { id: 'c1', question: 'Child', response: '', parentId: 'r1' } as any,
      })
      treeStore.setRootMessageIds(['r1'])

      const wrapper = mountTree({
        rootMessages: [{ id: 'r1', question: 'Root', childIds: ['c1'] }],
        autoExpandAll: true,
      })

      // The children should be rendered in the slot
      expect(wrapper.text()).toContain('Child')
    })
  })
})
