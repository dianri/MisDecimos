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
 * Estructura estándar SELAE (20 dígitos):
 * [Prefijo 2d][Código Sorteo 5d][Fracción 2d][Serie 3d][Número Décimo 5d][Control 3d]
 * Ejemplo: 51020101100876719833 -> Número: 76719, Fracción: 11, Serie: 008, Sorteo: 02010, Control: 833
 */
export function parseSelaeBarcode(rawInput: string): SelaeParsedTicket {
  if (!rawInput) {
    return createEmptyResult('', 'Código de barras vacío')
  }

  // 1. Limpieza de prefijos GS1, espacios, guiones y caracteres de control
  let cleaned = rawInput
    .replace(/^\][a-zA-Z0-9]{2}/, '') // Elimina prefijo GS1 AIM tipo ']C1'
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

  // 3. Estructura estándar SELAE (20 dígitos canónicos con prefijo 51 o 01)
  // Patrón canónico SELAE:
  // (51|01) -> Prefijo juego Lotería Nacional (2 dígitos)
  // (\d{5}) -> Código interno de sorteo (5 dígitos, ej. 02010)
  // (\d{2}) -> Fracción (2 dígitos, ej. 11)
  // (\d{3}) -> Serie (3 dígitos, ej. 008)
  // (\d{5}) -> Número del décimo (5 dígitos, ej. 76719)
  // (\d{3}) -> Dígitos de control (3 dígitos, ej. 833)
  const selae20Regex = /(?:51|01)(\d{5})(\d{2})(\d{3})(\d{5})(\d{3})/
  const match20 = digitsOnly.match(selae20Regex)

  if (match20) {
    const drawCode = match20[1]
    const fraction = String(parseInt(match20[2], 10) || 1).padStart(2, '0')
    const series = String(parseInt(match20[3], 10) || 1).padStart(3, '0')
    const ticketNumber = match20[4]
    const checkDigits = match20[5]

    return {
      isValid: true,
      number: ticketNumber,
      ticketNumber,
      serie: series,
      series,
      fraccion: fraction,
      fraction,
      drawCode,
      checkDigits,
      drawType: upcoming.drawType,
      drawName: upcoming.drawName,
      drawDate: upcoming.drawDate,
      ticketPrice: upcoming.ticketPrice,
      barcodeRaw: rawInput,
      confidence: 'HIGH',
    }
  }

  // 4. Variante de 20 dígitos exactos con prefijo genérico de 2 dígitos
  if (digitsOnly.length === 20) {
    const alt20Match = digitsOnly.match(/^(\d{2})(\d{5})(\d{2})(\d{3})(\d{5})(\d{3})$/)
    if (alt20Match) {
      const drawCode = alt20Match[2]
      const fraction = String(parseInt(alt20Match[3], 10) || 1).padStart(2, '0')
      const series = String(parseInt(alt20Match[4], 10) || 1).padStart(3, '0')
      const ticketNumber = alt20Match[5]
      const checkDigits = alt20Match[6]

      return {
        isValid: true,
        number: ticketNumber,
        ticketNumber,
        serie: series,
        series,
        fraccion: fraction,
        fraction,
        drawCode,
        checkDigits,
        drawType: upcoming.drawType,
        drawName: upcoming.drawName,
        drawDate: upcoming.drawDate,
        ticketPrice: upcoming.ticketPrice,
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
