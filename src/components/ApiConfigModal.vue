<template>
  <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal" @click.stop>
      <button @click="handleClose" class="modal-close-btn">×</button>
      <h2>LM Studio Server Configuration</h2>
      <p>This app connects to LM Studio running locally on your machine. LM Studio provides an OpenAI-compatible API server for running local language models.</p>
      <p><strong>Setup:</strong> Start LM Studio → Load a model → Enable the local server</p>
      <p>Enter your LM Studio server details:</p>
      <div class="modal-form">
        <div class="form-group">
          <label for="hostname">Hostname:</label>
          <input 
            id="hostname"
            v-model="localHostname" 
            type="text" 
            placeholder="localhost"
            @keydown.enter="handleSave"
          />
        </div>
        <div class="form-group">
          <label for="port">Port:</label>
          <input 
            id="port"
            v-model="localPort" 
            type="text" 
            placeholder="1234"
            @keydown.enter="handleSave"
          />
        </div>
        <button @click="handleSave" class="modal-btn">Save</button>
      </div>
      <div class="modal-footer">
        Made by <a href="https://github.com/nkhanhtrn" target="_blank" rel="noopener noreferrer">@nkhanhtrn</a> with <span class="heart">❤</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted } from 'vue'

export default {
  name: 'ApiConfigModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    hostname: {
      type: String,
      default: ''
    },
    port: {
      type: String,
      default: ''
    }
  },
  emits: ['save', 'close'],
  setup(props, { emit }) {
    const localHostname = ref(props.hostname)
    const localPort = ref(props.port)

    watch(() => props.hostname, (newVal) => {
      localHostname.value = newVal
    })

    watch(() => props.port, (newVal) => {
      localPort.value = newVal
    })

    const handleSave = () => {
      emit('save', {
        hostname: localHostname.value,
        port: localPort.value
      })
    }

    const handleClose = () => {
      emit('close')
    }

    const handleOverlayClick = () => {
      handleClose()
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape' && props.show) {
        handleClose()
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown)
    })

    return {
      localHostname,
      localPort,
      handleSave,
      handleClose,
      handleOverlayClick
    }
  }
}
</script>

<style scoped>
.modal-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
  text-align: center;
  font-size: 13px;
  color: #6c757d;
}

.modal-footer a {
  color: #007bff;
  text-decoration: none;
  font-weight: 500;
}

.modal-footer a:hover {
  text-decoration: underline;
}

.heart {
  color: #e25555;
  animation: heartbeat 1.5s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% {
    transform: scale(1);
  }
  10%, 30% {
    transform: scale(1.1);
  }
  20%, 40% {
    transform: scale(1);
  }
}
</style>
