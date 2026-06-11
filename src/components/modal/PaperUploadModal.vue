<template>
  <Modal
    :visible="visible"
    title="Add Research Paper"
    size="xlarge"
    @close="onClose"
  >
    <div class="paper-upload-modal">
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'upload' }"
          @click="activeTab = 'upload'"
        >
          Upload PDF
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'metadata' }"
          @click="activeTab = 'metadata'"
        >
          Metadata
        </button>
      </div>

      <div v-show="activeTab === 'upload'" class="tab-content">
        <div
          class="drop-zone"
          :class="{
            'drag-over': isDragOver,
            'uploading': isUploading
          }"
          @click="triggerFileInput"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".pdf"
            @change="handleFileSelect"
            style="display: none"
          >
          <div v-if="isUploading" class="uploading-state">
            <div class="spinner"></div>
            <p>Processing paper...</p>
            <div class="upload-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <span class="progress-text">{{ uploadProgress }}%</span>
            </div>
          </div>
          <div v-else class="drop-zone-content">
            <div class="drop-icon">📄</div>
            <p class="drop-text">Drop your PDF research paper here</p>
            <p class="drop-hint">or click to browse</p>
            <p class="drop-format">Supports .pdf files</p>
          </div>
        </div>

        <div v-if="uploadError" class="error-message">
          {{ uploadError }}
          <button class="error-dismiss" @click="uploadError = null">&times;</button>
        </div>

        <div v-if="fileReady" class="file-info">
          <span class="file-icon">📄</span>
          <span class="file-name">{{ fileName }}</span>
          <span class="file-size">{{ formatFileSize(fileSize) }}</span>
          <button class="file-remove" @click="removeFile">&times;</button>
        </div>
      </div>

      <div v-show="activeTab === 'metadata'" class="tab-content metadata-tab">
        <div class="metadata-form">
          <label class="meta-label">Title *</label>
          <input v-model="meta.title" class="meta-input" placeholder="Paper title" />

          <label class="meta-label">Authors</label>
          <input v-model="meta.author" class="meta-input" placeholder="Author names (comma-separated)" />

          <div class="meta-row">
            <div class="meta-field">
              <label class="meta-label">Journal / Conference</label>
              <input v-model="meta.journal" class="meta-input" placeholder="e.g. Nature, ICML 2024" />
            </div>
            <div class="meta-field">
              <label class="meta-label">Year</label>
              <input v-model.number="meta.year" type="number" class="meta-input" placeholder="2024" />
            </div>
          </div>

          <label class="meta-label">DOI</label>
          <input v-model="meta.doi" class="meta-input" placeholder="e.g. 10.1000/xyz123" />

          <label class="meta-label">Abstract</label>
          <textarea v-model="meta.abstract" class="meta-textarea" rows="4" placeholder="Paper abstract..."></textarea>

          <label class="meta-label">Keywords</label>
          <div class="keywords-input-wrapper">
            <div class="keywords-tags">
              <span v-for="(kw, i) in meta.keywords" :key="i" class="keyword-tag">
                {{ kw }}
                <button class="keyword-remove" @click="removeKeyword(i)">&times;</button>
              </span>
              <input
                v-model="newKeyword"
                class="keyword-input"
                placeholder="Add keyword..."
                @keydown.enter.prevent="addKeyword"
              />
            </div>
          </div>

          <label class="meta-label">BibTeX</label>
          <textarea v-model="meta.bibtex" class="meta-textarea mono" rows="4" placeholder="@article{...}"></textarea>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-actions">
        <Button variant="secondary" @click="onClose">
          Cancel
        </Button>
        <Button variant="primary" @click="handleSubmit" :disabled="!canSubmit || isSubmitting">
          {{ isSubmitting ? 'Adding...' : 'Add Paper' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import Modal from './Modal.vue'
import Button from '@/components/Button.vue'
import { extractPdfInfo } from '@/services/pdfRenderer'
import { extractPaperMeta } from '@/services/paperMetaExtractor'
import type { PaperMeta } from '@/types/book'

export interface PaperUploadData {
  title: string
  author: string
  coverData: ArrayBuffer | null
  fileData: ArrayBuffer
  fileSize: number
  fileType: 'epub' | 'pdf'
  category: 'paper'
  meta: PaperMeta
  paperMeta: PaperMeta
}

const props = withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: false,
})

