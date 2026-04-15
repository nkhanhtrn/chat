// Stub - will be fully implemented when porting touch drag utilities

export const touchDragState = {
  isDragging: false,
  currentX: 0,
  currentY: 0,
  messageData: null as Record<string, unknown> | null,
}

export function endTouchDrag(): void {
  touchDragState.isDragging = false
  touchDragState.messageData = null
}

export function isPointInElement(x: number, y: number, element: HTMLElement | null): boolean {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}
