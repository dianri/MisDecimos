import {
  classifyUserTickets,
  buildUnifiedActiveTicketsList,
  type TicketRow,
  type OwnershipShareRow,
  type TicketItemWithMeta,
} from './ticketMetrics.ts'

export const ARCHIVE_SUCCESS_TOAST =
  'Décimo archivado en tu cuenta. Puedes consultarlo en Mi Perfil.'

export const RESTORE_SUCCESS_TOAST =
  'Décimo restaurado a tu pantalla principal.'

/**
 * Devuelve el listado de décimos y participaciones archivados del usuario,
 * ordenados por fecha de sorteo más reciente y fecha de creación descendente.
 */
export function buildArchivedTicketsList(
  tickets: TicketRow[],
  shares: OwnershipShareRow[],
  archivedTicketIds: Set<string>,
  userId: string
): TicketItemWithMeta[] {
  const { misArchivados } = classifyUserTickets(tickets, shares, archivedTicketIds, userId)
  return buildUnifiedActiveTicketsList(misArchivados)
}

/**
 * Devuelve el listado activo principal (excluyendo estrictamente los décimos archivados).
 */
export function buildMainActiveTicketsList(
  tickets: TicketRow[],
  shares: OwnershipShareRow[],
  archivedTicketIds: Set<string>,
  userId: string
): TicketItemWithMeta[] {
  const { activeTickets } = classifyUserTickets(tickets, shares, archivedTicketIds, userId)
  return buildUnifiedActiveTicketsList(activeTickets)
}

/**
 * Determina si el usuario actual puede ver el botón de eliminar en un décimo archivado.
 */
export function canDeleteArchivedTicket(ticketOwnerId: string, userId: string): boolean {
  return Boolean(ticketOwnerId && userId && ticketOwnerId === userId)
}