const emit = defineEmits<{
  close: []
  upload: [data: PaperUploadData]
}>()

const activeTab = ref('upload')
const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref<string | null>(null)
const isSubmitting = ref(false)

const fileReady = ref(false)
const fileData = ref<ArrayBuffer | null>(null)
const fileName = ref('')
const fileSize = ref(0)
const coverData = ref<ArrayBuffer | null>(null)

const newKeyword = ref('')

const meta = reactive({
  title: '',
  author: '',
  doi: '',
  journal: '',
  year: null as number | null,
  abstract: '',
  keywords: [] as string[],
  bibtex: '',
})

const canSubmit = computed(() => {
  return fileReady.value && meta.title.trim().length > 0
})

watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    resetState()
  }
})

function resetState() {
  activeTab.value = 'upload'
  fileReady.value = false
  fileData.value = null
  fileName.value = ''
  fileSize.value = 0
  coverData.value = null
  isDragOver.value = false
  isUploading.value = false
  uploadProgress.value = 0
  uploadError.value = null
  isSubmitting.value = false
  meta.title = ''
  meta.author = ''
  meta.doi = ''
  meta.journal = ''
  meta.year = null
  meta.abstract = ''
  meta.keywords = []
  meta.bibtex = ''
  newKeyword.value = ''
}

function triggerFileInput() {
  if (isUploading.value) return
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
  ;(event.target as HTMLInputElement).value = ''
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  if (isUploading.value) return
  const file = event.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

async function processFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    uploadError.value = 'Please select a PDF file'
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  uploadError.value = null

  try {
    const arrayBuffer = await file.arrayBuffer()
    uploadProgress.value = 30

    let title = file.name.replace(/\.pdf$/i, '')
    let author = ''
    let cover: ArrayBuffer | null = null

    try {
      const info = await extractPdfInfo(arrayBuffer)
      title = info.title || title
      author = info.author
      cover = info.coverData
    } catch (err) {
      console.warn('[PaperUpload] Failed to extract PDF info:', err)
    }

    fileData.value = arrayBuffer
    fileName.value = file.name
    fileSize.value = file.size
    coverData.value = cover
    fileReady.value = true

    if (title && !meta.title) meta.title = title
    if (author && !meta.author) meta.author = author

    uploadProgress.value = 100
    activeTab.value = 'metadata'

    try {
      const extracted = await extractPaperMeta(arrayBuffer)
      if (extracted.doi && !meta.doi) meta.doi = extracted.doi
      if (extracted.journal && !meta.journal) meta.journal = extracted.journal
      if (extracted.year && !meta.year) meta.year = extracted.year
      if (extracted.abstract && !meta.abstract) meta.abstract = extracted.abstract
      if (extracted.keywords?.length && meta.keywords.length === 0) meta.keywords = extracted.keywords
      if (extracted.citationCount != null) meta.citationCount = extracted.citationCount
    } catch (err) {
      console.warn('[PaperUpload] Auto-extraction failed:', err)
    }

    setTimeout(() => {
      isUploading.value = false
      uploadProgress.value = 0
    }, 500)
  } catch (err) {
    console.error('[PaperUpload] Failed:', err)
    uploadError.value = (err as Error).message || 'Failed to process paper'
    isUploading.value = false
    uploadProgress.value = 0
  }
}

function removeFile() {
  fileReady.value = false
  fileData.value = null
  fileName.value = ''
  fileSize.value = 0
  coverData.value = null
}

