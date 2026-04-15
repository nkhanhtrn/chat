// Stub - will be fully implemented when porting book storage operations

export const BookStorage = {
  async saveBookFile(_bookId: string, _fileData: ArrayBuffer): Promise<void> {
    // Stub: save book file to IndexedDB
  },

  async getBookFile(_bookId: string): Promise<ArrayBuffer> {
    throw new Error('BookStorage.getBookFile not implemented')
  },

  async deleteBookFile(_bookId: string): Promise<void> {
    // Stub: delete book file from IndexedDB
  },
}
