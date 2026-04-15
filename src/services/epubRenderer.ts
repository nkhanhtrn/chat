// Stub - will be fully implemented when porting epub rendering

export class EpubRenderer {
  constructor(
    _container: HTMLElement,
    _fileData: ArrayBuffer
  ) {}

  async initialize(): Promise<void> {
    // Stub: initialize epub renderer
  }

  getTableOfContents(): unknown[] {
    return []
  }

  destroy(): void {
    // Stub: cleanup
  }
}
