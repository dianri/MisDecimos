/**
 * Utilidades para compartir participaciones e invitaciones en MisDecimos.
 * Se utilizan secuencias de escape Unicode explícitas (\u{...}) para evitar
 * caracteres corruptos (\uFFFD) al transferir texto a navegadores o clientes externos.
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
 * Utiliza secuencias Unicode seguras para los iconos para garantizar compatibilidad
 * multiplataforma sin depender de la codificación del archivo fuente.
 */
export function buildWhatsAppShareMessage(params: WhatsAppShareParams): string {
  const ticketDisplay = params.ticketNumber ? ` Nº ${params.ticketNumber}` : ''
  const drawDisplay = params.drawName || 'Lotería'

  // Emojis seguros mediante escapes Unicode:
  // \u{1F3AB} -> 🎟️ (Boleto/Ticket)
  // \u{1F511} -> 🔑 (Llave/Código)
  // \u{1F449} -> 👉 (Dedo indicando enlace)
  const ticketEmoji = '\u{1F3AB}'
  const keyEmoji = '\u{1F511}'
  const pointEmoji = '\u{1F449}'

  return [
    `${ticketEmoji} ¡Te he compartido una participación del ${params.percentage}% para el décimo${ticketDisplay} de ${drawDisplay} en MisDecimos!`,
    `${keyEmoji} Código de 6 dígitos: ${params.shortCode}`,
    `${pointEmoji} Reclama tu cuota al instante aquí: ${params.shareUrl}`,
  ].join('\n\n')
}

/**
 * Genera la URL con codificación URI limpia para api.whatsapp.com
 */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
}
