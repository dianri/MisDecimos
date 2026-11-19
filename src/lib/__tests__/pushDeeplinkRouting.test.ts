import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRouteFromPath } from '../../hooks/useAndroidBackNavigation.ts'

test('parseRouteFromPath - parses standard /billetes/:id routes', () => {
  const result = parseRouteFromPath('/billetes/uuid-ticket-123')
  assert.equal(result.tab, 'billetes')
  assert.equal(result.ticketId, 'uuid-ticket-123')
})

test('parseRouteFromPath - parses aliases (/billete/, /decimos/, /decimo/, /tickets/, /ticket/)', () => {
  const aliases = [
    { path: '/billete/ticket-singular-1', expectedId: 'ticket-singular-1' },
    { path: '/decimos/decimos-plural-2', expectedId: 'decimos-plural-2' },
    { path: '/decimo/decimo-singular-3', expectedId: 'decimo-singular-3' },
    { path: '/tickets/tickets-plural-4', expectedId: 'tickets-plural-4' },
    { path: '/ticket/ticket-singular-5', expectedId: 'ticket-singular-5' },
  ]

  for (const { path, expectedId } of aliases) {
    const result = parseRouteFromPath(path)
    assert.equal(result.tab, 'billetes')
    assert.equal(result.ticketId, expectedId)
  }
})

test('parseRouteFromPath - handles trailing slashes, query parameters and hashes', () => {
  const result = parseRouteFromPath('/billetes/ticket-clean-99/?foo=bar&test=1#detail')
  assert.equal(result.tab, 'billetes')
  assert.equal(result.ticketId, 'ticket-clean-99')
})

test('parseRouteFromPath - handles absolute URLs with host and domain', () => {
  const result = parseRouteFromPath('https://misdecimos.dianrie.com/billetes/abc-777?utm_source=push')
  assert.equal(result.tab, 'billetes')
  assert.equal(result.ticketId, 'abc-777')
})

test('parseRouteFromPath - parses standard non-ticket routes (/alertas, /auditoria, /perfil, /)', () => {
  assert.deepEqual(parseRouteFromPath('/alertas'), { tab: 'alertas', ticketId: null })
  assert.deepEqual(parseRouteFromPath('/auditoria'), { tab: 'auditoria', ticketId: null })
  assert.deepEqual(parseRouteFromPath('/perfil'), { tab: 'perfil', ticketId: null })
  assert.deepEqual(parseRouteFromPath('/'), { tab: 'billetes', ticketId: null })
  assert.deepEqual(parseRouteFromPath(''), { tab: 'billetes', ticketId: null })
})
