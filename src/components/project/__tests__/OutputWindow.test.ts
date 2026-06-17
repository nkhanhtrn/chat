import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OutputWindow from '../OutputWindow.vue'
import type { ProjectWindow } from '@/types/project'

vi.mock('@/composables/useDynamicCompiler', () => ({
  useDynamicCompiler: () => ({
    compiledComponent: { value: null },
    error: { value: null },
    scopeId: 'test-scope',
    compile: vi.fn(),
    cleanup: vi.fn(),
  }),
}))

function createWindow(overrides: Partial<ProjectWindow> = {}): ProjectWindow {
  return {
    id: 'win-1',
    sessionId: 'session-1',
    title: 'Test Tool',
    type: 'tool',
    displayState: 'open',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 300 },
    zIndex: 1,
    code: '<template><div>hello</div></template>',
    ...overrides,
  }
}

function mountComponent(overrides: Partial<ProjectWindow> = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return mount(OutputWindow, {
    props: {
      window: createWindow(overrides),
      topBoundary: 0,
    },
    attachTo: el,
  })
}

function dispatchDocEvent(type: string, clientX = 0, clientY = 0) {
  const event = new Event(type)
  Object.defineProperty(event, 'clientX', { value: clientX })
  Object.defineProperty(event, 'clientY', { value: clientY })
  document.dispatchEvent(event)
}

describe('OutputWindow', () => {
  it('renders CodeDisplay when viewing code', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.code-display').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows CodeEditor when editing code', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.code-editor').exists()).toBe(true)
    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows save and cancel buttons when editing', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[title="Save & re-render"]').exists()).toBe(true)
    expect(wrapper.find('[title="Cancel"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('emits update:code when saving edit', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Save & re-render"]').trigger('click')

    expect(wrapper.emitted('update:code')).toBeTruthy()
    wrapper.unmount()
  })

  it('cancels edit and clears draft', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Cancel"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.code-editor').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows live preview when not viewing code', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.tool-mount').exists()).toBe(true)
    wrapper.unmount()
  })

  describe('pointer events', () => {
    it('emits bring-to-front on pointerdown', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      await wrapper.find('.output-window').trigger('pointerdown')
      expect(wrapper.emitted('bring-to-front')).toBeTruthy()
      wrapper.unmount()
    })

    it('emits update:position on header pointer drag', async () => {
      const wrapper = mountComponent({ position: { x: 100, y: 100 } })
      await wrapper.vm.$nextTick()

      const header = wrapper.find('.window-header').element as HTMLElement
      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'clientX', { value: 50 })
      Object.defineProperty(downEvent, 'clientY', { value: 50 })
      header.dispatchEvent(downEvent)

      dispatchDocEvent('pointermove', 80, 60)
      dispatchDocEvent('pointerup')

      const emitted = wrapper.emitted('update:position')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual({ x: 130, y: 110 })
      wrapper.unmount()
    })

    it('emits update:size on resize handle pointer drag', async () => {
      const wrapper = mountComponent({ size: { width: 300, height: 200 } })
      await wrapper.vm.$nextTick()

      const handle = wrapper.find('.resize-handle.corner').element as HTMLElement
      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'clientX', { value: 0 })
      Object.defineProperty(downEvent, 'clientY', { value: 0 })
      handle.dispatchEvent(downEvent)

      dispatchDocEvent('pointermove', 50, 50)
      dispatchDocEvent('pointerup')

      const emitted = wrapper.emitted('update:size')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual({ width: 350, height: 250 })
      wrapper.unmount()
    })
  })
})
