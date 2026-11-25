export type AlertDotPriority = 'critical' | 'prize' | 'general'

export interface UnreadAlertSummaryItem {
  type: string
}

const CRITICAL_ALERT_TYPES = new Set([
  'ERROR',
  'CRITICAL',
  'WAIVER_REQUEST',
  'WAIVER_REJECTED',
  'PAYOUT_OVERDUE',
  'SYSTEM_ERROR',
])

const PRIZE_ALERT_TYPES = new Set([
  'PRIZE_WON',
  'PRIZE_COLLECTED',
  'TICKET_LIQUIDATED',
  'INVITE_ACCEPTED',
])

/**
 * Determina la prioridad cromática del punto indicador en la campana de alertas:
 * 1. Crítica/error -> Rojo Coral (#D04848)
 * 2. Premio / buenas noticias -> Verde Granito (#3A5245)
 * 3. General -> Oro Cava (#C5A880)
 */
export function resolveAlertDotPriority(
  unreadAlerts: UnreadAlertSummaryItem[]
): AlertDotPriority | null {
  if (!unreadAlerts || unreadAlerts.length === 0) return null

  let hasPrize = false

  for (const alert of unreadAlerts) {
    const normalized = (alert.type || '').toUpperCase()
    if (CRITICAL_ALERT_TYPES.has(normalized)) {
      return 'critical'
    }
    if (PRIZE_ALERT_TYPES.has(normalized)) {
      hasPrize = true
    }
  }

  return hasPrize ? 'prize' : 'general'
}

export function getAlertDotColorClass(priority: AlertDotPriority | null): string {
  switch (priority) {
    case 'critical':
      return 'bg-[#D04848]'
    case 'prize':
      return 'bg-[#3A5245]'
    case 'general':
      return 'bg-[#C5A880]'
    default:
      return ''
  }
}
