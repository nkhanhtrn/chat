import { describe, it, expect, vi } from 'vitest'
import { getChatBackupFilename } from '../backupRestore.js'

describe('getChatBackupFilename', () => {
  it('should return a filename with the correct format', () => {
    const filename = getChatBackupFilename()
    expect(filename).toMatch(/^chat-messages-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/)
  })

  it('should end with .json', () => {
    const filename = getChatBackupFilename()
    expect(filename.endsWith('.json')).toBe(true)
  })

  it('should be unique for different times', () => {
    // Mock Date to different values
    const RealDate = Date
    global.Date = class extends RealDate {
      static now() { return 1700000000000 } // 2023-11-14T22:13:20.000Z
      constructor() { return new RealDate(1700000000000) }
    }
    const filename1 = getChatBackupFilename()
    global.Date = class extends RealDate {
      static now() { return 1700000001000 } // 1 second later
      constructor() { return new RealDate(1700000001000) }
    }
    const filename2 = getChatBackupFilename()
    global.Date = RealDate
    expect(filename1).not.toBe(filename2)
  })
})
