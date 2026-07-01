export const GlobalWorkerOptions: { workerSrc?: string } = {}

export function getDocument(): unknown {
  throw new Error('pdfjs is not available in the reader build')
}

export class TextLayer {
  // no-op stub — pdf rendering is disabled in the reader build
}
