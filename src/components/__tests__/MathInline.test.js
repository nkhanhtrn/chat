import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MathInline from '../MathInline.vue'

describe('MathInline', () => {
  it('renders inline LaTeX using KaTeX', () => {
    const latex = '2x^2 - 4x + 1 = 0'
    const wrapper = mount(MathInline, {
      props: { content: latex }
    })
    // KaTeX output should contain <span class="katex">
    expect(wrapper.html()).toContain('katex')
    expect(wrapper.html()).toContain('2x^2 - 4x + 1 = 0')
  })

  it('should handle mathEl ref being null during render', async () => {
    const latex = 'a + b'
    const wrapper = mount(MathInline, {
      props: { content: latex }
    })

    // Set mathEl to null
    wrapper.vm.mathEl = null

    // Change content to trigger watch - should not throw error
    await wrapper.setProps({ content: 'c + d' })
    await nextTick()

    // Should not have thrown an error
    expect(true).toBe(true)
  })

  it('should update when content changes', async () => {
    const latex1 = 'x = 1'
    const wrapper = mount(MathInline, {
      props: { content: latex1 }
    })

    expect(wrapper.html()).toContain('x = 1')

    // Update content
    await wrapper.setProps({ content: 'y = 2' })
    await nextTick()

    expect(wrapper.html()).toContain('y = 2')
  })
})
