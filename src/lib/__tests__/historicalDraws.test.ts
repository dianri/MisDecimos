import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateHistoricalDraw,
  evaluateNavidadDraw,
  evaluateElNinoDraw,
  prevNum,
  nextNum,
} from '../historicalDraws.ts'
import { HISTORICAL_TICKETS_FIXTURES } from '../__fixtures__/historicalTickets.ts'

test('Navidad 2025 - El Gordo (79432) otorga 400.000 € por décimo', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.NAVIDAD_2025_EL_GORDO
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 40_000_000)
  assert.equal(res.prizeCategory, '1.º Premio (El Gordo)')
})

test('Navidad 2025 - Segundo premio (70048) otorga 125.000 € por décimo', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.NAVIDAD_2025_SEGUNDO
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 12_500_000)
  assert.equal(res.prizeCategory, '2.º Premio')
})

test('Navidad 2025 - Aproximación al 1.º premio (79431) otorga 2.000 €', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.NAVIDAD_2025_APROXIMACION
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 200_000)
  assert.equal(res.prizeCategory, 'Aproximación 1.º Premio')
})

test('Navidad 2025 - Centena del 1.º premio (79400) otorga 100 €', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.NAVIDAD_2025_CENTENA
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 10_000)
  assert.ok(res.prizeCategory?.includes('Centena 1.º Premio'))
})

test('Navidad 2025 - Dos últimas cifras del 1.º premio (11132) otorga 100 €', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.NAVIDAD_2025_DOS_ULTIMAS
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 10_000)
  assert.ok(res.prizeCategory?.includes('Dos últimas cifras 1.º Premio'))
})

test('Navidad 2025 - Reintegro (00002) otorga 20 €', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.NAVIDAD_2025_REINTEGRO
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 2_000)
  assert.equal(res.prizeCategory, 'Reintegro')
})

test('Navidad 2025 - Boleto no premiado (12345) devuelve 0 €', () => {
  const fixture = HISTORICAL_TICKETS_FIXTURES.SIN_PREMIO_12345
  const res = evaluateHistoricalDraw(fixture.drawDate, fixture.drawType, fixture.number)

  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 0)
  assert.equal(res.prizeCategory, 'Sin premio')
})

test('Navidad 2020 - El Gordo (72897) otorga 400.000 € y terminación (00007) reintegro de 20 €', () => {
  const gordo = evaluateHistoricalDraw('2020-12-22', 'NAVIDAD', '72897')
  assert.equal(gordo.found, true)
  assert.equal(gordo.prizePerDecimoCents, 40_000_000)
  assert.equal(gordo.prizeCategory, '1.º Premio (El Gordo)')

  const reintegro = evaluateHistoricalDraw('2020-12-22', 'NAVIDAD', '00007')
  assert.equal(reintegro.found, true)
  assert.equal(reintegro.prizePerDecimoCents, 2_000)
  assert.equal(reintegro.prizeCategory, 'Reintegro')
})

test('El Niño 2025 - 1.º premio (78908) otorga 200.000 € y 2.º premio (06766) otorga 75.000 €', () => {
  const primero = evaluateHistoricalDraw('2025-01-06', 'EL_NINO', '78908')
  assert.equal(primero.found, true)
  assert.equal(primero.prizePerDecimoCents, 20_000_000)
  assert.equal(primero.prizeCategory, '1.º Premio (El Niño)')

  const segundo = evaluateHistoricalDraw('2025-01-06', 'EL_NINO', '06766')
  assert.equal(segundo.found, true)
  assert.equal(segundo.prizePerDecimoCents, 7_500_000)
  assert.equal(segundo.prizeCategory, '2.º Premio')
})

test('Normalización de números cortos ("2" -> "00002")', () => {
  const res = evaluateHistoricalDraw('2025-12-22', 'NAVIDAD', '2')
  assert.equal(res.found, true)
  assert.equal(res.prizePerDecimoCents, 2_000)
  assert.equal(res.prizeCategory, 'Reintegro')
})

test('Sorteo no registrado devuelve found: false', () => {
  const res = evaluateHistoricalDraw('2026-12-22', 'NAVIDAD', '79432')
  assert.equal(res.found, false)
  assert.equal(res.prizePerDecimoCents, 0)
})

