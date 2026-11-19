import { parseSelaeBarcode, type SelaeParsedTicket } from './selaeBarcodeParser.ts'

export type ClassifiedScanPayload =
  | {
      kind: 'INVITE'
      inviteCodeOrToken: string
      sourceFormat: 'url' | 'json' | 'pin' | 'token'
    }
  | {
      kind: 'TICKET'
      parsed: SelaeParsedTicket
    }
  | {
      kind: 'UNKNOWN'
      rawText: string
      errorMessage: string
    }

/**
 * Analiza y clasifica polimórficamente el texto leído por el escáner de cámara o archivo.
 * Discrimina de forma automática entre:
 * 1. Invitaciones de cotitularidad (QR con URL, token criptográfico UUID, JSON o PIN numérico/alfanumérico de 6 dígitos)
 * 2. Décimos de Lotería Nacional (código de barras físico SELAE GS1-128 de 20 dígitos o número de 5 dígitos)
 * 3. Códigos ajenos o no reconocidos
 */
export function classifyScannedPayload(rawText: string): ClassifiedScanPayload {
  if (!rawText || !rawText.trim()) {
    return {
      kind: 'UNKNOWN',
      rawText: rawText || '',
      errorMessage: 'Código vacío o ilegible',
    }
  }

  const trimmed = rawText.trim()

  // 1. Detección de Payload JSON (ej. QR con objeto estructurado de invitación)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(trimmed)
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        const potentialKeys = [
          'inviteToken',
          'token',
          'inviteCode',
          'shortCode',
          'short_code',
          'invite_token',
          'code',
          'pin',
        ]
        for (const key of potentialKeys) {
          const val = parsedJson[key]
          if (typeof val === 'string' && val.trim().length > 0) {
            return {
              kind: 'INVITE',
              inviteCodeOrToken: val.trim(),
              sourceFormat: 'json',
            }
          } else if (typeof val === 'number') {
            return {
              kind: 'INVITE',
              inviteCodeOrToken: String(val),
              sourceFormat: 'json',
            }
          }
        }
      }
    } catch {
      // Continuar si no es un JSON válido
    }
  }

  // 2. Detección de URL de Invitación (ej. https://misdecimos.dianrie.com/invite/<token>)
  // o variantes de ruta (/invitacion/, /claim/, /reclamar/)
  const urlRouteMatch = trimmed.match(
    /(?:invite|invitacion|invitaciones|claim|reclamar)\/([a-zA-Z0-9_-]+)/i
  )
  if (urlRouteMatch && urlRouteMatch[1]) {
    return {
      kind: 'INVITE',
      inviteCodeOrToken: urlRouteMatch[1],
      sourceFormat: 'url',
    }
  }

  // Parámetros de consulta en URL (ej. ?token=XYZ, ?invite=XYZ, ?code=XYZ, ?pin=XYZ)
  if (
    trimmed.includes('?') &&
    (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/'))
  ) {
    try {
      const dummyBase = 'https://misdecimos.local'
      const parsedUrl = new URL(trimmed.startsWith('/') ? `${dummyBase}${trimmed}` : trimmed)
      const paramKeys = ['token', 'invite_token', 'invite', 'code', 'pin', 'short_code']
      for (const p of paramKeys) {
        const pVal = parsedUrl.searchParams.get(p)
        if (pVal && pVal.trim().length > 0) {
          return {
            kind: 'INVITE',
            inviteCodeOrToken: pVal.trim(),
            sourceFormat: 'url',
          }
        }
      }
    } catch {
      // Ignorar errores de URL
    }
  }

  // 3. Detección de Token UUID (36 caracteres estándar: 8-4-4-4-12)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  if (uuidRegex.test(trimmed)) {
    return {
      kind: 'INVITE',
      inviteCodeOrToken: trimmed,
      sourceFormat: 'token',
    }
  }

  // 4. Detección de Décimo de Lotería Nacional (SELAE)
  const selaeResult = parseSelaeBarcode(trimmed)
  const cleanDigits = trimmed.replace(/\D/g, '')

  // Si tiene 18 a 24 dígitos y es válido según la estructura oficial SELAE
  if (selaeResult.isValid && cleanDigits.length >= 18) {
    return {
      kind: 'TICKET',
      parsed: selaeResult,
    }
  }

  // 5. Detección de Código Corto / PIN de 6 caracteres de Invitación (ej. 847392 o ABC123)
  const isSixCharPin = /^[a-zA-Z0-9]{6}$/.test(trimmed)
  if (isSixCharPin) {
    return {
      kind: 'INVITE',
      inviteCodeOrToken: trimmed,
      sourceFormat: 'pin',
    }
  }

  // 6. Número directo de décimo de 5 dígitos
  if (selaeResult.isValid && cleanDigits.length === 5) {
    return {
      kind: 'TICKET',
      parsed: selaeResult,
    }
  }

  // 7. Código ajeno no reconocido
  return {
    kind: 'UNKNOWN',
    rawText: trimmed,
    errorMessage: 'Código no reconocido. Escanea el código de barras de un décimo o el QR de una invitación.',
  }
}
