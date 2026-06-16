import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectHeader from '../project/ProjectHeader.vue'
import type { SubProject } from '@/types/project'

function createSub(id: string, name: string): SubProject {
  return { id, name, createdAt: Date.now() } as SubProject
}

function mountHeader(props = {}) {
  const subs = [createSub('s1', 'Sub 1'), createSub('s2', 'Sub 2'), createSub('s3', 'Sub 3')]
  return mount(ProjectHeader, {
    props: {
      name: 'Project',
      subprojects: subs,
      openSubprojects: subs,
      activeSubprojectId: 's1',
      isHome: false,
      ...props,
    },
  })
}

function getSubTabs(wrapper: ReturnType<typeof mountHeader>) {
  return wrapper.findAll('.subproject:not(.home-tab)')
}

describe('ProjectHeader', () => {
  it('renders subproject tabs', () => {
    const wrapper = mountHeader()
    expect(getSubTabs(wrapper)).toHaveLength(3)
  })

  it('emits switch-subproject on tab click', async () => {
    const wrapper = mountHeader()
    const tabs = getSubTabs(wrapper)
    await tabs[1].trigger('click')
    expect(wrapper.emitted('switch-subproject')![0]).toEqual(['s2'])
  })

  it('emits add-subproject on add button click', async () => {
    const wrapper = mountHeader()
    await wrapper.find('.subproject-add').trigger('click')
    expect(wrapper.emitted('add-subproject')).toBeTruthy()
  })

  describe('touch pointer reorder', () => {
    it('ignores mouse pointer for reorder', async () => {
      const wrapper = mountHeader()
      const tabs = getSubTabs(wrapper)
      await tabs[0].trigger('pointerdown', { pointerType: 'mouse', clientX: 0 })
      expect(wrapper.find('.subproject.is-dragging').exists()).toBe(false)
    })

    it('starts drag on touch pointer with movement beyond threshold', async () => {
      const wrapper = mountHeader()
      await wrapper.vm.$nextTick()

      const tabs = getSubTabs(wrapper)
      const targetTab = tabs[1].element as HTMLElement
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(targetTab)

      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'pointerType', { value: 'touch' })
      Object.defineProperty(downEvent, 'clientX', { value: 100 })
      Object.defineProperty(downEvent, 'clientY', { value: 0 })
      tabs[0].element.dispatchEvent(downEvent)

      const moveEvent = new Event('pointermove')
      Object.defineProperty(moveEvent, 'clientX', { value: 150 })
      Object.defineProperty(moveEvent, 'clientY', { value: 0 })
      document.dispatchEvent(moveEvent)

      await wrapper.vm.$nextTick()
      expect(wrapper.find('.subproject.is-dragging').exists()).toBe(true)

      document.dispatchEvent(new Event('pointerup'))
      expect(wrapper.emitted('reorder-subprojects')).toBeTruthy()
      vi.restoreAllMocks()
      wrapper.unmount()
    })

    it('does not start drag below movement threshold', async () => {
      const wrapper = mountHeader()
      const tabs = getSubTabs(wrapper)

      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'pointerType', { value: 'touch' })
      Object.defineProperty(downEvent, 'clientX', { value: 100 })
      Object.defineProperty(downEvent, 'clientY', { value: 0 })
      tabs[0].element.dispatchEvent(downEvent)

      const moveEvent = new Event('pointermove')
      Object.defineProperty(moveEvent, 'clientX', { value: 102 })
      Object.defineProperty(moveEvent, 'clientY', { value: 0 })
      document.dispatchEvent(moveEvent)

      expect(wrapper.find('.subproject.is-dragging').exists()).toBe(false)

      document.dispatchEvent(new Event('pointerup'))
      wrapper.unmount()
    })
  })
})
