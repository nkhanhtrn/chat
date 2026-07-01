import { describe, it, expect, beforeEach } from 'vitest'
import { loadModule } from './helper'

describe('escapeHtml', () => {
  beforeEach(() => { window.R = undefined })

  it('escapes HTML special chars', () => {
    loadModule('utils.js')
    expect(window.R.escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    )
  })

  it('returns empty string for falsy input', () => {
    loadModule('utils.js')
    expect(window.R.escapeHtml('')).toBe('')
    expect(window.R.escapeHtml(null)).toBe('')
    expect(window.R.escapeHtml(undefined)).toBe('')
  })

  it('returns non-string coerced to string', () => {
    loadModule('utils.js')
    expect(window.R.escapeHtml(42)).toBe('42')
  })
})

describe('unwrap', () => {
  beforeEach(() => { window.R = undefined })

  it('unwraps stringValue', () => {
    loadModule('utils.js')
    expect(window.R.unwrap({ stringValue: 'hello' })).toBe('hello')
  })

  it('unwraps integerValue', () => {
    loadModule('utils.js')
    expect(window.R.unwrap({ integerValue: '42' })).toBe(42)
  })

  it('unwraps doubleValue', () => {
    loadModule('utils.js')
    expect(window.R.unwrap({ doubleValue: 3.14 })).toBe(3.14)
  })

  it('unwraps booleanValue', () => {
    loadModule('utils.js')
    expect(window.R.unwrap({ booleanValue: true })).toBe(true)
    expect(window.R.unwrap({ booleanValue: false })).toBe(false)
  })

  it('unwraps nullValue', () => {
    loadModule('utils.js')
    expect(window.R.unwrap({ nullValue: null })).toBe(null)
  })

  it('unwraps timestampValue', () => {
    loadModule('utils.js')
    expect(window.R.unwrap({ timestampValue: '2024-01-01T00:00:00Z' })).toBe('2024-01-01T00:00:00Z')
  })

  it('unwraps arrayValue', () => {
    loadModule('utils.js')
    const result = window.R.unwrap({
      arrayValue: {
        values: [
          { stringValue: 'a' },
          { stringValue: 'b' },
        ]
      }
    })
    expect(result).toEqual(['a', 'b'])
  })

  it('unwraps mapValue recursively', () => {
    loadModule('utils.js')
    const result = window.R.unwrap({
      mapValue: {
        fields: {
          title: { stringValue: 'My Book' },
          pages: { integerValue: '300' },
        }
      }
    })
    expect(result).toEqual({ title: 'My Book', pages: 300 })
  })

  it('returns null for falsy input', () => {
    loadModule('utils.js')
    expect(window.R.unwrap(null)).toBe(null)
    expect(window.R.unwrap(undefined)).toBe(null)
  })
})
