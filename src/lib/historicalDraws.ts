/**
 * Base de datos oficial y motor de escrutinio para sorteos históricos (2020–2025).
 * Cubre Sorteo Extraordinario de Navidad (22 de diciembre) y Sorteo del Niño (6 de enero).
 */

export interface HistoricalNavidadDraw {
  first: string
  second: string
  third: string
  fourths: string[]
  fifths: string[]
}

export interface HistoricalElNinoDraw {
  first: string
  second: string
  third: string
  fourDigits: string[]
  threeDigits: string[]
  twoDigits: string[]
  reintegros: string[]
}

export const NAVIDAD_DRAWS: Record<string, HistoricalNavidadDraw> = {
  '2025-12-22': {
    first: '79432',
    second: '70048',
    third: '90693',
    fourths: ['25508', '78477'],
    fifths: ['18669', '23112', '25412', '41716', '60649', '61366', '77715', '94273'],
  },
  '2024-12-22': {
    first: '72480',
    second: '40014',
    third: '11840',
    fourths: ['77768', '48020'],
    fifths: ['37876', '72853', '74778', '45456', '45225', '97345', '75143', '60622'],
  },
  '2023-12-22': {
    first: '88008',
    second: '58303',
    third: '31938',
    fourths: ['93361', '41147'],
    fifths: ['01568', '05427', '37038', '45742', '54274', '57421', '86007', '88979'],
  },
  '2022-12-22': {
    first: '05490',
    second: '04074',
    third: '45250',
    fourths: ['54289', '25296'],
    fifths: ['62391', '43696', '88509', '38454', '24492', '79138', '36142', '87092'],
  },
  '2021-12-22': {
    first: '86148',
    second: '72119',
    third: '19517',
    fourths: ['42833', '91179'],
    fifths: ['92052', '70316', '26711', '24198', '69457', '89053', '34345', '89109'],
  },
  '2020-12-22': {
    first: '72897',
    second: '06095',
    third: '52472',
    fourths: ['75981', '38341'],
    fifths: ['19371', '28674', '31617', '37023', '43831', '49760', '55483', '86986'],
  },
}

export const EL_NINO_DRAWS: Record<string, HistoricalElNinoDraw> = {
  '2025-01-06': {
    first: '78908',
    second: '06766',
    third: '66777',
    fourDigits: ['4276', '1454'],
    threeDigits: [
      '798', '824', '794', '981', '307', '548', '660', '366', '040', '756', '899', '184', '404', '306',
    ],
    twoDigits: ['31', '26', '89', '68', '11'],
    reintegros: ['8', '5', '0'],
  },
  '2024-01-06': {
    first: '94974',
    second: '89634',
    third: '57033',
    fourDigits: ['7247', '8172'],
    threeDigits: [
      '507', '296', '161', '978', '872', '506', '114', '488', '730', '428', '281', '568', '644', '598',
    ],
    twoDigits: ['66', '40', '32', '65', '99'],
    reintegros: ['4', '1', '9'],
  },
  '2023-01-06': {
    first: '89603',
    second: '72289',
    third: '18918',
    fourDigits: ['6338', '8173'],
    threeDigits: [
      '224', '231', '266', '278', '300', '387', '457', '527', '538', '550', '726', '760', '888', '928',
    ],
    twoDigits: ['11', '18', '24', '29', '41'],
    reintegros: ['3', '4', '9'],
  },
  '2022-01-06': {
    first: '41665',
    second: '44469',
    third: '19467',
    fourDigits: ['0512', '8387'],
    threeDigits: [
      '435', '842', '822', '851', '709', '740', '025', '300', '665', '632', '721', '239', '186', '641',
    ],
    twoDigits: ['50', '98', '80', '48', '41'],
    reintegros: ['5', '7', '2'],
  },
  '2021-01-06': {
    first: '19570',
    second: '03436',
    third: '05587',
    fourDigits: ['3350', '3156'],
    threeDigits: [
      '491', '418', '521', '936', '010', '918', '926', '835', '159', '741', '173', '935', '432', '672',
    ],
    twoDigits: ['69', '28', '41', '24', '07'],
    reintegros: ['0', '4', '7'],
  },
  '2020-01-06': {
    first: '57342',
    second: '21816',
    third: '26706',
    fourDigits: ['1867', '5343'],
    threeDigits: [
      '967', '980', '158', '702', '851', '660', '618', '002', '141', '934', '992', '918', '888',
    ],
    twoDigits: ['03', '40', '71', '69', '25'],
    reintegros: ['2', '0', '7'],
  },
}