function addKeyword() {
  const kw = newKeyword.value.trim()
  if (kw && !meta.keywords.includes(kw)) {
    meta.keywords.push(kw)
  }
  newKeyword.value = ''
}

function removeKeyword(index: number) {
  meta.keywords.splice(index, 1)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function handleSubmit() {
  if (!canSubmit.value || !fileData.value) return

  isSubmitting.value = true

  emit('upload', {
    title: meta.title.trim(),
    author: meta.author.trim(),
    coverData: coverData.value,
    fileData: fileData.value,
    fileSize: fileSize.value,
    fileType: 'pdf',
    category: 'paper',
    meta: {
      doi: meta.doi.trim() || null,
      journal: meta.journal.trim() || null,
      year: meta.year,
      abstract: meta.abstract.trim() || null,
      keywords: [...meta.keywords],
      bibtex: meta.bibtex.trim() || null,
      citationCount: null,
      language: null,
    },
  })
}

function onClose() {
  emit('close')
}
</script>

<style scoped>
.paper-upload-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tabs {
  display: flex;
  gap: 0;
}

.tab {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted, #999);
  transition: all 0.15s ease;
}

.tab:hover {
  color: var(--color-text-base, #333);
}

.tab.active {
  border-bottom-color: var(--color-primary, #6366f1);
  color: var(--color-primary, #6366f1);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 460px;
}

.metadata-tab {
  overflow-y: auto;
}

.metadata-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted, #999);
  margin-top: 0.5rem;
  margin-bottom: 0.15rem;
  font-weight: 500;
}

.meta-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base, #ddd);
  border-radius: 6px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-base, #333);
  font-size: 0.9rem;
  box-sizing: border-box;
}

.meta-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.meta-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base, #ddd);
  border-radius: 6px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-base, #333);
  font-size: 0.9rem;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.meta-textarea.mono {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
}

.meta-row {
  display: flex;
  gap: 0.75rem;
}

.meta-field {
  flex: 1;
}

.keywords-input-wrapper {
  border: 1px solid var(--color-border-base, #ddd);
  border-radius: 6px;
  padding: 0.35rem;
  background: var(--color-bg-elevated, #fff);
}

.keywords-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.keyword-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem;
  background: var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
  color: var(--color-primary, #6366f1);
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.keyword-remove {
  background: none;
  border: none;
  color: var(--color-primary, #6366f1);
  cursor: pointer;
  padding: 0;
  font-size: 0.9rem;
  line-height: 1;
  opacity: 0.7;
}

.keyword-remove:hover {
  opacity: 1;
}

.keyword-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.85rem;
  padding: 0.2rem 0.35rem;
  color: var(--color-text-base, #333);
  min-width: 120px;
  flex: 1;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-hover, #f5f5f5);
  border-radius: 6px;
  border: 1px solid var(--color-border-base, #ddd);
}

.file-icon {
  font-size: 1.2rem;
}

.file-name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--color-text-base, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.75rem;
  color: var(--color-text-muted, #999);
}

.file-remove {
  background: none;
  border: none;
  color: var(--color-text-muted, #999);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
  line-height: 1;
}

.file-remove:hover {
  color: var(--color-error-text, #c33);
}

.drop-zone {
  border: 2px dashed var(--color-border-base, #ddd);
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone:hover {
  border-color: var(--color-primary, #6366f1);
  background: var(--color-bg-hover, #f5f5f5);
}

.drop-zone.drag-over {
  border-color: var(--color-primary, #6366f1);
  background: var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.drop-zone.uploading {
  cursor: default;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.drop-icon {
  font-size: 4rem;
  opacity: 0.5;
}

.drop-text {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-text-base, #333);
}

.drop-hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted, #999);
}

.drop-format {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted, #999);
}

.uploading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 300px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-hover, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary, #6366f1);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--color-text-muted, #999);
  min-width: 3ch;
  text-align: right;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-hover, #f0f0f0);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c33;
  font-size: 0.875rem;
}

.error-dismiss {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #c33;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
</style>
