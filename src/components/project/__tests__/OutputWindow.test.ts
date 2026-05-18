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
  return mount(OutputWindow, {
    props: {
      window: createWindow(overrides),
    },
  })
}

describe('OutputWindow editor line numbers', () => {
  it('renders line numbers when editing code', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    const lineNums = wrapper.findAll('.editor-body .line-num')
    expect(lineNums.length).toBeGreaterThanOrEqual(1)
    expect(lineNums[0].text()).toBe('1')
  })

  it('updates line numbers as user types', async () => {
    const wrapper = mountComponent({ code: 'a' })
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    const textarea = wrapper.find('.editor-textarea')
    await textarea.setValue('line1\nline2\nline3')
    await wrapper.vm.$nextTick()

    const lineNums = wrapper.findAll('.editor-body .line-num')
    expect(lineNums).toHaveLength(3)
    expect(lineNums[0].text()).toBe('1')
    expect(lineNums[1].text()).toBe('2')
    expect(lineNums[2].text()).toBe('3')
  })

  it('syncs line numbers scroll with textarea scroll', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    const textarea = wrapper.find<HTMLTextAreaElement>('.editor-textarea')
    const lineNumsEl = wrapper.find<HTMLElement>('.editor-body .line-numbers')

    expect(lineNumsEl.exists()).toBe(true)
    expect(textarea.exists()).toBe(true)

    Object.defineProperty(textarea.element, 'scrollTop', { value: 42, writable: true })
    await textarea.trigger('scroll')

    expect(lineNumsEl.element.scrollTop).toBe(42)
  })

  it('focuses textarea when clicking line numbers gutter', async () => {
    const wrapper = mountComponent()
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="View code"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[title="Edit code"]').trigger('click')
    await wrapper.vm.$nextTick()

    const textarea = wrapper.find<HTMLTextAreaElement>('.editor-textarea')
    const focusSpy = vi.spyOn(textarea.element, 'focus')

    await wrapper.find('.editor-body .line-numbers').trigger('click')

    expect(focusSpy).toHaveBeenCalled()
  })
})
