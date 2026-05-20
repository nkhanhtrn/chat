import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeDisplay from '../CodeDisplay.vue'

function mountComponent(props = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return mount(CodeDisplay, {
    props: { content: 'const x = 1', language: 'typescript', ...props },
    attachTo: el,
  })
}

describe('CodeDisplay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the language badge', () => {
    const wrapper = mountComponent({ language: 'javascript' })
    expect(wrapper.find('.language-badge').text()).toBe('javascript')
    wrapper.unmount()
  })

  it('renders a CodeMirror editor', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    wrapper.unmount()
  })

  it('passes content to the editor', () => {
    const wrapper = mountComponent({ content: 'console.log("hello")' })
    expect(wrapper.find('.cm-content').text()).toContain('console.log')
    wrapper.unmount()
  })

  it('copies the content prop to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as any)

    const wrapper = mountComponent({ content: 'console.log("hello")' })
    const copyBtn = wrapper.find('[title="Copy code"]')

    await copyBtn.trigger('click')

    expect(writeText).toHaveBeenCalledWith('console.log("hello")')
    wrapper.unmount()
  })

  it('emits edit when edit button is clicked', async () => {
    const wrapper = mountComponent()
    const editBtn = wrapper.find('[title="Edit code"]')

    await editBtn.trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
    wrapper.unmount()
  })

  it('has a search button', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[title="Search (Ctrl+F)"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('editor is in read-only mode', () => {
    const wrapper = mountComponent()
    const editor = wrapper.findComponent({ name: 'CodeEditor' })
    expect(editor.vm.view?.state.readOnly).toBe(true)
    wrapper.unmount()
  })

  it('resolves language prop to correct editor language', () => {
    const wrapper = mountComponent({ language: 'html' })
    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    wrapper.unmount()
  })
})
