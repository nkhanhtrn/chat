// Stub - will be fully implemented when porting Firestore operations

export async function syncChatStateWithSubcollections(
  _state: Record<string, unknown>,
  _changedIds: Set<string> | null,
  _deletedIds: Set<string> | null
): Promise<void> {
  // Stub: Firestore sync
}

export async function loadChatMetadata(): Promise<Record<string, unknown> | null> {
  return null
}

export async function loadMessagesForChat(_chatId: string): Promise<Record<string, unknown>> {
  return {}
}
