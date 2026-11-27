import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPrizesSummary,
  filterScrutinizedItems,
  isTicketScrutinized,
} from '../prizesSummary.ts'
import type { TicketRow, OwnershipShareRow } from '../ticketMetrics.ts'

const baseTicket: Omit<TicketRow, 'id' | 'owner_id' | 'number' | 'draw_date' | 'status' | 'prize_amount_cents' | 'last_checked_at' | 'check_source'> = {
  barcode_raw: null,
  created_at: '2026-11-01T00:00:00Z',
  draw_name: 'Lotería de Navidad',
  draw_type: 'NAVIDAD',
  fraccion: null,
  origin: 'MANUAL',
  serie: null,
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

test('buildPrizesSummary - calcula Décimos Activos, Total Premios fraccionado y excluye renunciados/pendientes/archivados', () => {
  const userId = 'user-1'

  const tickets: TicketRow[] = [
    // Propio premiado (1.000 € total, user tiene 40% -> 400 €)
    { ...baseTicket, id: 't-own-prized', owner_id: userId, number: '79432', draw_date: '2025-12-22', status: 'VALIDADO', prize_amount_cents: 100_000, last_checked_at: '2026-11-24T10:00:00Z', check_source: 'historico_oficial' },
    // Participación aceptada premiada (200 € total, user tiene 25% -> 50 €)
    { ...baseTicket, id: 't-part-prized', owner_id: 'other', number: '70048', draw_date: '2025-12-22', status: 'VALIDADO', prize_amount_cents: 20_000, last_checked_at: '2026-11-24T10:00:00Z', check_source: 'historico_oficial' },
    // Propio comprobado sin premio (0 €)
    { ...baseTicket, id: 't-own-zero', owner_id: userId, number: '12345', draw_date: '2024-12-22', status: 'VALIDADO', prize_amount_cents: 0, last_checked_at: '2026-11-24T10:00:00Z', check_source: 'historico_oficial' },
    // Propio pendiente sin comprobar (cuenta en Décimos Activos, NO en historial de escrutinio)
    { ...baseTicket, id: 't-own-pending', owner_id: userId, number: '55555', draw_date: '2026-12-22', status: 'PENDIENTE', prize_amount_cents: 0, last_checked_at: null, check_source: null },
    // Participación RENUNCIADA premiada (excluida)
    { ...baseTicket, id: 't-renounced', owner_id: 'other', number: '11111', draw_date: '2025-12-22', status: 'VALIDADO', prize_amount_cents: 50_000, last_checked_at: '2026-11-24T10:00:00Z', check_source: null },
    // Participación PENDIENTE premiada (excluida)
    { ...baseTicket, id: 't-invite-pending', owner_id: 'other', number: '22222', draw_date: '2025-12-22', status: 'VALIDADO', prize_amount_cents: 50_000, last_checked_at: '2026-11-24T10:00:00Z', check_source: null },
    // Archivado premiado (excluido de activos y total premios)
    { ...baseTicket, id: 't-archived', owner_id: userId, number: '33333', draw_date: '2025-12-22', status: 'ARCHIVADO', prize_amount_cents: 50_000, last_checked_at: '2026-11-24T10:00:00Z', check_source: null },
  ]

  const shares: OwnershipShareRow[] = [
    { ...baseShare, id: 's1', ticket_id: 't-own-prized', user_id: userId, role: 'PROPIETARIO', percentage: 40, status: 'ACEPTADA' },
    { ...baseShare, id: 's2', ticket_id: 't-part-prized', user_id: userId, role: 'PARTICIPANTE', percentage: 25, status: 'ACEPTADA' },
    { ...baseShare, id: 's3', ticket_id: 't-own-zero', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's4', ticket_id: 't-own-pending', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's5', ticket_id: 't-renounced', user_id: userId, role: 'PARTICIPANTE', percentage: 0, status: 'RENUNCIADA' },
    { ...baseShare, id: 's6', ticket_id: 't-invite-pending', user_id: userId, role: 'PARTICIPANTE', percentage: 20, status: 'PENDIENTE' },
    { ...baseShare, id: 's7', ticket_id: 't-archived', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
  ]

  const summary = buildPrizesSummary(tickets, shares, new Set(['t-archived']), userId)

  // 4 décimos activos: t-own-prized, t-part-prized, t-own-zero, t-own-pending
  assert.equal(summary.activeTicketsCount, 4)
  // 400 € + 50 € = 450 € (45.000 céntimos)
  assert.equal(summary.totalPrizeCents, 45_000)
  assert.equal(summary.totalPrizeEuros, 450)

  // Historial de escrutinio: 3 elementos (2 premiados + 1 sin premio)
  assert.equal(summary.scrutinizedItems.length, 3)
  assert.equal(summary.prizedCount, 2)
  assert.equal(summary.noPrizeCount, 1)

  // Orden: premiados de mayor a menor (400 € > 50 €), luego sin premio
  assert.equal(summary.scrutinizedItems[0].ticket.id, 't-own-prized')
  assert.equal(summary.scrutinizedItems[0].prizeCategory, '1.º Premio (El Gordo)')
  assert.equal(summary.scrutinizedItems[1].ticket.id, 't-part-prized')
  assert.equal(summary.scrutinizedItems[2].ticket.id, 't-own-zero')
  assert.equal(summary.scrutinizedItems[2].isPrized, false)
})

test('filterScrutinizedItems - filtra correctamente entre todos, premiados y sin premio', () => {
  const userId = 'user-1'
  const tickets: TicketRow[] = [
    { ...baseTicket, id: 't-prized', owner_id: userId, number: '79432', draw_date: '2025-12-22', status: 'VALIDADO', prize_amount_cents: 2_000, last_checked_at: '2026-11-24T10:00:00Z', check_source: null },
    { ...baseTicket, id: 't-zero-new', owner_id: userId, number: '12345', draw_date: '2025-12-22', status: 'VALIDADO', prize_amount_cents: 0, last_checked_at: '2026-11-24T10:00:00Z', check_source: null },
    { ...baseTicket, id: 't-zero-old', owner_id: userId, number: '54321', draw_date: '2023-12-22', status: 'VALIDADO', prize_amount_cents: 0, last_checked_at: '2026-11-24T10:00:00Z', check_source: null },
  ]
  const shares: OwnershipShareRow[] = [
    { ...baseShare, id: 's1', ticket_id: 't-prized', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's2', ticket_id: 't-zero-new', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's3', ticket_id: 't-zero-old', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
  ]

  const summary = buildPrizesSummary(tickets, shares, new Set(), userId)
  assert.equal(filterScrutinizedItems(summary.scrutinizedItems, 'todos').length, 3)
  assert.equal(filterScrutinizedItems(summary.scrutinizedItems, 'premiados').length, 1)

  const noPrize = filterScrutinizedItems(summary.scrutinizedItems, 'sin_premio')
  assert.equal(noPrize.length, 2)
  // Más reciente primero (2025-12-22 antes de 2023-12-22)
  assert.equal(noPrize[0].ticket.id, 't-zero-new')
  assert.equal(noPrize[1].ticket.id, 't-zero-old')
})

test('isTicketScrutinized - detecta correctamente estados comprobados y pendientes', () => {
  assert.equal(isTicketScrutinized({ prize_amount_cents: 0, last_checked_at: null, status: 'PENDIENTE' }), false)
  assert.equal(isTicketScrutinized({ prize_amount_cents: 0, last_checked_at: '2026-11-25T00:00:00Z', status: 'VALIDADO' }), true)
  assert.equal(isTicketScrutinized({ prize_amount_cents: 2000, last_checked_at: null, status: 'PENDIENTE' }), true)
  assert.equal(isTicketScrutinized({ prize_amount_cents: 0, last_checked_at: null, status: 'LIQUIDADO' }), true)
})

test('buildPrizesSummary - calcula las 6 métricas clave (totales, comprobados, compartidos, jugado, ganado, cobrado)', () => {
  const userId = 'user-1'
  const tickets: TicketRow[] = [
    // Propio 100% comprobado sin premio (20 € jugado)
    { ...baseTicket, id: 't1', owner_id: userId, number: '11111', draw_date: '2026-12-22', status: 'VALIDADO', prize_amount_cents: 0, last_checked_at: '2026-12-22T12:00:00Z', check_source: 'elpais' },
    // Propio compartido (50% -> 10 € jugado), premiado 100 € total -> 50 € usuario, LIQUIDADO (cobrado)
    { ...baseTicket, id: 't2', owner_id: userId, number: '22222', draw_date: '2026-12-22', status: 'LIQUIDADO', prize_amount_cents: 10_000, last_checked_at: '2026-12-22T12:00:00Z', check_source: 'elpais' },
    // Participación recibida (25% -> 5 € jugado), pendiente de comprobar
    { ...baseTicket, id: 't3', owner_id: 'other', number: '33333', draw_date: '2026-12-22', status: 'PENDIENTE', prize_amount_cents: 0, last_checked_at: null, check_source: null },
  ]
  const shares: OwnershipShareRow[] = [
    { ...baseShare, id: 's1', ticket_id: 't1', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's2', ticket_id: 't2', user_id: userId, role: 'PROPIETARIO', percentage: 50, status: 'ACEPTADA' },
    { ...baseShare, id: 's3', ticket_id: 't3', user_id: userId, role: 'PARTICIPANTE', percentage: 25, status: 'ACEPTADA' },
  ]

  const summary = buildPrizesSummary(tickets, shares, new Set(), userId)
  assert.equal(summary.activeTicketsCount, 3)
  assert.equal(summary.checkedCount, 2)
  assert.equal(summary.sharedCount, 2) // t2 (<100%) y t3 (participación recibida)
  assert.equal(summary.totalPlayedCents, 3_500) // 20 + 10 + 5 = 35 €
  assert.equal(summary.totalPrizeCents, 5_000) // 50 €
  assert.equal(summary.totalCollectedCents, 5_000) // t2 LIQUIDADO -> 50 € cobrados
})

test('Navegación usa Banknote para Premios y PrizesPage muestra solo tabla Resumen de 6 métricas', () => {
  const shellSource = readFileSync(resolve(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf8')
  const prizesSource = readFileSync(resolve(process.cwd(), 'src/pages/PrizesPage.tsx'), 'utf8')

  assert.ok(shellSource.includes("{ id: 'premios', label: 'Premios', icon: Banknote }"))
  assert.ok(!shellSource.includes('Trophy'))

  assert.ok(!prizesSource.includes('Trophy'))
  assert.ok(!prizesSource.includes('Balance de tus décimos activos y resultados oficiales comprobados'))
  assert.ok(!prizesSource.includes('Historial de Escrutinio'))
  for (const label of ['Décimos totales', 'Comprobados', 'Compartidos', 'Jugado', 'Ganado', 'Cobrado']) {
    assert.ok(prizesSource.includes(label), `PrizesPage debe incluir la métrica ${label}`)
  }

  // Diseño Apple Wallet / Bento Grid (Hero Card + 3 widgets)
  assert.ok(prizesSource.includes('from-[#FCF9F3] via-[#F7EFE0] to-[#EFE0C4]'))
  assert.ok(prizesSource.includes('grid-cols-3'))
  assert.ok(prizesSource.includes('Progreso de cobro'))
  assert.ok(prizesSource.includes('Progreso de escrutinio'))

  // El marcado de cobro del propietario impacta directamente en Cobrado
  const afterCollected = buildPrizesSummary(
    [{ ...baseTicket, id: 't1', owner_id: 'u1', number: '12345', draw_date: '2026-12-22', status: 'VALIDADO', prize_amount_cents: 10_000, last_checked_at: '2026-12-22T12:00:00Z', check_source: 'elpais' }],
    [{ ...baseShare, id: 's1', ticket_id: 't1', user_id: 'u1', role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA', prize_paid_confirmed: true }],
    new Set(),
    'u1'
  )
  assert.equal(afterCollected.totalCollectedCents, 10_000)

  const afterReverted = buildPrizesSummary(
    [{ ...baseTicket, id: 't1', owner_id: 'u1', number: '12345', draw_date: '2026-12-22', status: 'VALIDADO', prize_amount_cents: 10_000, last_checked_at: '2026-12-22T12:00:00Z', check_source: 'elpais' }],
    [{ ...baseShare, id: 's1', ticket_id: 't1', user_id: 'u1', role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA', prize_paid_confirmed: false }],
    new Set(),
    'u1'
  )
  assert.equal(afterReverted.totalCollectedCents, 0)
})
