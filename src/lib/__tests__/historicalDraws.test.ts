import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateHistoricalDraw } from '../historicalDraws.ts'
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
