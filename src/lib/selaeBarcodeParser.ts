/**
 * Parser de Código de Barras GS1-128 / Code-128 / ITF de Lotería Nacional (SELAE)
 */

export interface SelaeParsedTicket {
  isValid: boolean
  number: string
  serie: string
  fraccion: string
  drawType: 'NAVIDAD' | 'EL_NINO'
  drawName: string
  drawDate: string // YYYY-MM-DD
  ticketPrice: number
  barcodeRaw: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * Normaliza y decodifica un código de barras de décimo de SELAE.
 */
export function parseSelaeBarcode(rawInput: string): SelaeParsedTicket {
  if (!rawInput) {
    return createEmptyResult('')
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

  // Fecha de referencia actual
  const today = new Date()
  const currentYear = today.getFullYear()

  // Si no hay suficientes dígitos numéricos
  if (digitsOnly.length < 5) {
    return createEmptyResult(rawInput)
  }

  let number = ''
  let serie = '001'
  let fraccion = '01'
  let drawType: 'NAVIDAD' | 'EL_NINO' = 'NAVIDAD'
  let drawDate = `${currentYear}-12-22`
  let drawName = 'Sorteo Extraordinario de Navidad'
  let ticketPrice = 20.0
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  let isValid = false

  // Formato Canónico SELAE (20 a 24 dígitos):
  // Patrón estándar 20 dígitos: [2 ID Sorteo][5 Número][2 Fracción][3 Serie][2 Día/Sem][4 Control/Año]
  // Ejemplo: 01 49307 03 115 51 2025
  if (digitsOnly.length >= 20) {
    confidence = 'HIGH'
    isValid = true

    // Extraer segmentos
    // Muchas variantes de SELAE inician con 2 dígitos de código de juego (01 para Lotería Nacional)
    const gamePrefix = digitsOnly.substring(0, 2)
    if (gamePrefix === '01' || digitsOnly.length === 20) {
      number = digitsOnly.substring(2, 7)
      fraccion = String(parseInt(digitsOnly.substring(7, 9), 10) || 1).padStart(2, '0')
      serie = String(parseInt(digitsOnly.substring(9, 12), 10) || 1).padStart(3, '0')
    } else {
      // Formato alternativo de 20-24 dígitos empezando directo por el número
      number = digitsOnly.substring(0, 5)
      serie = String(parseInt(digitsOnly.substring(5, 8), 10) || 1).padStart(3, '0')
      fraccion = String(parseInt(digitsOnly.substring(8, 10), 10) || 1).padStart(2, '0')
    }

    // Intentar deducir tipo de sorteo por longitud y mes aproximado
    const month = today.getMonth() // 0-11
    if (month === 0 || month === 1) {
      // Enero o Febrero -> El Niño
      drawType = 'EL_NINO'
      drawName = `Sorteo Extraordinario de El Niño ${currentYear}`
      drawDate = `${currentYear}-01-06`
      ticketPrice = 20.0
    } else {
      drawType = 'NAVIDAD'
      drawName = `Sorteo Extraordinario de Navidad ${currentYear}`
      drawDate = `${currentYear}-12-22`
      ticketPrice = 20.0
    }
  } else if (digitsOnly.length >= 10 && digitsOnly.length < 20) {
    // Código de barras corto / recortado
    confidence = 'MEDIUM'
    isValid = true
    number = digitsOnly.substring(0, 5)
    serie = digitsOnly.length >= 8 ? String(parseInt(digitsOnly.substring(5, 8), 10) || 1).padStart(3, '0') : '001'
    fraccion = digitsOnly.length >= 10 ? String(parseInt(digitsOnly.substring(8, 10), 10) || 1).padStart(2, '0') : '01'
    drawType = 'NAVIDAD'
    drawName = `Sorteo Extraordinario de Navidad ${currentYear}`
    drawDate = `${currentYear}-12-22`
    ticketPrice = 20.0
  } else if (digitsOnly.length === 5) {
    // Solo se leyó el número de 5 dígitos
    confidence = 'MEDIUM'
    isValid = true
    number = digitsOnly
    serie = '001'
    fraccion = '01'
    drawType = 'NAVIDAD'
    drawName = `Sorteo Extraordinario de Navidad ${currentYear}`
    drawDate = `${currentYear}-12-22`
    ticketPrice = 20.0
  } else {
    // Buscar la primera secuencia de 5 cifras
    const match = digitsOnly.match(/\d{5}/)
    if (match) {
      number = match[0]
      isValid = true
      confidence = 'LOW'
      drawType = 'NAVIDAD'
      drawName = `Sorteo Extraordinario de Navidad ${currentYear}`
      drawDate = `${currentYear}-12-22`
      ticketPrice = 20.0
    }
  }

  // Asegurar que el número tenga exactamente 5 cifras
  if (!number || number.length !== 5 || !/^\d{5}$/.test(number)) {
    isValid = false
  }

  return {
    isValid,
    number: number || '00000',
    serie: serie || '001',
    fraccion: fraccion || '01',
    drawType,
    drawName,
    drawDate,
    ticketPrice,
    barcodeRaw: rawInput,
    confidence,
  }
}

function createEmptyResult(rawInput: string): SelaeParsedTicket {
  const currentYear = new Date().getFullYear()
  return {
    isValid: false,
    number: '',
    serie: '001',
    fraccion: '01',
    drawType: 'NAVIDAD',
    drawName: `Sorteo Extraordinario de Navidad ${currentYear}`,
    drawDate: `${currentYear}-12-22`,
    ticketPrice: 20.0,
    barcodeRaw: rawInput,
    confidence: 'LOW',
  }
}
