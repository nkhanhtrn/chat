import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeDisplay from '../CodeDisplay.vue'

describe('CodeDisplay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mountComponent(props = {}) {
    return mount(CodeDisplay, {
      props: { content: 'const x = 1', language: 'typescript', ...props },
    })
  }

  it('copies the content prop to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as any)

    const wrapper = mountComponent({ content: 'console.log("hello")' })
    const buttons = wrapper.findAll('button')
    const copyBtn = buttons[1]

    await copyBtn.trigger('click')

    expect(writeText).toHaveBeenCalledWith('console.log("hello")')
  })

  it('shows checkmark icon after copying', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as any)

    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    const copyBtn = buttons[1]

    await copyBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('polyline').exists()).toBe(true)
  })

  it('emits edit when edit button is clicked', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    const editBtn = buttons[0]

    await editBtn.trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
