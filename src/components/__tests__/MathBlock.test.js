import { mount } from '@vue/test-utils'
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
})
