<template>
  <Transition name="banner-slide">
    <div v-if="visible" class="stale-data-banner">
      <div class="banner-content">
        <span class="banner-icon">&#x26A0;</span>
        <div class="banner-text">
          <strong>Data out of sync</strong>
          <span class="banner-description">
            {{ isReadOnlyMode
              ? 'The app is in read-only mode. Refresh to sync your data.'
              : 'Your data may be out of date. Please refresh to continue editing.'
            }}
          </span>
        </div>
        <div class="banner-actions">
          <button class="refresh-btn" @click="$emit('refresh')">
            Refresh Page
          </button>
          <button
            v-if="!isReadOnlyMode"
            class="dismiss-btn"
            @click="$emit('dismiss')"
            title="Continue in read-only mode"
          >
            &#x2715;
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isReadOnlyMode: {
    type: Boolean,
    default: false
  }
})

defineEmits(['refresh', 'dismiss'])
</script>

<style scoped>
.stale-data-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.banner-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.banner-text strong {
  font-weight: 600;
  font-size: 0.875rem;
}

.banner-description {
  font-size: 0.8125rem;
  opacity: 0.9;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: white;
  color: #d97706;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: #fef3c7;
}

.dismiss-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Banner slide animation */
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .banner-content {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .banner-text {
    flex-basis: calc(100% - 2.5rem);
  }

  .banner-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .banner-description {
    display: none;
  }
}
</style>
