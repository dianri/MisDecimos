export type SwipeSide = 'left' | 'right' | null

export const SWIPE_ACTION_WIDTH = 84
export const SWIPE_OPEN_THRESHOLD = 42

/**
 * Calcula el desplazamiento horizontal limitado (clamped) durante el arrastre táctil.
 * - dx > 0: desliza hacia la derecha (revela Archivar a la izquierda)
 * - dx < 0: desliza hacia la izquierda (revela Eliminar a la derecha)
 */
export function clampSwipeOffset(dx: number, baseOffset: number = 0): number {
  const raw = baseOffset + dx
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, raw))
}

/**
 * Determina el estado final (abierto a izquierda, derecha o cerrado) al soltar el dedo.
 */
export function resolveSwipeSnap(offsetX: number): {
  side: SwipeSide
  snappedOffset: number
} {
  if (offsetX >= SWIPE_OPEN_THRESHOLD) {
    return { side: 'left', snappedOffset: SWIPE_ACTION_WIDTH }
  }
  if (offsetX <= -SWIPE_OPEN_THRESHOLD) {
    return { side: 'right', snappedOffset: -SWIPE_ACTION_WIDTH }
  }
  return { side: null, snappedOffset: 0 }
}

/**
 * Determina si un gesto inicial debe bloquearse como horizontal o dejarse pasar al scroll vertical.
 */
export function detectHorizontalSwipeLock(
  dx: number,
  dy: number,
  minDistance: number = 10
): 'horizontal' | 'vertical' | 'undecided' {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (absX < minDistance && absY < minDistance) {
    return 'undecided'
  }
  if (absX > absY * 1.2) {
    return 'horizontal'
  }
  return 'vertical'
}

/**
 * Resuelve si el clic sobre una tarjeta debe navegar al detalle o cerrar el swipe abierto.
 */
export function resolveCardTapWithSwipe(
  ticketId: string,
  openSwipeTicketId: string | null
): { action: 'close_swipe' | 'navigate' } {
  if (openSwipeTicketId === ticketId) {
    return { action: 'close_swipe' }
  }
  return { action: 'navigate' }
}

/**
 * Resuelve la transición de modales al pulsar "Tengo un código" dentro del escáner unificado.
 */
export function resolveScannerHaveCodeTransition(): {
  closeScanner: boolean
  openClaimModal: boolean
  resetClaimCode: boolean
} {
  return {
    closeScanner: true,
    openClaimModal: true,
    resetClaimCode: true,
  }
}
