import { ref, computed, watch } from 'vue'
import { detectUrls } from '../services/urlFetcher.js'
import { AttachmentType, readAttachment } from '../services/attachmentReader.js'

/**
 * Composable for managing file uploads and URL detection
 */
export function useAttachments() {
  // Uploaded files state
  // Array of { file: File, name: string, status: 'loading'|'success'|'error', content: string, error?: string, readerName?: string }
  const uploadedFiles = ref([])

  // URL fetching state
  const detectedUrls = ref([]) // Array of { url, status: 'loading'|'success'|'error', content: string }
  const fetchedContents = ref({}) // Map of url -> content

  // File input ref (to be set by component)
  const fileInputRef = ref(null)

  // Computed: check if any URLs are still loading
  const hasLoadingUrls = computed(() =>
    detectedUrls.value.some(u => u.status === 'loading')
  )

  // Computed: check if any files are still loading
  const hasLoadingFiles = computed(() =>
    uploadedFiles.value.some(f => f.status === 'loading')
  )

  // Computed: check if any attachments are loading
  const hasLoadingAttachments = computed(() =>
    hasLoadingUrls.value || hasLoadingFiles.value
  )

  /**
   * Watch input text for URL changes and auto-fetch
   * @param {Ref<string>} inputText - Reactive input text ref
   */
  function watchInputForUrls(inputText) {
    watch(inputText, async (newText) => {
      const urls = detectUrls(newText)

      // Find new URLs that we haven't seen before
      const existingUrls = detectedUrls.value.map(d => d.url)
      const newUrls = urls.filter(url => !existingUrls.includes(url))

      // Remove URLs that are no longer in the text
      detectedUrls.value = detectedUrls.value.filter(d => urls.includes(d.url))

      // Clean up fetchedContents for removed URLs
      for (const url of Object.keys(fetchedContents.value)) {
        if (!urls.includes(url)) {
          delete fetchedContents.value[url]
        }
      }

      // Add new URLs and start fetching using attachment reader
      for (const url of newUrls) {
        const urlEntry = { url, status: 'loading', content: '' }
        detectedUrls.value.push(urlEntry)

        try {
          const result = await readAttachment({
            type: AttachmentType.URL,
            url
          })
          // Find and update the entry (it might have been removed)
          const entry = detectedUrls.value.find(d => d.url === url)
          if (entry) {
            entry.status = 'success'
            entry.content = result.content
            fetchedContents.value[url] = result.content
          }
        } catch (error) {
          const entry = detectedUrls.value.find(d => d.url === url)
          if (entry) {
            entry.status = 'error'
            entry.content = error.message
          }
        }
      }
    }, { immediate: false })
  }

  /**
   * Trigger file upload dialog
   */
  function triggerFileUpload() {
    fileInputRef.value?.click()
  }

  /**
   * Handle file upload event
   * @param {Event} event - File input change event
   */
  async function handleFileUpload(event) {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of files) {
      // Add file entry with loading status
      const fileEntry = {
        file,
        name: file.name,
        status: 'loading',
        content: '',
        error: null,
        readerName: null
      }
      uploadedFiles.value.push(fileEntry)

      // Read file using attachment reader
      try {
        const result = await readAttachment({
          type: AttachmentType.FILE,
          file
        })

        // Find and update the entry
        const entry = uploadedFiles.value.find(f => f.file === file)
        if (entry) {
          entry.status = 'success'
          entry.content = result.content
          entry.readerName = result.readerName
        }
      } catch (error) {
        const entry = uploadedFiles.value.find(f => f.file === file)
        if (entry) {
          entry.status = 'error'
          entry.error = error.message
        }
        console.error(`Failed to read file ${file.name}:`, error)
      }
    }

    // Reset the input so the same file can be selected again
    event.target.value = ''
  }

  /**
   * Remove a file from the uploaded files list
   * @param {number} index - Index of file to remove
   */
  function removeFile(index) {
    uploadedFiles.value.splice(index, 1)
  }

  /**
   * Clear all attachments (files and URLs)
   */
  function clearAll() {
    uploadedFiles.value = []
    detectedUrls.value = []
    fetchedContents.value = {}
  }

  /**
   * Get current state snapshot for message sending
   * @returns {Object} Snapshot of current attachments state
   */
  function getSnapshot() {
    return {
      uploadedFiles: [...uploadedFiles.value],
      detectedUrls: [...detectedUrls.value],
      fetchedContents: { ...fetchedContents.value }
    }
  }

  return {
    // State
    uploadedFiles,
    detectedUrls,
    fetchedContents,
    fileInputRef,

    // Computed
    hasLoadingUrls,
    hasLoadingFiles,
    hasLoadingAttachments,

    // Actions
    watchInputForUrls,
    triggerFileUpload,
    handleFileUpload,
    removeFile,
    clearAll,
    getSnapshot
  }
}
