import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyUserTickets } from '../ticketMetrics.ts'
import type { Database } from '../../types/database.types.ts'

type TicketRow = Database['public']['Tables']['tickets']['Row']
type OwnershipShareRow = Database['public']['Tables']['ownership_shares']['Row']

/**
 * Lógica pura de validación de acceso al detalle de un décimo.
 */
export function evaluateTicketDetailAccess(params: {
  currentUserId: string
  ticketOwnerId: string
  userShare?: {
    status: string
    percentage: number
  } | null
}): {
  allowed: boolean
  isOwner: boolean
  isRenounced?: boolean
  redirectTab?: 'participaciones'
  noticeMsg?: string
} {
  const isOwner = params.ticketOwnerId === params.currentUserId

  if (isOwner) {
    return { allowed: true, isOwner: true }
  }

  const share = params.userShare
  const hasActiveShare = Boolean(
    share &&
    (share.status === 'ACEPTADA' || share.status === 'PENDIENTE') &&
    Number(share.percentage) > 0
  )

  if (hasActiveShare) {
    return { allowed: true, isOwner: false }
  }

  const isRenounced = share?.status === 'RENUNCIADA'
  return {
    allowed: false,
    isOwner: false,
    isRenounced,
    redirectTab: 'participaciones',
    noticeMsg: isRenounced
      ? 'Ya no tienes acceso a este décimo porque renunciaste a tu participación.'
      : 'Ya no tienes acceso a este décimo.',
  }
}

/**
 * Lógica pura de redirección tras confirmar la renuncia a una participación.
 */
export function buildRenounceRedirectAction(): {
  targetTab: 'participaciones'
  replace: boolean
  toastMsg: string
} {
  return {
    targetTab: 'participaciones',
    replace: true,
    toastMsg: 'Has renunciado a la participación. El décimo se ha retirado de tus participaciones.',
  }
}

test('evaluateTicketDetailAccess - propietario siempre tiene acceso permitido', () => {
  const result = evaluateTicketDetailAccess({
    currentUserId: 'user-owner-1',
    ticketOwnerId: 'user-owner-1',
    userShare: null,
  })

  assert.equal(result.allowed, true)
  assert.equal(result.isOwner, true)
})

test('evaluateTicketDetailAccess - cotitular con participación aceptada tiene acceso permitido', () => {
  const result = evaluateTicketDetailAccess({
    currentUserId: 'participant-1',
    ticketOwnerId: 'user-owner-1',
    userShare: { status: 'ACEPTADA', percentage: 20 },
  })

  assert.equal(result.allowed, true)
  assert.equal(result.isOwner, false)
})

test('evaluateTicketDetailAccess - usuario con participación RENUNCIADA es bloqueado y redirigido', () => {
  const result = evaluateTicketDetailAccess({
    currentUserId: 'participant-1',
    ticketOwnerId: 'user-owner-1',
    userShare: { status: 'RENUNCIADA', percentage: 0 },
  })

  assert.equal(result.allowed, false)
  assert.equal(result.isRenounced, true)
  assert.equal(result.redirectTab, 'participaciones')
  assert.equal(
    result.noticeMsg,
    'Ya no tienes acceso a este décimo porque renunciaste a tu participación.'
  )
})

test('evaluateTicketDetailAccess - usuario ajeno sin participación es bloqueado y redirigido', () => {
  const result = evaluateTicketDetailAccess({
    currentUserId: 'stranger-1',
    ticketOwnerId: 'user-owner-1',
    userShare: null,
  })

  assert.equal(result.allowed, false)
  assert.equal(result.isRenounced, false)
  assert.equal(result.redirectTab, 'participaciones')
  assert.equal(result.noticeMsg, 'Ya no tienes acceso a este décimo.')
})

test('buildRenounceRedirectAction - genera navegación con replace:true y toast informativo', () => {
  const action = buildRenounceRedirectAction()

  assert.equal(action.targetTab, 'participaciones')
  assert.equal(action.replace, true)
  assert.equal(
    action.toastMsg,
    'Has renunciado a la participación. El décimo se ha retirado de tus participaciones.'
  )
})

test('classifyUserTickets - participación renunciada no figura en participaciones activas ni suma premios', () => {
  const currentUserId = 'user-cotitular'
  const ownerId = 'user-owner'

  const ticket: TicketRow = {
    id: 'ticket-1',
    owner_id: ownerId,
    number: '77777',
    serie: '1',
    fraccion: '1',
    draw_name: 'Navidad',
    draw_date: '2026-12-22',
    draw_type: 'NAVIDAD',
    status: 'VALIDADO',
    origin: 'MANUAL',
    barcode_raw: null,
    check_source: null,
    last_checked_at: null,
    prize_amount_cents: 100000,
    ticket_price: 2000,
    template_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const renouncedShare: OwnershipShareRow = {
    id: 'share-1',
    ticket_id: 'ticket-1',
    user_id: currentUserId,
    percentage: 0,
    role: 'PARTICIPANTE',
    status: 'RENUNCIADA',
    waiver_requested: false,
    waiver_requested_at: null,
    prize_paid_confirmed: false,
    prize_paid_confirmed_at: null,
    prize_payout_requested_at: null,
    prize_payout_requested_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const result = classifyUserTickets([ticket], [renouncedShare], new Set(), currentUserId)

  assert.equal(result.misParticipaciones.length, 0, 'No debe listar la participación renunciada')
  assert.equal(result.misDecimos.length, 0)
  assert.equal(result.totalActivosCount, 0)
  assert.equal(result.totalPremiosGanados, 0)
})
