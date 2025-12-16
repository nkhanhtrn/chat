<template>
  <button
    class="speaker-btn"
    :class="{ speaking: isSpeaking, [size]: true }"
    @click="speak"
    :disabled="!text || isSpeaking"
    :title="isSpeaking ? 'Speaking...' : 'Pronounce'"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    </svg>
  </button>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  }
})

const isSpeaking = ref(false)
let currentAudio = null

const iconSize = computed(() => {
  switch (props.size) {
    case 'small': return 14
    case 'large': return 22
    default: return 18
  }
})

function stop() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  isSpeaking.value = false
}

function speak() {
  if (!props.text || isSpeaking.value) return

  stop()
  isSpeaking.value = true

  // Use Web Speech API (built-in, free, reliable)
  if (!window.speechSynthesis) {
    console.error('Web Speech API not supported')
    isSpeaking.value = false
    return
  }

  const utterance = new SpeechSynthesisUtterance(props.text)
  utterance.rate = 0.9

  // Try to select a good English voice
  const voices = window.speechSynthesis.getVoices()
  const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                       voices.find(v => v.lang.startsWith('en'))
  if (englishVoice) {
    utterance.voice = englishVoice
  }

  utterance.onend = () => {
    isSpeaking.value = false
  }
  utterance.onerror = () => {
    isSpeaking.value = false
  }

  window.speechSynthesis.speak(utterance)
}

// Expose stop method for parent components
defineExpose({ stop })

// Cleanup on unmount
onBeforeUnmount(() => {
  stop()
})
</script>

<style scoped>
.speaker-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted, #666);
  transition: all 0.15s ease;
}

.speaker-btn.small {
  width: 24px;
  height: 24px;
}

.speaker-btn.medium {
  width: 28px;
  height: 28px;
}

.speaker-btn.large {
  width: 32px;
  height: 32px;
}

.speaker-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f5f5f5);
  color: var(--color-text-strong, #333);
}

.speaker-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.speaker-btn.speaking {
  color: var(--color-primary, #007bff);
}

.speaker-btn.speaking svg {
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
