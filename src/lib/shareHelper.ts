/**
 * Utilidades para compartir participaciones e invitaciones en MisDecimos.
 * Se utilizan secuencias de escape Unicode explícitas (\u{...}) para garantizar
 * que los emojis se codifiquen adecuadamente en UTF-8 en todas las plataformas.
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
 * Utiliza los emojis oficiales de la aplicación mediante escapes Unicode UTF-8 seguros:
 * \u{1F3AB} -> 🎟️ (Boleto/Décimo)
 * \u{1F511} -> 🔑 (Llave/Código de 6 dígitos)
 * \u{1F449} -> 👉 (Dedo indicador/Enlace de reclamación)
 */
export function buildWhatsAppShareMessage(params: WhatsAppShareParams): string {
  const ticketDisplay = params.ticketNumber ? ` Nº ${params.ticketNumber}` : ''
  const drawDisplay = params.drawName || 'Lotería'

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
