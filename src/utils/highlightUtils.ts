import type { QuestionLink } from '@/types/message'

export function createQuestionLink(params: {
  text: string; targetMessageId: string; startOffset: number; endOffset: number
  noteContent?: string
}): QuestionLink {
  const link: QuestionLink = {
    id: crypto.randomUUID(),
    type: 'question-link',
    text: params.text,
    targetMessageId: params.targetMessageId,
    startOffset: params.startOffset,
    endOffset: params.endOffset
  }
  if (params.noteContent) {
    link.hasNote = true
    link.noteContent = params.noteContent
  }
  return link
}

export function buildConversationChain(
  messagesById: Record<string, any>,
  messageId: string
): Array<{ question: string }> {
  const chain: Array<{ question: string }> = []
  let msg = messagesById[messageId]
  while (msg) {
    chain.unshift({ question: msg.question })
    msg = msg.parentId ? messagesById[msg.parentId] : null
  }
  return chain
}

export function isMessageInTree(
  messagesById: Record<string, any>,
  messageId: string,
  rootMessageId: string
): boolean {
  let msg: any = messagesById[messageId]
  while (msg) {
    if (msg.id === rootMessageId) return true
    msg = msg.parentId ? messagesById[msg.parentId] : null
  }
  return false
}
