import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginModal from '../LoginModal.vue'
import Modal from '../Modal.vue'
import * as auth from '../../services/auth.js'

// Mock auth module
vi.mock('../../services/auth.js', () => ({
  signInUser: vi.fn()
}))

describe('LoginModal', () => {
  const mockUser = {
    uid: 'user123',
    email: 'test@example.com'
  }

  const mountComponent = (props = {}) => {
    return mount(LoginModal, {
      props: {
        visible: true,
        ...props
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders when visible is true', () => {
      const wrapper = mountComponent()

      expect(wrapper.find('.login-container').exists()).toBe(true)
    })

    it('does not render when visible is false', () => {
      const wrapper = mountComponent({ visible: false })

      expect(wrapper.find('.login-container').exists()).toBe(false)
    })

    it('displays email input field', () => {
      const wrapper = mountComponent()

      const emailInput = wrapper.find('input[type="email"]')
      expect(emailInput.exists()).toBe(true)
      expect(emailInput.attributes('placeholder')).toContain('email')
    })

    it('displays password input field', () => {
      const wrapper = mountComponent()

      const passwordInput = wrapper.find('input[type="password"]')
      expect(passwordInput.exists()).toBe(true)
    })

    it('displays sign in button', () => {
      const wrapper = mountComponent()

      const submitBtn = wrapper.find('.submit-btn')
      expect(submitBtn.exists()).toBe(true)
      expect(submitBtn.text()).toBe('Sign In')
    })

    it('displays sync note', () => {
      const wrapper = mountComponent()

      expect(wrapper.find('.sync-note').text()).toContain('synced securely')
    })

    it('has correct modal title', () => {
      const wrapper = mountComponent()

      const modal = wrapper.findComponent(Modal)
      expect(modal.props('title')).toBe('Sign In to Sync Your Chats')
    })
  })

  describe('form interaction', () => {
    it('updates email value on input', async () => {
      const wrapper = mountComponent()

      const emailInput = wrapper.find('input[type="email"]')
      await emailInput.setValue('test@example.com')

      expect(emailInput.element.value).toBe('test@example.com')
    })

    it('updates password value on input', async () => {
      const wrapper = mountComponent()

      const passwordInput = wrapper.find('input[type="password"]')
      await passwordInput.setValue('password123')

      expect(passwordInput.element.value).toBe('password123')
    })

    it('disables inputs while loading', async () => {
      vi.mocked(auth.signInUser).mockImplementation(() => new Promise(() => {})) // Never resolves

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('input[type="email"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('input[type="password"]').attributes('disabled')).toBeDefined()
    })

    it('disables submit button while loading', async () => {
      vi.mocked(auth.signInUser).mockImplementation(() => new Promise(() => {}))

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('.submit-btn').attributes('disabled')).toBeDefined()
    })

    it('shows loading text while signing in', async () => {
      vi.mocked(auth.signInUser).mockImplementation(() => new Promise(() => {}))

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('.submit-btn').text()).toBe('Signing in...')
    })
  })

  describe('successful sign in', () => {
    it('calls signInUser with email and password', async () => {
      vi.mocked(auth.signInUser).mockResolvedValue(mockUser)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(auth.signInUser).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('displays success message on successful sign in', async () => {
      vi.mocked(auth.signInUser).mockResolvedValue(mockUser)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.success-message').exists()).toBe(true)
      expect(wrapper.find('.success-message').text()).toContain('Successfully signed in')
    })

    it('clears form fields on successful sign in', async () => {
      vi.mocked(auth.signInUser).mockResolvedValue(mockUser)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('input[type="email"]').element.value).toBe('')
      expect(wrapper.find('input[type="password"]').element.value).toBe('')
    })

    it('emits success event with user after delay', async () => {
      vi.mocked(auth.signInUser).mockResolvedValue(mockUser)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      vi.advanceTimersByTime(1000)

      expect(wrapper.emitted('success')).toBeTruthy()
      expect(wrapper.emitted('success')[0]).toEqual([mockUser])
    })

    it('emits close event after delay', async () => {
      vi.mocked(auth.signInUser).mockResolvedValue(mockUser)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      vi.advanceTimersByTime(1000)

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('error handling', () => {
    it('displays error for user not found', async () => {
      const error = new Error('User not found')
      error.code = 'auth/user-not-found'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('unknown@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toContain('No account found')
    })

    it('displays error for wrong password', async () => {
      const error = new Error('Wrong password')
      error.code = 'auth/wrong-password'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('wrongpassword')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').text()).toContain('Incorrect password')
    })

    it('displays error for invalid email', async () => {
      const error = new Error('Invalid email')
      error.code = 'auth/invalid-email'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('invalid-email')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').text()).toContain('Invalid email')
    })

    it('displays error for invalid credentials', async () => {
      const error = new Error('Invalid credentials')
      error.code = 'auth/invalid-credential'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').text()).toContain('Invalid email or password')
    })

    it('displays error for network failure', async () => {
      const error = new Error('Network error')
      error.code = 'auth/network-request-failed'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').text()).toContain('Network error')
    })

    it('displays generic error for unknown error code', async () => {
      const error = new Error('Unknown error occurred')
      error.code = 'auth/unknown-error'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').text()).toContain('Unknown error occurred')
    })

    it('clears error message on new submission', async () => {
      const error = new Error('First error')
      error.code = 'auth/wrong-password'
      vi.mocked(auth.signInUser).mockRejectedValueOnce(error)
      vi.mocked(auth.signInUser).mockResolvedValueOnce(mockUser)

      const wrapper = mountComponent()

      // First attempt - fails
      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('wrongpassword')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)

      // Second attempt
      await wrapper.find('input[type="password"]').setValue('correctpassword')
      await wrapper.find('form').trigger('submit')

      // Error should be cleared immediately on submit
      expect(wrapper.find('.error-message').exists()).toBe(false)
    })

    it('re-enables inputs after error', async () => {
      const error = new Error('Error')
      error.code = 'auth/wrong-password'
      vi.mocked(auth.signInUser).mockRejectedValue(error)

      const wrapper = mountComponent()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(wrapper.find('input[type="email"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('input[type="password"]').attributes('disabled')).toBeUndefined()
    })
  })

  describe('modal events', () => {
    it('emits close event when modal is closed', async () => {
      const wrapper = mountComponent()

      const modal = wrapper.findComponent(Modal)
      await modal.vm.$emit('close')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })
})
