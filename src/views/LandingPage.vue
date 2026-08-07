<template>
  <AppLayout storage-key="sidebar">
    <SlideTransition appear direction="vertical">
      <div class="landing-page">
        <div class="landing-content">
          <h1>Study Assistant</h1>
          <p class="tagline">Your personal learning companion</p>
          <div v-if="!currentUser" class="login-prompt">
            <span class="login-text">Sign in to sync your data</span>
            <button class="login-btn" @click="showLoginModal = true">Sign In</button>
          </div>
          <div v-else class="user-info"><span class="user-email">{{ currentUser.email }}</span></div>
          <div class="quick-actions">
            <router-link to="/notebooks" class="action-card">
              <div class="action-icon">📓</div>
              <div class="action-text"><h3>Notebooks</h3><p>learn from AI</p></div>
            </router-link>
            <router-link to="/books" class="action-card">
              <div class="action-icon">📚</div>
              <div class="action-text"><h3>Books</h3><p>expand your minds</p></div>
            </router-link>
            <router-link to="/papers" class="action-card">
              <div class="action-icon">📄</div>
              <div class="action-text"><h3>Research Papers</h3><p>read & annotate</p></div>
            </router-link>
            <router-link to="/sketchpad" class="action-card">
              <div class="action-icon">✏️</div>
              <div class="action-text"><h3>Sketchpad</h3><p>draw & sketch</p></div>
            </router-link>
            <router-link to="/projects" class="action-card">
              <div class="action-icon">🛠️</div>
              <div class="action-text"><h3>Projects</h3><p>build & experiment</p></div>
            </router-link>
          </div>
        </div>
      </div>
    </SlideTransition>
    <LoginModal :visible="showLoginModal" @close="showLoginModal = false" @success="showLoginModal = false" />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import LoginModal from '@/components/modal/LoginModal.vue'
import { onAuthChange } from '@/services/auth'

const showLoginModal = ref(false)
const currentUser = ref<{ email: string } | null>(null)
let unsubscribeAuth: (() => void) | null = null

onMounted(() => { unsubscribeAuth = onAuthChange((user) => { currentUser.value = user as { email: string } | null }) })
onUnmounted(() => { unsubscribeAuth?.() })
</script>

<style scoped>
.landing-page { height: 100%; display: flex; align-items: center; justify-content: center; background: var(--color-bg-page); padding: 2rem; }
.landing-content { text-align: center; max-width: 800px; }
h1 { font-family: Georgia, serif; font-size: 3rem; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.5rem; }
.tagline { font-size: 1.25rem; color: var(--color-text-muted); margin: 0 0 1.5rem; font-style: italic; }
.login-prompt { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 2rem; }
.login-btn { padding: 0.5rem 1rem; background: var(--color-primary); border: none; border-radius: 6px; color: white; cursor: pointer; }
.user-email { font-size: 0.9rem; color: var(--color-text-muted); }
.quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.action-card { display: flex; align-items: center; gap: 1rem; padding: 1.5rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 12px; text-decoration: none; transition: all 0.2s; }
.action-card:hover { border-color: var(--color-border-accent); box-shadow: 0 4px 12px var(--shadow-primary); transform: translateY(-2px); }
.action-icon { font-size: 2.5rem; flex-shrink: 0; }
.action-text { text-align: left; }
.action-text h3 { font-size: 1.1rem; font-weight: 600; color: var(--color-text-base); margin: 0 0 0.25rem; }
.action-text p { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }
@media (max-width: 768px) { h1 { font-size: 2rem; } .quick-actions { grid-template-columns: 1fr; } }
</style>
