<template>
  <div class="progress-overlay">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>
    <span class="progress-status">{{ status }}</span>
    <span class="progress-percent">{{ progress }}%</span>
  </div>
</template>

<script setup>
defineProps({
  progress: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.progress-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: white;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-status {
  font-size: 0.875rem;
  text-align: center;
}

.progress-percent {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-primary);
}

/* Dark overlay variant (for use on top of images) */
.progress-overlay.is-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
}

.progress-overlay.is-overlay .progress-bar {
  width: 80%;
  height: 6px;
}

.progress-overlay.is-overlay .progress-percent {
  font-size: 1rem;
}

/* Full screen variant (for page-level loading) */
.progress-overlay.is-fullscreen {
  height: 100%;
  padding: 2rem;
}

.progress-overlay.is-fullscreen .progress-bar {
  width: 300px;
  height: 8px;
}

.progress-overlay.is-fullscreen .progress-percent {
  font-size: 1.5rem;
}
</style>
