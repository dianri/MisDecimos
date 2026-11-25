export interface TicketCardPresentation {
  isPrized: boolean
  isCheckedWithoutPrize: boolean
  totalPrizeFormatted: string
  userPrizeFormatted: string
  isUserActive: boolean
  statusBadgeLabel: string
  statusBadgeClasses: string
  containerClasses: string
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

/**
 * Resuelve la lógica de presentación visual de las tarjetas de billetes en el listado,
 * siguiendo el sistema "Titanio, Oro Cava y Verde Granito" (estilo minimalista Apple).
 * - Si está premiado (prizeAmountCents > 0): superficie champán luminosa con borde Oro Cava (#C5A880).
 * - Si está comprobado sin premio: muestra píldora [✓ Comprobado] en Verde Granito (#3A5245).
 */
export function resolveTicketCardPresentation(params: {
  prizeAmountCents: number
  status: string
  userPercentage: number
  isOwner?: boolean
  isArchived?: boolean
  isRenounced?: boolean
  lastCheckedAt?: string | null
}): TicketCardPresentation {
  const isPrized = params.prizeAmountCents > 0
  const isUserActive = !params.isRenounced && params.userPercentage > 0
  const isCheckedWithoutPrize =
    !isPrized && (params.status === 'VALIDADO' || Boolean(params.lastCheckedAt))

  const totalPrizeFormatted = `${currencyFormatter.format(params.prizeAmountCents / 100)} €`

  const userPrizeCents = Math.round((params.prizeAmountCents * params.userPercentage) / 100)
  const userPrizeFormatted = `${currencyFormatter.format(userPrizeCents / 100)} €`

  let statusBadgeLabel = params.status
  let statusBadgeClasses = ''

  if (isPrized) {
    statusBadgeLabel = params.status === 'LIQUIDADO' ? 'LIQUIDADO' : '¡PREMIADO!'
    statusBadgeClasses = 'bg-[#3A5245] text-[#FFFFFF] border border-[#3A5245]'
  } else if (isCheckedWithoutPrize) {
    statusBadgeLabel = '✓ Comprobado'
    statusBadgeClasses =
      'bg-[#3A5245] text-[#FFFFFF] dark:text-[#F5F5F7] border border-[#3A5245]'
  } else {
    switch (params.status) {
      case 'LIQUIDADO':
        statusBadgeClasses =
          'bg-[#3A5245] text-[#FFFFFF] dark:text-[#F5F5F7] border border-[#3A5245]'
        break
      case 'ARCHIVADO':
        statusBadgeClasses =
          'bg-[#1D1D1F]/10 dark:bg-[#F5F5F7]/10 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 border border-transparent'
        break
      case 'PENDIENTE':
      default:
        statusBadgeClasses =
          'bg-transparent border border-[#1D1D1F]/15 dark:border-[#F5F5F7]/15 text-[#1D1D1F]/55 dark:text-[#F5F5F7]/55'
        break
    }
  }

  const swipeEdgeClasses = 'border-l-4 border-l-[#3A5245] border-r-4 border-r-[#D04848]'

  const containerClasses = isPrized
    ? `bg-gradient-to-br from-[#FCF9F3] via-[#F7EFE0] to-[#EFE0C4] dark:from-[#262017] dark:via-[#1F1B15] dark:to-[#1D1D1F] border-[1.5px] border-[#C5A880] dark:border-[#C5A880]/75 ${swipeEdgeClasses} shadow-[0_4px_16px_rgba(197,168,128,0.18)] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-[22px] p-5 hover:brightness-[0.98] active:scale-[0.99] transition-all cursor-pointer space-y-4 relative overflow-hidden`
    : `bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] rounded-[22px] border-y border-y-[#1D1D1F]/[0.07] dark:border-y-[#F5F5F7]/[0.08] ${swipeEdgeClasses} shadow-[0_2px_10px_rgba(29,29,31,0.04)] dark:shadow-none p-5 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer space-y-4 relative overflow-hidden`

  return {
    isPrized,
    isCheckedWithoutPrize,
    totalPrizeFormatted,
    userPrizeFormatted,
    isUserActive,
    statusBadgeLabel,
    statusBadgeClasses,
    containerClasses,
  }
}
