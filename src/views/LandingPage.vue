<template>
  <AppLayout storage-key="landing-layout">
    <SlideTransition appear direction="vertical">
      <div class="landing-page">
      <div class="landing-content">
        <h1>Study Assistant</h1>
        <p class="tagline">Your personal learning companion</p>

        <div class="quick-actions">
          <router-link to="/notebooks" class="action-card">
            <div class="action-icon">📓</div>
            <div class="action-text">
              <h3>Notebooks</h3>
              <p>Browse and manage your notebooks</p>
            </div>
          </router-link>

          <router-link to="/studio" class="action-card">
            <div class="action-icon">🛠️</div>
            <div class="action-text">
              <h3>Studio</h3>
              <p>Build with AI assistance</p>
            </div>
          </router-link>

          <router-link to="/playground" class="action-card">
            <div class="action-icon">💬</div>
            <div class="action-text">
              <h3>Playground</h3>
              <p>Chat freely with AI</p>
            </div>
          </router-link>

          <router-link to="/calendar" class="action-card">
            <div class="action-icon">📅</div>
            <div class="action-text">
              <h3>Calendar</h3>
              <p>View activity history</p>
            </div>
          </router-link>
        </div>
      </div>
      </div>
    </SlideTransition>
  </AppLayout>
</template>

<script setup>
import AppLayout from '../components/AppLayout.vue'
import SlideTransition from '../components/SlideTransition.vue'
</script>

<style scoped>
.landing-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  padding: 2rem;
}

.landing-content {
  text-align: center;
  max-width: 800px;
}

h1 {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 3rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0 0 0.5rem;
}

.tagline {
  font-size: 1.25rem;
  color: var(--color-text-muted);
  margin: 0 0 3rem;
  font-style: italic;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.2s;
}

.action-card:hover {
  border-color: var(--color-border-accent);
  box-shadow: 0 4px 12px var(--shadow-primary);
  transform: translateY(-2px);
}

.action-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.action-text {
  text-align: left;
}

.action-text h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-base);
  margin: 0 0 0.25rem;
}

.action-text p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }

  .tagline {
    font-size: 1rem;
    margin-bottom: 2rem;
  }

  .quick-actions {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .action-card {
    padding: 1rem;
  }

  .action-icon {
    font-size: 2rem;
  }
}
</style>
