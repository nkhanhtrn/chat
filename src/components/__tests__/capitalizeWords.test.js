import { describe, it, expect } from 'vitest'

import { capitalizeWords } from '../utils.js'

describe('capitalizeWords', () => {
  it('capitalizes the first letter of each word', () => {
    expect(capitalizeWords('hello world')).toBe('Hello World')
    expect(capitalizeWords('multiple words here')).toBe('Multiple Words Here')
    expect(capitalizeWords('already Capitalized')).toBe('Already Capitalized')
    expect(capitalizeWords('tEST cASE')).toBe('TEST CASE')
  })

  it('returns empty string for falsy input', () => {
    expect(capitalizeWords('')).toBe('')
    expect(capitalizeWords(null)).toBe('')
    expect(capitalizeWords(undefined)).toBe('')
  })

  it('handles single word', () => {
    expect(capitalizeWords('word')).toBe('Word')
    expect(capitalizeWords('WORD')).toBe('WORD')
  })

  it('handles extra spaces', () => {
    expect(capitalizeWords('  hello   world  ')).toBe('  Hello   World  ')
  })
})
