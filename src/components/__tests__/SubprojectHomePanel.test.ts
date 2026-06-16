import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SubprojectHomePanel from '../project/SubprojectHomePanel.vue'
import type { SubProject } from '@/types/project'

function createSub(id: string, name: string): SubProject {
  return { id, name, createdAt: Date.now() } as SubProject
}

function mountPanel(props = {}) {
  const subs = [createSub('s1', 'Sub 1'), createSub('s2', 'Sub 2'), createSub('s3', 'Sub 3')]
  return mount(SubprojectHomePanel, {
    props: {
      subprojects: subs,
      closedIds: [],
      ...props,
    },
  })
}

describe('SubprojectHomePanel', () => {
  it('renders subproject items', () => {
    const wrapper = mountPanel()
    expect(wrapper.findAll('.subproject-item')).toHaveLength(3)
  })

  it('shows correct count', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('.count').text()).toBe('3')
  })

  it('emits open-subproject on item click', async () => {
    const wrapper = mountPanel()
    await wrapper.findAll('.item-info')[1].trigger('click')
    expect(wrapper.emitted('open-subproject')![0]).toEqual(['s2'])
  })

  describe('touch pointer reorder', () => {
    it('ignores mouse pointer for reorder', async () => {
      const wrapper = mountPanel()
      const items = wrapper.findAll('.subproject-item')
      await items[0].trigger('pointerdown', { pointerType: 'mouse', clientY: 0 })
      expect(wrapper.find('.subproject-item.is-dragging').exists()).toBe(false)
    })

    it('starts drag on touch pointer with movement beyond threshold', async () => {
      const wrapper = mountPanel()
      await wrapper.vm.$nextTick()

      const items = wrapper.findAll('.subproject-item')
      const targetItem = items[2].element as HTMLElement
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetItem)

      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'pointerType', { value: 'touch' })
      Object.defineProperty(downEvent, 'clientX', { value: 50 })
      Object.defineProperty(downEvent, 'clientY', { value: 100 })
      items[0].element.dispatchEvent(downEvent)

      const moveEvent = new Event('pointermove')
      Object.defineProperty(moveEvent, 'clientX', { value: 50 })
      Object.defineProperty(moveEvent, 'clientY', { value: 200 })
      document.dispatchEvent(moveEvent)

      await wrapper.vm.$nextTick()
      expect(wrapper.find('.subproject-item.is-dragging').exists()).toBe(true)

      document.dispatchEvent(new Event('pointerup'))
      expect(wrapper.emitted('reorder-subprojects')).toBeTruthy()
      vi.restoreAllMocks()
      wrapper.unmount()
    })

    it('does not start drag below movement threshold', async () => {
      const wrapper = mountPanel()
      const items = wrapper.findAll('.subproject-item')

      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'pointerType', { value: 'touch' })
      Object.defineProperty(downEvent, 'clientX', { value: 50 })
      Object.defineProperty(downEvent, 'clientY', { value: 100 })
      items[0].element.dispatchEvent(downEvent)

      const moveEvent = new Event('pointermove')
      Object.defineProperty(moveEvent, 'clientX', { value: 50 })
      Object.defineProperty(moveEvent, 'clientY', { value: 102 })
      document.dispatchEvent(moveEvent)

      expect(wrapper.find('.subproject-item.is-dragging').exists()).toBe(false)

      document.dispatchEvent(new Event('pointerup'))
      wrapper.unmount()
    })
  })
})
