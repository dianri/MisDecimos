import { test } from 'node:test'
import assert from 'node:assert'
import { resolveAlertDotPriority, getAlertDotColorClass } from '../alertBadgePriority.ts'

test('resolveAlertDotPriority - sin alertas no leídas devuelve null', () => {
  assert.strictEqual(resolveAlertDotPriority([]), null)
  assert.strictEqual(getAlertDotColorClass(null), '')
})

test('resolveAlertDotPriority - prioridad 1: crítica/error -> Rojo Coral #D04848', () => {
  const priority = resolveAlertDotPriority([
    { type: 'SHARE_CREATED' },
    { type: 'PRIZE_WON' },
    { type: 'WAIVER_REQUEST' },
  ])
  assert.strictEqual(priority, 'critical')
  assert.strictEqual(getAlertDotColorClass(priority), 'bg-[#D04848]')
})

test('resolveAlertDotPriority - prioridad 2: premio/buenas noticias -> Verde Granito #3A5245', () => {
  const priority = resolveAlertDotPriority([
    { type: 'SHARE_CREATED' },
    { type: 'PRIZE_WON' },
  ])
  assert.strictEqual(priority, 'prize')
  assert.strictEqual(getAlertDotColorClass(priority), 'bg-[#3A5245]')
})

test('resolveAlertDotPriority - prioridad 3: general -> Oro Cava #C5A880', () => {
  const priority = resolveAlertDotPriority([
    { type: 'SHARE_CREATED' },
    { type: 'PAYOUT_REMINDER' },
  ])
  assert.strictEqual(priority, 'general')
  assert.strictEqual(getAlertDotColorClass(priority), 'bg-[#C5A880]')
})
