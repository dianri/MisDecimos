import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Lógica pura de preparación de estado tras reclamar una participación.
 */
export function buildPostClaimNavigation(params: {
  ticketId: string
  percentage?: number
}): {
  replaceHistoryUrl: string
  replaceHistoryState: {
    tab: string
    ticketId: null
    fromTab: string
    subTab: string
    directFallbackTab: string
  }
  detailRoute: string
  detailState: {
    fromTab: string
    claimMessage: string
  }
} {
  const pctText = params.percentage ? ` del ${params.percentage}%` : ''
  const toastMsg = `¡Participación${pctText} reclamada correctamente!`

  return {
    replaceHistoryUrl: '/?tab=participaciones',
    replaceHistoryState: {
      tab: 'billetes',
      ticketId: null,
      fromTab: 'participaciones',
      subTab: 'participaciones',
      directFallbackTab: 'participaciones',
    },
    detailRoute: `/billetes/${params.ticketId}`,
    detailState: {
      fromTab: 'participaciones',
      claimMessage: toastMsg,
    },
  }
}

/**
 * Lógica pura de resolución de retorno desde el detalle del décimo.
 */
export function resolveClaimedDetailBack(options: {
  historyIdx: number
  isDirectEntry: boolean
  fromTab?: string
  ticketOwnerId: string
  currentUserId: string
}): { action: 'back' | 'navigateRoot'; destinationTab?: 'participaciones' | 'decimos' } {
  // 1. Con historial previo en la app (idx > 0)
  if (options.historyIdx > 0 && !options.isDirectEntry) {
    return { action: 'back' }
  }

  // 2. Sin historial previo (fallback directo)
  const isParticipant = options.ticketOwnerId !== options.currentUserId
  const destinationTab =
    options.fromTab === 'participaciones' || options.fromTab === 'archivados'
      ? (options.fromTab as 'participaciones')
      : isParticipant
      ? 'participaciones'
      : 'decimos'

  return { action: 'navigateRoot', destinationTab }
}

test('buildPostClaimNavigation - prepara URL y estado reemplazando a ?tab=participaciones', () => {
  const nav = buildPostClaimNavigation({
    ticketId: 'ticket-uuid-12345',
    percentage: 25,
  })

  assert.equal(nav.replaceHistoryUrl, '/?tab=participaciones')
  assert.equal(nav.replaceHistoryState.fromTab, 'participaciones')
  assert.equal(nav.replaceHistoryState.subTab, 'participaciones')
  assert.equal(nav.replaceHistoryState.directFallbackTab, 'participaciones')
  assert.equal(nav.detailRoute, '/billetes/ticket-uuid-12345')
  assert.equal(nav.detailState.fromTab, 'participaciones')
  assert.equal(nav.detailState.claimMessage, '¡Participación del 25% reclamada correctamente!')
})

test('buildPostClaimNavigation - maneja reclamación sin porcentaje explícito', () => {
  const nav = buildPostClaimNavigation({
    ticketId: 'ticket-uuid-67890',
  })

  assert.equal(nav.replaceHistoryUrl, '/?tab=participaciones')
  assert.equal(nav.detailRoute, '/billetes/ticket-uuid-67890')
  assert.equal(nav.detailState.claimMessage, '¡Participación reclamada correctamente!')
})

test('resolveClaimedDetailBack - con historial interno previo (idx > 0) ejecuta back()', () => {
  const res = resolveClaimedDetailBack({
    historyIdx: 1,
    isDirectEntry: false,
    fromTab: 'participaciones',
    ticketOwnerId: 'owner-user',
    currentUserId: 'participant-user',
  })

  assert.equal(res.action, 'back')
})

test('resolveClaimedDetailBack - en entrada directa prioriza fromTab=participaciones', () => {
  const res = resolveClaimedDetailBack({
    historyIdx: 0,
    isDirectEntry: true,
    fromTab: 'participaciones',
    ticketOwnerId: 'owner-user',
    currentUserId: 'owner-user', // Incluso si fuera dueño
  })

  assert.equal(res.action, 'navigateRoot')
  assert.equal(res.destinationTab, 'participaciones')
})

test('resolveClaimedDetailBack - en entrada directa sin fromTab deriva según rol de cotitular', () => {
  const res = resolveClaimedDetailBack({
    historyIdx: 0,
    isDirectEntry: true,
    fromTab: undefined,
    ticketOwnerId: 'custodio-user',
    currentUserId: 'cotitular-user',
  })

  assert.equal(res.action, 'navigateRoot')
  assert.equal(res.destinationTab, 'participaciones')
})
