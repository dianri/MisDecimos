import {
  classifyUserTickets,
  type TicketRow,
  type OwnershipShareRow,
} from './ticketMetrics.ts'
import { evaluateHistoricalDraw } from './historicalDraws.ts'

export type PrizesFilterType = 'todos' | 'premiados' | 'sin_premio'

export interface ScrutinizedTicketItem {
  ticket: TicketRow
  isOwner: boolean
  userPercentage: number
  isPrized: boolean
  userPrizeCents: number
  prizeCategory: string | null
}

export interface PrizesSummaryResult {
  activeTicketsCount: number
  checkedCount: number
  sharedCount: number
  totalPlayedCents: number
  totalPlayedEuros: number
  totalPrizeCents: number
  totalPrizeEuros: number
  totalCollectedCents: number
  totalCollectedEuros: number
  scrutinizedItems: ScrutinizedTicketItem[]
  prizedCount: number
  noPrizeCount: number
}

/**
 * Determina si un décimo ha sido comprobado oficialmente (con o sin premio).
 */
export function isTicketScrutinized(ticket: Pick<TicketRow, 'prize_amount_cents' | 'last_checked_at' | 'status'>): boolean {
  return (
    ticket.prize_amount_cents > 0 ||
    ticket.last_checked_at !== null ||
    ticket.status === 'VALIDADO' ||
    ticket.status === 'LIQUIDADO'
  )
}

/**
 * Calcula los KPIs de Premios (Décimos Activos y Total Premios proporcional exacto en céntimos)
 * y genera el historial ordenado de escrutinio (premiados primero de mayor a menor importe,
 * seguidos de comprobados sin premio ordenados del sorteo más reciente al más antiguo).
 */
export function buildPrizesSummary(
  tickets: TicketRow[],
  shares: OwnershipShareRow[],
  archivedTicketIds: Set<string>,
  userId: string
): PrizesSummaryResult {
  const classified = classifyUserTickets(tickets, shares, archivedTicketIds, userId)

  let totalPrizeCents = 0
  let totalPlayedCents = 0
  let totalCollectedCents = 0
  let sharedCount = 0
  const scrutinizedItems: ScrutinizedTicketItem[] = []

  for (const item of classified.activeTickets) {
    const { ticket, isOwner, userPercentage } = item
    const isPrized = ticket.prize_amount_cents > 0
    const userPrizeCents = isPrized
      ? Math.round((ticket.prize_amount_cents * userPercentage) / 100)
      : 0

    const ticketPriceCents = Math.round((ticket.ticket_price || 20) * 100)
    totalPlayedCents += Math.round((ticketPriceCents * userPercentage) / 100)

    if (!isOwner || userPercentage < 100) {
      sharedCount += 1
    }

    if (isPrized) {
      totalPrizeCents += userPrizeCents
      const userShare = shares.find(
        (s) => s.ticket_id === ticket.id && s.user_id === userId && s.status === 'ACEPTADA'
      )
      const isCollected =
        ticket.status === 'LIQUIDADO' || Boolean(userShare?.prize_paid_confirmed)
      if (isCollected) {
        totalCollectedCents += userPrizeCents
      }
    }

    if (isTicketScrutinized(ticket)) {
      let prizeCategory: string | null = null
      if (isPrized && ticket.check_source === 'historico_oficial') {
        const evalRes = evaluateHistoricalDraw(ticket.draw_date, ticket.draw_type, ticket.number)
        if (evalRes.found && evalRes.prizeCategory) {
          prizeCategory = evalRes.prizeCategory
        }
      }

      scrutinizedItems.push({
        ticket,
        isOwner,
        userPercentage,
        isPrized,
        userPrizeCents,
        prizeCategory,
      })
    }
  }

  // Ordenar: 1º premiados de mayor a menor importe; 2º comprobados sin premio por fecha más reciente
  scrutinizedItems.sort((a, b) => {
    if (a.isPrized && !b.isPrized) return -1
    if (!a.isPrized && b.isPrized) return 1

    if (a.isPrized && b.isPrized) {
      if (b.userPrizeCents !== a.userPrizeCents) {
        return b.userPrizeCents - a.userPrizeCents
      }
      return b.ticket.draw_date.localeCompare(a.ticket.draw_date)
    }

    return b.ticket.draw_date.localeCompare(a.ticket.draw_date)
  })

  const prizedCount = scrutinizedItems.filter((i) => i.isPrized).length
  const noPrizeCount = scrutinizedItems.length - prizedCount

  return {
    activeTicketsCount: classified.totalActivosCount,
    checkedCount: scrutinizedItems.length,
    sharedCount,
    totalPlayedCents,
    totalPlayedEuros: totalPlayedCents / 100,
    totalPrizeCents,
    totalPrizeEuros: totalPrizeCents / 100,
    totalCollectedCents,
    totalCollectedEuros: totalCollectedCents / 100,
    scrutinizedItems,
    prizedCount,
    noPrizeCount,
  }
}

/**
 * Filtra los elementos del historial de escrutinio según la pestaña seleccionada.
 */
export function filterScrutinizedItems(
  items: ScrutinizedTicketItem[],
  filter: PrizesFilterType
): ScrutinizedTicketItem[] {
  if (filter === 'premiados') {
    return items.filter((item) => item.isPrized)
  }
  if (filter === 'sin_premio') {
    return items.filter((item) => !item.isPrized)
  }
  return items
}