test('Aproximaciones circulares en extremos (00000 <-> 99999)', () => {
  assert.equal(prevNum('00000'), '99999')
  assert.equal(nextNum('00000'), '00001')
  assert.equal(prevNum('99999'), '99998')
  assert.equal(nextNum('99999'), '00000')

  const drawZero = {
    first: '00000',
    second: '99999',
    third: '50000',
    fourths: ['11111', '22222'],
    fifths: ['33333', '44444', '55555', '66666', '77777', '88888', '12345', '54321'],
  }

  const approxZeroPrev = evaluateNavidadDraw('99999', drawZero)
  // 99999 is the 2nd prize itself here, so test 00000 as first with separate second prize
  const drawExtremeFirst = { ...drawZero, second: '40000' }
  const res99999 = evaluateNavidadDraw('99999', drawExtremeFirst)
  const res00001 = evaluateNavidadDraw('00001', drawExtremeFirst)
  assert.equal(res99999.prizePerDecimoCents, 200_000)
  assert.equal(res99999.prizeCategory, 'Aproximación 1.º Premio')
  assert.equal(res00001.prizePerDecimoCents, 200_000)
  assert.equal(res00001.prizeCategory, 'Aproximación 1.º Premio')

  const drawExtremeSecond = { ...drawZero, first: '30000', second: '99999' }
  const res99998 = evaluateNavidadDraw('99998', drawExtremeSecond)
  const res00000 = evaluateNavidadDraw('00000', drawExtremeSecond)
  assert.equal(res99998.prizePerDecimoCents, 125_000)
  assert.equal(res99998.prizeCategory, 'Aproximación 2.º Premio')
  assert.equal(res00000.prizePerDecimoCents, 125_000)
  assert.equal(res00000.prizeCategory, 'Aproximación 2.º Premio')
  assert.equal(approxZeroPrev.prizePerDecimoCents, 12_500_000)
})

test('Normalización de entradas atípicas (espacios, >5 dígitos, cadena vacía)', () => {
  // Espacios alrededor de un número válido
  const withSpaces = evaluateHistoricalDraw('2025-12-22', 'NAVIDAD', ' 00002 ')
  assert.equal(withSpaces.found, true)
  assert.equal(withSpaces.prizePerDecimoCents, 2_000)
  assert.equal(withSpaces.prizeCategory, 'Reintegro')

  // Longitud mayor de 5 dígitos debe rechazarse
  const tooLong = evaluateHistoricalDraw('2025-12-22', 'NAVIDAD', '123456')
  assert.equal(tooLong.found, false)
  assert.equal(tooLong.prizePerDecimoCents, 0)

  // Cadena vacía debe rechazarse (no convertirse en 00000)
  const empty = evaluateHistoricalDraw('2025-12-22', 'NAVIDAD', '')
  assert.equal(empty.found, false)
  assert.equal(empty.prizePerDecimoCents, 0)
})

test('Acumulación válida vs absorción de reintegro en Navidad y no solapamiento en El Niño', () => {
  // Navidad 2025: 1º = 79432 (centena 794), 2º = 70048 (últimas 2 cifras 48)
  // El número 79448 acumula Centena 1.º (100 €) + Dos últimas cifras 2.º (100 €) = 200 €
  const accumulated = evaluateHistoricalDraw('2025-12-22', 'NAVIDAD', '79448')
  assert.equal(accumulated.found, true)
  assert.equal(accumulated.prizePerDecimoCents, 20_000)
  assert.ok(accumulated.prizeCategory?.includes('Centena 1.º Premio'))
  assert.ok(accumulated.prizeCategory?.includes('Dos últimas cifras 2.º Premio'))

  // Navidad 2025: 11132 coincide en 2 últimas cifras del Gordo (32) -> 100 €, absorbe el reintegro de 20 € (NO 120 €)
  const absorbed = evaluateHistoricalDraw('2025-12-22', 'NAVIDAD', '11132')
  assert.equal(absorbed.found, true)
  assert.equal(absorbed.prizePerDecimoCents, 10_000)
  assert.equal(absorbed.prizeCategory, 'Dos últimas cifras 1.º Premio')

  // El Niño: extracciones de 4 y 2 cifras no se solapan ni duplican premio
  const syntheticNino = {
    first: '78908',
    second: '06766',
    third: '66777',
    fourDigits: ['1234'],
    threeDigits: ['234'],
    twoDigits: ['34'],
    reintegros: ['4'],
  }
  const ninoOverlap = evaluateElNinoDraw('01234', syntheticNino)
  assert.equal(ninoOverlap.found, true)
  assert.equal(ninoOverlap.prizePerDecimoCents, 35_000)
  assert.equal(ninoOverlap.prizeCategory, 'Terminación 4 cifras')
})
