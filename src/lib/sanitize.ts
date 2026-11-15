/**
 * Utilidades de sanitización y validación de seguridad para MisDecimos.
 */

/**
 * Limpia y normaliza texto introducido por el usuario (nombres, teléfonos, notas, etiquetas).
 * Elimina etiquetas HTML, scripts, caracteres de control y espacios redundantes.
 */
export function sanitizeText(input: string | null | undefined, maxLength?: number): string {
  if (!input) return ''

  // 1. Eliminar etiquetas HTML y scripts
  let cleaned = input.replace(/<[^>]*>?/gm, '')

  // 2. Eliminar secuencias comunes de inyección de script y caracteres de control
  cleaned = cleaned.replace(/javascript:/gi, '')
  cleaned = cleaned.replace(/data:/gi, '')
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')

  // 3. Normalizar espacios en blanco consecutivos a un solo espacio
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // 4. Limitar longitud máxima si se especifica
  if (maxLength && maxLength > 0 && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim()
  }

  return cleaned
}

/**
 * Valida que una URL de imagen sea segura (https:// o ruta relativa válida).
 * Evita ataques XSS mediante protocolos no seguros (ej. javascript:).
 */
export function safeImageUrl(url?: string | null): string {
  if (!url) return ''

  const trimmed = url.trim()

  // Permitir URLs relativas locales seguras
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  // Permitir URLs absolutas con protocolo seguro HTTPS
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:') {
      return trimmed
    }
  } catch {
    return ''
  }

  return ''
}
