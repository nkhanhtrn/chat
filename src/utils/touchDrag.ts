import { reactive } from 'vue'

interface TouchDragState {
  isDragging: boolean
  messageId: string | null
  messageData: Record<string, unknown> | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  ghostElement: HTMLElement | null
}

export const touchDragState = reactive<TouchDragState>({
  isDragging: false,
  messageId: null,
  messageData: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  ghostElement: null,
})

const DRAG_THRESHOLD = 10
const LONG_PRESS_DURATION = 300

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let hasMoved = false

export function startTouchDrag(event: TouchEvent, messageId: string, messageData: Record<string, unknown>): void {
  const touch = event.touches[0]
  touchDragState.startX = touch.clientX
  touchDragState.startY = touch.clientY
  touchDragState.currentX = touch.clientX
  touchDragState.currentY = touch.clientY
  touchDragState.messageId = messageId
  touchDragState.messageData = messageData
  hasMoved = false

  longPressTimer = setTimeout(() => {
    if (!hasMoved) {
      touchDragState.isDragging = true
      createGhostElement(messageData)
      if (navigator.vibrate) navigator.vibrate(50)
    }
  }, LONG_PRESS_DURATION)
}

export function moveTouchDrag(event: TouchEvent): void {
  if (!touchDragState.messageId) return

  const touch = event.touches[0]
  const deltaX = Math.abs(touch.clientX - touchDragState.startX)
  const deltaY = Math.abs(touch.clientY - touchDragState.startY)

  if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
    hasMoved = true
    if (longPressTimer && !touchDragState.isDragging) {
      clearTimeout(longPressTimer)
      longPressTimer = null
      cancelTouchDrag()
      return
    }
  }

  if (!touchDragState.isDragging) return

  event.preventDefault()
  touchDragState.currentX = touch.clientX
  touchDragState.currentY = touch.clientY

  if (touchDragState.ghostElement) {
    touchDragState.ghostElement.style.left = `${touch.clientX - 50}px`
    touchDragState.ghostElement.style.top = `${touch.clientY - 20}px`
  }
}

export function endTouchDrag(): { messageId: string; messageData: Record<string, unknown>; x: number; y: number } | null {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  const wasActiveDrag = touchDragState.isDragging
  const result = wasActiveDrag ? {
    messageId: touchDragState.messageId!,
    messageData: touchDragState.messageData!,
    x: touchDragState.currentX,
    y: touchDragState.currentY,
  } : null

  removeGhostElement()
  touchDragState.isDragging = false
  touchDragState.messageId = null
  touchDragState.messageData = null
  touchDragState.startX = 0
  touchDragState.startY = 0
  touchDragState.currentX = 0
  touchDragState.currentY = 0

  return result
}

export function cancelTouchDrag(): void {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  removeGhostElement()
  touchDragState.isDragging = false
  touchDragState.messageId = null
  touchDragState.messageData = null
}

function createGhostElement(messageData: Record<string, unknown>): void {
  removeGhostElement()
  const ghost = document.createElement('div')
  ghost.className = 'touch-drag-ghost'
  ghost.textContent = (messageData?.questionSummarized || messageData?.question || 'Dragging...') as string
  ghost.style.cssText = `
    position: fixed;
    left: ${touchDragState.currentX - 50}px;
    top: ${touchDragState.currentY - 20}px;
    max-width: 200px;
    padding: 8px 12px;
    background: var(--color-primary, #6366f1);
    color: white;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: 'Georgia', serif;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.95;
  `
  document.body.appendChild(ghost)
  touchDragState.ghostElement = ghost
}

function removeGhostElement(): void {
  if (touchDragState.ghostElement) {
    touchDragState.ghostElement.remove()
    touchDragState.ghostElement = null
  }
}

export function isPointInElement(x: number, y: number, element: HTMLElement | null): boolean {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}
