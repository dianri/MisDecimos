export type ShareSwipeAction = 'renounce' | 'request_waiver' | null

export interface ShareSwipeParams {
  isOwner: boolean
  isMe: boolean
  shareRole: string
  shareStatus: string
  waiverRequested: boolean
  ticketStatus: string
  prizeAmountCents: number
}

/**
 * Resuelve la acción de deslizamiento hacia la izquierda en una tarjeta de participación:
 * - 'renounce': el propio cotitular puede renunciar directamente a su cuota.
 * - 'request_waiver': el propietario puede solicitar formalmente la renuncia al cotitular.
 * - null: no hay acción de renuncia disponible.
 */
export function resolveParticipantShareSwipeAction(
  params: ShareSwipeParams
): ShareSwipeAction {
  const {
    isOwner,
    isMe,
    shareRole,
    shareStatus,
    waiverRequested,
    ticketStatus,
    prizeAmountCents,
  } = params

  if (
    isMe &&
    shareRole === 'PARTICIPANTE' &&
    shareStatus === 'ACEPTADA' &&
    ticketStatus !== 'LIQUIDADO' &&
    !(ticketStatus === 'VALIDADO' && prizeAmountCents > 0) &&
    !waiverRequested
  ) {
    return 'renounce'
  }

  if (
    isOwner &&
    !waiverRequested &&
    ticketStatus === 'PENDIENTE' &&
    shareStatus === 'ACEPTADA'
  ) {
    return 'request_waiver'
  }

  return null
}

export function getShareSwipeActionLabel(action: ShareSwipeAction): string | null {
  if (action === 'renounce') return 'Renunciar'
  if (action === 'request_waiver') return 'Solicitar renuncia'
  return null
}
