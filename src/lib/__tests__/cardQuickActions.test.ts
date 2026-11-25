import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveShareButtonNavigation,
  evaluateQuickPrizeCheckPrecondition,
  formatQuickPrizeCheckToast,
  hasThirdPartyParticipations,
  hasSelectShareToShareFlag,
  consumeSelectShareToast,
  SELECT_SHARE_TOAST_TITLE,
  SELECT_SHARE_TOAST_SUBTITLE,
} from '../cardQuickActions.ts'

test('resolveShareButtonNavigation - sin participaciones previas abre crear participación', () => {
  const target = resolveShareButtonNavigation({
    ticketId: 'ticket-123',
    hasParticipations: false,
    fromTab: 'decimos',
  })

  assert.equal(target.ticketId, 'ticket-123')
  assert.equal(target.state.fromTab, 'decimos')
  assert.equal(target.state.openCreateShare, true)
})

test('resolveShareButtonNavigation - con participaciones previas navega al detalle con selectShareToShare: true', () => {
  const target = resolveShareButtonNavigation({
    ticketId: 'ticket-456',
    hasParticipations: true,
    fromTab: 'participaciones',
  })

  assert.equal(target.ticketId, 'ticket-456')
  assert.equal(target.state.fromTab, 'participaciones')
  assert.equal(target.state.openCreateShare, undefined)
  assert.equal(target.state.selectShareToShare, true)
  assert.equal(hasSelectShareToShareFlag(target.state), true)
  assert.equal(hasSelectShareToShareFlag({}), false)
})

test('consumeSelectShareToast - dispara toast flotante al cargar décimo, evita doble disparo y limpia historial', () => {
  const initialState = { fromTab: 'decimos', selectShareToShare: true }

  // Antes de cargar el décimo no debe dispararse
  const beforeLoad = consumeSelectShareToast({
    historyState: initialState,
    isTicketLoaded: false,
    alreadyTriggered: false,
  })
  assert.equal(beforeLoad.shouldTrigger, false)
  assert.equal(beforeLoad.cleanedState, null)

  // Al cargar el décimo dispara el toast y devuelve el estado limpio sin selectShareToShare
  const onLoad = consumeSelectShareToast({
    historyState: initialState,
    isTicketLoaded: true,
    alreadyTriggered: false,
  })
  assert.equal(onLoad.shouldTrigger, true)
  assert.deepEqual(onLoad.cleanedState, { fromTab: 'decimos' })
  assert.equal(SELECT_SHARE_TOAST_TITLE, 'Selecciona una participación para compartir')
  assert.equal(
    SELECT_SHARE_TOAST_SUBTITLE,
    'Pulsa sobre cualquiera de las participaciones de la lista para ver su enlace o código.'
  )

  // En segundo montaje (StrictMode) con alreadyTriggered=true no vuelve a dispararse
  const secondRun = consumeSelectShareToast({
    historyState: initialState,
    isTicketLoaded: true,
    alreadyTriggered: true,
  })
  assert.equal(secondRun.shouldTrigger, false)
})

test('evaluateQuickPrizeCheckPrecondition - sorteo futuro bloquea comprobación con aviso claro', () => {
  const now = new Date('2026-11-25T10:00:00+01:00')
  const res = evaluateQuickPrizeCheckPrecondition('2026-12-22', now)

  assert.equal(res.canCheck, false)
  assert.equal(res.shortDate, '22/12/2026')
  assert.equal(res.message, 'El sorteo del 22/12/2026 aún no se ha celebrado.')
})

test('evaluateQuickPrizeCheckPrecondition - sorteo pasado o de hoy permite comprobación', () => {
  const now = new Date('2026-11-25T10:00:00+01:00')

  const past = evaluateQuickPrizeCheckPrecondition('2025-12-22', now)
  assert.equal(past.canCheck, true)
  assert.equal(past.shortDate, '22/12/2025')

  const today = evaluateQuickPrizeCheckPrecondition('2026-11-25', now)
  assert.equal(today.canCheck, true)
})

test('formatQuickPrizeCheckToast - formatea premio con categoría, 0 € sin premio y error no disponible', () => {
  const prized = formatQuickPrizeCheckToast(
    {
      ok: true,
      success: true,
      prizeAmountCents: 40_000_000,
      formattedPrize: '400.000,00 €',
      prizeCategory: '1.º Premio (El Gordo)',
      listStatus: 'final',
      checkSource: 'historico_oficial',
      checkedAt: '2026-11-25T00:00:00Z',
    },
    '22/12/2025'
  )
  assert.equal(prized.type, 'success')
  assert.equal(prized.text, '¡Premiado! · 1.º Premio (El Gordo) (400.000,00 €)')

  const noPrize = formatQuickPrizeCheckToast(
    {
      ok: true,
      success: true,
      prizeAmountCents: 0,
      formattedPrize: '0,00 €',
      listStatus: 'final',
      checkSource: 'historico_oficial',
      checkedAt: '2026-11-25T00:00:00Z',
    },
    '22/12/2025'
  )
  assert.equal(noPrize.type, 'success')
  assert.equal(noPrize.text, 'Comprobado · Sin premio en el sorteo oficial del 22/12/2025')

  const unavailable = formatQuickPrizeCheckToast(
    {
      ok: false,
      success: false,
      prizeAmountCents: 0,
      formattedPrize: '0,00 €',
      listStatus: 'unavailable',
      checkSource: 'historico_oficial',
      checkedAt: '2026-11-25T00:00:00Z',
      code: 'HISTORICAL_UNAVAILABLE',
      message: 'No hay resultados históricos disponibles.',
    },
    '22/12/2018'
  )
  assert.equal(unavailable.type, 'warning')
  assert.equal(unavailable.text, 'No hay resultados históricos disponibles.')
})

test('hasThirdPartyParticipations - ignora cuota del propietario y participaciones renunciadas', () => {
  const sharesOnlyOwner = [
    { ticket_id: 't1', role: 'PROPIETARIO', status: 'ACEPTADA' },
    { ticket_id: 't1', role: 'PARTICIPANTE', status: 'RENUNCIADA' },
  ]
  assert.equal(
    hasThirdPartyParticipations({ ticketId: 't1', shares: sharesOnlyOwner }),
    false
  )

  const targetNoCoOwners = resolveShareButtonNavigation({
    ticketId: 't1',
    hasParticipations: hasThirdPartyParticipations({ ticketId: 't1', shares: sharesOnlyOwner }),
    fromTab: 'decimos',
  })
  assert.equal(targetNoCoOwners.state.openCreateShare, true)

  const sharesWithCoOwner = [
    ...sharesOnlyOwner,
    { ticket_id: 't1', role: 'PARTICIPANTE', status: 'ACEPTADA' },
  ]
  assert.equal(
    hasThirdPartyParticipations({ ticketId: 't1', shares: sharesWithCoOwner }),
    true
  )

  // Invitación pendiente cuenta como participación creada
  assert.equal(
    hasThirdPartyParticipations({
      ticketId: 't1',
      shares: sharesOnlyOwner,
      pendingInviteTicketIds: new Set(['t1']),
    }),
    true
  )
})
