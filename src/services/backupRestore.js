/**
 * Generate a filename for chat backup download.
 * @returns {string} Filename for the backup file.
 */
export function getChatBackupFilename() {
  return `chat-messages-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
}
/**
 * Create a chat backup blob and filename (for download).
 * @param {Object} params
 * @param {Array} params.chats
 * @param {any} params.activeChatId
 * @param {string} params.selectedModel
 * @param {number} params.chatIdCounter
 * @param {Function} [params.backupChatsFn] - Optional override for backupChats
 * @param {Function} [params.getFilenameFn] - Optional override for filename
 * @returns {{ url: string, filename: string }}
 */
export function createChatBackup({ chats, activeChatId, selectedModel, chatIdCounter, backupChatsFn = backupChats, getFilenameFn }) {
  const data = {
    chats,
    activeChat: activeChatId,
    selectedModel,
    chatCounter: chatIdCounter
  }
  const json = backupChatsFn(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const filename = getFilenameFn ? getFilenameFn() : getChatBackupFilename()
  return { url, filename }
}
// src/services/backupRestore.js

/**
 * Backup chat data to a JSON string.
 * @param {Object} data - The chat data to backup.
 * @returns {string} JSON string.
 */
export function backupChats(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid data for backup')
  return JSON.stringify(data, null, 2)
}

/**
 * Restore chat data from a JSON string or object.
 * @param {string|Object} input - The JSON string or object to restore from.
 * @returns {Object} Restored chat data.
 */
export function restoreChats(input) {
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch (err) {
      throw new Error('Invalid JSON format')
    }
  }
  if (!data.chats || !Array.isArray(data.chats)) throw new Error('Invalid chat data')
  return {
    chats: data.chats,
    activeChat: data.activeChat ?? (data.chats[0]?.id ?? null),
    selectedModel: data.selectedModel ?? '',
    chatCounter: data.chatCounter ?? (data.chats.length ? Math.max(...data.chats.map(c => c.id)) + 1 : 1)
  }
}
