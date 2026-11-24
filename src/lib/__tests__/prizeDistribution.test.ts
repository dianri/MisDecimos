import { test } from 'node:test'
import assert from 'node:assert'
import { classifyUserTickets } from '../ticketMetrics.ts'
import type { TicketRow, OwnershipShareRow } from '../ticketMetrics.ts'

interface ShareItem {
  userId: string
  role: 'PROPIETARIO' | 'PARTICIPANTE'
  percentage: number
  status: 'ACEPTADA' | 'PENDIENTE' | 'RENUNCIADA' | 'CANCELADA'
}

interface SharePrizeCalculation {
  userId: string
  role: 'PROPIETARIO' | 'PARTICIPANTE'
  percentage: number
  status: 'ACEPTADA' | 'PENDIENTE' | 'RENUNCIADA' | 'CANCELADA'
  proportionalPrizeCents: number
  formattedPrize: string
}

/**
 * Función canónica pura que replica la distribución de premios de record_ticket_prize_check
 * con ajuste exacto de resto mayor (Hamilton) cuando las cuotas aceptadas suman 100%.
 */
function calculatePrizeDistribution(
  prizeAmountCents: number,
  shares: ShareItem[]
): {
  totalPrizeCents: number
  sharesBreakdown: SharePrizeCalculation[]
  totalAllocatedCents: number
} {
  const rawCents = shares.map((share) => {
    if (share.status === 'ACEPTADA' && share.percentage > 0) {
      const exact = (prizeAmountCents * share.percentage) / 100
      const floored = Math.floor(exact)
      return { floored, remainder: exact - floored, eligible: true }
    }
    return { floored: 0, remainder: 0, eligible: false }
  })

  const acceptedPctSum = shares.reduce(
    (sum, s) => sum + (s.status === 'ACEPTADA' && s.percentage > 0 ? s.percentage : 0),
    0
  )

  const allocatedFloored = rawCents.reduce((sum, r) => sum + r.floored, 0)
  const targetTotalCents =
    Math.abs(acceptedPctSum - 100) < 0.001
      ? prizeAmountCents
      : Math.round((prizeAmountCents * acceptedPctSum) / 100)

  let centsLeft = Math.max(0, targetTotalCents - allocatedFloored)
  const finalCents = rawCents.map((r) => r.floored)

  if (centsLeft > 0) {
    const sortedIndices = rawCents
      .map((r, idx) => ({ idx, remainder: r.remainder, eligible: r.eligible }))
      .filter((x) => x.eligible)
      .sort((a, b) => b.remainder - a.remainder)

    for (let i = 0; i < sortedIndices.length && centsLeft > 0; i++) {
      finalCents[sortedIndices[i].idx] += 1
      centsLeft -= 1
    }
  }

  const sharesBreakdown: SharePrizeCalculation[] = shares.map((share, idx) => {
    const proportionalPrizeCents = finalCents[idx]
    const formattedPrize =
      (proportionalPrizeCents / 100).toLocaleString('es-ES', {
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

test('calculatePrizeDistribution - decimales periódicos (33.33%, 33.33%, 33.34%) cuadran al céntimo', () => {
  const prizeAmountCents = 1000 // 10,00 €
  const shares: ShareItem[] = [
    { userId: 'owner-1', role: 'PROPIETARIO', percentage: 33.33, status: 'ACEPTADA' },
    { userId: 'user-2', role: 'PARTICIPANTE', percentage: 33.33, status: 'ACEPTADA' },
    { userId: 'user-3', role: 'PARTICIPANTE', percentage: 33.34, status: 'ACEPTADA' },
  ]

  const result = calculatePrizeDistribution(prizeAmountCents, shares)
  assert.strictEqual(result.totalAllocatedCents, 1000)
  assert.strictEqual(result.sharesBreakdown[0].proportionalPrizeCents, 333)
  assert.strictEqual(result.sharesBreakdown[1].proportionalPrizeCents, 333)
  assert.strictEqual(result.sharesBreakdown[2].proportionalPrizeCents, 334)
})

test('classifyUserTickets - excluye PENDIENTE, CANCELADA y RENUNCIADA y calcula cuota fraccionada del custodio (40% de 1.000 € = 400 €)', () => {
  const baseTicket = {
    barcode_raw: null,
    check_source: null,
    created_at: '2026-11-01T00:00:00Z',
    draw_date: '2025-12-22',
    draw_name: 'Lotería de Navidad',
    draw_type: 'NAVIDAD',
    fraccion: null,
    last_checked_at: null,
    number: '79432',
    origin: 'MANUAL',
    serie: null,
    status: 'VALIDADO',
    template_id: null,
    ticket_price: 20,
    updated_at: '2026-11-01T00:00:00Z',
  }

  const tickets: TicketRow[] = [
    { ...baseTicket, id: 't-owner-40', owner_id: 'owner-1', prize_amount_cents: 100_000 }, // 1.000 €
    { ...baseTicket, id: 't-pending', owner_id: 'other', prize_amount_cents: 50_000 },
    { ...baseTicket, id: 't-cancelled', owner_id: 'other', prize_amount_cents: 50_000 },
    { ...baseTicket, id: 't-renounced', owner_id: 'other', prize_amount_cents: 50_000 },
  ]

  const baseShare = {
    created_at: '2026-11-01T00:00:00Z',
    prize_paid_confirmed: false,
    prize_paid_confirmed_at: null,
    prize_payout_requested_at: null,
    prize_payout_requested_by: null,
    updated_at: '2026-11-01T00:00:00Z',
    waiver_requested: false,
    waiver_requested_at: null,
  }

  const shares: OwnershipShareRow[] = [
    { ...baseShare, id: 's1', ticket_id: 't-owner-40', user_id: 'owner-1', role: 'PROPIETARIO', percentage: 40, status: 'ACEPTADA' },
    { ...baseShare, id: 's2', ticket_id: 't-owner-40', user_id: 'user-2', role: 'PARTICIPANTE', percentage: 60, status: 'ACEPTADA' },
    { ...baseShare, id: 's3', ticket_id: 't-pending', user_id: 'owner-1', role: 'PARTICIPANTE', percentage: 25, status: 'PENDIENTE' },
    { ...baseShare, id: 's4', ticket_id: 't-cancelled', user_id: 'owner-1', role: 'PARTICIPANTE', percentage: 25, status: 'CANCELADA' },
    { ...baseShare, id: 's5', ticket_id: 't-renounced', user_id: 'owner-1', role: 'PARTICIPANTE', percentage: 0, status: 'RENUNCIADA' },
  ]

  const metrics = classifyUserTickets(tickets, shares, new Set(), 'owner-1')

  assert.strictEqual(metrics.totalActivosCount, 1)
  assert.strictEqual(metrics.misDecimos.length, 1)
  assert.strictEqual(metrics.misParticipaciones.length, 0)
  assert.strictEqual(metrics.totalPremiosGanados, 400)
})
