<template>
  <button
    :class="['btn', `btn-${variant}`, { 'btn-loading': loading }]"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="!loading" class="btn-content">
      <slot></slot>
    </span>
    <span v-else class="spinner"></span>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'tertiary' | 'type-4' | 'danger' | 'ghost' | 'icon' | 'nav'
  disabled?: boolean
  loading?: boolean
}>(), {
  variant: 'primary',
  disabled: false,
  loading: false,
})
</script>

<style scoped>
.btn {
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  outline: none;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, var(--color-primary-gradient-start) 0%, var(--color-primary-gradient-end) 100%);
  color: var(--color-text-inverse);
  border-radius: 4px;
  font-size: 0.95rem;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary.btn-loading { background: var(--color-primary); }

.btn-secondary {
  padding: 0.25rem 0.9rem;
  background: var(--color-bg-button);
  border: 1px solid var(--color-border-button);
  color: var(--color-text-code);
  border-radius: 4px;
  font-weight: normal;
}
.btn-secondary:hover:not(:disabled) { background: var(--color-bg-button-hover); border-color: var(--color-border-button-hover); }
.btn-secondary:active:not(:disabled) { background: var(--color-bg-button-active); border-color: var(--color-border-button-active); }

.btn-tertiary {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  border-radius: 4px;
  font-weight: normal;
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', serif;
  font-size: 0.95rem;
}
.btn-tertiary:hover:not(:disabled) { background: var(--color-bg-button-hover); color: var(--color-text-on-accent); }
.btn-tertiary:active:not(:disabled) { background: var(--color-bg-button-active); }

.btn-type-4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.btn-type-4:hover:not(:disabled) { background-color: var(--color-bg-hover); color: var(--color-text-secondary); }
.btn-type-4 svg { flex-shrink: 0; }

.btn-danger {
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  color: var(--color-text-muted);
  border-radius: 4px;
  font-weight: normal;
  font-size: 1.5rem;
  line-height: 1;
}
.btn-danger:hover:not(:disabled) { background: var(--color-error-bg); color: var(--color-error-text); }

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: var(--color-text-inverse);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
