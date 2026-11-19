import type { Database } from '../types/database.types'

export type TicketRow = Database['public']['Tables']['tickets']['Row']
export type OwnershipShareRow = Database['public']['Tables']['ownership_shares']['Row']

export interface TicketItemWithMeta {
  ticket: TicketRow
  userPercentage: number
  participantsCount: number
  isOwner: boolean
  isArchived: boolean
}

export interface UserTicketListsAndMetrics {
  activeTickets: TicketItemWithMeta[]
  misDecimos: TicketItemWithMeta[]
  misParticipaciones: TicketItemWithMeta[]
  misArchivados: TicketItemWithMeta[]
  totalActivosCount: number
  totalPremiosGanados: number
}

/**
 * Filtra y clasifica los billetes del usuario calculando las listas por pestaña y los totales métricos.
 *
 * Regla de negocio estricta:
 * - Para el propietario (ticket.owner_id === userId): el décimo pertenece al usuario y computa como propio.
 * - Para un participante (ticket.owner_id !== userId): el décimo SOLO pertenece al usuario si tiene una
 *   cuota en ownership_shares con status === 'ACEPTADA' y percentage > 0.
 * - Si la cuota del usuario está en status === 'RENUNCIADA' (o no tiene cuota aceptada con porcentaje > 0),
 *   se excluye por completo de los billetes activos, total de premios, pestaña de participaciones y archivados.
 */
export function classifyUserTickets(
  tickets: TicketRow[],
  shares: OwnershipShareRow[],
  archivedTicketIds: Set<string>,
  userId: string
): UserTicketListsAndMetrics {
  const visibleTickets: TicketItemWithMeta[] = []

  for (const ticket of tickets) {
    const isOwner = ticket.owner_id === userId
    const ticketShares = shares.filter((s) => s.ticket_id === ticket.id)
    const myShare = ticketShares.find((s) => s.user_id === userId)

    // Si el usuario no es el propietario, verificar cuota activa y aceptada
    if (!isOwner) {
      const hasActiveParticipation =
        myShare?.status === 'ACEPTADA' && Number(myShare?.percentage || 0) > 0

      // Si renunció a la participación o no tiene cuota aceptada > 0%, excluir totalmente
      if (!hasActiveParticipation) {
        continue
      }
    }

    const userPercentage = isOwner
      ? (myShare ? Number(myShare.percentage) : 100)
      : Number(myShare?.percentage || 0)

    const activeShares = ticketShares.filter((s) => s.status === 'ACEPTADA')
    const isArchived = archivedTicketIds.has(ticket.id) || ticket.status === 'ARCHIVADO'

    visibleTickets.push({
      ticket,
      userPercentage,
      participantsCount: activeShares.length || 1,
      isOwner,
      isArchived,
    })
  }

  // Filtrado de listas según estado de archivo y propiedad
  const activeTickets = visibleTickets.filter((t) => !t.isArchived)
  const misDecimos = activeTickets.filter((t) => t.isOwner)
  const misParticipaciones = activeTickets.filter((t) => !t.isOwner && t.userPercentage > 0)
  const misArchivados = visibleTickets.filter((t) => t.isArchived)

  // Totales para el cuadro de mando
  const totalActivosCount = activeTickets.length
  const totalPremiosGanados = activeTickets.reduce((acc, curr) => {
    if (curr.ticket.prize_amount_cents > 0) {
      const userPrizeCents = (curr.ticket.prize_amount_cents * curr.userPercentage) / 100
      return acc + userPrizeCents / 100
    }
    return acc
  }, 0)

  return {
    activeTickets,
    misDecimos,
    misParticipaciones,
    misArchivados,
    totalActivosCount,
    totalPremiosGanados,
  }
}
