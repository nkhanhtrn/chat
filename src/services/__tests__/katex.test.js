import { renderKatex } from '../katex'

describe('renderKatex', () => {
  it('renders inline math', () => {
    const html = renderKatex('2x^2 - 4x + 1 = 0')
    expect(html).toContain('katex')
    expect(html).toContain('2x^2')
  })

  it('renders block math', () => {
    const html = renderKatex('L \\;\\approx\\; \\frac{P}{4\\,D^2}', true)
    expect(html).toContain('katex-display')
    expect(html).toContain('\\frac{P}{4\\,D^2}')
  })

  it('handles invalid latex gracefully', () => {
    const html = renderKatex('\\notacommand')
    expect(html).toContain('katex')
    expect(html).toContain('notacommand')
  })
})
