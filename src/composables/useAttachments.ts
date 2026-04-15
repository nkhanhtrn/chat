import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { detectUrls } from '@/services/urlFetcher'
import { AttachmentType, readAttachment } from '@/services/attachmentReader'

export interface UploadedFile {
  file: File
  name: string
  status: 'loading' | 'success' | 'error'
  content: string
  error: string | null
  readerName: string | null
}

export interface DetectedUrl {
  url: string
  status: 'loading' | 'success' | 'error'
  content: string
}

export function useAttachments() {
  const uploadedFiles = ref<UploadedFile[]>([])
  const detectedUrls = ref<DetectedUrl[]>([])
  const fetchedContents = ref<Record<string, string>>({})
  const fileInputRef = ref<HTMLInputElement | null>(null)

  const hasLoadingUrls = computed(() => detectedUrls.value.some(u => u.status === 'loading'))
  const hasLoadingFiles = computed(() => uploadedFiles.value.some(f => f.status === 'loading'))
  const hasLoadingAttachments = computed(() => hasLoadingUrls.value || hasLoadingFiles.value)

  function watchInputForUrls(inputText: Ref<string>) {
    watch(inputText, async (newText) => {
      const urls = detectUrls(newText)
      const existingUrls = detectedUrls.value.map(d => d.url)
      const newUrls = urls.filter(url => !existingUrls.includes(url))

      detectedUrls.value = detectedUrls.value.filter(d => urls.includes(d.url))

      for (const url of Object.keys(fetchedContents.value)) {
        if (!urls.includes(url)) delete fetchedContents.value[url]
      }

      for (const url of newUrls) {
        const urlEntry: DetectedUrl = { url, status: 'loading', content: '' }
        detectedUrls.value.push(urlEntry)

        try {
          const result = await readAttachment({ type: AttachmentType.URL, url })
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
            entry.content = (error as Error).message
          }
        }
      }
    }, { immediate: false })
  }

  function triggerFileUpload() { fileInputRef.value?.click() }

  async function handleFileUpload(event: Event) {
    const files = (event.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    for (const file of files) {
      const fileEntry: UploadedFile = { file, name: file.name, status: 'loading', content: '', error: null, readerName: null }
      uploadedFiles.value.push(fileEntry)

      try {
        const result = await readAttachment({ type: AttachmentType.FILE, file })
        const entry = uploadedFiles.value.find(f => f.file === file)
        if (entry) {
          entry.status = 'success'
          entry.content = result.content
          entry.readerName = result.readerName ?? null
        }
      } catch (error) {
        const entry = uploadedFiles.value.find(f => f.file === file)
        if (entry) {
          entry.status = 'error'
          entry.error = (error as Error).message
        }
      }
    }
    ;(event.target as HTMLInputElement).value = ''
  }

  function removeFile(index: number) { uploadedFiles.value.splice(index, 1) }

  function clearAll() {
    uploadedFiles.value = []
    detectedUrls.value = []
    fetchedContents.value = {}
  }

  function getSnapshot() {
    return {
      uploadedFiles: [...uploadedFiles.value],
      detectedUrls: [...detectedUrls.value],
      fetchedContents: { ...fetchedContents.value },
    }
  }

  return {
    uploadedFiles, detectedUrls, fetchedContents, fileInputRef,
    hasLoadingUrls, hasLoadingFiles, hasLoadingAttachments,
    watchInputForUrls, triggerFileUpload, handleFileUpload,
    removeFile, clearAll, getSnapshot,
  }
}
