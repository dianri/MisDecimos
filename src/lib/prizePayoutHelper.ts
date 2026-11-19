export interface CotitularCardActionMenuState {
  showMenu: boolean
  canRequestWaiver: boolean
  canRequestPayout: boolean
  payoutButtonLabel: string
  showWaitingBanner: boolean
  canParticipantConfirmPayout: boolean
  proportionalPrizeFormatted: string
}

/**
 * Resuelve las acciones y visibilidad del menú contextual de cotitulares
 * y los botones de cobro en función del rol, estado del billete y premio.
 */
export function resolveCotitularCardActions(params: {
  isOwner: boolean
  isMe: boolean
  ticketStatus: string
  prizeAmountCents: number
  percentage: number
  status: string
  waiverRequested: boolean
  prizePaidConfirmed: boolean
  prizePayoutRequestedAt: string | null
}): CotitularCardActionMenuState {
  const isAccepted = params.status === 'ACEPTADA' && params.percentage > 0
  const hasPrize = params.prizeAmountCents > 0

  const canRequestWaiver =
    params.isOwner && !params.waiverRequested && params.ticketStatus === 'PENDIENTE'

  const canRequestPayout =
    params.isOwner && hasPrize && isAccepted && !params.prizePaidConfirmed

  const showMenu = isAccepted && (canRequestWaiver || canRequestPayout)

  const payoutButtonLabel = params.prizePayoutRequestedAt
    ? 'Reenviar solicitud de cobro'
    : 'Solicitar confirmación de cobro'

  const showWaitingBanner =
    hasPrize &&
    isAccepted &&
    Boolean(params.prizePayoutRequestedAt) &&
    !params.prizePaidConfirmed

  const canParticipantConfirmPayout =
    params.isMe &&
    !params.isOwner &&
    hasPrize &&
    isAccepted &&
    !params.prizePaidConfirmed

  const proportionalPrizeCents = hasPrize
    ? Math.round((params.prizeAmountCents * params.percentage) / 100)
    : 0

  const proportionalPrizeFormatted = (proportionalPrizeCents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'

  return {
    showMenu,
    canRequestWaiver,
    canRequestPayout,
    payoutButtonLabel,
    showWaitingBanner,
    canParticipantConfirmPayout,
    proportionalPrizeFormatted,
  }
}
