/**
 * Parser de Código de Barras GS1-128 / Code-128 / ITF de Lotería Nacional (SELAE)
 */

export interface SelaeParsedTicket {
  isValid: boolean
  number: string
  ticketNumber: string
  serie: string
  series: string
  fraccion: string
  fraction: string
  drawCode?: string
  drawYearCode?: string
  year?: number
  checkDigits?: string
  drawType: 'NAVIDAD' | 'EL_NINO'
  drawName: string
  drawDate: string // YYYY-MM-DD
  ticketPrice: number
  barcodeRaw: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  errorMessage?: string
}

/**
 * Calcula el próximo sorteo oficial extraordinario (Navidad o El Niño)
 * - 1 de Enero a 6 de Enero: El Niño del año en curso
 * - 7 de Enero a 22 de Diciembre: Navidad del año en curso
 * - 23 de Diciembre en adelante: El Niño del año siguiente
 */
export function getUpcomingDraw(today: Date = new Date()): {
  drawType: 'NAVIDAD' | 'EL_NINO'
  drawName: string
  drawDate: string
  ticketPrice: number
} {
  const year = today.getFullYear()
  const month = today.getMonth() // 0-11
  const day = today.getDate()

  // 1 al 6 de Enero -> El Niño del año en curso
  if (month === 0 && day <= 6) {
    return {
      drawType: 'EL_NINO',
      drawName: `Sorteo Extraordinario de El Niño ${year}`,
      drawDate: `${year}-01-06`,
      ticketPrice: 20.0,
    }
  }

  // 7 de Enero al 22 de Diciembre -> Navidad del año en curso
  if (month < 11 || (month === 11 && day <= 22)) {
    return {
      drawType: 'NAVIDAD',
      drawName: `Sorteo Extraordinario de Navidad ${year}`,
      drawDate: `${year}-12-22`,
      ticketPrice: 20.0,
    }
  }

  // A partir del 23 de Diciembre -> El Niño del año siguiente
  const nextYear = year + 1
  return {
    drawType: 'EL_NINO',
    drawName: `Sorteo Extraordinario de El Niño ${nextYear}`,
    drawDate: `${nextYear}-01-06`,
    ticketPrice: 20.0,
  }
}

/**
 * Normaliza y decodifica un código de barras de décimo de SELAE.
 * Estructura verificada en décimos físicos oficiales de SELAE (20 dígitos canónicos: 1 + 3 + 1 + 2 + 3 + 6 + 4):
 * [Juego (1d=5)][Código Sorteo (3d)][Dígito Año (1d)][Fracción (2d)][Serie (3d)][Número Décimo (6d, slice -5)][Control (4d)]
 *
 * Ejemplos reales de producción:
 * - 5102502115>0493073567 -> 5 (Lotería Nac.) + 102 (Navidad) + 5 (2025) + 02 (Fracc.) + 115 (Serie) + 049307 (Nº 49307) + 3567 (Control) -> Navidad, 2025-12-22
 * - 5002001002>0880082456 -> 5 (Lotería Nac.) + 002 (El Niño) + 0 (2020) + 01 (Fracc.) + 002 (Serie) + 088008 (Nº 88008) + 2456 (Control) -> El Niño, 2020-01-06
 * - 5102607065>0023205830 -> 5 (Lotería Nac.) + 102 (Navidad) + 6 (2026) + 07 (Fracc.) + 065 (Serie) + 002320 (Nº 02320) + 5830 (Control) -> Navidad, 2026-12-22
 */
