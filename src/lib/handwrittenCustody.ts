/**
 * Validaciones puras y utilidades para la pestaña Firma Manuscrita (acuerdo privado simple).
 */

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

export interface DniNieValidationResult {
  valid: boolean
  normalized: string
  error?: string
}

/**
 * Valida formato y letra de control oficial española para DNI (8 dígitos + letra)
 * y NIE (X/Y/Z + 7 dígitos + letra).
 */
export function validateSpanishDniNie(raw: string): DniNieValidationResult {
  const normalized = String(raw || '')
    .toUpperCase()
    .replace(/[\s.-]/g, '')
    .trim()

  if (!normalized) {
    return { valid: false, normalized: '', error: 'Introduce tu DNI o NIE.' }
  }

  const match = normalized.match(/^([XYZ]|\d)\d{7}([A-Z])$/)
  if (!match) {
    return {
      valid: false,
      normalized,
      error: 'El DNI/NIE debe tener 8 dígitos y letra (ej. 12345678Z o X1234567L).',
    }
  }

  let numPrefix = normalized.slice(0, 1)
  if (numPrefix === 'X') numPrefix = '0'
  else if (numPrefix === 'Y') numPrefix = '1'
  else if (numPrefix === 'Z') numPrefix = '2'

  const numValue = parseInt(`${numPrefix}${normalized.slice(1, 8)}`, 10)
  const expectedLetter = DNI_LETTERS[numValue % 23]
  const actualLetter = normalized.slice(8, 9)

  if (expectedLetter !== actualLetter) {
    return {
      valid: false,
      normalized,
      error: `La letra de control del DNI/NIE no es válida (se esperaba ${expectedLetter}).`,
    }
  }

  return { valid: true, normalized }
}

/**
 * Valida teléfono móvil (mínimo 9 dígitos).
 */
export function validateMobilePhone(raw: string): {
  valid: boolean
  normalized: string
  error?: string
} {
  const normalized = String(raw || '').trim()
  const digits = normalized.replace(/\D/g, '')
  if (digits.length < 9) {
    return {
      valid: false,
      normalized,
      error: 'Introduce un teléfono móvil válido (mínimo 9 dígitos).',
    }
  }
  return { valid: true, normalized }
}

export interface HandwrittenFormInput {
  fullName: string
  nif: string
  phone?: string
  hasPhoto?: boolean
  requirePhoto: boolean
  declarationAccepted: boolean
  hasSignatureStroke: boolean
}

export interface HandwrittenFormValidation {
  valid: boolean
  normalizedNif: string
  errors: string[]
}

export function validateHandwrittenForm(input: HandwrittenFormInput): HandwrittenFormValidation {
  const errors: string[] = []
  const fullName = String(input.fullName || '').trim()
  if (fullName.length < 3) {
    errors.push('Introduce tu nombre y apellidos completos.')
  }

  const dniCheck = validateSpanishDniNie(input.nif)
  if (!dniCheck.valid && dniCheck.error) {
    errors.push(dniCheck.error)
  }

  if (input.requirePhoto && !input.hasPhoto) {
    errors.push('Adjunta o fotografía el anverso del décimo.')
  }

  if (!input.declarationAccepted) {
    errors.push('Debes marcar la casilla de declaración responsable.')
  }

  if (!input.hasSignatureStroke) {
    errors.push('Dibuja tu firma manuscrita en el recuadro antes de guardar.')
  }

  return {
    valid: errors.length === 0,
    normalizedNif: dniCheck.normalized,
    errors,
  }
}

export interface HandwrittenAccordionStateInput {
  isOwner: boolean
  currentUserId?: string | null
  activeUserShareId?: string | null
  activeUserShareStatus?: string | null
  shares: Array<{
    id: string
    user_id: string
    role?: string | null
    status: string
  }>
  legalEvents: Array<{
    event_type: string
    actor_user_id: string
    participation_id?: string | null
  }>
}

export interface HandwrittenAccordionState {
  hasCurrentUserHandwrittenSigned: boolean
  otherActiveHandwrittenCount: number
}

/**
 * Evalúa de forma aislada por usuario y participation_id activo si el usuario actual
 * ha firmado de forma manuscrita y cuántos otros partícipes activos han firmado.
 */
export function evaluateHandwrittenAccordionState(
  input: HandwrittenAccordionStateInput
): HandwrittenAccordionState {
  const { isOwner, currentUserId, activeUserShareId, activeUserShareStatus, shares, legalEvents } =
    input

  let hasCurrentUserHandwrittenSigned = false
  if (currentUserId) {
    if (isOwner) {
      hasCurrentUserHandwrittenSigned = legalEvents.some(
        (ev) => ev.event_type === 'HANDWRITTEN_CUSTODY_SIGNED' && ev.actor_user_id === currentUserId
      )
    } else {
      const normalizedStatus = String(activeUserShareStatus || '').trim().toUpperCase()
      const isShareAccepted = normalizedStatus === 'ACEPTADA' || normalizedStatus === 'ACCEPTED'
      if (activeUserShareId && isShareAccepted) {
        hasCurrentUserHandwrittenSigned = legalEvents.some(
          (ev) =>
            ev.event_type === 'HANDWRITTEN_PARTICIPATION_SIGNED' &&
            ev.participation_id === activeUserShareId
        )
      }
    }
  }

  const activeThirdPartyShares = shares.filter((s) => {
    if (currentUserId && s.user_id === currentUserId) return false
    const st = String(s.status || '').trim().toUpperCase()
    return st === 'ACEPTADA' || st === 'ACCEPTED'
  })

  const signedOtherIds = new Set<string>()
  for (const share of activeThirdPartyShares) {
    const hasSigned = legalEvents.some(
      (ev) =>
        ev.event_type === 'HANDWRITTEN_PARTICIPATION_SIGNED' &&
        ev.participation_id === share.id
    )
    if (hasSigned) {
      signedOtherIds.add(share.id)
    }
  }

  return {
    hasCurrentUserHandwrittenSigned,
    otherActiveHandwrittenCount: signedOtherIds.size,
  }
}