export function prevNum(nStr: string): string {
  const n = parseInt(nStr, 10)
  return String(n === 0 ? 99999 : n - 1).padStart(5, '0')
}

export function nextNum(nStr: string): string {
  const n = parseInt(nStr, 10)
  return String(n === 99999 ? 0 : n + 1).padStart(5, '0')
}

export interface HistoricalEvaluationResult {
  found: boolean
  prizePerDecimoCents: number
  prizeCategory?: string
}

/**
 * Evalúa un número en los sorteos históricos oficiales (2020–2025).
 */
export function evaluateHistoricalDraw(
  drawDate: string,
  drawType: string,
  ticketNumber: string
): HistoricalEvaluationResult {
  const trimmed = String(ticketNumber ?? '').trim()
  if (!/^\d{1,5}$/.test(trimmed)) {
    return {
      found: false,
      prizePerDecimoCents: 0,
    }
  }
  const cleanNumber = trimmed.padStart(5, '0')

  const isNavidad =
    drawType === 'NAVIDAD' ||
    drawDate.endsWith('-12-22') ||
    Boolean(NAVIDAD_DRAWS[drawDate])

  const isElNino =
    drawType === 'EL_NINO' ||
    drawDate.endsWith('-01-06') ||
    Boolean(EL_NINO_DRAWS[drawDate])

  if (isNavidad && NAVIDAD_DRAWS[drawDate]) {
    return evaluateNavidadDraw(cleanNumber, NAVIDAD_DRAWS[drawDate])
  }

  if (isElNino && EL_NINO_DRAWS[drawDate]) {
    return evaluateElNinoDraw(cleanNumber, EL_NINO_DRAWS[drawDate])
  }

  return {
    found: false,
    prizePerDecimoCents: 0,
  }
}

export function evaluateNavidadDraw(
  num: string,
  draw: HistoricalNavidadDraw
): HistoricalEvaluationResult {
  // 1. Premios mayores principales
  if (num === draw.first) {
    return { found: true, prizePerDecimoCents: 40_000_000, prizeCategory: '1.º Premio (El Gordo)' }
  }
  if (num === draw.second) {
    return { found: true, prizePerDecimoCents: 12_500_000, prizeCategory: '2.º Premio' }
  }
  if (num === draw.third) {
    return { found: true, prizePerDecimoCents: 5_000_000, prizeCategory: '3.º Premio' }
  }
  if (draw.fourths.includes(num)) {
    return { found: true, prizePerDecimoCents: 2_000_000, prizeCategory: '4.º Premio' }
  }
  if (draw.fifths.includes(num)) {
    return { found: true, prizePerDecimoCents: 600_000, prizeCategory: '5.º Premio' }
  }

  // 2. Aproximaciones (±1)
  if (num === prevNum(draw.first) || num === nextNum(draw.first)) {
    return { found: true, prizePerDecimoCents: 200_000, prizeCategory: 'Aproximación 1.º Premio' }
  }
  if (num === prevNum(draw.second) || num === nextNum(draw.second)) {
    return { found: true, prizePerDecimoCents: 125_000, prizeCategory: 'Aproximación 2.º Premio' }
  }
  if (num === prevNum(draw.third) || num === nextNum(draw.third)) {
    return { found: true, prizePerDecimoCents: 96_000, prizeCategory: 'Aproximación 3.º Premio' }
  }

  // 3. Centenas y Terminaciones
  let totalCents = 0
  const categories: string[] = []

  // Centenas (primeras 3 cifras iguales)
  const numCentena = num.slice(0, 3)
  if (numCentena === draw.first.slice(0, 3)) {
    totalCents += 10_000
    categories.push('Centena 1.º Premio')
  }
  if (numCentena === draw.second.slice(0, 3)) {
    totalCents += 10_000
    categories.push('Centena 2.º Premio')
  }
  if (numCentena === draw.third.slice(0, 3)) {
    totalCents += 10_000
    categories.push('Centena 3.º Premio')
  }
  for (const f of draw.fourths) {
    if (numCentena === f.slice(0, 3)) {
      totalCents += 10_000
      categories.push('Centena 4.º Premio')
      break
    }
  }

  // Dos últimas cifras
  const numLast2 = num.slice(-2)
  let wonLast2First = false
  if (numLast2 === draw.first.slice(-2)) {
    totalCents += 10_000
    categories.push('Dos últimas cifras 1.º Premio')
    wonLast2First = true
  }
  if (numLast2 === draw.second.slice(-2)) {
    totalCents += 10_000
    categories.push('Dos últimas cifras 2.º Premio')
  }
  if (numLast2 === draw.third.slice(-2)) {
    totalCents += 10_000
    categories.push('Dos últimas cifras 3.º Premio')
  }

  // Reintegro (última cifra igual al 1.º premio)
  // Las dos últimas cifras del primer premio ya absorben el reintegro.
  const numLast1 = num.slice(-1)
  if (numLast1 === draw.first.slice(-1) && !wonLast2First) {
    totalCents += 2_000
    categories.push('Reintegro')
  }

  if (totalCents > 0) {
    return {
      found: true,
      prizePerDecimoCents: totalCents,
      prizeCategory: categories.join(' + '),
    }
  }

  return {
    found: true,
    prizePerDecimoCents: 0,
    prizeCategory: 'Sin premio',
  }
}

