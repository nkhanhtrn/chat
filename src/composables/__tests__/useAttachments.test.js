import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useAttachments } from '../useAttachments.js'

// Mock the services
vi.mock('../../services/urlFetcher.js', () => ({
  detectUrls: vi.fn((text) => {
    const urlRegex = /https?:\/\/[^\s]+/g
    return text.match(urlRegex) || []
  })
}))

vi.mock('../../services/attachmentReader.js', () => ({
  AttachmentType: {
    FILE: 'file',
    URL: 'url'
  },
  readAttachment: vi.fn(async (attachment) => {
    if (attachment.type === 'url') {
      if (attachment.url.includes('error')) {
        throw new Error('Failed to fetch')
      }
      return { content: `Content from ${attachment.url}`, readerName: 'url' }
    }
    if (attachment.type === 'file') {
      return { content: `Content of ${attachment.file.name}`, readerName: 'text' }
    }
    throw new Error('Unknown attachment type')
  })
}))

describe('useAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const attachments = useAttachments()

    expect(attachments.uploadedFiles.value).toEqual([])
    expect(attachments.detectedUrls.value).toEqual([])
    expect(attachments.fetchedContents.value).toEqual({})
    expect(attachments.hasLoadingUrls.value).toBe(false)
    expect(attachments.hasLoadingFiles.value).toBe(false)
  })

  it('should compute hasLoadingUrls correctly', () => {
    const attachments = useAttachments()

    attachments.detectedUrls.value = [{ url: 'https://example.com', status: 'loading' }]
    expect(attachments.hasLoadingUrls.value).toBe(true)

    attachments.detectedUrls.value = [{ url: 'https://example.com', status: 'success' }]
    expect(attachments.hasLoadingUrls.value).toBe(false)
  })

  it('should compute hasLoadingFiles correctly', () => {
    const attachments = useAttachments()

    attachments.uploadedFiles.value = [{ name: 'test.txt', status: 'loading' }]
    expect(attachments.hasLoadingFiles.value).toBe(true)

    attachments.uploadedFiles.value = [{ name: 'test.txt', status: 'success' }]
    expect(attachments.hasLoadingFiles.value).toBe(false)
  })

  it('should compute hasLoadingAttachments correctly', () => {
    const attachments = useAttachments()

    expect(attachments.hasLoadingAttachments.value).toBe(false)

    attachments.detectedUrls.value = [{ url: 'https://example.com', status: 'loading' }]
    expect(attachments.hasLoadingAttachments.value).toBe(true)

    attachments.detectedUrls.value = []
    attachments.uploadedFiles.value = [{ name: 'test.txt', status: 'loading' }]
    expect(attachments.hasLoadingAttachments.value).toBe(true)
  })

  it('should remove file by index', () => {
    const attachments = useAttachments()

    attachments.uploadedFiles.value = [
      { name: 'file1.txt', status: 'success' },
      { name: 'file2.txt', status: 'success' },
      { name: 'file3.txt', status: 'success' }
    ]

    attachments.removeFile(1)

    expect(attachments.uploadedFiles.value).toHaveLength(2)
    expect(attachments.uploadedFiles.value[0].name).toBe('file1.txt')
    expect(attachments.uploadedFiles.value[1].name).toBe('file3.txt')
  })

  it('should clear all attachments', () => {
    const attachments = useAttachments()

    attachments.uploadedFiles.value = [{ name: 'file.txt', status: 'success' }]
    attachments.detectedUrls.value = [{ url: 'https://example.com', status: 'success' }]
    attachments.fetchedContents.value = { 'https://example.com': 'content' }

    attachments.clearAll()

    expect(attachments.uploadedFiles.value).toEqual([])
    expect(attachments.detectedUrls.value).toEqual([])
    expect(attachments.fetchedContents.value).toEqual({})
  })

  it('should return snapshot of current state', () => {
    const attachments = useAttachments()

    attachments.uploadedFiles.value = [{ name: 'file.txt', status: 'success' }]
    attachments.detectedUrls.value = [{ url: 'https://example.com', status: 'success' }]
    attachments.fetchedContents.value = { 'https://example.com': 'content' }

    const snapshot = attachments.getSnapshot()

    expect(snapshot.uploadedFiles).toEqual([{ name: 'file.txt', status: 'success' }])
    expect(snapshot.detectedUrls).toEqual([{ url: 'https://example.com', status: 'success' }])
    expect(snapshot.fetchedContents).toEqual({ 'https://example.com': 'content' })

    // Verify it's a copy, not a reference
    snapshot.uploadedFiles.push({ name: 'new.txt' })
    expect(attachments.uploadedFiles.value).toHaveLength(1)
  })

  describe('handleFileUpload', () => {
    it('should add file with loading status initially', async () => {
      const attachments = useAttachments()

      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const event = {
        target: {
          files: [mockFile],
          value: 'test.txt'
        }
      }

      // Start the upload (don't await)
      attachments.handleFileUpload(event)

      // Verify file is added immediately with loading status
      expect(attachments.uploadedFiles.value).toHaveLength(1)
      expect(attachments.uploadedFiles.value[0].name).toBe('test.txt')
      expect(attachments.uploadedFiles.value[0].status).toBe('loading')
    })

    it('should call readAttachment for each file', async () => {
      const { readAttachment } = await import('../../services/attachmentReader.js')

      const attachments = useAttachments()

      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const event = {
        target: {
          files: [mockFile],
          value: 'test.txt'
        }
      }

      // Wait for processing
      await attachments.handleFileUpload(event)

      // Verify mock was called with correct args
      expect(readAttachment).toHaveBeenCalledWith({
        type: 'file',
        file: mockFile
      })

      // File should be added to the list
      expect(attachments.uploadedFiles.value).toHaveLength(1)
      // Input should be reset
      expect(event.target.value).toBe('')
    })

    it('should handle empty file list', async () => {
      const attachments = useAttachments()

      const event = { target: { files: [] } }
      await attachments.handleFileUpload(event)

      expect(attachments.uploadedFiles.value).toHaveLength(0)
    })

    it('should handle null files', async () => {
      const attachments = useAttachments()

      const event = { target: { files: null } }
      await attachments.handleFileUpload(event)

      expect(attachments.uploadedFiles.value).toHaveLength(0)
    })
  })

  describe('watchInputForUrls', () => {
    it('should detect and fetch URLs from input', async () => {
      const attachments = useAttachments()
      const inputText = ref('')

      attachments.watchInputForUrls(inputText)

      inputText.value = 'Check out https://example.com for more info'

      // Wait for async processing
      await vi.waitFor(() => {
        return attachments.detectedUrls.value.length > 0
      })

      expect(attachments.detectedUrls.value).toHaveLength(1)

      await vi.waitFor(() => {
        return attachments.detectedUrls.value[0]?.status === 'success'
      })

      expect(attachments.detectedUrls.value[0].url).toBe('https://example.com')
      expect(attachments.fetchedContents.value['https://example.com']).toBeDefined()
    })

    it('should remove URLs when deleted from input', async () => {
      const attachments = useAttachments()
      const inputText = ref('https://example.com')

      attachments.watchInputForUrls(inputText)

      await vi.waitFor(() => {
        return attachments.detectedUrls.value.length > 0
      })

      inputText.value = 'no urls here'

      await vi.waitFor(() => {
        return attachments.detectedUrls.value.length === 0
      })

      expect(attachments.detectedUrls.value).toEqual([])
      expect(attachments.fetchedContents.value).toEqual({})
    })

    it('should handle fetch errors', async () => {
      const attachments = useAttachments()
      const inputText = ref('')

      attachments.watchInputForUrls(inputText)

      inputText.value = 'https://error.example.com'

      // Wait for the watcher to trigger and the async fetch to complete
      // Use multiple promise cycles to ensure Vue reactivity and async operations complete
      await new Promise(resolve => setTimeout(resolve, 50))
      await new Promise(resolve => setTimeout(resolve, 50))
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(attachments.detectedUrls.value).toHaveLength(1)
      expect(attachments.detectedUrls.value[0].status).toBe('error')
    })
  })
})
