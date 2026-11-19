import { test } from 'node:test'
import assert from 'node:assert'

interface ShareItem {
  userId: string
  role: 'PROPIETARIO' | 'PARTICIPANTE'
  percentage: number
  status: 'ACEPTADA' | 'PENDIENTE' | 'RENUNCIADA'
}

interface SharePrizeCalculation {
  userId: string
  role: 'PROPIETARIO' | 'PARTICIPANTE'
  percentage: number
  status: 'ACEPTADA' | 'PENDIENTE' | 'RENUNCIADA'
  proportionalPrizeCents: number
  formattedPrize: string
}

/**
 * Función canónica pura que replica la distribución de premios de record_ticket_prize_check
 */
function calculatePrizeDistribution(
  prizeAmountCents: number,
  shares: ShareItem[]
): {
  totalPrizeCents: number
  sharesBreakdown: SharePrizeCalculation[]
  totalAllocatedCents: number
} {
  const sharesBreakdown: SharePrizeCalculation[] = shares.map((share) => {
    let proportionalPrizeCents = 0

    // Regla de negocio estricta: solo participaciones ACEPTADAS con porcentaje > 0 reciben premio
    if (share.status === 'ACEPTADA' && share.percentage > 0) {
      proportionalPrizeCents = Math.round((prizeAmountCents * share.percentage) / 100)
    }

    const formattedPrize = (
      (proportionalPrizeCents / 100)
    ).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'

    return {
      userId: share.userId,
      role: share.role,
      percentage: share.percentage,
      status: share.status,
      proportionalPrizeCents,
      formattedPrize,
    }
  })

  const totalAllocatedCents = sharesBreakdown.reduce(
    (acc, curr) => acc + curr.proportionalPrizeCents,
    0
  )

  return {
    totalPrizeCents: prizeAmountCents,
    sharesBreakdown,
    totalAllocatedCents,
  }
}

test('calculatePrizeDistribution - reparte proporcionalmente entre propietario y cotitulares aceptados', () => {
  const prizeAmountCents = 100000 // 1.000,00 €
  const shares: ShareItem[] = [
    { userId: 'owner-1', role: 'PROPIETARIO', percentage: 60, status: 'ACEPTADA' },
    { userId: 'user-2', role: 'PARTICIPANTE', percentage: 40, status: 'ACEPTADA' },
  ]

  const result = calculatePrizeDistribution(prizeAmountCents, shares)

  assert.strictEqual(result.totalPrizeCents, 100000)
  assert.strictEqual(result.sharesBreakdown[0].proportionalPrizeCents, 60000)
  assert.strictEqual(result.sharesBreakdown[0].formattedPrize, '600,00 €')
  assert.strictEqual(result.sharesBreakdown[1].proportionalPrizeCents, 40000)
  assert.strictEqual(result.sharesBreakdown[1].formattedPrize, '400,00 €')
  assert.strictEqual(result.totalAllocatedCents, 100000)
})

test('calculatePrizeDistribution - participaciones RENUNCIADA reciben 0,00 €', () => {
  const prizeAmountCents = 100000 // 1.000,00 €
  const shares: ShareItem[] = [
    { userId: 'owner-1', role: 'PROPIETARIO', percentage: 70, status: 'ACEPTADA' },
    { userId: 'user-2', role: 'PARTICIPANTE', percentage: 30, status: 'ACEPTADA' },
    { userId: 'user-3', role: 'PARTICIPANTE', percentage: 0, status: 'RENUNCIADA' },
  ]

  const result = calculatePrizeDistribution(prizeAmountCents, shares)

  const renounced = result.sharesBreakdown.find((s) => s.userId === 'user-3')
  assert.ok(renounced)
  assert.strictEqual(renounced.proportionalPrizeCents, 0)
  assert.strictEqual(renounced.formattedPrize, '0,00 €')
})

test('calculatePrizeDistribution - participaciones PENDIENTE no reciben premio asignado', () => {
  const prizeAmountCents = 200000 // 2.000,00 €
  const shares: ShareItem[] = [
    { userId: 'owner-1', role: 'PROPIETARIO', percentage: 50, status: 'ACEPTADA' },
    { userId: 'user-2', role: 'PARTICIPANTE', percentage: 25, status: 'ACEPTADA' },
    { userId: 'invite-3', role: 'PARTICIPANTE', percentage: 25, status: 'PENDIENTE' },
  ]

  const result = calculatePrizeDistribution(prizeAmountCents, shares)

  const pending = result.sharesBreakdown.find((s) => s.userId === 'invite-3')
  assert.ok(pending)
  assert.strictEqual(pending.proportionalPrizeCents, 0)
  assert.strictEqual(pending.formattedPrize, '0,00 €')

  const owner = result.sharesBreakdown.find((s) => s.userId === 'owner-1')
  assert.strictEqual(owner?.proportionalPrizeCents, 100000) // 1.000,00 €
})

test('calculatePrizeDistribution - simulación y restablecimiento', () => {
  const simulatedPrizePerDecimo = 1000 // 1.000 €
  const prizeAmountCents = Math.round(simulatedPrizePerDecimo * 100)

  const shares: ShareItem[] = [
    { userId: 'owner-1', role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
  ]

  const simulatedResult = calculatePrizeDistribution(prizeAmountCents, shares)
  assert.strictEqual(simulatedResult.totalPrizeCents, 100000)
  assert.strictEqual(simulatedResult.sharesBreakdown[0].proportionalPrizeCents, 100000)

  // Al restablecer: prizeAmountCents = 0
  const resetResult = calculatePrizeDistribution(0, shares)
  assert.strictEqual(resetResult.totalPrizeCents, 0)
  assert.strictEqual(resetResult.sharesBreakdown[0].proportionalPrizeCents, 0)
  assert.strictEqual(resetResult.sharesBreakdown[0].formattedPrize, '0,00 €')
})
