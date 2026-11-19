import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSelaeBarcode, getUpcomingDraw } from '../selaeBarcodeParser.ts'

test('parseSelaeBarcode - production code 1 (Navidad 2025): 5102502115>0493073567', () => {
  const barcode = '5102502115>0493073567'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '49307')
  assert.equal(result.ticketNumber, '49307')
  assert.equal(result.serie, '115')
  assert.equal(result.series, '115')
  assert.equal(result.fraccion, '02')
  assert.equal(result.fraction, '02')
  assert.equal(result.drawCode, '102')
  assert.equal(result.year, 2025)
  assert.equal(result.drawType, 'NAVIDAD')
  assert.equal(result.drawDate, '2025-12-22')
  assert.equal(result.checkDigits, '3567')
  assert.equal(result.confidence, 'HIGH')
  assert.equal(result.barcodeRaw, barcode)
})

test('parseSelaeBarcode - production code 2 (El Niño 2020): 5002001002>0880082456', () => {
  const barcode = '5002001002>0880082456'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '88008')
  assert.equal(result.ticketNumber, '88008')
  assert.equal(result.serie, '002')
  assert.equal(result.series, '002')
  assert.equal(result.fraccion, '01')
  assert.equal(result.fraction, '01')
  assert.equal(result.drawCode, '002')
  assert.equal(result.year, 2020)
  assert.equal(result.drawType, 'EL_NINO')
  assert.equal(result.drawDate, '2020-01-06')
  assert.equal(result.checkDigits, '2456')
  assert.equal(result.confidence, 'HIGH')
  assert.equal(result.barcodeRaw, barcode)
})

test('parseSelaeBarcode - production code 3 (Navidad 2026): 5102607065>0023205830 with separator >', () => {
  const barcode = '5102607065>0023205830'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '02320')
  assert.equal(result.ticketNumber, '02320')
  assert.equal(result.serie, '065')
  assert.equal(result.series, '065')
  assert.equal(result.fraccion, '07')
  assert.equal(result.fraction, '07')
  assert.equal(result.drawCode, '102')
  assert.equal(result.year, 2026)
  assert.equal(result.drawType, 'NAVIDAD')
  assert.equal(result.drawDate, '2026-12-22')
  assert.equal(result.checkDigits, '5830')
  assert.equal(result.confidence, 'HIGH')
  assert.equal(result.barcodeRaw, barcode)
})

test('parseSelaeBarcode - production code 4 (Navidad 2020): 51020101100876719833', () => {
  const barcode = '51020101100876719833'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '87671')
  assert.equal(result.ticketNumber, '87671')
  assert.equal(result.serie, '110')
  assert.equal(result.series, '110')
  assert.equal(result.fraccion, '10')
  assert.equal(result.fraction, '10')
  assert.equal(result.drawCode, '102')
  assert.equal(result.year, 2020)
  assert.equal(result.drawType, 'NAVIDAD')
  assert.equal(result.drawDate, '2020-12-22')
  assert.equal(result.checkDigits, '9833')
  assert.equal(result.confidence, 'HIGH')
  assert.equal(result.barcodeRaw, barcode)
})

test('parseSelaeBarcode - GS1 AIM identifier prefix and spaces', () => {
  const raw = ']C1 51 026 07 065 002320 5830'
  const result = parseSelaeBarcode(raw)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '02320')
  assert.equal(result.fraction, '07')
  assert.equal(result.series, '065')
  assert.equal(result.drawCode, '102')
  assert.equal(result.year, 2026)
  assert.equal(result.drawType, 'NAVIDAD')
  assert.equal(result.drawDate, '2026-12-22')
  assert.equal(result.checkDigits, '5830')
  assert.equal(result.confidence, 'HIGH')
})

test('parseSelaeBarcode - standard 20-digit SELAE barcode with prefix 01', () => {
  const barcode = '01026070650023205830'
  const result = parseSelaeBarcode(barcode)

  assert.equal(result.isValid, true)
  assert.equal(result.number, '02320')
  assert.equal(result.series, '065')
  assert.equal(result.fraction, '07')
  assert.equal(result.drawCode, '102')
  assert.equal(result.year, 2026)
  assert.equal(result.drawType, 'NAVIDAD')
  assert.equal(result.drawDate, '2026-12-22')
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
