import { describe, it, expect, beforeEach } from 'vitest'
import { loadModule } from './helper'

describe('saveAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    window.R = undefined
    loadModule('state.js')
    loadModule('auth.js')
  })

  it('stores token, uid, refreshToken in state and localStorage', () => {
    window.R.saveAuth({
      idToken: 'token123',
      localId: 'uid456',
      refreshToken: 'refresh789',
    })
    expect(window.R.state.token).toBe('token123')
    expect(window.R.state.uid).toBe('uid456')
    expect(window.R.state.refreshToken).toBe('refresh789')
    expect(localStorage.getItem('token')).toBe('token123')
    expect(localStorage.getItem('uid')).toBe('uid456')
    expect(localStorage.getItem('refreshToken')).toBe('refresh789')
  })
})

describe('clearAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    window.R = undefined
    loadModule('state.js')
    loadModule('auth.js')
  })

  it('removes auth from state and localStorage', () => {
    window.R.saveAuth({ idToken: 't', localId: 'u', refreshToken: 'r' })
    window.R.clearAuth()
    expect(window.R.state.token).toBe(null)
    expect(window.R.state.uid).toBe(null)
    expect(window.R.state.refreshToken).toBe(null)
    expect(localStorage.getItem('token')).toBe(null)
    expect(localStorage.getItem('uid')).toBe(null)
    expect(localStorage.getItem('refreshToken')).toBe(null)
  })
})
