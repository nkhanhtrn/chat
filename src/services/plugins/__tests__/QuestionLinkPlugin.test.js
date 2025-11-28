globalThis.escapeHtml = (str) => `[escaped]${str}`

import { QuestionLinkPlugin } from '../QuestionLinkPlugin.js'

describe('QuestionLinkPlugin', () => {

  const mockEscapeHtml = (str) => `[escaped]${str}`

  describe('extract', () => {
    it('extracts and replaces question link text with placeholder', () => {
      const text = 'See Q1 for details.'
      const item = { startOffset: 4, endOffset: 6, id: 'q1', childIndex: 2 }
      const result = QuestionLinkPlugin.extract(text, item)
      expect(result.processed).toBe('See QUESTION_LINK_q1 for details.')
      expect(result.placeholder).toEqual({
        id: 'QUESTION_LINK_q1',
        type: 'question-link',
        text: 'Q1',
        childIndex: 2,
        originalId: 'q1'
      })
    })
  })

  // Removed empty render describe block
})
