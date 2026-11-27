import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildDrawDateIso,
  extractYearFromIsoDate,
  formatDrawDateDisplay,
  getDefaultDrawYear,
  getSelectableDrawYears,
} from '../drawDateSelector.ts'

test('drawDateSelector - muestra 22/12/{año} para Navidad y 06/01/{año} para El Niño', () => {
  assert.equal(formatDrawDateDisplay('NAVIDAD', 2026), '22/12/2026')
  assert.equal(formatDrawDateDisplay('EL_NINO', 2027), '06/01/2027')
})

test('drawDateSelector - al cambiar de año mantiene fijo el día y mes del sorteo en formato ISO', () => {
  assert.equal(buildDrawDateIso('NAVIDAD', 2025), '2025-12-22')
  assert.equal(buildDrawDateIso('NAVIDAD', 2028), '2028-12-22')
  assert.equal(buildDrawDateIso('EL_NINO', 2026), '2026-01-06')
  assert.equal(buildDrawDateIso('EL_NINO', 2029), '2029-01-06')
})

test('drawDateSelector - año por defecto según tipo de sorteo y fecha actual', () => {
  // Navidad siempre selecciona el año en curso
  assert.equal(getDefaultDrawYear('NAVIDAD', new Date(2026, 10, 27)), 2026)
  assert.equal(getDefaultDrawYear('NAVIDAD', new Date(2026, 11, 28)), 2026)

  // El Niño selecciona año en curso hasta el 6 de enero, y año siguiente después del 6 de enero
  assert.equal(getDefaultDrawYear('EL_NINO', new Date(2026, 0, 5)), 2026)
  assert.equal(getDefaultDrawYear('EL_NINO', new Date(2026, 0, 6)), 2026)
  assert.equal(getDefaultDrawYear('EL_NINO', new Date(2026, 0, 7)), 2027)
  assert.equal(getDefaultDrawYear('EL_NINO', new Date(2026, 10, 27)), 2027)
})

test('drawDateSelector - extrae año desde fecha escaneada y genera rango de años seleccionables', () => {
  assert.equal(extractYearFromIsoDate('2025-12-22', 2026), 2025)
  assert.equal(extractYearFromIsoDate('2020-01-06', 2026), 2020)

  assert.deepEqual(getSelectableDrawYears(2026), [2024, 2025, 2026, 2027, 2028, 2029])
  assert.deepEqual(getSelectableDrawYears(2026, 2020), [2020, 2024, 2025, 2026, 2027, 2028, 2029])
})

test('TicketFormModal - sustituye input[type=date] por selector exclusivo de año con apariencia intacta', () => {
  const modalSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/TicketFormModal.tsx'),
    'utf8'
  )

  assert.ok(!modalSource.includes('type="date"'), 'No debe usar input type="date" nativo')
  assert.ok(modalSource.includes('aria-label="Año del sorteo"'), 'Debe incluir el selector accesible de año')
  assert.ok(modalSource.includes('formatDrawDateDisplay(drawType, selectedYear)'))
  assert.ok(modalSource.includes('buildDrawDateIso(drawType, selectedYear)'))
  assert.ok(modalSource.includes('<Calendar className="h-3.5 w-3.5'))
  assert.ok(modalSource.includes('p_draw_date: drawDate'))
})
