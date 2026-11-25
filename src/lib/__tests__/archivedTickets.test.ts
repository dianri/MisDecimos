import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ARCHIVE_SUCCESS_TOAST,
  RESTORE_SUCCESS_TOAST,
  buildArchivedTicketsList,
  buildMainActiveTicketsList,
  canDeleteArchivedTicket,
} from '../archivedTickets.ts'
import type { TicketRow, OwnershipShareRow } from '../ticketMetrics.ts'

const baseTicket: Omit<TicketRow, 'id' | 'owner_id' | 'number' | 'draw_date' | 'status'> = {
  barcode_raw: null,
  check_source: null,
  created_at: '2026-11-01T00:00:00Z',
  draw_name: 'Lotería de Navidad',
  draw_type: 'NAVIDAD',
  fraccion: null,
  last_checked_at: null,
  origin: 'MANUAL',
  prize_amount_cents: 0,
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

test('Toast de archivado menciona explícitamente Mi Perfil y el de restauración la pantalla principal', () => {
  assert.ok(ARCHIVE_SUCCESS_TOAST.includes('Mi Perfil'))
  assert.equal(
    ARCHIVE_SUCCESS_TOAST,
    'Décimo archivado en tu cuenta. Puedes consultarlo en Mi Perfil.'
  )
  assert.equal(RESTORE_SUCCESS_TOAST, 'Décimo restaurado a tu pantalla principal.')
})

test('buildMainActiveTicketsList excluye estrictamente los décimos archivados y buildArchivedTicketsList los lista', () => {
  const userId = 'user-1'
  const tickets: TicketRow[] = [
    { ...baseTicket, id: 't-active', owner_id: userId, number: '11111', draw_date: '2026-12-22', status: 'PENDIENTE' },
    { ...baseTicket, id: 't-archived-own', owner_id: userId, number: '22222', draw_date: '2025-12-22', status: 'ARCHIVADO' },
    { ...baseTicket, id: 't-archived-part', owner_id: 'other', number: '33333', draw_date: '2024-12-22', status: 'VALIDADO' },
  ]
  const shares: OwnershipShareRow[] = [
    { ...baseShare, id: 's1', ticket_id: 't-active', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's2', ticket_id: 't-archived-own', user_id: userId, role: 'PROPIETARIO', percentage: 100, status: 'ACEPTADA' },
    { ...baseShare, id: 's3', ticket_id: 't-archived-part', user_id: userId, role: 'PARTICIPANTE', percentage: 30, status: 'ACEPTADA' },
  ]

  const archivedIds = new Set(['t-archived-own', 't-archived-part'])

  const mainActive = buildMainActiveTicketsList(tickets, shares, archivedIds, userId)
  assert.equal(mainActive.length, 1)
  assert.equal(mainActive[0].ticket.id, 't-active')

  const archived = buildArchivedTicketsList(tickets, shares, archivedIds, userId)
  assert.equal(archived.length, 2)
  assert.equal(archived[0].ticket.id, 't-archived-own')
  assert.equal(archived[0].isOwner, true)
  assert.equal(archived[1].ticket.id, 't-archived-part')
  assert.equal(archived[1].isOwner, false)

  // Al restaurar 't-archived-own' (toggle_archive_ticket quita hide y restaura status), vuelve a activos
  const restoredTickets = tickets.map((t) =>
    t.id === 't-archived-own' ? { ...t, status: 'PENDIENTE' } : t
  )
  const afterRestoreIds = new Set(['t-archived-part'])
  assert.equal(buildMainActiveTicketsList(restoredTickets, shares, afterRestoreIds, userId).length, 2)
  assert.equal(buildArchivedTicketsList(restoredTickets, shares, afterRestoreIds, userId).length, 1)
})

test('canDeleteArchivedTicket solo permite eliminar cuando owner_id === user.id', () => {
  assert.equal(canDeleteArchivedTicket('user-1', 'user-1'), true)
  assert.equal(canDeleteArchivedTicket('other', 'user-1'), false)
})
