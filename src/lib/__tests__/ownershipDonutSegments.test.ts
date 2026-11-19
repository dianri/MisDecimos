import { test } from 'node:test'
import assert from 'node:assert'
import {
  computeRadialOwnershipSegments,
  computeSolidDonutArcs,
  SEGMENT_COLORS,
  TOTAL_RADIAL_SEGMENTS,
  DONUT_RADIUS,
} from '../ownershipSegments.ts'

test('computeSolidDonutArcs - 100% propietario asigna un único arco continuo con offset 0', () => {
  const { circumference, arcs, totalAllocated, availablePercent } = computeSolidDonutArcs(100, 0, 0, DONUT_RADIUS)
  assert.strictEqual(totalAllocated, 100)
  assert.strictEqual(availablePercent, 0)
  assert.strictEqual(arcs.length, 1)

  const ownerArc = arcs[0]
  assert.strictEqual(ownerArc.category, 'propietario')
  assert.strictEqual(ownerArc.color, SEGMENT_COLORS.propietario)
  assert.strictEqual(ownerArc.offset, 0)
  assert.strictEqual(ownerArc.length, circumference)
})

test('computeSolidDonutArcs - 55% / 25% / 20% distribuye 3 arcos contiguos sin solapamiento', () => {
  const { circumference, arcs, totalAllocated, availablePercent } = computeSolidDonutArcs(55, 25, 20, 62)
  assert.strictEqual(totalAllocated, 100)
  assert.strictEqual(availablePercent, 0)
  assert.strictEqual(arcs.length, 3)

  const [owner, coOwners, pending] = arcs

  assert.strictEqual(owner.category, 'propietario')
  assert.strictEqual(owner.offset, 0)
  assert.strictEqual(owner.length, 0.55 * circumference)

  assert.strictEqual(coOwners.category, 'cotitulares')
  assert.strictEqual(coOwners.offset, -(0.55 * circumference))
  assert.strictEqual(coOwners.length, 0.25 * circumference)

  assert.strictEqual(pending.category, 'pendientes')
  assert.strictEqual(pending.offset, -((0.55 + 0.25) * circumference))
  assert.strictEqual(pending.length, 0.20 * circumference)

  const totalLength = owner.length + coOwners.length + pending.length
  assert.ok(Math.abs(totalLength - circumference) < 0.0001, 'La suma de arcos debe igualar la circunferencia total')
})

test('computeSolidDonutArcs - suma < 100% preserva availablePercent para el círculo base gris', () => {
  const { circumference, arcs, totalAllocated, availablePercent } = computeSolidDonutArcs(50, 20, 10, 62)
  assert.strictEqual(totalAllocated, 80)
  assert.strictEqual(availablePercent, 20)
  assert.strictEqual(arcs.length, 3)

  const totalLength = arcs.reduce((acc, a) => acc + a.length, 0)
  assert.ok(Math.abs(totalLength - 0.8 * circumference) < 0.0001)
})

test('computeSolidDonutArcs - omite categorías con 0% evitando círculos vacíos', () => {
  const { arcs } = computeSolidDonutArcs(80, 0, 20, 62)
  assert.strictEqual(arcs.length, 2)
  assert.strictEqual(arcs[0].category, 'propietario')
  assert.strictEqual(arcs[1].category, 'pendientes')
  assert.strictEqual(arcs[1].offset, -(0.8 * 2 * Math.PI * 62))
})

test('computeRadialOwnershipSegments - 100% propietario asigna todos los 50 segmentos a verde', () => {
  const segments = computeRadialOwnershipSegments(100, 0, 0)
  assert.strictEqual(segments.length, TOTAL_RADIAL_SEGMENTS)

  const greenCount = segments.filter((s) => s.category === 'propietario' && s.color === SEGMENT_COLORS.propietario).length
  assert.strictEqual(greenCount, 50, 'Los 50 segmentos deben ser del propietario')
})

