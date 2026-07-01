import { describe, it, expect, beforeEach } from 'vitest'
import { loadApi } from './helper'

describe('saveAuth', () => {
  beforeEach(() => localStorage.clear())

  it('stores token and uid in state and localStorage', () => {
    const { saveAuth, state } = loadApi()
    saveAuth({ idToken: 'tok', localId: 'uid1' })
    expect(state.token).toBe('tok')
    expect(state.uid).toBe('uid1')
    expect(localStorage.getItem('token')).toBe('tok')
    expect(localStorage.getItem('uid')).toBe('uid1')
  })
})

describe('clearAuth', () => {
  beforeEach(() => localStorage.clear())

  it('removes auth from state and localStorage', () => {
    const { saveAuth, clearAuth, state } = loadApi()
    saveAuth({ idToken: 'tok', localId: 'uid1' })
    clearAuth()
    expect(state.token).toBe(null)
    expect(localStorage.getItem('token')).toBe(null)
  })
})
