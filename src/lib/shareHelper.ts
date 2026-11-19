/**
 * Utilidades para compartir participaciones e invitaciones en MisDecimos.
 * Se utilizan símbolos seguros del Plano Básico Multilingüe (BMP, <= 0xFFFF)
 * para evitar caracteres corruptos (\uFFFD) producidos por clientes o pasarelas web
 * como api.whatsapp.com/send al recibir secuencias de 4 bytes (pares subrogados).
 */

export interface WhatsAppShareParams {
  percentage: number
  ticketNumber?: string | null
  drawName?: string | null
  shortCode: string
  shareUrl: string
}

/**
 * Construye el mensaje oficial formateado para compartir por WhatsApp u otras apps.
 * Utiliza símbolos Unicode seguros del plano BMP (<= 0xFFFF) para garantizar compatibilidad
 * universal en api.whatsapp.com/send sin degradación a \uFFFD.
 */
export function buildWhatsAppShareMessage(params: WhatsAppShareParams): string {
  const ticketDisplay = params.ticketNumber ? ` Nº ${params.ticketNumber}` : ''
  const drawDisplay = params.drawName || 'Lotería'

  // Símbolos Unicode BMP seguros (<= 0xFFFF):
  // \u2605 -> ★ (Estrella / Décimo destacado)
  // \u2022 -> • (Viñeta / Código de 6 dígitos)
  // \u2192 -> → (Flecha derecha / Enlace de reclamación)
  const starSymbol = '\u2605'
  const bulletSymbol = '\u2022'
  const arrowSymbol = '\u2192'

  return [
    `${starSymbol} ¡Te he compartido una participación del ${params.percentage}% para el décimo${ticketDisplay} de ${drawDisplay} en MisDecimos!`,
    `${bulletSymbol} Código de 6 dígitos: ${params.shortCode}`,
    `${arrowSymbol} Reclama tu cuota al instante aquí: ${params.shareUrl}`,
  ].join('\n\n')
}

/**
 * Genera la URL con codificación URI limpia para api.whatsapp.com
 */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
}
