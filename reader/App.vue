<template>
  <div v-if="!authReady" class="login-screen">
    <p class="login-sub">Loading…</p>
  </div>
  <div v-else-if="!user" class="login-screen">
    <form class="login-form" @submit.prevent="handleLogin">
      <h1>Reader</h1>
      <p class="login-sub">Sign in to access your library</p>
      <input
        v-model="email"
        type="email"
        placeholder="Email"
        required
        autocomplete="email"
      />
      <input
        v-model="password"
        type="password"
        placeholder="Password"
        required
        autocomplete="current-password"
      />
      <button type="submit" :disabled="busy">
        {{ busy ? 'Signing in…' : 'Sign in' }}
      </button>
      <p v-if="error" class="login-error">{{ error }}</p>
    </form>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onAuthChange, signInUser } from '@/services/auth'
import type { User } from 'firebase/auth'

const user = ref<User | null>(null)
const authReady = ref(false)
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
let unsub: (() => void) | null = null

onMounted(() => {
  try {
    unsub = onAuthChange((u) => {
      user.value = u
      authReady.value = true
    })
  } catch {
    // Firebase not initialized (e.g. missing config) — show login gracefully
    authReady.value = true
  }
})

onUnmounted(() => {
  unsub?.()
})

async function handleLogin(): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    await signInUser(email.value, password.value)
  } catch (err) {
    error.value = (err as Error).message || 'Sign in failed'
    busy.value = false
  }
}
</script>