test('computeRadialOwnershipSegments - 55% / 25% / 20% distribuye bloques continuos sin solapamiento', () => {
  const segments = computeRadialOwnershipSegments(55, 25, 20)
  assert.strictEqual(segments.length, 50)

  const ownerSegments = segments.filter((s) => s.category === 'propietario')
  const coOwnerSegments = segments.filter((s) => s.category === 'cotitulares')
  const pendingSegments = segments.filter((s) => s.category === 'pendientes')
  const availableSegments = segments.filter((s) => s.category === 'disponible')

  assert.strictEqual(ownerSegments.length, 28, '55% debe tener 28 segmentos (~56%)')
  assert.strictEqual(coOwnerSegments.length, 12, '25% debe tener 12 segmentos (~24%)')
  assert.strictEqual(pendingSegments.length, 10, '20% debe tener 10 segmentos (20%)')
  assert.strictEqual(availableSegments.length, 0, 'No debe haber segmentos disponibles')

  // Verificar que cada categoría forma un bloque continuo sin alternancia de colores
  for (let i = 0; i < 28; i++) {
    assert.strictEqual(segments[i].category, 'propietario')
    assert.strictEqual(segments[i].color, SEGMENT_COLORS.propietario)
  }
  for (let i = 28; i < 40; i++) {
    assert.strictEqual(segments[i].category, 'cotitulares')
    assert.strictEqual(segments[i].color, SEGMENT_COLORS.cotitulares)
  }
  for (let i = 40; i < 50; i++) {
    assert.strictEqual(segments[i].category, 'pendientes')
    assert.strictEqual(segments[i].color, SEGMENT_COLORS.pendientes)
  }
})

test('computeRadialOwnershipSegments - incluye tramo disponible en gris si suma < 100%', () => {
  const segments = computeRadialOwnershipSegments(50, 20, 10)
  assert.strictEqual(segments.length, 50)

  const ownerSegments = segments.filter((s) => s.category === 'propietario')
  const coOwnerSegments = segments.filter((s) => s.category === 'cotitulares')
  const pendingSegments = segments.filter((s) => s.category === 'pendientes')
  const availableSegments = segments.filter((s) => s.category === 'disponible')

  assert.strictEqual(ownerSegments.length, 25)
  assert.strictEqual(coOwnerSegments.length, 10)
  assert.strictEqual(pendingSegments.length, 5)
  assert.strictEqual(availableSegments.length, 10)
  assert.strictEqual(availableSegments[0].color, SEGMENT_COLORS.disponible)
})

test('computeRadialOwnershipSegments - garantiza al menos 1 segmento para cuotas > 0 pequeñas', () => {
  const segments = computeRadialOwnershipSegments(98, 1, 1)
  assert.strictEqual(segments.length, 50)

  const coOwnerSegments = segments.filter((s) => s.category === 'cotitulares')
  const pendingSegments = segments.filter((s) => s.category === 'pendientes')

  assert.ok(coOwnerSegments.length >= 1, 'Cotitulares debe tener al menos 1 segmento visible')
  assert.ok(pendingSegments.length >= 1, 'Pendientes debe tener al menos 1 segmento visible')
})

test('computeRadialOwnershipSegments - coordenadas geométricas válidas y 12 en punto a -90°', () => {
  const segments = computeRadialOwnershipSegments(100, 0, 0)
  const first = segments[0]

  // En i=0 (12 en punto), x1 y x2 deben estar en x=50, y1 en 50 - 34 = 16, y2 en 50 - 42.5 = 7.5
  assert.strictEqual(first.x1, 50)
  assert.strictEqual(first.x2, 50)
  assert.strictEqual(first.y1, 16)
  assert.strictEqual(first.y2, 7.5)

  // Todas las coordenadas deben estar dentro de la caja de 100x100
  segments.forEach((s) => {
    assert.ok(s.x1 >= 0 && s.x1 <= 100)
    assert.ok(s.y1 >= 0 && s.y1 <= 100)
    assert.ok(s.x2 >= 0 && s.x2 <= 100)
    assert.ok(s.y2 >= 0 && s.y2 <= 100)
  })
})
