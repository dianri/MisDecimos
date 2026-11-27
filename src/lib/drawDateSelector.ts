export type DrawType = 'NAVIDAD' | 'EL_NINO'

/**
 * Devuelve el año por defecto para el sorteo seleccionado:
 * - Navidad: año en curso (new Date().getFullYear()).
 * - El Niño: año en curso si es 6 de enero o anterior; año siguiente si ya pasó el 6 de enero.
 */
export function getDefaultDrawYear(drawType: DrawType, now: Date = new Date()): number {
  const currentYear = now.getFullYear()
  if (drawType === 'NAVIDAD') {
    return currentYear
  }
  return now.getMonth() > 0 || now.getDate() > 6 ? currentYear + 1 : currentYear
}

/**
 * Construye la fecha ISO completa fijando día y mes según el tipo de sorteo:
 * - NAVIDAD -> YYYY-12-22
 * - EL_NINO -> YYYY-01-06
 */
export function buildDrawDateIso(drawType: DrawType, year: number): string {
  return drawType === 'NAVIDAD' ? `${year}-12-22` : `${year}-01-06`
}

/**
 * Formatea la fecha visible en el campo "Fecha del Sorteo" (DD/MM/YYYY):
 * - NAVIDAD -> 22/12/YYYY
 * - EL_NINO -> 06/01/YYYY
 */
export function formatDrawDateDisplay(drawType: DrawType, year: number): string {
  return drawType === 'NAVIDAD' ? `22/12/${year}` : `06/01/${year}`
}

/**
 * Extrae el año (YYYY) de una fecha ISO YYYY-MM-DD, con respaldo seguro.
 */
export function extractYearFromIsoDate(
  isoDate?: string | null,
  fallbackYear: number = new Date().getFullYear()
): number {
  if (!isoDate) return fallbackYear
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(isoDate.trim())
  if (!match) return fallbackYear
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallbackYear
}

/**
 * Genera el listado ordenado de años seleccionables [baseYear - 2 .. baseYear + 3],
 * asegurando que cualquier año ya seleccionado (ej. boleto histórico escaneado) esté incluido.
 */
export function getSelectableDrawYears(
  baseYear: number = new Date().getFullYear(),
  selectedYear?: number
): number[] {
  const years = new Set<number>()
  for (let y = baseYear - 2; y <= baseYear + 3; y += 1) {
    years.add(y)
  }
  if (typeof selectedYear === 'number' && Number.isFinite(selectedYear)) {
    years.add(selectedYear)
  }
  return Array.from(years).sort((a, b) => a - b)
}
