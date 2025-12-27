/**
 * Utility functions for handling attachments in StudioChat
 */

import {
  AttachmentType,
  formatAttachmentForPrompt
} from '../services/attachmentReader.js'

/**
 * Build raw attachments for taskRouter (2-model mode)
 * @param {Array} uploadedFiles - Array of uploaded file objects
 * @param {Array} detectedUrls - Array of detected URL objects
 * @param {Object} fetchedContents - Map of url -> content
 * @returns {Array} Array of attachment objects for taskRouter
 */
export function buildRawAttachments(uploadedFiles, detectedUrls, fetchedContents = {}) {
  const attachments = []

  // Add file attachments (with File objects for reading)
  for (const f of uploadedFiles) {
    if (f.file) {
      attachments.push({
        type: AttachmentType.FILE,
        file: f.file
      })
    }
  }

  // Add URL attachments (with pre-fetched content if available)
  for (const u of detectedUrls) {
    attachments.push({
      type: AttachmentType.URL,
      url: u.url,
      prefetchedContent: fetchedContents[u.url] || null
    })
  }

  return attachments
}

/**
 * Format uploaded files for prompt (using attachment reader format)
 * @param {Array} files - Array of uploaded file objects
 * @returns {string} Formatted string for prompt
 */
export function formatUploadedFilesForPrompt(files) {
  const successfulFiles = files.filter(f => f.status === 'success')
  if (successfulFiles.length === 0) return ''

  return successfulFiles.map(f =>
    formatAttachmentForPrompt(
      { content: f.content },
      { type: AttachmentType.FILE, file: f.file }
    )
  ).join('\n\n')
}

/**
 * Format URL contents for prompt (using attachment reader format)
 * @param {Object} fetchedContents - Map of url -> content
 * @returns {string} Formatted string for prompt
 */
export function formatFetchedContentForPrompt(fetchedContents) {
  const entries = Object.entries(fetchedContents).filter(
    ([, content]) => content && content.trim()
  )
  if (entries.length === 0) return ''

  return entries.map(([url, content]) =>
    formatAttachmentForPrompt(
      { content },
      { type: AttachmentType.URL, url }
    )
  ).join('\n\n')
}

/**
 * Build attachments list for display in UI
 * @param {Array} uploadedFiles - Array of uploaded file objects
 * @param {Array} detectedUrls - Array of detected URL objects
 * @param {Function} truncateFileName - Function to truncate file names
 * @param {Function} truncateUrl - Function to truncate URLs
 * @returns {Array} Array of attachment objects for display
 */
export function buildAttachmentsForDisplay(uploadedFiles, detectedUrls, truncateFileName, truncateUrl) {
  return [
    ...uploadedFiles
      .filter(f => f.status === 'success')
      .map(f => ({
        type: 'file',
        name: truncateFileName(f.name),
        readerName: f.readerName
      })),
    ...detectedUrls
      .filter(u => u.status === 'success')
      .map(u => ({ type: 'url', name: truncateUrl(u.url) }))
  ]
}
