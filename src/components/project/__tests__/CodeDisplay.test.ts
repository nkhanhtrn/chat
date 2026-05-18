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

  describe('line numbers', () => {
    it('renders line numbers for single line content', () => {
      const wrapper = mountComponent({ content: 'hello' })
      const lineNums = wrapper.findAll('.line-num')

      expect(lineNums).toHaveLength(1)
      expect(lineNums[0].text()).toBe('1')
    })

    it('renders line numbers for multi-line content', () => {
      const wrapper = mountComponent({ content: 'line1\nline2\nline3' })
      const lineNums = wrapper.findAll('.line-num')

      expect(lineNums).toHaveLength(3)
      expect(lineNums[0].text()).toBe('1')
      expect(lineNums[1].text()).toBe('2')
      expect(lineNums[2].text()).toBe('3')
    })

    it('renders correct line count for content with many lines', () => {
      const lines = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`)
      const wrapper = mountComponent({ content: lines.join('\n') })
      const lineNums = wrapper.findAll('.line-num')

      expect(lineNums).toHaveLength(500)
      expect(lineNums[499].text()).toBe('500')
    })

    it('renders each code line in a .code-line row alongside its line number', () => {
      const wrapper = mountComponent({ content: 'a\nb\nc' })
      const rows = wrapper.findAll('.code-line')

      expect(rows).toHaveLength(3)
      rows.forEach((row, i) => {
        expect(row.find('.line-num').text()).toBe(String(i + 1))
        expect(row.find('.line-text').text()).toBe(['a', 'b', 'c'][i])
      })
    })

    it('renders empty line numbers for content with trailing newline', () => {
      const wrapper = mountComponent({ content: 'a\nb\n' })
      const lineNums = wrapper.findAll('.line-num')

      expect(lineNums).toHaveLength(3)
      expect(wrapper.findAll('.line-text')[2].text()).toBe('')
    })

    it('renders one line number for empty content', () => {
      const wrapper = mountComponent({ content: '' })
      const lineNums = wrapper.findAll('.line-num')

      expect(lineNums).toHaveLength(1)
    })
  })
})
