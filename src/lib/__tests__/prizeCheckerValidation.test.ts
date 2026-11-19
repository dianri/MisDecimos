import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDrawDateShort,
  getDrawStartTimestamp,
  evaluateDrawDateStatus,
  evaluateProviderResponse,
} from '../prizeCheckerValidation.ts'

test('formatDrawDateShort - formatea fechas ISO YYYY-MM-DD a DD/MM/AAAA', () => {
  assert.equal(formatDrawDateShort('2020-12-22'), '22/12/2020')
  assert.equal(formatDrawDateShort('2026-01-06'), '06/01/2026')
  assert.equal(formatDrawDateShort('2025-07-15'), '15/07/2025')
})

test('getDrawStartTimestamp - horarios oficiales CET para Navidad y El Niño', () => {
  const navidad = getDrawStartTimestamp('2026-12-22', 'NAVIDAD')
  // En CET (UTC+1), 09:00:00+01:00 corresponde a 08:00:00Z
  assert.equal(navidad.toISOString(), '2026-12-22T08:00:00.000Z')

  const nino = getDrawStartTimestamp('2026-01-06', 'EL_NINO')
  // En CET (UTC+1), 12:00:00+01:00 corresponde a 11:00:00Z
  assert.equal(nino.toISOString(), '2026-01-06T11:00:00.000Z')
})

test('evaluateDrawDateStatus - detecta sorteo futuro', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0) // 19 Nov 2026
  const status = evaluateDrawDateStatus({
    drawDate: '2026-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  assert.equal(status.isFuture, true)
  assert.equal(status.isPast, false)
  assert.equal(status.isToday, false)
  assert.equal(status.drawYear, 2026)
  assert.equal(status.formattedDate, '22/12/2026')
})

test('evaluateDrawDateStatus - detecta sorteo histórico de año pasado', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0) // 19 Nov 2026
  const status = evaluateDrawDateStatus({
    drawDate: '2020-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  assert.equal(status.isFuture, false)
  assert.equal(status.isPast, true)
  assert.equal(status.isToday, false)
  assert.equal(status.drawYear, 2020)
  assert.equal(status.formattedDate, '22/12/2020')
})

test('evaluateProviderResponse - sorteo futuro devuelve DRAW_NOT_HELD_YET', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0)
  const drawStatus = evaluateDrawDateStatus({
    drawDate: '2027-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  const evalResult = evaluateProviderResponse({
    drawStatus,
    currentYear: 2026,
  })

  assert.equal(evalResult.ok, false)
  assert.equal(evalResult.code, 'DRAW_NOT_HELD_YET')
  assert.match(evalResult.message, /Este sorteo se celebrará el 22\/12\/2027/i)
})

test('evaluateProviderResponse - sorteo de hoy en curso devuelve DRAW_IN_PROGRESS', () => {
  // Simular día de sorteo 22 dic 2026 a las 10:30 CET
  const now = new Date('2026-12-22T10:30:00+01:00')
  const drawStatus = evaluateDrawDateStatus({
    drawDate: '2026-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  const evalResult = evaluateProviderResponse({
    drawStatus,
    currentYear: 2026,
    providerStatus: 0,
  })

  assert.equal(evalResult.ok, false)
  assert.equal(evalResult.code, 'DRAW_IN_PROGRESS')
  assert.match(evalResult.message, /El sorteo está en curso o aún no hay resultados/i)
})

test('evaluateProviderResponse - sorteo histórico (2020) con error/status 0 devuelve HISTORICAL_UNAVAILABLE', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0)
  const drawStatus = evaluateDrawDateStatus({
    drawDate: '2020-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  // El proveedor actual devuelve error o status 0 porque no tiene el histórico de 2020
  const evalResult = evaluateProviderResponse({
    drawStatus,
    currentYear: 2026,
    providerError: 1,
  })

  assert.equal(evalResult.ok, false)
  assert.equal(evalResult.code, 'HISTORICAL_UNAVAILABLE')
  assert.match(evalResult.message, /No hay resultados históricos disponibles en el proveedor oficial para el sorteo del 22\/12\/2020/i)
})

test('evaluateProviderResponse - sorteo histórico con año devuelto discordante devuelve HISTORICAL_UNAVAILABLE', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0)
  const drawStatus = evaluateDrawDateStatus({
    drawDate: '2020-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  // El proveedor responde con datos de la temporada activa (ej. 2026) en vez de 2020
  const evalResult = evaluateProviderResponse({
    drawStatus,
    currentYear: 2026,
    providerYear: 2026,
    prizeEuros: 20,
  })

  assert.equal(evalResult.ok, false)
  assert.equal(evalResult.code, 'HISTORICAL_UNAVAILABLE')
  assert.match(evalResult.message, /No hay resultados históricos disponibles/i)
})

test('evaluateProviderResponse - sorteo con premio oficial verificado', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0)
  const drawStatus = evaluateDrawDateStatus({
    drawDate: '2024-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  const evalResult = evaluateProviderResponse({
    drawStatus,
    currentYear: 2026,
    providerYear: 2024,
    providerStatus: 4,
    prizeEuros: 100,
    checkSource: 'oficial',
  })

  assert.equal(evalResult.ok, true)
  assert.equal(evalResult.code, 'SUCCESS')
  assert.equal(evalResult.prizeAmountCents, 10000)
  assert.equal(evalResult.formattedPrize, '100,00 €')
  assert.equal(evalResult.listStatus, 'final')
})

test('evaluateProviderResponse - sorteo sin premio verificado (0 €)', () => {
  const now = new Date(2026, 10, 19, 10, 0, 0)
  const drawStatus = evaluateDrawDateStatus({
    drawDate: '2024-12-22',
    drawType: 'NAVIDAD',
    now,
  })

  const evalResult = evaluateProviderResponse({
    drawStatus,
    currentYear: 2026,
    providerYear: 2024,
    providerStatus: 4,
    prizeEuros: 0,
    checkSource: 'oficial',
  })

  assert.equal(evalResult.ok, true)
  assert.equal(evalResult.code, 'SUCCESS')
  assert.equal(evalResult.prizeAmountCents, 0)
  assert.equal(evalResult.formattedPrize, '0,00 €')
})
