/**
 * Utilidades puras de validación de fechas, horas y respuestas oficiales para el Comprobador de Premios.
 */

export interface DrawDateStatus {
  drawDate: string
  formattedDate: string // DD/MM/AAAA
  drawYear: number
  drawStart: Date
  isFuture: boolean
  isToday: boolean
  isPast: boolean
  hasStarted: boolean
}

export interface PrizeCheckEvaluation {
  ok: boolean
  code: 'DRAW_NOT_HELD_YET' | 'DRAW_IN_PROGRESS' | 'HISTORICAL_UNAVAILABLE' | 'SUCCESS'
  message: string
  prizeAmountCents: number
  formattedPrize: string
  checkSource?: string
  listStatus?: string
}

/**
 * Formatea una fecha YYYY-MM-DD en formato DD/MM/AAAA
 */
export function formatDrawDateShort(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || ''
  const [y, m, d] = dateStr.split('-')
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

/**
 * Obtiene la hora oficial de inicio del sorteo en horario peninsular (CET / Europe/Madrid, UTC+1).
 * - Navidad: 09:00 CET
 * - El Niño: 12:00 CET
 * - Otros sorteos ordinarios: 13:00 CET
 */
export function getDrawStartTimestamp(drawDate: string, drawType?: string): Date {
  const isElNino = drawType === 'EL_NINO' || drawDate.includes('-01-06')
  const hour = isElNino ? 12 : drawType === 'NAVIDAD' || drawDate.includes('-12-22') ? 9 : 13
  const hourStr = String(hour).padStart(2, '0')
  return new Date(`${drawDate}T${hourStr}:00:00+01:00`)
}

/**
 * Evalúa el estado cronológico de la fecha de un sorteo en relación a la fecha y hora actuales.
 */
export function evaluateDrawDateStatus(params: {
  drawDate: string
  drawType?: string
  now?: Date
}): DrawDateStatus {
  const { drawDate, drawType } = params
  const now = params.now || new Date()

  const [yStr] = drawDate.split('-')
  const drawYear = parseInt(yStr, 10)
  const formattedDate = formatDrawDateShort(drawDate)
  const drawStart = getDrawStartTimestamp(drawDate, drawType)

  // Obtener fecha actual en Madrid (YYYY-MM-DD)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const curY = parts.find((p) => p.type === 'year')?.value || String(now.getFullYear())
  const curM = parts.find((p) => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0')
  const curD = parts.find((p) => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0')
  const todayStr = `${curY}-${curM}-${curD}`

  const isFuture = drawDate > todayStr || (drawDate === todayStr && now.getTime() < drawStart.getTime())
  const isToday = drawDate === todayStr
  const isPast = drawDate < todayStr
  const hasStarted = now.getTime() >= drawStart.getTime()

  return {
    drawDate,
    formattedDate,
    drawYear,
    drawStart,
    isFuture,
    isToday,
    isPast,
    hasStarted,
  }
}

/**
 * Evalúa de forma estricta la respuesta del proveedor oficial considerando el año solicitado.
 */
export function evaluateProviderResponse(params: {
  drawStatus: DrawDateStatus
  currentYear: number
  providerYear?: number
  providerStatus?: number | string
  providerError?: number | string
  prizeEuros?: number
  checkSource?: string
  listStatus?: string
}): PrizeCheckEvaluation {
  const { drawStatus, currentYear, providerYear, providerStatus, providerError, prizeEuros = 0 } = params
  const formattedDate = drawStatus.formattedDate

  // 1. Sorteo futuro o pendiente de comenzar hoy
  if (drawStatus.isFuture || !drawStatus.hasStarted) {
    return {
      ok: false,
      code: 'DRAW_NOT_HELD_YET',
      message: `Este sorteo se celebrará el ${formattedDate}. Aún no hay resultados oficiales.`,
      prizeAmountCents: 0,
      formattedPrize: '0,00 €',
    }
  }

  // 2. Validación de año: si el sorteo es de un año anterior y el proveedor no soporta histórico para ese año
  const isHistorical = drawStatus.drawYear < currentYear
  if (isHistorical) {
    // Si el proveedor retornó explícitamente un año diferente al solicitado
    if (providerYear && providerYear !== drawStatus.drawYear) {
      return {
        ok: false,
        code: 'HISTORICAL_UNAVAILABLE',
        message: `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${formattedDate}.`,
        prizeAmountCents: 0,
        formattedPrize: '0,00 €',
      }
    }

    // Si el proveedor devolvió error o status 0 para una fecha pasada
    if (providerError === 1 || providerStatus === 0 || providerStatus === '0') {
      return {
        ok: false,
        code: 'HISTORICAL_UNAVAILABLE',
        message: `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${formattedDate}.`,
        prizeAmountCents: 0,
        formattedPrize: '0,00 €',
      }
    }
  }

  // 3. Sorteo celebrado hoy y en curso
  if (drawStatus.isToday) {
    if (providerError === 1 || providerStatus === 0 || providerStatus === '0') {
      return {
        ok: false,
        code: 'DRAW_IN_PROGRESS',
        message: 'El sorteo está en curso o aún no hay resultados oficiales publicados.',
        prizeAmountCents: 0,
        formattedPrize: '0,00 €',
      }
    }
  }

  // 4. Resultado oficial verificado
  const prizeAmountCents = Math.round(Number(prizeEuros || 0) * 100)
  const formattedPrize =
    (prizeAmountCents / 100).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'

  return {
    ok: true,
    code: 'SUCCESS',
    message: prizeAmountCents > 0 ? `Premio oficial: ${formattedPrize}` : 'Sin premio en el sorteo oficial.',
    prizeAmountCents,
    formattedPrize,
    checkSource: params.checkSource || 'oficial',
    listStatus: params.listStatus || (providerStatus === 4 || providerStatus === '4' ? 'final' : 'provisional'),
  }
}
