import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeEditor from '../CodeEditor.vue'

function mountComponent(props = {}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return mount(CodeEditor, {
    props: { modelValue: 'const x = 1', ...props },
    attachTo: el,
  })
}

describe('CodeEditor', () => {
  it('mounts and creates a CodeMirror editor', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.cm-editor-wrap').exists()).toBe(true)
    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays the initial modelValue', () => {
    const wrapper = mountComponent({ modelValue: 'hello world' })
    const content = wrapper.find('.cm-content')
    expect(content.text()).toContain('hello world')
    wrapper.unmount()
  })

  it('emits update:modelValue when content changes', async () => {
    const wrapper = mountComponent({ modelValue: '' })
    const view = wrapper.vm.view
    if (view) {
      view.dispatch({ changes: { from: 0, to: 0, insert: 'new code' } })
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      const lastEmit = wrapper.emitted('update:modelValue')!.pop()!
      expect(lastEmit[0]).toContain('new code')
    }
    wrapper.unmount()
  })

  it('updates content when modelValue prop changes', async () => {
    const wrapper = mountComponent({ modelValue: 'old' })
    await wrapper.setProps({ modelValue: 'new content' })
    const content = wrapper.find('.cm-content')
    expect(content.text()).toContain('new content')
    wrapper.unmount()
  })

  it('applies read-only state to editor', () => {
    const wrapper = mountComponent({ readOnly: true })
    const view = wrapper.vm.view
    expect(view?.state.readOnly).toBe(true)
    wrapper.unmount()
  })

  it('renders line numbers', () => {
    const wrapper = mountComponent({ modelValue: 'line1\nline2\nline3' })
    const gutters = wrapper.findAll('.cm-gutters .cm-gutterElement')
    expect(gutters.length).toBeGreaterThanOrEqual(4)
    wrapper.unmount()
  })

  it('renders fold gutter', () => {
    const wrapper = mountComponent({ modelValue: '<div>\n  <span>hi</span>\n</div>' })
    const foldGutter = wrapper.find('.cm-foldGutter')
    expect(foldGutter.exists()).toBe(true)
    wrapper.unmount()
  })

  it('exposes openSearch method', () => {
    const wrapper = mountComponent()
    expect(typeof wrapper.vm.openSearch).toBe('function')
    wrapper.unmount()
  })

  it('exposes setSearch, findNext, findPrev, getMatchCount methods', () => {
    const wrapper = mountComponent()
    expect(typeof wrapper.vm.setSearch).toBe('function')
    expect(typeof wrapper.vm.findNext).toBe('function')
    expect(typeof wrapper.vm.findPrev).toBe('function')
    expect(typeof wrapper.vm.getMatchCount).toBe('function')
    wrapper.unmount()
  })

  it('creates a valid EditorView', () => {
    const wrapper = mountComponent()
    const view = wrapper.vm.view
    expect(view).toBeTruthy()
    expect(view?.state.doc.toString()).toBe('const x = 1')
    wrapper.unmount()
  })
})
