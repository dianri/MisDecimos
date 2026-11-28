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
 * Selecciona la participación vigente (ACEPTADA / PENDIENTE) de un usuario,
 * ignorando registros históricos renunciados, cancelados o rechazados y ordenando por created_at descendente.
 */
export function findActiveUserShare<
  T extends { user_id: string; status: string; created_at?: string | null }
>(shares: T[], userId?: string | null): T | undefined {
  if (!userId) return undefined
  const active = shares.filter((s) => {
    if (s.user_id !== userId) return false
    const st = String(s.status || '').trim().toUpperCase()
    return !INACTIVE_STATUSES.has(st) && ACTIVE_SHARE_STATUSES.has(st)
  })
  if (active.length <= 1) return active[0]
  return [...active].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })[0]
}

export interface TicketSealStatus {
  isSigned: boolean
  mode: 'digital' | 'handwritten' | 'unsigned'
  title: string
  subtitle: string
  verificationCode?: string | null
}

/**
 * Resuelve el estado visual del Sello Digital del décimo (Firmado Digital, Acuerdo Manuscrito o Sin Firmar).
 */
export function resolveTicketSealState(input: {
  hasDigitalCert: boolean
  hasCustodianHandwritten: boolean
  verificationCode?: string | null
}): TicketSealStatus {
  if (input.hasDigitalCert) {
    return {
      isSigned: true,
      mode: 'digital',
      title: 'FIRMADO · SELLO DIGITAL',
      subtitle: input.verificationCode
        ? `CUSTODIA CERTIFICADA · ${input.verificationCode}`
        : 'CUSTODIA CERTIFICADA',
      verificationCode: input.verificationCode || null,
    }
  }
  if (input.hasCustodianHandwritten) {
    return {
      isSigned: true,
      mode: 'handwritten',
      title: 'FIRMADO · SELLO DIGITAL',
      subtitle: 'ACUERDO MANUSCRITO',
      verificationCode: input.verificationCode || null,
    }
  }
  return {
    isSigned: false,
    mode: 'unsigned',
    title: 'SIN FIRMAR · SELLO DIGITAL',
    subtitle: 'SELLO DIGITAL',
    verificationCode: null,
  }
}

export interface TicketDeletionBlockInput {
  isOwner: boolean
  acceptedThirdPartyCount: number
  ticketStatus: string
}

/**
 * Devuelve un mensaje claro y accionable si el décimo no puede eliminarse, o null si está permitido.
 */
export function getTicketDeletionBlockReason(input: TicketDeletionBlockInput): string | null {
  if (!input.isOwner) {
    return 'Solo el propietario del décimo puede eliminarlo.'
  }

  const count = Math.max(0, Math.floor(input.acceptedThirdPartyCount || 0))
  if (count === 1) {
    return 'No puedes eliminar este décimo porque tiene 1 participación aceptada. Para eliminarlo, el partícipe debe renunciar antes a su participación.'
  }
  if (count > 1) {
    return `No puedes eliminar este décimo porque tiene ${count} participaciones aceptadas. Para eliminarlo, los partícipes deben renunciar antes a sus participaciones.`
  }

  const normalizedStatus = String(input.ticketStatus || '').trim().toUpperCase()
  if (normalizedStatus === 'LIQUIDADO') {
    return 'No puedes eliminar este décimo porque el sorteo ya está liquidado.'
  }

  return null
}

/**
 * Extrae el mensaje real de un error de Supabase/PostgREST o Error estándar.
 */
export function extractSupabaseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  return fallback
}

/**
 * Determina si una participación concreta tiene una firma digital activa (certificado X.509).
 * Comprueba estrictamente por participation_id (nunca por actor_user_id suelto) para evitar
 * que una nueva participación herede la firma de una participación previa ya renunciada.
 */
export function hasActiveDigitalParticipationSignature(
  legalEvents: Array<
    Pick<TicketLegalEventRow, 'event_type' | 'actor_user_id' | 'participation_id' | 'signature_b64' | 'cert_serial'>
  >,
  _userId?: string | null,
  shareId?: string | null
): boolean {
  if (!shareId) return false
  let signed = false

  for (const ev of legalEvents) {
    if (!ev.participation_id || ev.participation_id !== shareId) continue

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
    case 'PARTICIPATION_ACCEPTED':
      legalTitle = 'Participación aceptada'
      legalDescription = `Participación (${pctText}) aceptada por ${ev.actor_name}${nifSuffix}`
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
