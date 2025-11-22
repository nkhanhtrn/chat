<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal">
      <button @click="handleClose" class="modal-close-btn">×</button>
      <h2>API Server Configuration</h2>
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
      handleClose
    }
  }
}
</script>
