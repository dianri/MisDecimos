/**
 * Utilidades para determinar la vinculación y estado de renuncias en notificaciones y alertas.
 */

export interface NotificationLike {
  id?: string
  ticket_id?: string | null
  metadata?: unknown
  action_url?: string | null
}

/**
 * Extrae el ticket_id de una notificación a través de ticket_id, metadata.ticket_id o action_url.
 */
export function extractTicketIdFromNotification(notif: NotificationLike): string | null {
  if (notif.ticket_id) return notif.ticket_id

  if (notif.metadata && typeof notif.metadata === 'object') {
    const meta = notif.metadata as Record<string, unknown>
    if (typeof meta.ticket_id === 'string' && meta.ticket_id.trim()) {
      return meta.ticket_id.trim()
    }
  }

  if (notif.action_url) {
    const match = notif.action_url.match(/(?:billetes?|decimos?|tickets?)\/([a-zA-Z0-9_-]+)/i)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Determina si el billete asociado a una notificación corresponde a una participación renunciada.
 */
export function isNotificationTicketRenounced(
  notif: NotificationLike,
  renouncedTicketIds: Set<string>
): boolean {
  const ticketId = extractTicketIdFromNotification(notif)
  if (!ticketId) return false
  return renouncedTicketIds.has(ticketId)
}

/**
 * Evalúa si se permite la navegación a la ficha del décimo desde la alerta.
 */
export function canNavigateToTicketFromAlert(
  notif: NotificationLike,
  renouncedTicketIds: Set<string>
): { canNavigate: boolean; ticketId: string | null; isRenounced: boolean } {
  const ticketId = extractTicketIdFromNotification(notif)
  if (!ticketId) {
    return { canNavigate: false, ticketId: null, isRenounced: false }
  }

  const isRenounced = renouncedTicketIds.has(ticketId)
  return {
    canNavigate: !isRenounced,
    ticketId,
    isRenounced,
  }
}
