export interface TicketCardPresentation {
  isPrized: boolean
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
 * diferenciando de forma destacada y celebratoria los décimos premiados (prizeAmountCents > 0).
 */
export function resolveTicketCardPresentation(params: {
  prizeAmountCents: number
  status: string
  userPercentage: number
  isArchived?: boolean
  isRenounced?: boolean
}): TicketCardPresentation {
  const isPrized = params.prizeAmountCents > 0
  const isUserActive = !params.isRenounced && params.userPercentage > 0

  const totalPrizeFormatted = `${currencyFormatter.format(params.prizeAmountCents / 100)} €`

  const userPrizeCents = Math.round((params.prizeAmountCents * params.userPercentage) / 100)
  const userPrizeFormatted = `${currencyFormatter.format(userPrizeCents / 100)} €`

  let statusBadgeLabel = params.status
  let statusBadgeClasses = ''

  if (isPrized) {
    if (params.status === 'LIQUIDADO') {
      statusBadgeLabel = 'LIQUIDADO'
      statusBadgeClasses =
        'bg-emerald-600 text-white shadow-sm border border-emerald-500'
    } else {
      statusBadgeLabel = '¡PREMIADO!'
      statusBadgeClasses =
        'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm border border-amber-400/50'
    }
  } else {
    switch (params.status) {
      case 'VALIDADO':
        statusBadgeClasses = 'bg-blue-50 text-blue-700 border-blue-200'
        break
      case 'LIQUIDADO':
        statusBadgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300'
        break
      case 'ARCHIVADO':
        statusBadgeClasses = 'bg-gray-100 text-gray-600 border-gray-200'
        break
      case 'PENDIENTE':
      default:
        statusBadgeClasses = 'bg-amber-50 text-amber-800 border-amber-200'
        break
    }
  }

  const containerClasses = isPrized
    ? 'bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/75 rounded-2xl border-y-2 border-y-amber-400/85 border-l-4 border-l-emerald-600 border-r-4 border-r-rose-500 ring-2 ring-amber-300/25 shadow-md shadow-amber-900/5 p-4 hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer space-y-3 relative overflow-hidden'
    : 'bg-white rounded-2xl border-y border-y-gray-100 border-l-4 border-l-emerald-600 border-r-4 border-r-rose-500 shadow-sm p-4 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer space-y-3 relative overflow-hidden'

  return {
    isPrized,
    totalPrizeFormatted,
    userPrizeFormatted,
    isUserActive,
    statusBadgeLabel,
    statusBadgeClasses,
    containerClasses,
  }
}
