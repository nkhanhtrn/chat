// Stub - will be fully implemented when porting attachment reading

export enum AttachmentType {
  FILE = 'file',
  URL = 'url',
}

export interface ReadAttachmentParams {
  type: AttachmentType
  file?: File
  url?: string
}

export interface ReadAttachmentResult {
  content: string
  readerName?: string
}

export async function readAttachment(_params: ReadAttachmentParams): Promise<ReadAttachmentResult> {
  throw new Error('readAttachment not implemented')
}
