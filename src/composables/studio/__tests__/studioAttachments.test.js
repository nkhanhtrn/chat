import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildRawAttachments,
  formatUploadedFilesForPrompt,
  formatFetchedContentForPrompt,
  buildAttachmentsForDisplay
} from '../studioAttachments.js'
import { AttachmentType, formatAttachmentForPrompt } from '../../../services/attachmentReader.js'

vi.mock('../../../services/attachmentReader.js', () => ({
  AttachmentType: {
    URL: 'url',
    FILE: 'file'
  },
  formatAttachmentForPrompt: vi.fn((result, attachment) => result.content)
}))

describe('studioAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildRawAttachments', () => {
    it('should build empty array when no attachments', () => {
      const result = buildRawAttachments([], [], {})

      expect(result).toEqual([])
    })

    it('should build file attachments with File objects', () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const uploadedFiles = [
        { file: mockFile, name: 'test.txt', status: 'success' }
      ]

      const result = buildRawAttachments(uploadedFiles, [], {})

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(AttachmentType.FILE)
      expect(result[0].file).toBe(mockFile)
    })

    it('should skip files without File object', () => {
      const uploadedFiles = [
        { name: 'test.txt', status: 'success' } // no file property
      ]

      const result = buildRawAttachments(uploadedFiles, [], {})

      expect(result).toEqual([])
    })

    it('should build URL attachments', () => {
      const detectedUrls = [
        { url: 'https://example.com', status: 'success' }
      ]

      const result = buildRawAttachments([], detectedUrls, {})

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe(AttachmentType.URL)
      expect(result[0].url).toBe('https://example.com')
      expect(result[0].prefetchedContent).toBeNull()
    })

    it('should include prefetched content for URLs', () => {
      const detectedUrls = [
        { url: 'https://example.com', status: 'success' }
      ]
      const fetchedContents = {
        'https://example.com': 'Prefetched page content'
      }

      const result = buildRawAttachments([], detectedUrls, fetchedContents)

      expect(result[0].prefetchedContent).toBe('Prefetched page content')
    })

    it('should handle multiple files and URLs', () => {
      const mockFile1 = new File(['a'], 'a.txt')
      const mockFile2 = new File(['b'], 'b.txt')
      const uploadedFiles = [
        { file: mockFile1, name: 'a.txt' },
        { file: mockFile2, name: 'b.txt' }
      ]
      const detectedUrls = [
        { url: 'https://a.com' },
        { url: 'https://b.com' }
      ]
      const fetchedContents = {
        'https://a.com': 'Content A'
      }

      const result = buildRawAttachments(uploadedFiles, detectedUrls, fetchedContents)

      expect(result).toHaveLength(4)
      expect(result[0].type).toBe(AttachmentType.FILE)
      expect(result[1].type).toBe(AttachmentType.FILE)
      expect(result[2].type).toBe(AttachmentType.URL)
      expect(result[2].prefetchedContent).toBe('Content A')
      expect(result[3].type).toBe(AttachmentType.URL)
      expect(result[3].prefetchedContent).toBeNull()
    })
  })

  describe('formatUploadedFilesForPrompt', () => {
    it('should return empty string for no files', () => {
      const result = formatUploadedFilesForPrompt([])

      expect(result).toBe('')
    })

    it('should return empty string when no successful files', () => {
      const files = [
        { status: 'pending', content: 'content' },
        { status: 'error', content: 'content' }
      ]

      const result = formatUploadedFilesForPrompt(files)

      expect(result).toBe('')
    })

    it('should format successful files', () => {
      const mockFile = new File([''], 'test.txt')
      const files = [
        { status: 'success', content: 'File content here', file: mockFile }
      ]

      const result = formatUploadedFilesForPrompt(files)

      expect(formatAttachmentForPrompt).toHaveBeenCalledWith(
        { content: 'File content here' },
        { type: AttachmentType.FILE, file: mockFile }
      )
      expect(result).toBe('File content here')
    })

    it('should format multiple successful files', () => {
      const mockFile1 = new File([''], 'a.txt')
      const mockFile2 = new File([''], 'b.txt')
      const files = [
        { status: 'success', content: 'Content A', file: mockFile1 },
        { status: 'error', content: 'Fail' },
        { status: 'success', content: 'Content B', file: mockFile2 }
      ]

      const result = formatUploadedFilesForPrompt(files)

      expect(formatAttachmentForPrompt).toHaveBeenCalledTimes(2)
      expect(result).toBe('Content A\n\nContent B')
    })
  })

  describe('formatFetchedContentForPrompt', () => {
    it('should return empty string for empty object', () => {
      const result = formatFetchedContentForPrompt({})

      expect(result).toBe('')
    })

    it('should return empty string when all content is empty', () => {
      const fetchedContents = {
        'https://a.com': '',
        'https://b.com': '   '
      }

      const result = formatFetchedContentForPrompt(fetchedContents)

      expect(result).toBe('')
    })

    it('should return empty string when content is null/undefined', () => {
      const fetchedContents = {
        'https://a.com': null,
        'https://b.com': undefined
      }

      const result = formatFetchedContentForPrompt(fetchedContents)

      expect(result).toBe('')
    })

    it('should format fetched content', () => {
      const fetchedContents = {
        'https://example.com': 'Page content'
      }

      const result = formatFetchedContentForPrompt(fetchedContents)

      expect(formatAttachmentForPrompt).toHaveBeenCalledWith(
        { content: 'Page content' },
        { type: AttachmentType.URL, url: 'https://example.com' }
      )
      expect(result).toBe('Page content')
    })

    it('should format multiple URLs', () => {
      const fetchedContents = {
        'https://a.com': 'Content A',
        'https://b.com': 'Content B'
      }

      const result = formatFetchedContentForPrompt(fetchedContents)

      expect(formatAttachmentForPrompt).toHaveBeenCalledTimes(2)
      expect(result).toBe('Content A\n\nContent B')
    })

    it('should skip empty content entries', () => {
      const fetchedContents = {
        'https://a.com': 'Content A',
        'https://empty.com': '',
        'https://b.com': 'Content B'
      }

      const result = formatFetchedContentForPrompt(fetchedContents)

      expect(formatAttachmentForPrompt).toHaveBeenCalledTimes(2)
    })
  })

  describe('buildAttachmentsForDisplay', () => {
    const mockTruncateFileName = vi.fn((name) => name.slice(0, 10))
    const mockTruncateUrl = vi.fn((url) => url.slice(0, 20))

    beforeEach(() => {
      mockTruncateFileName.mockClear()
      mockTruncateUrl.mockClear()
    })

    it('should return empty array when no attachments', () => {
      const result = buildAttachmentsForDisplay([], [], mockTruncateFileName, mockTruncateUrl)

      expect(result).toEqual([])
    })

    it('should build display items for successful files', () => {
      const uploadedFiles = [
        { status: 'success', name: 'document.pdf', readerName: 'pdf' },
        { status: 'error', name: 'failed.txt' }
      ]

      const result = buildAttachmentsForDisplay(uploadedFiles, [], mockTruncateFileName, mockTruncateUrl)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'file',
        name: 'document.p',
        readerName: 'pdf'
      })
      expect(mockTruncateFileName).toHaveBeenCalledWith('document.pdf')
    })

    it('should build display items for successful URLs', () => {
      const detectedUrls = [
        { status: 'success', url: 'https://example.com/page' },
        { status: 'pending', url: 'https://loading.com' }
      ]

      const result = buildAttachmentsForDisplay([], detectedUrls, mockTruncateFileName, mockTruncateUrl)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'url',
        name: 'https://example.com/'
      })
      expect(mockTruncateUrl).toHaveBeenCalledWith('https://example.com/page')
    })

    it('should combine files and URLs', () => {
      const uploadedFiles = [
        { status: 'success', name: 'file.txt', readerName: 'text' }
      ]
      const detectedUrls = [
        { status: 'success', url: 'https://test.com' }
      ]

      const result = buildAttachmentsForDisplay(uploadedFiles, detectedUrls, mockTruncateFileName, mockTruncateUrl)

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('file')
      expect(result[1].type).toBe('url')
    })

    it('should filter out non-success status', () => {
      const uploadedFiles = [
        { status: 'pending', name: 'loading.txt' },
        { status: 'error', name: 'failed.txt' },
        { status: 'success', name: 'done.txt', readerName: 'text' }
      ]
      const detectedUrls = [
        { status: 'pending', url: 'https://loading.com' },
        { status: 'success', url: 'https://done.com' }
      ]

      const result = buildAttachmentsForDisplay(uploadedFiles, detectedUrls, mockTruncateFileName, mockTruncateUrl)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('done.txt'.slice(0, 10))
      expect(result[1].name).toBe('https://done.com'.slice(0, 20))
    })
  })
})