export interface LockedCertificateIdentityInput {
  isOwner: boolean
  certification?: {
    custodian_name: string
    custodian_nif: string
  } | null
  activeUserShareId?: string | null
  legalEvents: Array<{
    event_type: string
    participation_id?: string | null
    actor_name: string
    actor_nif?: string | null
    signature_b64?: string | null
    cert_serial?: string | null
  }>
}

export interface LockedCertificateIdentity {
  isLocked: boolean
  fullName: string | null
  nif: string | null
}

/**
 * Resuelve si Nombre y DNI/NIE en Firma Manuscrita deben bloquearse
 * con los datos verificados mediante Certificado Digital previo.
 */
export function resolveLockedCertificateIdentity(
  input: LockedCertificateIdentityInput
): LockedCertificateIdentity {
  if (input.isOwner) {
    if (input.certification?.custodian_name && input.certification?.custodian_nif) {
      return {
        isLocked: true,
        fullName: input.certification.custodian_name,
        nif: input.certification.custodian_nif,
      }
    }
    const custodyEv = input.legalEvents.find(
      (ev) => ev.event_type === 'CUSTODY_CERTIFIED' && ev.actor_name && ev.actor_nif
    )
    if (custodyEv?.actor_nif) {
      return {
        isLocked: true,
        fullName: custodyEv.actor_name,
        nif: custodyEv.actor_nif,
      }
    }
    return { isLocked: false, fullName: null, nif: null }
  }

  if (!input.activeUserShareId) {
    return { isLocked: false, fullName: null, nif: null }
  }

  let activeCertName: string | null = null
  let activeCertNif: string | null = null
  for (const ev of input.legalEvents) {
    if (ev.participation_id !== input.activeUserShareId) continue
    if (ev.event_type === 'PARTICIPATION_SIGNED' && ev.signature_b64 && ev.cert_serial && ev.actor_nif) {
      activeCertName = ev.actor_name
      activeCertNif = ev.actor_nif
    } else if (ev.event_type === 'PARTICIPATION_RENOUNCED') {
      activeCertName = null
      activeCertNif = null
    }
  }

  if (activeCertName && activeCertNif) {
    return {
      isLocked: true,
      fullName: activeCertName,
      nif: activeCertNif,
    }
  }

  return { isLocked: false, fullName: null, nif: null }
}

export interface EffectiveSignerIdentityInput {
  signerRole: 'custodian' | 'participant' | string
  participationId?: string | null
  handwrittenFullName: string
  handwrittenNif: string
  certification?: {
    custodian_name: string
    custodian_nif: string
  } | null
  legalEvents: Array<{
    event_type: string
    participation_id?: string | null
    actor_name: string
    actor_nif?: string | null
    signature_b64?: string | null
    cert_serial?: string | null
  }>
}

export interface EffectiveSignerIdentity {
  fullName: string
  nif: string
  verifiedWithCert: boolean
}

/**
 * Aplica precedencia absoluta de la identidad del Certificado Digital sobre
 * cualquier nombre o DNI/NIE introducido previamente en Firma Manuscrita.
 */
export function resolveEffectiveSignerIdentity(
  input: EffectiveSignerIdentityInput
): EffectiveSignerIdentity {
  if (input.signerRole === 'custodian') {
    if (input.certification?.custodian_name && input.certification?.custodian_nif) {
      return {
        fullName: input.certification.custodian_name,
        nif: input.certification.custodian_nif,
        verifiedWithCert: true,
      }
    }
    const custodyEv = input.legalEvents.find(
      (ev) => ev.event_type === 'CUSTODY_CERTIFIED' && ev.actor_name && ev.actor_nif
    )
    if (custodyEv?.actor_nif) {
      return {
        fullName: custodyEv.actor_name,
        nif: custodyEv.actor_nif,
        verifiedWithCert: true,
      }
    }
    return {
      fullName: input.handwrittenFullName,
      nif: input.handwrittenNif,
      verifiedWithCert: false,
    }
  }

  if (input.participationId) {
    let certName: string | null = null
    let certNif: string | null = null
    for (const ev of input.legalEvents) {
      if (ev.participation_id !== input.participationId) continue
      if (
        ev.event_type === 'PARTICIPATION_SIGNED' &&
        ev.signature_b64 &&
        ev.cert_serial &&
        ev.actor_nif
      ) {
        certName = ev.actor_name
        certNif = ev.actor_nif
      } else if (ev.event_type === 'PARTICIPATION_RENOUNCED') {
        certName = null
        certNif = null
      }
    }
    if (certName && certNif) {
      return {
        fullName: certName,
        nif: certNif,
        verifiedWithCert: true,
      }
    }
  }

  return {
    fullName: input.handwrittenFullName,
    nif: input.handwrittenNif,
    verifiedWithCert: false,
  }
}
