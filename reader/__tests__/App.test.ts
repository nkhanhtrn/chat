import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { onAuthChange, signInUser } from '@/services/auth'
import App from '../App.vue'

describe('App (reader)', () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  function mountApp(callback: ((cb: (u: unknown) => void) => void) | null) {
    if (callback) {
      vi.mocked(onAuthChange).mockImplementation((cb) => {
        callback(cb as (u: unknown) => void)
        return () => {}
      })
    } else {
      // Auth never resolves → loading state persists
      vi.mocked(onAuthChange).mockImplementation(() => () => {})
    }
    wrapper = mount(App, { global: { stubs: { RouterView: true } } })
  }

  it('shows a loading state before auth resolves', () => {
    mountApp(null)
    expect(wrapper.text()).toContain('Loading')
  })

  it('shows the login form when auth resolves with no user', async () => {
    mountApp((cb) => cb(null))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.login-form').exists()).toBe(true)
  })

  it('renders router-view when the user is authenticated', async () => {
    mountApp((cb) => cb({ uid: 'u1' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent({ name: 'RouterView' }).exists()).toBe(true)
  })

  it('calls signInUser with the entered credentials on submit', async () => {
    mountApp((cb) => cb(null))
    await wrapper.vm.$nextTick()

    await wrapper.find('input[type="email"]').setValue('a@b.com')
    await wrapper.find('input[type="password"]').setValue('pw')
    await wrapper.find('form').trigger('submit.prevent')

    expect(signInUser).toHaveBeenCalledWith('a@b.com', 'pw')
  })
})
