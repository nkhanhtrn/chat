<template>
  <div class="api-key-section">
    <div class="api-key-input-wrapper">
      <button
        class="nav-btn"
        :disabled="currentIndex === 0"
        @click="currentIndex--"
        title="Previous key"
      >
        &lt;
      </button>
      <input
        type="password"
        :value="keys[currentIndex]"
        :placeholder="`API key ${currentIndex + 1}`"
        class="api-key-input"
        @input="updateKey(currentIndex, $event.target.value)"
      />
      <button
        v-if="currentIndex < keys.length - 1"
        class="nav-btn"
        @click="currentIndex++"
        title="Next key"
      >
        &gt;
      </button>
      <button
        v-else
        class="add-key-btn"
        :disabled="!keys[currentIndex]?.trim()"
        @click="addKey"
        title="Add another API key"
      >
        +
      </button>
    </div>
    <div class="api-key-hint">
      <span class="key-counter">{{ currentIndex + 1 }}/{{ keys.length }}</span>
      <span class="hint-separator">|</span>
      <a :href="helpUrl" target="_blank" rel="noopener">Get API key</a>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => ['']
  },
  helpUrl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const keys = ref([...props.modelValue])
const currentIndex = ref(0)

watch(() => props.modelValue, (newVal) => {
  keys.value = [...newVal]
  if (currentIndex.value >= keys.value.length) {
    currentIndex.value = Math.max(0, keys.value.length - 1)
  }
}, { deep: true })

const updateKey = (index, value) => {
  keys.value[index] = value
  emit('update:modelValue', [...keys.value])
}

const addKey = () => {
  keys.value.push('')
  currentIndex.value = keys.value.length - 1
  emit('update:modelValue', [...keys.value])
}
</script>

<style scoped>
.api-key-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.api-key-input-wrapper {
  display: flex;
  gap: 0.5rem;
}

.api-key-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-base);
  font-size: 0.9rem;
  font-family: monospace;
}

.api-key-input:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.api-key-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.api-key-hint a {
  color: var(--color-text-link, #0066cc);
  text-decoration: none;
}

.api-key-hint a:hover {
  text-decoration: underline;
}

.hint-separator {
  margin: 0 0.5rem;
  color: var(--color-text-muted);
}

.key-counter {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-family: monospace;
}

.nav-btn,
.add-key-btn {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
  transition: all 0.15s ease;
}

.nav-btn:hover:not(:disabled),
.add-key-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-base);
}

.nav-btn:disabled,
.add-key-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.add-key-btn:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #166534;
  color: #166534;
}
</style>
