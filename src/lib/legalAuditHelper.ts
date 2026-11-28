import type { Database } from '../types/database.types.ts'

export type TicketLegalEventRow = Database['public']['Tables']['ticket_legal_events']['Row']

const INACTIVE_STATUSES = new Set([
  'CANCELADA',
  'RENUNCIADA',
  'RECHAZADA',
  'CANCELLED',
  'RENOUNCED',
  'REJECTED',
  'DECLINED',
])

const ACTIVE_SHARE_STATUSES = new Set(['ACEPTADA', 'PENDIENTE', 'ACCEPTED', 'PENDING'])
const ACTIVE_INVITE_STATUSES = new Set(['PENDIENTE', 'PENDING'])

/**
 * Cuenta exclusivamente las participaciones e invitaciones vigentes para el badge Reparto (N),
 * excluyendo cualquier registro histórico cancelado, renunciado o rechazado.
 */
export function countActiveRepartoItems(
  shares: Array<{ status: string }>,
  pendingInvites: Array<{ status: string }>
): number {
  const activeSharesCount = shares.filter((s) => {
    const st = String(s.status || '').trim().toUpperCase()
    return !INACTIVE_STATUSES.has(st) && ACTIVE_SHARE_STATUSES.has(st)
  }).length

  const activeInvitesCount = pendingInvites.filter((inv) => {
    const st = String(inv.status || '').trim().toUpperCase()
    return !INACTIVE_STATUSES.has(st) && ACTIVE_INVITE_STATUSES.has(st)
  }).length

  return activeSharesCount + activeInvitesCount
}

/**
 * Determina si un usuario tiene una firma digital activa (certificado X.509) sobre una participación.
 */
export function hasActiveDigitalParticipationSignature(
  legalEvents: Array<
    Pick<TicketLegalEventRow, 'event_type' | 'actor_user_id' | 'participation_id' | 'signature_b64' | 'cert_serial'>
  >,
  userId?: string | null,
  shareId?: string | null
): boolean {
  if (!userId && !shareId) return false
  let signed = false

  for (const ev of legalEvents) {
    const matchesActor = Boolean(userId && ev.actor_user_id === userId)
    const matchesShare = Boolean(shareId && ev.participation_id === shareId)
    if (!matchesActor && !matchesShare) continue

    if (
      ev.event_type === 'PARTICIPATION_SIGNED' &&
      Boolean(ev.signature_b64) &&
      Boolean(ev.cert_serial)
    ) {
      signed = true
    } else if (ev.event_type === 'PARTICIPATION_RENOUNCED') {
      signed = false
    }
  }

  return signed
}

export interface TimelineAuditLikeEvent {
  id: string
  action: string
  created_at: string
  percentage: number | null
  metadata: unknown
  actor?: {
    display_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  legalTitle?: string
  legalDescription?: string
  isLegalEvent?: boolean
}

function formatMethodLabel(certMethod: string | null): string {
  if (certMethod === 'autofirma') return 'AutoFirma'
  if (certMethod === 'p12') return 'Certificado .p12 / .pfx'
  if (certMethod === 'handwritten') return 'Firma manuscrita'
  return 'Certificado Digital'
}

export function formatLegalEventForTimeline(ev: TicketLegalEventRow): TimelineAuditLikeEvent {
  const meta =
    ev.metadata && typeof ev.metadata === 'object'
      ? (ev.metadata as Record<string, unknown>)
      : {}
  const nifSuffix = ev.actor_nif ? ` (NIF ${ev.actor_nif})` : ''
  const pctText = ev.share_percentage != null ? `${ev.share_percentage}%` : ''
  const methodLabel = formatMethodLabel(ev.cert_method)
  const verificationCode =
    typeof meta.verification_code === 'string' ? meta.verification_code : null

  let legalTitle = 'Evento legal'
  let legalDescription = ''

  switch (ev.event_type) {
    case 'CUSTODY_CERTIFIED':
      legalTitle = 'Custodia certificada con Certificado Digital'
      legalDescription = `Custodia certificada con Certificado Digital por ${ev.actor_name}${nifSuffix}`
      break
    case 'HANDWRITTEN_CUSTODY_SIGNED':
      legalTitle = 'Custodia firmada de forma manuscrita'
      legalDescription = `Custodia firmada de forma manuscrita por ${ev.actor_name}${nifSuffix}`
      break
    case 'PARTICIPATION_SIGNED':
      legalTitle = 'Participación firmada con Certificado Digital'
      legalDescription = `Participación (${pctText}) firmada con Certificado Digital por ${ev.actor_name}${nifSuffix}`
      break
    case 'HANDWRITTEN_PARTICIPATION_SIGNED':
      legalTitle = 'Participación firmada de forma manuscrita'
      legalDescription = `Participación (${pctText}) firmada de forma manuscrita por ${ev.actor_name}${nifSuffix}`
      break
    case 'PARTICIPATION_RENOUNCED':
      if (ev.signature_b64 && ev.cert_serial) {
        legalTitle = 'Renuncia firmada electrónicamente'
        legalDescription = `Renuncia a participación (${pctText}) firmada electrónicamente por ${ev.actor_name}${nifSuffix}`
      } else {
        legalTitle = 'Renuncia a participación'
        legalDescription = `Renuncia a participación (${pctText}) registrada por ${ev.actor_name}${nifSuffix}`
      }
      break
    case 'HANDWRITTEN_PARTICIPATION_RENOUNCED':
      legalTitle = 'Renuncia a participación (manuscrita)'
      legalDescription = `Renuncia a participación (${pctText}) registrada por ${ev.actor_name}${nifSuffix}`
      break
    default:
      legalDescription = `${ev.event_type} por ${ev.actor_name}${nifSuffix}`
  }

  return {
    id: `legal-${ev.id}`,
    action: ev.event_type,
    created_at: ev.created_at,
    percentage: ev.share_percentage != null ? Number(ev.share_percentage) : null,
    metadata: {
      ...meta,
      legal_method: methodLabel,
      verification_code: verificationCode,
      cert_serial: ev.cert_serial,
      actor_nif: ev.actor_nif,
    },
    actor: {
      display_name: ev.actor_name,
      email: null,
      avatar_url: null,
    },
    legalTitle,
    legalDescription,
    isLegalEvent: true,
  }
}

/**
 * Unifica audit_events y ticket_legal_events ordenados cronológicamente (más reciente primero).
 */
export function mergeAuditAndLegalEvents(
  auditEvents: TimelineAuditLikeEvent[],
  legalEvents: TicketLegalEventRow[]
): TimelineAuditLikeEvent[] {
  const mappedLegal = legalEvents.map(formatLegalEventForTimeline)
  return [...auditEvents, ...mappedLegal].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}
