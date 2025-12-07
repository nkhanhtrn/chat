<template>
  <Modal
    :visible="visible"
    title="Sign In to Sync Your Chats"
    size="small"
    @close="$emit('close')"
  >
    <div class="login-container">
      <!-- Error Message -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="your.email@example.com"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            :disabled="isLoading"
          />
        </div>

        <button
          type="submit"
          class="submit-btn"
          :disabled="isLoading"
        >
          <span v-if="!isLoading">Sign In</span>
          <span v-else>Signing in...</span>
        </button>
      </form>

      <!-- Info Text -->
      <div class="login-info">
        <p class="sync-note">
          🔒 Your data will be synced securely to Firebase and accessible across all your devices.
        </p>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref } from 'vue'
import Modal from './Modal.vue'
import { signInUser } from '../../services/auth.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'success'])

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const handleSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  try {
    const user = await signInUser(email.value, password.value)
    successMessage.value = 'Successfully signed in!'

    console.log('User authenticated:', user.email)

    // Reset form
    email.value = ''
    password.value = ''

    // Close modal after a short delay
    setTimeout(() => {
      emit('success', user)
      emit('close')
    }, 1000)

  } catch (error) {
    console.error('Authentication error:', error)

    // User-friendly error messages
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage.value = 'No account found with this email.'
        break
      case 'auth/wrong-password':
        errorMessage.value = 'Incorrect password. Please try again.'
        break
      case 'auth/invalid-email':
        errorMessage.value = 'Invalid email address format.'
        break
      case 'auth/invalid-credential':
        errorMessage.value = 'Invalid email or password.'
        break
      case 'auth/network-request-failed':
        errorMessage.value = 'Network error. Please check your internet connection.'
        break
      default:
        errorMessage.value = error.message || 'Authentication failed. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-message {
  padding: 0.75rem;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c33;
  font-size: 0.875rem;
}

.success-message {
  padding: 0.75rem;
  background: #efe;
  border: 1px solid #cfc;
  border-radius: 4px;
  color: #3a3;
  font-size: 0.875rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-strong, #333);
}

.form-group input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border-subtle, #ddd);
  border-radius: 4px;
  font-size: 0.9375rem;
  background: var(--color-bg-base, #fff);
  color: var(--color-text-base, #333);
  transition: border-color 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-accent, #2563eb);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #666);
}

.submit-btn {
  padding: 0.75rem 1rem;
  background: var(--color-accent, #2563eb);
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-accent-hover, #1d4ed8);
  transform: translateY(-1px);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border-subtle, #eee);
}

.login-info p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #666);
  text-align: center;
}

.sync-note {
  margin-top: 0.25rem;
  padding: 0.5rem;
  background: var(--color-bg-subtle, #f9f9f9);
  border-radius: 4px;
  font-size: 0.75rem !important;
}
</style>
