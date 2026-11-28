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
  phone: string
  hasPhoto?: boolean
  requirePhoto: boolean
  declarationAccepted: boolean
  hasSignatureStroke: boolean
}

export interface HandwrittenFormValidation {
  valid: boolean
  normalizedNif: string
  normalizedPhone: string
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

  const phoneCheck = validateMobilePhone(input.phone)
  if (!phoneCheck.valid && phoneCheck.error) {
    errors.push(phoneCheck.error)
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
    normalizedPhone: phoneCheck.normalized,
    errors,
  }
}
