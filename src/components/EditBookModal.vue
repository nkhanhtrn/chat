<template>
  <Modal
    :visible="visible"
    title="Edit Book"
    size="small"
    @close="onClose"
  >
    <div class="edit-book-form">
      <div class="form-field">
        <label for="edit-title">Title</label>
        <input
          id="edit-title"
          v-model="formData.title"
          type="text"
          class="form-input"
          placeholder="Book title"
          @keydown.enter="onSave"
        >
      </div>

      <div class="form-field">
        <label for="edit-author">Author</label>
        <input
          id="edit-author"
          v-model="formData.author"
          type="text"
          class="form-input"
          placeholder="Author name"
          @keydown.enter="onSave"
        >
      </div>

      <div class="form-field">
        <label>Cover Image</label>
        <div class="cover-upload">
          <div class="cover-preview">
            <img v-if="coverPreview" :src="coverPreview" alt="Book cover">
            <div v-else class="cover-placeholder">📖</div>
          </div>
          <div class="cover-actions">
            <Button v-if="formData.coverUrl" variant="secondary" @click="removeCover">
              Remove Cover
            </Button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              @change="handleCoverUpload"
              style="display: none"
            >
            <Button variant="secondary" @click="triggerFileInput">
              {{ formData.coverUrl ? 'Change Cover' : 'Upload Cover' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-left">
        <Button variant="danger" @click="onDelete" title="Delete book">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </Button>
      </div>
      <div class="footer-right">
        <Button variant="secondary" @click="onClose">Cancel</Button>
        <Button variant="primary" @click="onSave" :disabled="!hasChanges || isSaving">
          {{ isSaving ? 'Saving...' : 'Save' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Modal from './Modal/Modal.vue'
import Button from './Button.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  book: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save', 'delete'])

const formData = ref({
  title: '',
  author: '',
  coverUrl: null
})

const fileInput = ref(null)
const isSaving = ref(false)
const originalData = ref({})

const coverPreview = computed(() => formData.value.coverUrl)

const hasChanges = computed(() => {
  return (
    formData.value.title !== originalData.value.title ||
    formData.value.author !== originalData.value.author ||
    formData.value.coverUrl !== originalData.value.coverUrl
  )
})

watch(() => props.visible, (isVisible) => {
  if (isVisible && props.book) {
    formData.value = {
      title: props.book.title || '',
      author: props.book.author || '',
      coverUrl: props.book.coverUrl || null
    }
    originalData.value = { ...formData.value }
  }
})

function triggerFileInput() {
  fileInput.value.click()
}

function handleCoverUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file')
    return
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    alert('Image size must be less than 2MB')
    return
  }

  // Convert to data URL
  const reader = new FileReader()
  reader.onload = (e) => {
    formData.value.coverUrl = e.target.result
  }
  reader.readAsDataURL(file)
}

function removeCover() {
  formData.value.coverUrl = null
}

function onClose() {
  emit('close')
}

async function onSave() {
  if (!hasChanges.value || isSaving.value) return

  isSaving.value = true
  try {
    await emit('save', {
      title: formData.value.title,
      author: formData.value.author,
      coverUrl: formData.value.coverUrl
    })
  } finally {
    isSaving.value = false
  }
}

function onDelete() {
  const bookTitle = props.book?.title || 'this book'
  if (confirm(`Delete "${bookTitle}"?`)) {
    emit('delete')
  }
}
</script>

<style scoped>
.edit-book-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-base, #333);
}

.form-input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border-input, #ddd);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--color-bg-input, #fff);
  color: var(--color-text-base, #333);
  transition: all 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.form-input::placeholder {
  color: var(--color-text-muted, #999);
}

.cover-upload {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.cover-preview {
  width: 80px;
  height: 120px;
  border: 1px solid var(--color-border-base, #ddd);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-hover, #f5f5f5);
  flex-shrink: 0;
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 2.5rem;
  opacity: 0.5;
}

.cover-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.footer-left {
  display: flex;
  gap: 0.5rem;
}

.footer-right {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

@media (max-width: 480px) {
  .cover-upload {
    flex-direction: column;
    align-items: center;
  }

  .cover-actions {
    flex-direction: row;
    width: 100%;
    justify-content: center;
  }
}
</style>
