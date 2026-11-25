import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyUserTickets,
  buildUnifiedActiveTicketsList,
  type TicketRow,
  type OwnershipShareRow,
} from '../ticketMetrics.ts'
import { shouldShowCreateParticipationButton } from '../cardQuickActions.ts'
import { resolveTicketCardPresentation } from '../ticketCardHelper.ts'
import { clampSwipeOffset, resolveSwipeSnap } from '../swipeCardState.ts'

const baseTicket: Omit<TicketRow, 'id' | 'owner_id' | 'number' | 'draw_date' | 'created_at'> = {
  barcode_raw: null,
  check_source: null,
  draw_name: 'Lotería de Navidad',
  draw_type: 'NAVIDAD',
  fraccion: null,
  last_checked_at: null,
  origin: 'MANUAL',
  prize_amount_cents: 0,
  serie: null,
  status: 'PENDIENTE',
  template_id: null,
  ticket_price: 20,
  updated_at: '2026-11-01T00:00:00Z',
}

const baseShare: Omit<OwnershipShareRow, 'id' | 'ticket_id' | 'user_id' | 'role' | 'percentage' | 'status'> = {
  created_at: '2026-11-01T00:00:00Z',
  prize_paid_confirmed: false,
  prize_paid_confirmed_at: null,
  prize_payout_requested_at: null,
  prize_payout_requested_by: null,
  updated_at: '2026-11-01T00:00:00Z',
  waiver_requested: false,
  waiver_requested_at: null,
}

test('buildUnifiedActiveTicketsList - unifica Décimos propios y Participaciones activas con identificación correcta', () => {
  const userId = 'user-1'
  const tickets: TicketRow[] = [
    { ...baseTicket, id: 't-own', owner_id: userId, number: '11111', draw_date: '2025-12-22', created_at: '2026-11-01T10:00:00Z' },
    { ...baseTicket, id: 't-part', owner_id: 'other', number: '22222', draw_date: '2026-12-22', created_at: '2026-11-02T10:00:00Z' },
    { ...baseTicket, id: 't-renounced', owner_id: 'other', number: '33333', draw_date: '2026-12-22', created_at: '2026-11-03T10:00:00Z' },
  ]
  const shares: OwnershipShareRow[] = [
    { ...baseShare, id: 's1', ticket_id: 't-own', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's2', ticket_id: 't-part', user_id: userId, role: 'PARTICIPANTE', percentage: 25, status: 'ACEPTADA' },
    { ...baseShare, id: 's3', ticket_id: 't-renounced', user_id: userId, role: 'PARTICIPANTE', percentage: 0, status: 'RENUNCIADA' },
  ]

  const classified = classifyUserTickets(tickets, shares, new Set(), userId)
  const unified = buildUnifiedActiveTicketsList(classified.activeTickets)

  assert.equal(unified.length, 2)
  // Ordenado por draw_date más reciente primero
  assert.equal(unified[0].ticket.id, 't-part')
  assert.equal(unified[0].isOwner, false)
  assert.equal(unified[0].userPercentage, 25)

  assert.equal(unified[1].ticket.id, 't-own')
  assert.equal(unified[1].isOwner, true)
  assert.equal(unified[1].userPercentage, 100)

  // Presentación minimalista Apple: esquinas muy redondeadas (rounded-[22px]) y superficie limpia light/dark
  const ownPresentation = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'PENDIENTE',
    userPercentage: 100,
    isOwner: true,
  })
  assert.ok(ownPresentation.containerClasses.includes('rounded-[22px]'))
  assert.ok(ownPresentation.containerClasses.includes('bg-white'))
  assert.ok(ownPresentation.containerClasses.includes('dark:bg-[#1D1D1F]'))

  const partPresentation = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'PENDIENTE',
    userPercentage: 25,
    isOwner: false,
  })
  assert.ok(partPresentation.containerClasses.includes('rounded-[22px]'))
  assert.ok(partPresentation.containerClasses.includes('bg-white'))

  // Swipe en Participación: permite derecha (Archivar) pero bloquea izquierda (Eliminar)
  assert.equal(clampSwipeOffset(-60, 0, false), 0)
  assert.deepEqual(resolveSwipeSnap(-60, false), { side: null, snappedOffset: 0 })
})

test('shouldShowCreateParticipationButton - visible solo para propietario con porcentaje libre y no liquidado', () => {
  assert.equal(
    shouldShowCreateParticipationButton({ isOwner: true, ticketStatus: 'PENDIENTE', availablePercentage: 50 }),
    true
  )
  assert.equal(
    shouldShowCreateParticipationButton({ isOwner: true, ticketStatus: 'PENDIENTE', availablePercentage: 0 }),
    false
  )
  assert.equal(
    shouldShowCreateParticipationButton({ isOwner: false, ticketStatus: 'PENDIENTE', availablePercentage: 50 }),
    false
  )
  assert.equal(
    shouldShowCreateParticipationButton({ isOwner: true, ticketStatus: 'LIQUIDADO', availablePercentage: 50 }),
    false
  )
})
