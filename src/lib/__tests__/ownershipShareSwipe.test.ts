import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveParticipantShareSwipeAction,
  getShareSwipeActionLabel,
} from '../ownershipShareSwipe.ts'

test('resolveParticipantShareSwipeAction - cotitular autenticado en décimo pendiente habilita Renunciar', () => {
  const action = resolveParticipantShareSwipeAction({
    isOwner: false,
    isMe: true,
    shareRole: 'PARTICIPANTE',
    shareStatus: 'ACEPTADA',
    waiverRequested: false,
    ticketStatus: 'PENDIENTE',
    prizeAmountCents: 0,
  })
  assert.equal(action, 'renounce')
  assert.equal(getShareSwipeActionLabel(action), 'Renunciar')
})

test('resolveParticipantShareSwipeAction - propietario viendo cotitular aceptado habilita Solicitar renuncia', () => {
  const action = resolveParticipantShareSwipeAction({
    isOwner: true,
    isMe: false,
    shareRole: 'PARTICIPANTE',
    shareStatus: 'ACEPTADA',
    waiverRequested: false,
    ticketStatus: 'PENDIENTE',
    prizeAmountCents: 0,
  })
  assert.equal(action, 'request_waiver')
  assert.equal(getShareSwipeActionLabel(action), 'Solicitar renuncia')
})

test('resolveParticipantShareSwipeAction - décimo liquidado o con renuncia ya solicitada deshabilita swipe', () => {
  assert.equal(
    resolveParticipantShareSwipeAction({
      isOwner: false,
      isMe: true,
      shareRole: 'PARTICIPANTE',
      shareStatus: 'ACEPTADA',
      waiverRequested: true,
      ticketStatus: 'PENDIENTE',
      prizeAmountCents: 0,
    }),
    null
  )

  assert.equal(
    resolveParticipantShareSwipeAction({
      isOwner: false,
      isMe: true,
      shareRole: 'PARTICIPANTE',
      shareStatus: 'ACEPTADA',
      waiverRequested: false,
      ticketStatus: 'LIQUIDADO',
      prizeAmountCents: 10000,
    }),
    null
  )
})
