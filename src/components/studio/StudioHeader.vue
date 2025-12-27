<template>
  <header class="studio-header">
    <router-link to="/" class="back-link">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Home
    </router-link>
    <h1>AI Studio</h1>
    <div class="header-controls">
      <!-- Two-model mode toggle -->
      <label class="two-model-toggle">
        <input type="checkbox" :checked="twoModelMode" @change="$emit('update:twoModelMode', $event.target.checked)" />
        <span class="toggle-label">2-Model</span>
      </label>

      <!-- Single model mode -->
      <template v-if="!twoModelMode">
        <select :value="selectedProvider" @change="$emit('update:selectedProvider', $event.target.value)" class="provider-select">
          <option v-for="p in providers" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <select :value="selectedModel" @change="$emit('update:selectedModel', $event.target.value)" class="model-select" :disabled="models.length === 0">
          <option v-if="models.length === 0" value="">Loading models...</option>
          <option v-for="m in models" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
        </select>
      </template>

      <!-- Two-model mode: Router + Executor (all providers) -->
      <template v-else>
        <div class="model-pair">
          <div class="model-selector">
            <span class="model-label">Router</span>
            <select :value="routerModel" @change="$emit('update:routerModel', $event.target.value)" class="model-select small" :disabled="allModels.length === 0">
              <option v-if="allModels.length === 0" value="">Loading...</option>
              <option v-for="m in allModels" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
          </div>
          <div class="model-selector">
            <span class="model-label">Executor</span>
            <select :value="executorModel" @change="$emit('update:executorModel', $event.target.value)" class="model-select small" :disabled="allModels.length === 0">
              <option v-if="allModels.length === 0" value="">Loading...</option>
              <option v-for="m in allModels" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
          </div>
        </div>
      </template>
    </div>
  </header>
</template>

<script setup>
defineProps({
  twoModelMode: {
    type: Boolean,
    required: true
  },
  providers: {
    type: Array,
    required: true
  },
  selectedProvider: {
    type: String,
    required: true
  },
  models: {
    type: Array,
    required: true
  },
  allModels: {
    type: Array,
    required: true
  },
  selectedModel: {
    type: String,
    required: true
  },
  routerModel: {
    type: String,
    required: true
  },
  executorModel: {
    type: String,
    required: true
  }
})

defineEmits([
  'update:twoModelMode',
  'update:selectedProvider',
  'update:selectedModel',
  'update:routerModel',
  'update:executorModel'
])
</script>

<style scoped>
.studio-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--color-border-base);
  background-color: var(--color-bg-surface);
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--color-text-base);
}

.studio-header h1 {
  font-family: 'Georgia', serif;
  font-size: 1.25rem;
  font-weight: normal;
  color: var(--color-text-base);
  margin: 0;
  flex: 1;
}

.header-controls {
  display: flex;
  gap: 0.75rem;
}

.provider-select,
.model-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  cursor: pointer;
  min-width: 140px;
}

.provider-select:focus,
.model-select:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.model-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.two-model-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.two-model-toggle:hover {
  border-color: var(--color-border-strong);
}

.two-model-toggle input {
  cursor: pointer;
}

.toggle-label {
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.model-pair {
  display: flex;
  gap: 0.75rem;
}

.model-selector {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.model-label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: system-ui, sans-serif;
}

.model-select.small {
  min-width: 120px;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .studio-header {
    flex-wrap: wrap;
    padding: 1rem;
  }

  .studio-header h1 {
    order: -1;
    width: 100%;
    margin-bottom: 0.75rem;
  }

  .header-controls {
    flex: 1;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .provider-select,
  .model-select {
    min-width: 100px;
    font-size: 0.85rem;
  }

  .two-model-toggle {
    padding: 0.3rem 0.5rem;
  }

  .model-pair {
    flex-direction: column;
    gap: 0.4rem;
  }

  .model-selector {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .model-select.small {
    min-width: 100px;
    flex: 1;
  }
}
</style>
