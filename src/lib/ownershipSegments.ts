/**
 * ownershipSegments.ts — Generación determinista de segmentos radiales para el gráfico Donut
 * Sustituye los círculos SVG superpuestos por 50 segmentos radiales discretos sin solapamiento.
 */

export interface RadialSegment {
  index: number
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  category: 'propietario' | 'cotitulares' | 'pendientes' | 'disponible'
  pct: number
}

export const SEGMENT_COLORS = {
  propietario: '#2E6146',
  cotitulares: '#2563EB',
  pendientes: '#D97706',
  disponible: '#E5E7EB',
} as const

export const TOTAL_RADIAL_SEGMENTS = 50
export const INNER_RADIUS = 34
export const OUTER_RADIUS = 42.5

/**
 * Calcula 50 segmentos radiales discretos distribuidos uniformemente cada 7.2°
 * empezando a las 12 en punto (-90°).
 *
 * Cada segmento i (0..49) se clasifica de forma determinista y exclusiva:
 * - Propietario: Verde corporativo (#2E6146)
 * - Cotitulares: Azul (#2563EB)
 * - Pendientes: Naranja / Ámbar (#D97706)
 * - Disponible / Resto: Gris suave (#E5E7EB)
 *
 * Se garantiza continuidad en cada tramo sin solapamiento y al menos 1 segmento
 * visible para cualquier cuota > 0.
 */
export function computeRadialOwnershipSegments(
  ownerPercent: number,
  coOwnersPercent: number,
  pendingPercent: number
): RadialSegment[] {
  const oPct = Math.max(0, Math.min(100, Number(ownerPercent) || 0))
  const cPct = Math.max(0, Math.min(100 - oPct, Number(coOwnersPercent) || 0))
  const pPct = Math.max(0, Math.min(100 - (oPct + cPct), Number(pendingPercent) || 0))

  // Conteo acumulado proporcional de segmentos sobre un total de 50
  let c1 = Math.round((oPct / 100) * TOTAL_RADIAL_SEGMENTS)
  let c2 = Math.round(((oPct + cPct) / 100) * TOTAL_RADIAL_SEGMENTS)
  let c3 = Math.round(((oPct + cPct + pPct) / 100) * TOTAL_RADIAL_SEGMENTS)

  // Garantizar al menos 1 segmento para cualquier tramo > 0
  if (oPct > 0 && c1 === 0) c1 = 1
  if (cPct > 0 && c2 <= c1) c2 = c1 + 1
  if (pPct > 0 && c3 <= c2) c3 = c2 + 1

  // Asegurar que el total no exceda 50 segmentos, ajustando proporcionalmente
  if (c3 > TOTAL_RADIAL_SEGMENTS) {
    const overflow = c3 - TOTAL_RADIAL_SEGMENTS
    c3 = TOTAL_RADIAL_SEGMENTS
    c2 = Math.max(cPct > 0 ? 1 : 0, c2 - overflow)
    if (c2 <= c1 && cPct > 0 && oPct > 0) {
      c1 = Math.max(1, c1 - 1)
    }
  }

  return Array.from({ length: TOTAL_RADIAL_SEGMENTS }, (_, i) => {
    // Punto medio porcentual del segmento i (0..49): exacta progresión 1%, 3%, 5% ... 99%
    const pct = ((i + 0.5) / TOTAL_RADIAL_SEGMENTS) * 100

    let color: string = SEGMENT_COLORS.disponible
    let category: RadialSegment['category'] = 'disponible'

    if (i < c1) {
      color = SEGMENT_COLORS.propietario
      category = 'propietario'
    } else if (i < c2) {
      color = SEGMENT_COLORS.cotitulares
      category = 'cotitulares'
    } else if (i < c3) {
      color = SEGMENT_COLORS.pendientes
      category = 'pendientes'
    }

    // Distribución uniforme cada 360 / 50 = 7.2 grados, empezando a las 12 en punto (-90°)
    const angleDeg = (i * 360) / TOTAL_RADIAL_SEGMENTS - 90
    const rad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    return {
      index: i,
      x1: Number((50 + INNER_RADIUS * cos).toFixed(3)),
      y1: Number((50 + INNER_RADIUS * sin).toFixed(3)),
      x2: Number((50 + OUTER_RADIUS * cos).toFixed(3)),
      y2: Number((50 + OUTER_RADIUS * sin).toFixed(3)),
      color,
      category,
      pct: Number(pct.toFixed(2)),
    }
  })
}