export function evaluateElNinoDraw(
  num: string,
  draw: HistoricalElNinoDraw
): HistoricalEvaluationResult {
  // 1. Premios mayores principales
  if (num === draw.first) {
    return { found: true, prizePerDecimoCents: 20_000_000, prizeCategory: '1.º Premio (El Niño)' }
  }
  if (num === draw.second) {
    return { found: true, prizePerDecimoCents: 7_500_000, prizeCategory: '2.º Premio' }
  }
  if (num === draw.third) {
    return { found: true, prizePerDecimoCents: 2_500_000, prizeCategory: '3.º Premio' }
  }

  // 2. Aproximaciones (±1)
  if (num === prevNum(draw.first) || num === nextNum(draw.first)) {
    return { found: true, prizePerDecimoCents: 120_000, prizeCategory: 'Aproximación 1.º Premio' }
  }
  if (num === prevNum(draw.second) || num === nextNum(draw.second)) {
    return { found: true, prizePerDecimoCents: 61_000, prizeCategory: 'Aproximación 2.º Premio' }
  }

  let totalCents = 0
  const categories: string[] = []

  // Centenas (primeras 3 cifras iguales a 1º, 2º o 3º)
  const numCentena = num.slice(0, 3)
  if (numCentena === draw.first.slice(0, 3)) {
    totalCents += 10_000
    categories.push('Centena 1.º Premio')
  }
  if (numCentena === draw.second.slice(0, 3)) {
    totalCents += 10_000
    categories.push('Centena 2.º Premio')
  }
  if (numCentena === draw.third.slice(0, 3)) {
    totalCents += 10_000
    categories.push('Centena 3.º Premio')
  }

  // Extracciones de terminaciones
  let matchedTermination = false

  // Extracciones de 4 cifras (350 €)
  const numLast4 = num.slice(-4)
  if (draw.fourDigits.includes(numLast4)) {
    totalCents += 35_000
    categories.push('Terminación 4 cifras')
    matchedTermination = true
  }

  // Extracciones de 3 cifras (100 €)
  const numLast3 = num.slice(-3)
  if (!matchedTermination && draw.threeDigits.includes(numLast3)) {
    totalCents += 10_000
    categories.push('Terminación 3 cifras')
    matchedTermination = true
  }

  // Extracciones de 2 cifras (40 €)
  const numLast2 = num.slice(-2)
  if (!matchedTermination && draw.twoDigits.includes(numLast2)) {
    totalCents += 4_000
    categories.push('Terminación 2 cifras')
    matchedTermination = true
  }

  // Reintegros (20 €)
  const numLast1 = num.slice(-1)
  if (!matchedTermination && draw.reintegros.includes(numLast1)) {
    totalCents += 2_000
    categories.push('Reintegro')
  }

  if (totalCents > 0) {
    return {
      found: true,
      prizePerDecimoCents: totalCents,
      prizeCategory: categories.join(' + '),
    }
  }

  return {
    found: true,
    prizePerDecimoCents: 0,
    prizeCategory: 'Sin premio',
  }
}
