import type { CheckPrizeResult } from '../services/prizeService'

export interface ShareNavigationTarget {
  ticketId: string
  state: {
    fromTab: 'decimos' | 'participaciones' | 'archivados'
    openCreateShare?: boolean
  }
}

/**
 * Resuelve el destino de navegación al pulsar el botón rápido "Compartir" en una tarjeta de décimo.
 * - Si el décimo NO tiene participaciones ni invitaciones pendientes, navega al detalle con
 *   openCreateShare: true para abrir directamente el formulario de nueva participación.
 * - Si YA tiene participaciones o invitaciones, navega al detalle normal para elegir cuál compartir.
 */
export function resolveShareButtonNavigation(params: {
  ticketId: string
  hasParticipations: boolean
  fromTab: 'decimos' | 'participaciones' | 'archivados'
}): ShareNavigationTarget {
  const { ticketId, hasParticipations, fromTab } = params

  if (!hasParticipations) {
    return {
      ticketId,
      state: {
        fromTab,
        openCreateShare: true,
      },
    }
  }

  return {
    ticketId,
    state: {
      fromTab,
    },
  }
}

/**
 * Formatea una fecha ISO YYYY-MM-DD al formato español DD/MM/AAAA.
 */
export function formatDrawDateEs(drawDate: string): string {
  const parts = drawDate.split('-')
  if (parts.length !== 3) return drawDate
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD en zona horaria Europe/Madrid.
 */
export function getTodayMadridIso(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (year && month && day) {
      return `${year}-${month}-${day}`
    }
  } catch {
    // Fallback a fecha local ISO
  }
  return now.toISOString().slice(0, 10)
}

/**
 * Evalúa si un décimo puede comprobarse ahora desde la acción rápida de la tarjeta.
 * Si drawDate > hoy (Europe/Madrid), devuelve canCheck: false con mensaje informativo.
 */
export function evaluateQuickPrizeCheckPrecondition(
  drawDate: string,
  now: Date = new Date()
): { canCheck: boolean; shortDate: string; message?: string } {
  const shortDate = formatDrawDateEs(drawDate)
  const todayIso = getTodayMadridIso(now)

  if (drawDate > todayIso) {
    return {
      canCheck: false,
      shortDate,
      message: `El sorteo del ${shortDate} aún no se ha celebrado.`,
    }
  }

  return {
    canCheck: true,
    shortDate,
  }
}

/**
 * Genera el mensaje de feedback tras ejecutar la comprobación oficial desde la tarjeta.
 */
export function formatQuickPrizeCheckToast(
  res: CheckPrizeResult,
  shortDate: string
): { type: 'success' | 'warning'; text: string } {
  if (res.ok === false) {
    return {
      type: 'warning',
      text:
        res.message ||
        `No hay resultados oficiales disponibles para el sorteo del ${shortDate}.`,
    }
  }

  if (res.prizeAmountCents > 0) {
    const categorySuffix = res.prizeCategory ? ` (${res.prizeCategory})` : ''
    return {
      type: 'success',
      text: `¡Décimo premiado con ${res.formattedPrize}!${categorySuffix}`,
    }
  }

  return {
    type: 'success',
    text: `Comprobado · Sin premio en el sorteo oficial del ${shortDate}`,
  }
}
