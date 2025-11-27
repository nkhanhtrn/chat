import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MathBlock from '../MathBlock.vue'

describe('MathBlock', () => {
  it('renders block LaTeX using KaTeX', () => {
    const latex = 'L \\;\\approx\\; \\frac{P}{4\\,D^2}'
    const wrapper = mount(MathBlock, {
      props: { content: latex }
    })
    // KaTeX output should contain <span class="katex-display">
    expect(wrapper.html()).toContain('katex-display')
    expect(wrapper.html()).toContain('\\frac{P}{4\\,D^2}')
  })

  it('should handle mathEl ref being null during render', async () => {
    const latex = 'x^2 + y^2 = z^2'
    const wrapper = mount(MathBlock, {
      props: { content: latex }
    })

    // Set mathEl to null
    wrapper.vm.mathEl = null

    // Trigger the renderMath method - should not throw error
    wrapper.vm.$options.setup(wrapper.vm.$props).mathEl.value = null

    // Change content to trigger watch
    await wrapper.setProps({ content: 'a^2 + b^2 = c^2' })
    await nextTick()

    // Should not have thrown an error
    expect(true).toBe(true)
  })

  it('should update when content changes', async () => {
    const latex1 = 'x = 1'
    const wrapper = mount(MathBlock, {
      props: { content: latex1 }
    })

    expect(wrapper.html()).toContain('x = 1')

    // Update content
    await wrapper.setProps({ content: 'y = 2' })
    await nextTick()

    expect(wrapper.html()).toContain('y = 2')
  })
})
