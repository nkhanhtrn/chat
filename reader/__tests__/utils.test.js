import { describe, it, expect, beforeEach } from 'vitest'
import { loadCore } from './helper'

describe('escapeHtml', () => {
  it('escapes HTML special chars', () => {
    const { escapeHtml } = loadCore()
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    )
  })

  it('returns empty string for falsy input', () => {
    const { escapeHtml } = loadCore()
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('coerces non-strings', () => {
    const { escapeHtml } = loadCore()
    expect(escapeHtml(42)).toBe('42')
  })
})

describe('unwrap', () => {
  it('unwraps stringValue', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ stringValue: 'hello' })).toBe('hello')
  })

  it('unwraps integerValue', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ integerValue: '42' })).toBe(42)
  })

  it('unwraps doubleValue', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ doubleValue: 3.14 })).toBe(3.14)
  })

  it('unwraps booleanValue', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ booleanValue: true })).toBe(true)
  })

  it('unwraps nullValue', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ nullValue: null })).toBe(null)
  })

  it('unwraps arrayValue', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] } })).toEqual(['a', 'b'])
  })

  it('unwraps mapValue recursively', () => {
    const { unwrap } = loadCore()
    expect(unwrap({ mapValue: { fields: {
      title: { stringValue: 'My Book' },
      pages: { integerValue: '300' },
    } } })).toEqual({ title: 'My Book', pages: 300 })
  })

  it('returns null for falsy input', () => {
    const { unwrap } = loadCore()
    expect(unwrap(null)).toBe(null)
  })
})
