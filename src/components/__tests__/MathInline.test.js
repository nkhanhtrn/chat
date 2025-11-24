import { mount } from '@vue/test-utils'
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
})
