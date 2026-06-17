import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GlobalToolMenu from '../project/GlobalToolMenu.vue'

vi.mock('@/stores/globalTool', () => ({
  useGlobalToolStore: () => ({
    templateList: [],
    deleteTemplate: vi.fn(),
  }),
}))

function dispatchDocEvent(type: string, clientX = 0, clientY = 0) {
  const event = new Event(type)
  Object.defineProperty(event, 'clientX', { value: clientX })
  Object.defineProperty(event, 'clientY', { value: clientY })
  document.dispatchEvent(event)
}

function mountMenu() {
  return mount(GlobalToolMenu, { attachTo: document.body })
}

describe('GlobalToolMenu', () => {
  describe('pointer events', () => {
    it('closes menu on overlay pointerdown', async () => {
      const wrapper = mountMenu()
      await wrapper.find('.launcher-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(document.querySelector('.gtm-overlay')).toBeTruthy()

      const overlay = document.querySelector('.gtm-overlay') as HTMLElement
      overlay.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(document.querySelector('.gtm-overlay')).toBeFalsy()
      wrapper.unmount()
    })

    it('resizes menu via resize handle pointer drag', async () => {
      const wrapper = mountMenu()
      await wrapper.find('.launcher-btn').trigger('click')
      await wrapper.vm.$nextTick()

      const handle = document.querySelector('.gtm-resize-handle') as HTMLElement
      handle.dispatchEvent(new Event('pointerdown', { bubbles: true }))

      dispatchDocEvent('pointermove', 100, 100)
      dispatchDocEvent('pointerup')

      const menu = document.querySelector('.gtm-menu') as HTMLElement
      expect(menu.style.width).toBeTruthy()
      wrapper.unmount()
    })
  })
})
