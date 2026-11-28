/**
 * Lógica pura de bloqueo, verificación y generación de códigos para Certificación Legal.
 */

export interface LegalLockEvaluationInput {
  isCertified: boolean
  acceptedThirdPartyCount: number
}

export interface LegalLockEvaluation {
  isCertified: boolean
  acceptedThirdPartyCount: number
  isLocked: boolean
  canEditCriticalFields: boolean
  canDeleteTicket: boolean
  statusLabel: string
  statusDescription: string
}

/**
 * Evalúa si un décimo certificado está bloqueado frente a ediciones críticas o borrado.
 * - No certificado: editable y borrable con normalidad.
 * - Certificado con 0 participaciones aceptadas: editable/borrable (editar/borrar anula la certificación).
 * - Certificado con >= 1 participaciones aceptadas: bloqueado e inmutable.
 */
export function evaluateCertifiedTicketLock(input: LegalLockEvaluationInput): LegalLockEvaluation {
  if (!input.isCertified) {
    return {
      isCertified: false,
      acceptedThirdPartyCount: input.acceptedThirdPartyCount,
      isLocked: false,
      canEditCriticalFields: true,
      canDeleteTicket: true,
      statusLabel: 'Sin certificar',
      statusDescription: 'El décimo aún no cuenta con certificación digital de custodia.',
    }
  }

  if (input.acceptedThirdPartyCount >= 1) {
    return {
      isCertified: true,
      acceptedThirdPartyCount: input.acceptedThirdPartyCount,
      isLocked: true,
      canEditCriticalFields: false,
      canDeleteTicket: false,
      statusLabel: 'Bloqueado · Custodia protegida',
      statusDescription:
        'Existen participaciones aceptadas. Los datos críticos del décimo y su borrado están bloqueados.',
    }
  }

  return {
    isCertified: true,
    acceptedThirdPartyCount: 0,
    isLocked: false,
    canEditCriticalFields: true,
    canDeleteTicket: true,
    statusLabel: 'Certificado · Editable mientras no haya partícipes aceptados',
    statusDescription:
      'Si editas datos críticos o eliminas el décimo antes de que alguien acepte, la certificación actual se anulará.',
  }
}

/**
 * Determina si un partícipe debe firmar digitalmente la renuncia.
 * - Si firmó previamente con certificado digital -> exige firma digital de renuncia.
 * - Si solo aceptó de forma estándar -> basta con confirmación simple.
 */
export function requiresDigitalSignatureForRenounce(hasSignedParticipation: boolean): boolean {
  return Boolean(hasSignedParticipation)
}

/**
 * Genera un código único de verificación legible (ej. MD-2026-A9F2-7C1D).
 */
export function generateVerificationCode(year = new Date().getFullYear()): string {
  const bytes = new Uint8Array(4)
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')
  return `MD-${year}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

/**
 * Calcula el hash SHA-256 hexadecimal de un buffer o cadena usando Web Crypto API.
 */
export async function computeSha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data)

  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Construye el payload canónico determinista para firma digital y auditoría legal.
 */
export function buildCanonicalLegalPayload(params: {
  eventType: 'CUSTODY_CERTIFIED' | 'PARTICIPATION_ACCEPTED' | 'PARTICIPATION_SIGNED' | 'PARTICIPATION_RENOUNCED'
  ticketId: string
  ticketNumber: string
  drawDate: string
  drawName: string
  serie: string | null
  fraccion: string | null
  ticketPrice: number
  photoSha256?: string | null
  actorUserId: string
  sharePercentage?: number | null
  timestampIso: string
}): string {
  return JSON.stringify({
    v: 1,
    eventType: params.eventType,
    ticketId: params.ticketId,
    ticketNumber: params.ticketNumber,
    drawDate: params.drawDate,
    drawName: params.drawName,
    serie: params.serie || '001',
    fraccion: params.fraccion || '01',
    ticketPrice: Number(params.ticketPrice || 20),
    photoSha256: params.photoSha256 || null,
    actorUserId: params.actorUserId,
    sharePercentage: params.sharePercentage ?? null,
    timestampIso: params.timestampIso,
  })
}
