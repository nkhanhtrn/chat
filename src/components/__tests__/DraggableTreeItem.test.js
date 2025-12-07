import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DraggableTreeItem from '../DraggableTreeItem.vue'

describe('DraggableTreeItem', () => {
  let wrapper
  let pinia

  const defaultProps = {
    item: { id: 'item1', question: 'Test Question', questionSummarized: null },
    index: 0
  }

  // Create provide for drag state
  const createProvide = (draggedItem = null, dropTarget = null) => ({
    draggedItem: ref(draggedItem),
    dropTarget: ref(dropTarget)
  })

  // Create global config with Pinia
  const createGlobalConfig = (provide) => ({
    plugins: [pinia],
    provide
  })

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    if (wrapper) {
      wrapper.unmount()
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render tree item container', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item-container').exists()).toBe(true)
    })

    it('should render tree item element', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').exists()).toBe(true)
    })

    it('should display item question text', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item-text').text()).toBe('Test Question')
    })

    it('should display questionSummarized if available', () => {
      wrapper = mount(DraggableTreeItem, {
        props: {
          ...defaultProps,
          item: { id: 'item1', question: 'Full Question', questionSummarized: 'Summary' }
        },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item-text').text()).toBe('Summary')
    })

    it('should render drag handle', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.drag-handle').exists()).toBe(true)
    })

    it('should render delete button when showDeleteButton is true', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showDeleteButton: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.delete-button').exists()).toBe(true)
    })

    it('should not render delete button when showDeleteButton is false', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showDeleteButton: false },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.delete-button').exists()).toBe(false)
    })
  })

  describe('Active State', () => {
    it('should have active class when isActive is true', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isActive: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').classes()).toContain('active')
    })

    it('should not have active class when isActive is false', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isActive: false },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').classes()).not.toContain('active')
    })
  })

  describe('Custom Item Class', () => {
    it('should apply string itemClass', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, itemClass: 'custom-class' },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').classes()).toContain('custom-class')
    })

    it('should apply array itemClass', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, itemClass: ['class-a', 'class-b'] },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').classes()).toContain('class-a')
      expect(wrapper.find('.tree-item').classes()).toContain('class-b')
    })
  })

  describe('Click Events', () => {
    it('should emit click event when item is clicked', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item').trigger('click')
      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')[0][0]).toEqual(defaultProps.item)
    })

    it('should emit delete event when delete button is clicked', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showDeleteButton: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.delete-button').trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')[0][0]).toEqual(defaultProps.item)
    })

    it('should stop propagation on delete button click', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showDeleteButton: true },
        global: createGlobalConfig(createProvide())
      })
      const deleteBtn = wrapper.find('.delete-button')
      const event = new MouseEvent('click', { bubbles: true })
      const stopPropagation = vi.spyOn(event, 'stopPropagation')
      deleteBtn.element.dispatchEvent(event)
      expect(stopPropagation).toHaveBeenCalled()
    })
  })

  describe('Draggable Behavior', () => {
    it('should be draggable by default', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').attributes('draggable')).toBe('true')
    })

    it('should not be draggable when draggable prop is false', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, draggable: false },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.tree-item').attributes('draggable')).toBe('false')
    })

    it('should have is-dragging class when item is being dragged', () => {
      const provide = createProvide({ id: 'item1', parentId: null }, null)
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })
      expect(wrapper.find('.tree-item').classes()).toContain('is-dragging')
    })

    it('should set draggedItem on dragstart', async () => {
      const provide = createProvide()
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, parentId: 'parent1' },
        global: createGlobalConfig(provide)
      })

      const dataTransfer = { effectAllowed: '', setData: vi.fn() }
      await wrapper.find('.tree-item').trigger('dragstart', { dataTransfer })

      expect(provide.draggedItem.value).toEqual({ id: 'item1', parentId: 'parent1' })
      expect(dataTransfer.effectAllowed).toBe('copyMove')
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'item1')
    })

    it('should set question context data on dragstart', async () => {
      const provide = createProvide()
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })

      const dataTransfer = { effectAllowed: '', setData: vi.fn() }
      await wrapper.find('.tree-item').trigger('dragstart', { dataTransfer })

      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/x-question-context',
        JSON.stringify({ messageId: 'item1' })
      )
    })

    it('should set both text/plain and application/x-question-context on dragstart', async () => {
      const provide = createProvide()
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })

      const dataTransfer = { effectAllowed: '', setData: vi.fn() }
      await wrapper.find('.tree-item').trigger('dragstart', { dataTransfer })

      expect(dataTransfer.setData).toHaveBeenCalledTimes(2)
      expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'item1')
      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/x-question-context',
        expect.any(String)
      )
    })

    it('should clear draggedItem and dropTarget on dragend', async () => {
      const provide = createProvide({ id: 'item1', parentId: null }, { id: 'item2', position: 'above' })
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })

      await wrapper.find('.tree-item').trigger('dragend')

      expect(provide.draggedItem.value).toBe(null)
      expect(provide.dropTarget.value).toBe(null)
    })
  })

  describe('Drop Zone Behavior', () => {
    it('should show drop-above indicator when dropTarget position is above', () => {
      const provide = createProvide(
        { id: 'other-item', parentId: null },
        { id: 'item1', position: 'above', parentId: null }
      )
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })
      expect(wrapper.find('.tree-item-container').classes()).toContain('drop-above')
    })

    it('should show drop-below indicator when dropTarget position is below', () => {
      const provide = createProvide(
        { id: 'other-item', parentId: null },
        { id: 'item1', position: 'below', parentId: null }
      )
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })
      expect(wrapper.find('.tree-item-container').classes()).toContain('drop-below')
    })

    it('should not show drop indicators when hideDropZones is true', () => {
      const provide = createProvide(
        { id: 'other-item', parentId: null },
        { id: 'item1', position: 'above', parentId: null }
      )
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, hideDropZones: true },
        global: createGlobalConfig(provide)
      })
      expect(wrapper.find('.tree-item-container').classes()).not.toContain('drop-above')
      expect(wrapper.find('.tree-item-container').classes()).not.toContain('drop-below')
    })

    it('should emit drop event on drop', async () => {
      const provide = createProvide(
        { id: 'dragged-item', parentId: 'parent1' },
        { id: 'item1', position: 'above', parentId: null }
      )
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, index: 2, parentId: 'parent2' },
        global: createGlobalConfig(provide)
      })

      await wrapper.find('.tree-item-container').trigger('drop')

      expect(wrapper.emitted('drop')).toBeTruthy()
      expect(wrapper.emitted('drop')[0][0]).toEqual({
        messageId: 'dragged-item',
        targetId: 'item1',
        position: 'above',
        targetIndex: 2,
        targetParentId: 'parent2'
      })
    })

    it('should not emit drop event when dropping on self', async () => {
      const provide = createProvide(
        { id: 'item1', parentId: null },
        { id: 'item1', position: 'below', parentId: null }
      )
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })

      await wrapper.find('.tree-item-container').trigger('drop')

      expect(wrapper.emitted('drop')).toBeFalsy()
    })

    it('should clear drag state after drop', async () => {
      const provide = createProvide(
        { id: 'dragged-item', parentId: null },
        { id: 'item1', position: 'below', parentId: null }
      )
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(provide)
      })

      await wrapper.find('.tree-item-container').trigger('drop')

      expect(provide.draggedItem.value).toBe(null)
      expect(provide.dropTarget.value).toBe(null)
    })
  })

  describe('Inline Editing', () => {
    it('should not show edit input by default', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('should switch to edit mode on double click when editable', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      expect(wrapper.find('.inline-edit-input').exists()).toBe(true)
    })

    it('should not switch to edit mode on double click when not editable', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: false },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('should populate input with current text on edit', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      expect(wrapper.find('.inline-edit-input').element.value).toBe('Test Question')
    })

    it('should have is-editing class when editing', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      expect(wrapper.find('.tree-item').classes()).toContain('is-editing')
    })

    it('should not be draggable while editing', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      expect(wrapper.find('.tree-item').attributes('draggable')).toBe('false')
    })

    it('should emit rename on Enter with changed value', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      const input = wrapper.find('.inline-edit-input')
      await input.setValue('New Title')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename')).toBeTruthy()
      expect(wrapper.emitted('rename')[0]).toEqual([defaultProps.item, 'New Title'])
    })

    it('should not emit rename on Enter if value unchanged', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      await wrapper.find('.inline-edit-input').trigger('keydown.enter')

      expect(wrapper.emitted('rename')).toBeFalsy()
    })

    it('should trim whitespace from renamed value', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      const input = wrapper.find('.inline-edit-input')
      await input.setValue('  Trimmed Value  ')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename')[0]).toEqual([defaultProps.item, 'Trimmed Value'])
    })

    it('should cancel editing on Escape', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      const input = wrapper.find('.inline-edit-input')
      await input.setValue('Changed')
      await input.trigger('keydown.esc')

      expect(wrapper.emitted('rename')).toBeFalsy()
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('should save on save button click', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      await wrapper.find('.inline-edit-input').setValue('New Value')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.emitted('rename')).toBeTruthy()
      expect(wrapper.emitted('rename')[0]).toEqual([defaultProps.item, 'New Value'])
    })

    it('should cancel on cancel button click', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      await wrapper.find('.inline-edit-input').setValue('Changed')
      await wrapper.find('.cancel-btn').trigger('click')

      expect(wrapper.emitted('rename')).toBeFalsy()
      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('should disable save button when input is empty', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      await wrapper.find('.inline-edit-input').setValue('')

      expect(wrapper.find('.save-btn').attributes('disabled')).toBeDefined()
    })

    it('should hide delete button while editing', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true, showDeleteButton: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.delete-button').exists()).toBe(true)

      await wrapper.find('.tree-item-text').trigger('dblclick')

      expect(wrapper.find('.delete-button').exists()).toBe(false)
    })

    it('should not emit click while editing', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.tree-item-text').trigger('dblclick')
      await wrapper.find('.tree-item').trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })

  describe('Exposed Methods', () => {
    it('should expose startEditing method', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide())
      })

      expect(wrapper.vm.startEditing).toBeDefined()
      wrapper.vm.startEditing()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.inline-edit-input').exists()).toBe(true)
    })

    it('should not start editing via exposed method when not editable', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: false },
        global: createGlobalConfig(createProvide())
      })

      wrapper.vm.startEditing()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })
  })

  describe('Children Slot', () => {
    it('should render children slot when expanded', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isExpanded: true },
        global: createGlobalConfig(createProvide()),
        slots: {
          children: '<div class="test-child">Child Content</div>'
        }
      })

      expect(wrapper.find('.tree-children').exists()).toBe(true)
      expect(wrapper.find('.test-child').exists()).toBe(true)
    })

    it('should not render children slot when not expanded', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isExpanded: false },
        global: createGlobalConfig(createProvide()),
        slots: {
          children: '<div class="test-child">Child Content</div>'
        }
      })

      expect(wrapper.find('.tree-children').exists()).toBe(false)
    })
  })

  describe('Default Slot', () => {
    it('should render custom content via default slot', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide()),
        slots: {
          default: '<span class="custom-content">Custom Item</span>'
        }
      })

      expect(wrapper.find('.custom-content').exists()).toBe(true)
      expect(wrapper.find('.custom-content').text()).toBe('Custom Item')
    })

    it('should provide item and isEditing to slot scope', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide()),
        slots: {
          default: `<template #default="{ item, isEditing }">
            <span class="slot-item-id">{{ item.id }}</span>
            <span class="slot-editing">{{ isEditing }}</span>
          </template>`
        }
      })

      expect(wrapper.find('.slot-item-id').text()).toBe('item1')
      expect(wrapper.find('.slot-editing').text()).toBe('false')
    })
  })

  describe('Props Defaults', () => {
    it('should have correct default values', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })

      expect(wrapper.props('parentId')).toBe(null)
      expect(wrapper.props('isActive')).toBe(false)
      expect(wrapper.props('isExpanded')).toBe(false)
      expect(wrapper.props('showDeleteButton')).toBe(false)
      expect(wrapper.props('showCollapseButton')).toBe(false)
      expect(wrapper.props('hasChildren')).toBe(false)
      expect(wrapper.props('draggable')).toBe(true)
      expect(wrapper.props('hideDropZones')).toBe(false)
      expect(wrapper.props('itemClass')).toBe('')
      expect(wrapper.props('editable')).toBe(false)
      expect(wrapper.props('isStreaming')).toBe(false)
    })
  })

  describe('Collapse Button', () => {
    it('should not show collapse button by default', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.collapse-button').exists()).toBe(false)
    })

    it('should not show collapse button when showCollapseButton is true but hasChildren is false', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: false },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.collapse-button').exists()).toBe(false)
      expect(wrapper.find('.collapse-spacer').exists()).toBe(true)
    })

    it('should show collapse button when showCollapseButton and hasChildren are true', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.collapse-button').exists()).toBe(true)
    })

    it('should emit toggle-expand when collapse button is clicked', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.collapse-button').trigger('click')
      expect(wrapper.emitted('toggle-expand')).toBeTruthy()
      expect(wrapper.emitted('toggle-expand')[0][0]).toEqual(defaultProps.item)
    })

    it('should show down arrow when expanded', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: true, isExpanded: true },
        global: createGlobalConfig(createProvide())
      })
      const svg = wrapper.find('.collapse-button svg')
      expect(svg.exists()).toBe(true)
      // Check for down arrow polyline (points="6 9 12 15 18 9")
      expect(svg.find('polyline[points="6 9 12 15 18 9"]').exists()).toBe(true)
    })

    it('should show right arrow when collapsed', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: true, isExpanded: false },
        global: createGlobalConfig(createProvide())
      })
      const svg = wrapper.find('.collapse-button svg')
      expect(svg.exists()).toBe(true)
      // Check for right arrow polyline (points="9 18 15 12 9 6")
      expect(svg.find('polyline[points="9 18 15 12 9 6"]').exists()).toBe(true)
    })

    it('should not show drag handle when collapse button is shown', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.drag-handle').exists()).toBe(false)
    })

    it('should not emit click event when collapse button is clicked', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, showCollapseButton: true, hasChildren: true },
        global: createGlobalConfig(createProvide())
      })
      await wrapper.find('.collapse-button').trigger('click')
      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })

  describe('Streaming Indicator', () => {
    it('should not show streaming indicator by default', () => {
      wrapper = mount(DraggableTreeItem, {
        props: defaultProps,
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.streaming-indicator').exists()).toBe(false)
    })

    it('should show streaming indicator when isStreaming is true', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isStreaming: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.streaming-indicator').exists()).toBe(true)
    })

    it('should not show streaming indicator when isStreaming is false', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isStreaming: false },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.streaming-indicator').exists()).toBe(false)
    })

    it('should show streaming indicator with editable prop', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true, isStreaming: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.streaming-indicator').exists()).toBe(true)
    })

    it('should have correct title attribute on streaming indicator', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isStreaming: true },
        global: createGlobalConfig(createProvide())
      })
      expect(wrapper.find('.streaming-indicator').attributes('title')).toBe('Generating response...')
    })

    it('streaming indicator should be inside text wrapper', () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, isStreaming: true },
        global: createGlobalConfig(createProvide())
      })
      const wrapper_div = wrapper.find('.tree-item-text-wrapper')
      expect(wrapper_div.exists()).toBe(true)
      expect(wrapper_div.find('.streaming-indicator').exists()).toBe(true)
    })
  })

  describe('Blur Behavior', () => {
    it('should cancel editing on blur outside wrapper', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide()),
        attachTo: document.body
      })

      await wrapper.find('.tree-item-text').trigger('dblclick')
      await wrapper.find('.inline-edit-input').trigger('blur', { relatedTarget: null })

      expect(wrapper.find('.inline-edit-input').exists()).toBe(false)
    })

    it('should not cancel editing when clicking edit buttons', async () => {
      wrapper = mount(DraggableTreeItem, {
        props: { ...defaultProps, editable: true },
        global: createGlobalConfig(createProvide()),
        attachTo: document.body
      })

      await wrapper.find('.tree-item-text').trigger('dblclick')
      const saveBtn = wrapper.find('.save-btn').element
      await wrapper.find('.inline-edit-input').trigger('blur', { relatedTarget: saveBtn })

      expect(wrapper.find('.inline-edit-input').exists()).toBe(true)
    })
  })
})