export function parseSelaeBarcode(rawInput: string): SelaeParsedTicket {
  if (!rawInput) {
    return createEmptyResult('', 'Código de barras vacío')
  }

  // 1. Limpieza de prefijos GS1, espacios, guiones, separadores como '>' y caracteres de control
  let cleaned = rawInput
    .replace(/^\][a-zA-Z0-9]{2}/, '') // Elimina prefijo GS1 AIM tipo ']C1'
    .replace(/[>]/g, '')
    .replace(/[\s\-_().]/g, '')
    .trim()

  // 2. Corrección de errores comunes de OCR si hubiera caracteres alfabéticos
  cleaned = cleaned
    .replace(/O/gi, '0')
    .replace(/I/gi, '1')
    .replace(/L/gi, '1')
    .replace(/Z/gi, '2')
    .replace(/S/gi, '5')
    .replace(/B/gi, '8')

  // Solo dígitos
  const digitsOnly = cleaned.replace(/\D/g, '')

  // Si no hay suficientes dígitos numéricos
  if (digitsOnly.length < 5) {
    return createEmptyResult(rawInput, 'Código de barras demasiado corto o ilegible')
  }

  const upcoming = getUpcomingDraw()

  // 3. Estructura estándar oficial SELAE (20 dígitos canónicos: 1 + 3 + 1 + 2 + 3 + 6 + 4)
  // (?:01)?5 -> Prefijo juego Lotería Nacional (1 dígito '5', opcionalmente precedido de AI '01')
  // (\d{3})  -> Código sorteo (3 dígitos: 102 = Navidad, 002 = El Niño)
  // (\d{1})  -> Último dígito del año (1 dígito: 0..9 -> 2020 + d)
  // (\d{2})  -> Fracción (2 dígitos: 01..10)
  // (\d{3})  -> Serie (3 dígitos: 001..185)
  // (\d{6})  -> Número de 6 dígitos con cero inicial (slice(-5))
  // (\d{4})  -> Dígitos de control (4 dígitos)
  const selae20Regex = /(?:01)?5(\d{3})(\d{1})(\d{2})(\d{3})(\d{6})(\d{4})/
  const match20 = digitsOnly.match(selae20Regex)

  if (match20) {
    const drawCode = match20[1]
    const yearDigit = match20[2]
    const fullYear = 2020 + Number(yearDigit)
    const fraction = String(parseInt(match20[3], 10) || 1).padStart(2, '0')
    const series = String(parseInt(match20[4], 10) || 1).padStart(3, '0')
    const rawNumber = match20[5]
    const ticketNumber = rawNumber.slice(-5)
    const checkDigits = match20[6]

    let drawType: 'NAVIDAD' | 'EL_NINO' = 'NAVIDAD'
    let drawDate = `${fullYear}-12-22`
    let drawName = `Sorteo Extraordinario de Navidad ${fullYear}`

    if (drawCode === '102') {
      drawType = 'NAVIDAD'
      drawDate = `${fullYear}-12-22`
      drawName = `Sorteo Extraordinario de Navidad ${fullYear}`
    } else if (drawCode === '002') {
      drawType = 'EL_NINO'
      drawDate = `${fullYear}-01-06`
      drawName = `Sorteo Extraordinario de El Niño ${fullYear}`
    } else {
      // Sorteo ordinario
      drawType = upcoming.drawType
      drawDate = upcoming.drawDate
      drawName = `Sorteo Ordinario ${drawCode} (${fullYear})`
    }

    return {
      isValid: true,
      number: ticketNumber,
      ticketNumber,
      serie: series,
      series,
      fraccion: fraction,
      fraction,
      drawCode,
      drawYearCode: drawCode,
      year: fullYear,
      checkDigits,
      drawType,
      drawName,
      drawDate,
      ticketPrice: 20.0,
      barcodeRaw: rawInput,
      confidence: 'HIGH',
    }
  }

  // 4. Variante de 20 dígitos exactos con prefijo genérico de 1 dígito (1 + 3 + 1 + 2 + 3 + 6 + 4)
  if (digitsOnly.length === 20) {
    const alt20Match = digitsOnly.match(/^(\d{1})(\d{3})(\d{1})(\d{2})(\d{3})(\d{6})(\d{4})$/)
    if (alt20Match) {
      const drawCode = alt20Match[2]
      const yearDigit = alt20Match[3]
      const fullYear = 2020 + Number(yearDigit)
      const fraction = String(parseInt(alt20Match[4], 10) || 1).padStart(2, '0')
      const series = String(parseInt(alt20Match[5], 10) || 1).padStart(3, '0')
      const rawNumber = alt20Match[6]
      const ticketNumber = rawNumber.slice(-5)
      const checkDigits = alt20Match[7]

      let drawType: 'NAVIDAD' | 'EL_NINO' = 'NAVIDAD'
      let drawDate = `${fullYear}-12-22`
      let drawName = `Sorteo Extraordinario de Navidad ${fullYear}`

      if (drawCode === '102') {
        drawType = 'NAVIDAD'
        drawDate = `${fullYear}-12-22`
        drawName = `Sorteo Extraordinario de Navidad ${fullYear}`
      } else if (drawCode === '002') {
        drawType = 'EL_NINO'
        drawDate = `${fullYear}-01-06`
        drawName = `Sorteo Extraordinario de El Niño ${fullYear}`
      } else {
        drawType = upcoming.drawType
        drawDate = upcoming.drawDate
        drawName = `Sorteo Ordinario ${drawCode} (${fullYear})`
      }

      return {
        isValid: true,
        number: ticketNumber,
        ticketNumber,
        serie: series,
        series,
        fraccion: fraction,
        fraction,
        drawCode,
        drawYearCode: drawCode,
        year: fullYear,
        checkDigits,
        drawType,
        drawName,
        drawDate,
        ticketPrice: 20.0,
        barcodeRaw: rawInput,
        confidence: 'HIGH',
      }
    }
  }

  // 5. Entrada directa de 5 dígitos (solo el número del décimo)
  if (digitsOnly.length === 5) {
    return {
      isValid: true,
      number: digitsOnly,
      ticketNumber: digitsOnly,
      serie: '001',
      series: '001',
      fraccion: '01',
      fraction: '01',
      drawType: upcoming.drawType,
      drawName: upcoming.drawName,
      drawDate: upcoming.drawDate,
      ticketPrice: upcoming.ticketPrice,
      barcodeRaw: rawInput,
      confidence: 'MEDIUM',
    }
  }

  // Si no se ajusta al estándar de SELAE, no inventar datos falsos
  return createEmptyResult(
    rawInput,
    'Código de barras no reconocido como décimo de Lotería Nacional'
  )
}

function createEmptyResult(rawInput: string, errorMessage?: string): SelaeParsedTicket {
  const upcoming = getUpcomingDraw()
  return {
    isValid: false,
    number: '',
    ticketNumber: '',
    serie: '001',
    series: '001',
    fraccion: '01',
    fraction: '01',
    drawType: upcoming.drawType,
    drawName: upcoming.drawName,
    drawDate: upcoming.drawDate,
    ticketPrice: upcoming.ticketPrice,
    barcodeRaw: rawInput,
    confidence: 'LOW',
    errorMessage: errorMessage || 'Código de barras no reconocido como décimo de Lotería Nacional',
  }
}
