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
