import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Lógica pura de resolución de pestaña activa en TicketsPage
 */
function resolveTicketsActiveTab(
  searchParamTab: string | null,
  historyFromTab?: string | null
): 'decimos' | 'participaciones' | 'archivados' {
  if (searchParamTab === 'participaciones' || searchParamTab === 'archivados') {
    return searchParamTab
  }
  if (searchParamTab === 'decimos') {
    return 'decimos'
  }
  if (historyFromTab === 'participaciones' || historyFromTab === 'archivados') {
    return historyFromTab
  }
  return 'decimos'
}

/**
 * Lógica pura de navegación hacia atrás en TicketDetailPage
 */
function resolveDetailBackDestination(options: {
  historyIdx?: number | null
  isDirectEntry?: boolean
  ticketOwnerId?: string
  currentUserId?: string
}): { action: 'back' } | { action: 'navigateRoot'; targetTab: 'decimos' | 'participaciones' } {
  const { historyIdx, isDirectEntry, ticketOwnerId, currentUserId } = options

  // 1. Si existe historial interno de navegación (idx > 0 y no es entrada directa)
  if (typeof historyIdx === 'number' && historyIdx > 0 && !isDirectEntry) {
    return { action: 'back' }
  }

  // 2. Si se abrió directamente sin historial previo (notificación Push o enlace directo)
  const isParticipant = Boolean(
    ticketOwnerId && currentUserId && ticketOwnerId !== currentUserId
  )
  const targetTab = isParticipant ? 'participaciones' : 'decimos'

  return { action: 'navigateRoot', targetTab }
}

test('resolveTicketsActiveTab - prioriza el parámetro searchParams ?tab=...', () => {
  assert.equal(resolveTicketsActiveTab('participaciones', undefined), 'participaciones')
  assert.equal(resolveTicketsActiveTab('archivados', undefined), 'archivados')
  assert.equal(resolveTicketsActiveTab('decimos', undefined), 'decimos')
})

test('resolveTicketsActiveTab - usa historyFromTab como respaldo si no hay parámetro en URL', () => {
  assert.equal(resolveTicketsActiveTab(null, 'participaciones'), 'participaciones')
  assert.equal(resolveTicketsActiveTab(null, 'archivados'), 'archivados')
  assert.equal(resolveTicketsActiveTab('', 'participaciones'), 'participaciones')
})

test('resolveTicketsActiveTab - defecto a decimos ante parámetros inválidos o ausentes', () => {
  assert.equal(resolveTicketsActiveTab(null, null), 'decimos')
  assert.equal(resolveTicketsActiveTab(undefined as unknown as string, undefined), 'decimos')
  assert.equal(resolveTicketsActiveTab('invalido', 'otro_invalido'), 'decimos')
})

test('resolveDetailBackDestination - con historial interno previo (idx > 0) ejecuta back()', () => {
  const result = resolveDetailBackDestination({
    historyIdx: 1,
    isDirectEntry: false,
    ticketOwnerId: 'owner-123',
    currentUserId: 'user-456',
  })
  assert.deepEqual(result, { action: 'back' })

  const resultOwner = resolveDetailBackDestination({
    historyIdx: 2,
    isDirectEntry: false,
    ticketOwnerId: 'user-456',
    currentUserId: 'user-456',
  })
  assert.deepEqual(resultOwner, { action: 'back' })
})

test('resolveDetailBackDestination - en entrada directa deriva a participaciones si el usuario es cotitular', () => {
  const result = resolveDetailBackDestination({
    historyIdx: 0,
    isDirectEntry: true,
    ticketOwnerId: 'owner-123',
    currentUserId: 'participant-999',
  })
  assert.deepEqual(result, { action: 'navigateRoot', targetTab: 'participaciones' })
})

test('resolveDetailBackDestination - en entrada directa deriva a decimos si el usuario es el propietario', () => {
  const result = resolveDetailBackDestination({
    historyIdx: 0,
    isDirectEntry: true,
    ticketOwnerId: 'user-owner',
    currentUserId: 'user-owner',
  })
  assert.deepEqual(result, { action: 'navigateRoot', targetTab: 'decimos' })
})
