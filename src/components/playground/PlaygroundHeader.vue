<template>
  <header class="playground-header">
    <div class="header-left">
      <span class="title">Playground</span>
    </div>

    <div class="header-center">
      <!-- Two-model mode toggle -->
      <label class="two-model-toggle">
        <input
          type="checkbox"
          :checked="twoModelMode"
          @change="$emit('update:twoModelMode', $event.target.checked)"
        />
        <span class="toggle-label">2-Model</span>
      </label>

      <!-- Model Selection -->
      <template v-if="!twoModelMode">
        <div class="single-select">
          <label class="select-label">Provider</label>
          <select
            :value="selectedProvider"
            @change="$emit('update:selectedProvider', $event.target.value)"
            class="select-control provider"
          >
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="single-select">
          <label class="select-label">Model</label>
          <select
            :value="selectedModel"
            @change="$emit('update:selectedModel', $event.target.value)"
            class="select-control model"
            :disabled="models.length === 0"
          >
            <option v-if="models.length === 0" value="">Loading...</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </template>

      <!-- Two-model selectors -->
      <template v-else>
        <div class="dual-select">
          <label class="select-label">Router</label>
          <select
            :value="routerModel"
            @change="$emit('update:routerModel', $event.target.value)"
            class="select-control model"
            :disabled="allModels.length === 0"
          >
            <option v-if="allModels.length === 0" value="">Loading...</option>
            <option v-for="m in allModels" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="dual-select">
          <label class="select-label">Executor</label>
          <select
            :value="executorModel"
            @change="$emit('update:executorModel', $event.target.value)"
            class="select-control model"
            :disabled="allModels.length === 0"
          >
            <option v-if="allModels.length === 0" value="">Loading...</option>
            <option v-for="m in allModels" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </template>
    </div>

    <div class="header-right">
      <button @click="$emit('clear')" class="clear-btn" title="Clear Chat">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
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
  'update:executorModel',
  'clear'
])
</script>

<style scoped>
.playground-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-base);
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-base);
  font-family: system-ui, -apple-system, sans-serif;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  justify-content: center;
}

.two-model-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  font-size: 0.75rem;
  transition: all 0.15s;
}

.two-model-toggle:hover {
  border-color: var(--color-border-strong);
}

.two-model-toggle input {
  cursor: pointer;
  accent-color: var(--color-primary);
}

.toggle-label {
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.select-control {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  background: var(--color-bg-input);
  color: var(--color-text-base);
  font-size: 0.8rem;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
}

.select-control:focus {
  outline: none;
  border-color: var(--color-primary);
}

.select-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select-control.provider {
  width: 120px;
}

.select-control.model {
  width: 180px;
}

.single-select,
.dual-select {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.select-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
}

.header-right {
  display: flex;
  align-items: center;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

@media (max-width: 768px) {
  .playground-header {
    flex-wrap: wrap;
    padding: 0.75rem;
  }

  .header-center {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    margin-top: 0.5rem;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .select-control.provider {
    width: 100px;
  }

  .select-control.model {
    width: 140px;
  }
}
</style>
