import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyUserTickets,
  type TicketRow,
  type OwnershipShareRow,
} from '../ticketMetrics.ts'

const mockTicket = (partial: Partial<TicketRow>): TicketRow => ({
  id: 'ticket-1',
  owner_id: 'user-1',
  number: '12345',
  serie: '001',
  fraccion: '01',
  draw_type: 'NAVIDAD',
  draw_name: 'Sorteo de Navidad',
  draw_date: '2026-12-22',
  ticket_price: 20,
  barcode_raw: null,
  template_id: null,
  origin: 'MANUAL',
  status: 'REGISTRADO',
  prize_amount_cents: 0,
  check_source: null,
  last_checked_at: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  ...partial,
})

const mockShare = (partial: Partial<OwnershipShareRow>): OwnershipShareRow => ({
  id: 'share-1',
  ticket_id: 'ticket-1',
  user_id: 'user-1',
  role: 'PROPIETARIO',
  percentage: 100,
  status: 'ACEPTADA',
  prize_paid_confirmed: false,
  prize_paid_confirmed_at: null,
  waiver_requested: false,
  waiver_requested_at: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  ...partial,
})

test('classifyUserTickets - excludes renounced shares from activeTicketsCount and participations', () => {
  const currentUserId = 'user-alice'

  // 1. Décimo propio activo de Alice
  const ticketOwn = mockTicket({
    id: 'ticket-own',
    owner_id: currentUserId,
    number: '49307',
  })
  const shareOwn = mockShare({
    id: 'share-own',
    ticket_id: 'ticket-own',
    user_id: currentUserId,
    role: 'PROPIETARIO',
    percentage: 100,
    status: 'ACEPTADA',
  })

  // 2. Décimo de Bob donde Alice RENUNCIÓ a su participación (status: 'RENUNCIADA', percentage: 0)
  const ticketBob = mockTicket({
    id: 'ticket-bob',
    owner_id: 'user-bob',
    number: '76719',
    prize_amount_cents: 100000, // 1.000 € de premio
  })
  const shareAliceRenounced = mockShare({
    id: 'share-bob-alice',
    ticket_id: 'ticket-bob',
    user_id: currentUserId,
    role: 'PARTICIPANTE',
    percentage: 0,
    status: 'RENUNCIADA',
  })
  const shareBobOwner = mockShare({
    id: 'share-bob-owner',
    ticket_id: 'ticket-bob',
    user_id: 'user-bob',
    role: 'PROPIETARIO',
    percentage: 100,
    status: 'ACEPTADA',
  })

  const tickets = [ticketOwn, ticketBob]
  const shares = [shareOwn, shareAliceRenounced, shareBobOwner]
  const archivedIds = new Set<string>()

  const result = classifyUserTickets(tickets, shares, archivedIds, currentUserId)

  // Verificaciones requeridas por la regla de negocio:
  // Alice solo debe tener 1 billete activo (su propio décimo)
  assert.equal(result.totalActivosCount, 1)
  assert.equal(result.misDecimos.length, 1)
  assert.equal(result.misParticipaciones.length, 0)
  assert.equal(result.misArchivados.length, 0)
  // El premio del décimo al que renunció NO debe sumarse
  assert.equal(result.totalPremiosGanados, 0)
})

test('classifyUserTickets - correctly includes active accepted participations with prizes', () => {
  const currentUserId = 'user-alice'

  // 1. Décimo propio de Alice sin premio
  const ticketOwn = mockTicket({
    id: 'ticket-own',
    owner_id: currentUserId,
    number: '49307',
    prize_amount_cents: 0,
  })

  // 2. Décimo compartido de Bob donde Alice tiene 20% ACEPTADA con premio de 1.000 €
  const ticketBob = mockTicket({
    id: 'ticket-bob',
    owner_id: 'user-bob',
    number: '76719',
    prize_amount_cents: 100000, // 1.000 €
  })
  const shareAliceActive = mockShare({
    id: 'share-bob-alice',
    ticket_id: 'ticket-bob',
    user_id: currentUserId,
    role: 'PARTICIPANTE',
    percentage: 20,
    status: 'ACEPTADA',
  })

  const tickets = [ticketOwn, ticketBob]
  const shares = [shareAliceActive]
  const archivedIds = new Set<string>()

  const result = classifyUserTickets(tickets, shares, archivedIds, currentUserId)

  assert.equal(result.totalActivosCount, 2)
  assert.equal(result.misDecimos.length, 1)
  assert.equal(result.misParticipaciones.length, 1)
  // Premio proporcional: 1.000 € * 20% = 200 €
  assert.equal(result.totalPremiosGanados, 200)
})

test('classifyUserTickets - renounced participation is also excluded from archivados even if hidden', () => {
  const currentUserId = 'user-alice'

  const ticketBob = mockTicket({
    id: 'ticket-bob',
    owner_id: 'user-bob',
    number: '76719',
  })
  const shareAliceRenounced = mockShare({
    id: 'share-bob-alice',
    ticket_id: 'ticket-bob',
    user_id: currentUserId,
    role: 'PARTICIPANTE',
    percentage: 0,
    status: 'RENUNCIADA',
  })

  // Alice tenía el ticket en ticket_archive_hides
  const archivedIds = new Set<string>(['ticket-bob'])

  const result = classifyUserTickets([ticketBob], [shareAliceRenounced], archivedIds, currentUserId)

  assert.equal(result.totalActivosCount, 0)
  assert.equal(result.misDecimos.length, 0)
  assert.equal(result.misParticipaciones.length, 0)
  // No debe aparecer tampoco en archivados porque ya no le pertenece
  assert.equal(result.misArchivados.length, 0)
})
