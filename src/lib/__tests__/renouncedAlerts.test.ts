import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractTicketIdFromNotification,
  isNotificationTicketRenounced,
  canNavigateToTicketFromAlert,
} from '../renouncedAlerts.ts'

test('extractTicketIdFromNotification - extrae directamente de notif.ticket_id', () => {
  const notif = {
    ticket_id: 't-123',
    metadata: null,
    action_url: null,
  }
  assert.equal(extractTicketIdFromNotification(notif), 't-123')
})

test('extractTicketIdFromNotification - extrae de metadata.ticket_id si ticket_id es nulo', () => {
  const notif = {
    ticket_id: null,
    metadata: { ticket_id: 't-456' },
    action_url: null,
  }
  assert.equal(extractTicketIdFromNotification(notif), 't-456')
})

test('extractTicketIdFromNotification - extrae de action_url con patrones /billete/, /billetes/, /decimo/ o /tickets/', () => {
  assert.equal(
    extractTicketIdFromNotification({ action_url: 'https://misdecimos.dianrie.com/billete/uuid-111' }),
    'uuid-111'
  )
  assert.equal(
    extractTicketIdFromNotification({ action_url: '/billetes/uuid-222' }),
    'uuid-222'
  )
  assert.equal(
    extractTicketIdFromNotification({ action_url: '/decimos/uuid-333' }),
    'uuid-333'
  )
  assert.equal(
    extractTicketIdFromNotification({ action_url: '/tickets/uuid-444' }),
    'uuid-444'
  )
})

test('extractTicketIdFromNotification - devuelve null ante notificaciones sin ticket_id asociado', () => {
  assert.equal(extractTicketIdFromNotification({}), null)
  assert.equal(extractTicketIdFromNotification({ action_url: '/perfil' }), null)
  assert.equal(extractTicketIdFromNotification({ metadata: { foo: 'bar' } }), null)
})

test('isNotificationTicketRenounced - detecta correctamente si el décimo figura en renouncedTicketIds', () => {
  const renounced = new Set(['ticket-renounced-1', 'ticket-renounced-2'])

  const renouncedNotif = { ticket_id: 'ticket-renounced-1' }
  const activeNotif = { ticket_id: 'ticket-active-3' }
  const genericNotif = { ticket_id: null }

  assert.equal(isNotificationTicketRenounced(renouncedNotif, renounced), true)
  assert.equal(isNotificationTicketRenounced(activeNotif, renounced), false)
  assert.equal(isNotificationTicketRenounced(genericNotif, renounced), false)
})

test('canNavigateToTicketFromAlert - bloquea navegación para décimos renunciados y la permite para activos', () => {
  const renounced = new Set(['t-renounced'])

  // 1. Décimo renunciado
  const resRenounced = canNavigateToTicketFromAlert({ ticket_id: 't-renounced' }, renounced)
  assert.deepEqual(resRenounced, {
    canNavigate: false,
    ticketId: 't-renounced',
    isRenounced: true,
  })

  // 2. Décimo activo
  const resActive = canNavigateToTicketFromAlert({ ticket_id: 't-active' }, renounced)
  assert.deepEqual(resActive, {
    canNavigate: true,
    ticketId: 't-active',
    isRenounced: false,
  })

  // 3. Alerta genérica sin décimo
  const resGeneric = canNavigateToTicketFromAlert({}, renounced)
  assert.deepEqual(resGeneric, {
    canNavigate: false,
    ticketId: null,
    isRenounced: false,
  })
})
