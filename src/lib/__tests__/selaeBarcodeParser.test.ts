import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSelaeBarcode, getUpcomingDraw } from '../selaeBarcodeParser.ts'

test('parseSelaeBarcode - standard 20-digit SELAE barcode (prefix 51)', () => {
  const barcode = '51020101100876719833'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '76719')
  assert.equal(result.ticketNumber, '76719')
  assert.equal(result.serie, '008')
  assert.equal(result.series, '008')
  assert.equal(result.fraccion, '11')
  assert.equal(result.fraction, '11')
  assert.equal(result.drawCode, '02010')
  assert.equal(result.checkDigits, '833')
  assert.equal(result.confidence, 'HIGH')
  assert.equal(result.barcodeRaw, barcode)
})

test('parseSelaeBarcode - GS1 AIM identifier prefix and spaces', () => {
  const raw = ']C1 51 02010 11 008 76719 833'
  const result = parseSelaeBarcode(raw)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '76719')
  assert.equal(result.fraction, '11')
  assert.equal(result.series, '008')
  assert.equal(result.drawCode, '02010')
  assert.equal(result.checkDigits, '833')
  assert.equal(result.confidence, 'HIGH')
})

test('parseSelaeBarcode - standard 20-digit SELAE barcode with prefix 01', () => {
  const barcode = '01020101100876719833'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '76719')
  assert.equal(result.series, '008')
  assert.equal(result.fraction, '11')
  assert.equal(result.drawCode, '02010')
  assert.equal(result.confidence, 'HIGH')
})

test('parseSelaeBarcode - direct 5-digit number', () => {
  const result = parseSelaeBarcode('49307')

  assert.equal(result.isValid, true)
  assert.equal(result.number, '49307')
  assert.equal(result.ticketNumber, '49307')
  assert.equal(result.series, '001')
  assert.equal(result.fraction, '01')
  assert.equal(result.confidence, 'MEDIUM')
})

test('parseSelaeBarcode - invalid barcodes', () => {
  // Too short
  const shortResult = parseSelaeBarcode('123')
  assert.equal(shortResult.isValid, false)
  assert.equal(shortResult.number, '')
  assert.equal(shortResult.ticketNumber, '')
  assert.ok(shortResult.errorMessage)

  // Empty
  const emptyResult = parseSelaeBarcode('')
  assert.equal(emptyResult.isValid, false)
  assert.equal(emptyResult.number, '')

  // Unrecognized EAN-13
  const eanResult = parseSelaeBarcode('8412345678905')
  assert.equal(eanResult.isValid, false)
  assert.equal(eanResult.number, '')
  assert.equal(eanResult.ticketNumber, '')
  assert.equal(eanResult.errorMessage, 'Código de barras no reconocido como décimo de Lotería Nacional')
})

test('getUpcomingDraw - date logic', () => {
  // Jan 5 -> El Niño of same year
  const nino = getUpcomingDraw(new Date(2026, 0, 5))
  assert.equal(nino.drawType, 'EL_NINO')
  assert.equal(nino.drawDate, '2026-01-06')

  // Nov 19 -> Navidad of same year
  const navidad = getUpcomingDraw(new Date(2026, 10, 19))
  assert.equal(navidad.drawType, 'NAVIDAD')
  assert.equal(navidad.drawDate, '2026-12-22')

  // Dec 25 -> El Niño of next year
  const nextNino = getUpcomingDraw(new Date(2026, 11, 25))
  assert.equal(nextNino.drawType, 'EL_NINO')
  assert.equal(nextNino.drawDate, '2027-01-06')
})
