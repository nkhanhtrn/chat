import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useMessageTreeStore } from '@/stores/messageTree'
import DraggableTreeItem from '../DraggableTreeItem.vue'

const defaultItem = { id: 'msg-1', question: 'Test Question' }

function mountItem(overrides: Record<string, unknown> = {}) {
  const draggedItem = ref<{ id: string; parentId: string | null } | null>(null)
  const dropTarget = ref<{ id: string; position: string; parentId: string | null } | null>(null)

  const wrapper = mount(DraggableTreeItem, {
    props: {
      item: defaultItem,
      index: 0,
      ...overrides,
    },
    global: {
      provide: {
        draggedItem,
        dropTarget,
      },
      stubs: {
        // Don't stub children slot content
      },
    },
    slots: overrides.slots,
  })

  return { wrapper, draggedItem, dropTarget }
}

describe('DraggableTreeItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('rendering', () => {
    it('displays the question text', () => {
      const { wrapper } = mountItem()
      expect(wrapper.text()).toContain('Test Question')
    })

    it('displays questionSummarized when available', () => {
      const { wrapper } = mountItem({ item: { id: 'msg-1', question: 'Long question text', questionSummarized: 'Short' } })
      expect(wrapper.text()).toContain('Short')
    })

    it('applies active class when isActive is true', () => {
      const { wrapper } = mountItem({ isActive: true })
      expect(wrapper.find('.tree-item').classes()).toContain('active')
    })

    it('does not apply active class by default', () => {
      const { wrapper } = mountItem()
      expect(wrapper.find('.tree-item').classes()).not.toContain('active')
    })

    it('renders drag handle when not editing', () => {
      const { wrapper } = mountItem()
      expect(wrapper.find('.drag-handle').exists()).toBe(true)
    })

    it('renders rename and delete action buttons', () => {
      const { wrapper } = mountItem()
      const actions = wrapper.findAll('.tree-item-action-btn')
      expect(actions).toHaveLength(2) // rename + delete
    })

    it('renders children slot when provided and isExpanded', () => {
      const { wrapper } = mountItem({
        isExpanded: true,
        slots: { children: '<div class="child-slot">Child</div>' },
      })
      expect(wrapper.find('.child-slot').exists()).toBe(true)
    })

    it('does not render children slot when not expanded', () => {
      const { wrapper } = mountItem({
        isExpanded: false,
        slots: { children: '<div class="child-slot">Child</div>' },
      })
      expect(wrapper.find('.child-slot').exists()).toBe(false)
    })
  })

  describe('click', () => {
    it('emits click when tree-item is clicked', async () => {
      const { wrapper } = mountItem()
      await wrapper.find('.tree-item').trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)
      expect(wrapper.emitted('click')![0]).toEqual([defaultItem])
    })
  })

  describe('delete', () => {
    it('emits delete when delete button is clicked', async () => {
      const { wrapper } = mountItem()
      const deleteBtn = wrapper.findAll('.tree-item-action-btn')[1]
      await deleteBtn.trigger('click')
      expect(wrapper.emitted('delete')).toHaveLength(1)
      expect(wrapper.emitted('delete')![0]).toEqual([defaultItem])
    })
  })

  describe('inline editing', () => {
    it('enters edit mode when rename button is clicked', async () => {
      const { wrapper } = mountItem()
      const renameBtn = wrapper.findAll('.tree-item-action-btn')[0]
      await renameBtn.trigger('click')

      expect(wrapper.find('.inline-edit-input').exists()).toBe(true)
      expect(wrapper.find('.tree-item').classes()).toContain('is-editing')
    })

    it('prepopulates edit input with questionSummarized', async () => {
      const { wrapper } = mountItem({ item: { id: 'msg-1', question: 'Full question', questionSummarized: 'Summary' } })
      const renameBtn = wrapper.findAll('.tree-item-action-btn')[0]
      await renameBtn.trigger('click')

      const input = wrapper.find('.inline-edit-input').element as HTMLInputElement
      expect(input.value).toBe('Summary')
    })

    it('emits rename when finishEditing is called with new text', async () => {
      const { wrapper } = mountItem()
      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')

      const input = wrapper.find('.inline-edit-input')
      await input.setValue('New Name')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename')).toHaveLength(1)
      expect(wrapper.emitted('rename')![0]).toEqual([defaultItem, 'New Name'])
    })

    it('does not emit rename when text is unchanged', async () => {
      const { wrapper } = mountItem()
      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')

      const input = wrapper.find('.inline-edit-input')
      // Don't change value, just press enter
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename')).toBeUndefined()
    })

    it('cancels editing on Escape', async () => {
      const { wrapper } = mountItem()
      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')
      expect(wrapper.find('.inline-edit-input').exists()).toBe(true)

      await wrapper.find('.inline-edit-input').trigger('keydown.esc')
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('cancels editing on blur (outside wrapper)', async () => {
      const { wrapper } = mountItem()
      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')
      expect(wrapper.find('.inline-edit-input').exists()).toBe(true)

      // Blur with relatedTarget outside the edit wrapper
      await wrapper.find('.inline-edit-input').trigger('blur', { relatedTarget: document.body })
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('saves via save button', async () => {
      const { wrapper } = mountItem()
      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')

      await wrapper.find('.inline-edit-input').setValue('Renamed')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.emitted('rename')).toEqual([[defaultItem, 'Renamed']])
    })

    it('cancels via cancel button', async () => {
      const { wrapper } = mountItem()
      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')

      await wrapper.find('.cancel-btn').trigger('click')
      expect(wrapper.emitted('rename')).toBeUndefined()
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('exposes startEditing method', () => {
      const { wrapper } = mountItem()
      expect(typeof (wrapper.vm as any).startEditing).toBe('function')
    })

    it('is not draggable while editing', async () => {
      const { wrapper } = mountItem()
      expect(wrapper.find('.tree-item').attributes('draggable')).toBe('true')

      await wrapper.findAll('.tree-item-action-btn')[0].trigger('click')
      expect(wrapper.find('.tree-item').attributes('draggable')).toBe('false')
    })
  })

  describe('drag and drop', () => {
    function createDragEvent(type: string, overrides: Record<string, unknown> = {}) {
      const dataTransfer = {
        effectAllowed: '',
        dropEffect: '',
        setData: vi.fn(),
        getData: vi.fn(),
      }
      return {
        type,
        dataTransfer,
        clientY: 0,
        clientX: 0,
        preventDefault: vi.fn(),
        ...overrides,
      }
    }

    it('sets draggedItem on dragstart', async () => {
      const { wrapper, draggedItem } = mountItem()
      const event = createDragEvent('dragstart')
      await wrapper.find('.tree-item').trigger('dragstart', event)

      expect(draggedItem.value).toEqual({ id: 'msg-1', parentId: null })
    })

    it('clears drag state on dragend', async () => {
      const { wrapper, draggedItem, dropTarget } = mountItem()
      draggedItem.value = { id: 'msg-1', parentId: null }
      dropTarget.value = { id: 'msg-1', position: 'above', parentId: null }

      await wrapper.find('.tree-item').trigger('dragend')
      expect(draggedItem.value).toBeNull()
      expect(dropTarget.value).toBeNull()
    })

    it('emits drop when valid drop occurs', async () => {
      const { wrapper, draggedItem } = mountItem({ item: { id: 'target', question: 'Target' } })
      draggedItem.value = { id: 'source', parentId: null }

      const event = createDragEvent('drop')
      await wrapper.find('.tree-item-container').trigger('drop', event)

      expect(wrapper.emitted('drop')).toHaveLength(1)
      expect(wrapper.emitted('drop')![0][0]).toMatchObject({
        messageId: 'source',
        targetId: 'target',
      })
    })

    it('does not emit drop when dropping on self', async () => {
      const { wrapper, draggedItem } = mountItem()
      draggedItem.value = { id: 'msg-1', parentId: null }

      await wrapper.find('.tree-item-container').trigger('drop', {
        preventDefault: vi.fn(),
      })

      expect(wrapper.emitted('drop')).toBeUndefined()
    })

    it('does not process dragover when hideDropZones is true', async () => {
      const { wrapper, dropTarget } = mountItem({ hideDropZones: true })
      const treeItem = wrapper.findComponent({ ref: 'treeItemRef' })

      // Just ensure it doesn't crash
      await wrapper.find('.tree-item-container').trigger('dragover', {
        clientY: 50,
      })
      expect(dropTarget.value).toBeNull()
    })
  })

  describe('drop indicators', () => {
    it('applies drop-above class when dropTarget matches with above position', () => {
      const dropTarget = ref({ id: 'msg-1', position: 'above', parentId: null })
      const wrapper = mount(DraggableTreeItem, {
        props: { item: defaultItem, index: 0 },
        global: {
          provide: {
            draggedItem: ref(null),
            dropTarget,
          },
        },
      })
      expect(wrapper.find('.tree-item-container').classes()).toContain('drop-above')
    })

    it('applies drop-below class when dropTarget matches with below position', () => {
      const dropTarget = ref({ id: 'msg-1', position: 'below', parentId: null })
      const wrapper = mount(DraggableTreeItem, {
        props: { item: defaultItem, index: 0 },
        global: {
          provide: {
            draggedItem: ref(null),
            dropTarget,
          },
        },
      })
      expect(wrapper.find('.tree-item-container').classes()).toContain('drop-below')
    })

    it('does not apply drop classes when hideDropZones is true', () => {
      const dropTarget = ref({ id: 'msg-1', position: 'above', parentId: null })
      const wrapper = mount(DraggableTreeItem, {
        props: { item: defaultItem, index: 0, hideDropZones: true },
        global: {
          provide: {
            draggedItem: ref(null),
            dropTarget,
          },
        },
      })
      expect(wrapper.find('.tree-item-container').classes()).not.toContain('drop-above')
    })
  })
})
