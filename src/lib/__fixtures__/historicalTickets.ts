/**
 * Fixtures estandarizadas con décimos históricos reales de Lotería de Navidad y El Niño (2020–2025).
 * Utilizadas en pruebas unitarias, auditoría y comprobaciones de integración.
 */

export interface HistoricalTicketFixture {
  id: string
  number: string
  drawDate: string
  drawType: 'NAVIDAD' | 'EL_NINO'
  expectedPrizeCents: number
  expectedCategory: string
  description: string
}

export const HISTORICAL_TICKETS_FIXTURES: Record<string, HistoricalTicketFixture> = {
  // Navidad 2025
  NAVIDAD_2025_EL_GORDO: {
    id: 'fix-navidad-2025-gordo',
    number: '79432',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 40_000_000,
    expectedCategory: '1.º Premio (El Gordo)',
    description: 'El Gordo de Navidad 2025 (400.000 € por décimo)',
  },
  NAVIDAD_2025_SEGUNDO: {
    id: 'fix-navidad-2025-segundo',
    number: '70048',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 12_500_000,
    expectedCategory: '2.º Premio',
    description: 'Segundo Premio de Navidad 2025 (125.000 € por décimo)',
  },
  NAVIDAD_2025_APROXIMACION: {
    id: 'fix-navidad-2025-aprox',
    number: '79431',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 200_000,
    expectedCategory: 'Aproximación 1.º Premio',
    description: 'Número anterior al Gordo de Navidad 2025 (2.000 €)',
  },
  NAVIDAD_2025_CENTENA: {
    id: 'fix-navidad-2025-centena',
    number: '79400',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 10_000,
    expectedCategory: 'Centena 1.º Premio',
    description: 'Centena del 1.º premio de Navidad 2025 (100 €)',
  },
  NAVIDAD_2025_DOS_ULTIMAS: {
    id: 'fix-navidad-2025-dos-ultimas',
    number: '11132',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 10_000,
    expectedCategory: 'Dos últimas cifras 1.º Premio',
    description: 'Terminación en 32 igual al 1.º premio de Navidad 2025 (100 €)',
  },
  NAVIDAD_2025_REINTEGRO: {
    id: 'fix-navidad-2025-reintegro',
    number: '00002',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 2_000,
    expectedCategory: 'Reintegro',
    description: 'Terminación en 2 (reintegro del Gordo de Navidad 2025, 20 €)',
  },

  // Navidad 2020
  NAVIDAD_2020_EL_GORDO: {
    id: 'fix-navidad-2020-gordo',
    number: '72897',
    drawDate: '2020-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 40_000_000,
    expectedCategory: '1.º Premio (El Gordo)',
    description: 'El Gordo de Navidad 2020 (400.000 € por décimo)',
  },
  NAVIDAD_2020_REINTEGRO: {
    id: 'fix-navidad-2020-reintegro',
    number: '00007',
    drawDate: '2020-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 2_000,
    expectedCategory: 'Reintegro',
    description: 'Terminación en 7 (reintegro del Gordo de Navidad 2020, 20 €)',
  },

  // El Niño 2025
  NINO_2025_PRIMER_PREMIO: {
    id: 'fix-nino-2025-primero',
    number: '78908',
    drawDate: '2025-01-06',
    drawType: 'EL_NINO',
    expectedPrizeCents: 20_000_000,
    expectedCategory: '1.º Premio (El Niño)',
    description: 'Primer Premio de El Niño 2025 (200.000 € por décimo)',
  },
  NINO_2025_SEGUNDO_PREMIO: {
    id: 'fix-nino-2025-segundo',
    number: '06766',
    drawDate: '2025-01-06',
    drawType: 'EL_NINO',
    expectedPrizeCents: 7_500_000,
    expectedCategory: '2.º Premio',
    description: 'Segundo Premio de El Niño 2025 (75.000 € por décimo)',
  },

  // Boleto no premiado
  SIN_PREMIO_12345: {
    id: 'fix-sin-premio-12345',
    number: '12345',
    drawDate: '2025-12-22',
    drawType: 'NAVIDAD',
    expectedPrizeCents: 0,
    expectedCategory: 'Sin premio',
    description: 'Boleto 12345 en Navidad 2025 sin ningún premio ni reintegro (0 €)',
  },
}
