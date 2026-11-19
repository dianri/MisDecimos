import { test } from 'node:test'
import assert from 'node:assert'
import { resolveCotitularCardActions } from '../prizePayoutHelper.ts'

test('resolveCotitularCardActions - propietario en billete pendiente sin premio ve solicitar renuncia', () => {
  const result = resolveCotitularCardActions({
    isOwner: true,
    isMe: false,
    ticketStatus: 'PENDIENTE',
    prizeAmountCents: 0,
    percentage: 30,
    status: 'ACEPTADA',
    waiverRequested: false,
    prizePaidConfirmed: false,
    prizePayoutRequestedAt: null,
  })

  assert.strictEqual(result.showMenu, true)
  assert.strictEqual(result.canRequestWaiver, true)
  assert.strictEqual(result.canRequestPayout, false)
  assert.strictEqual(result.showWaitingBanner, false)
})

test('resolveCotitularCardActions - propietario en billete premiado validado ve solicitar confirmación de cobro', () => {
  const result = resolveCotitularCardActions({
    isOwner: true,
    isMe: false,
    ticketStatus: 'VALIDADO',
    prizeAmountCents: 100000, // 1.000 €
    percentage: 40,
    status: 'ACEPTADA',
    waiverRequested: false,
    prizePaidConfirmed: false,
    prizePayoutRequestedAt: null,
  })

  assert.strictEqual(result.showMenu, true)
  assert.strictEqual(result.canRequestWaiver, false)
  assert.strictEqual(result.canRequestPayout, true)
  assert.strictEqual(result.payoutButtonLabel, 'Solicitar confirmación de cobro')
  assert.strictEqual(result.showWaitingBanner, false)
  assert.strictEqual(result.proportionalPrizeFormatted, '400,00 €')
})

test('resolveCotitularCardActions - propietario con solicitud ya enviada ve reenviar y banner de espera', () => {
  const result = resolveCotitularCardActions({
    isOwner: true,
    isMe: false,
    ticketStatus: 'VALIDADO',
    prizeAmountCents: 100000,
    percentage: 25,
    status: 'ACEPTADA',
    waiverRequested: false,
    prizePaidConfirmed: false,
    prizePayoutRequestedAt: '2026-11-19T05:00:00Z',
  })

  assert.strictEqual(result.showMenu, true)
  assert.strictEqual(result.canRequestPayout, true)
  assert.strictEqual(result.payoutButtonLabel, 'Reenviar solicitud de cobro')
  assert.strictEqual(result.showWaitingBanner, true)
  assert.strictEqual(result.proportionalPrizeFormatted, '250,00 €')
})

test('resolveCotitularCardActions - cotitular confirmado oculta menú de cobro y banner', () => {
  const result = resolveCotitularCardActions({
    isOwner: true,
    isMe: false,
    ticketStatus: 'VALIDADO',
    prizeAmountCents: 100000,
    percentage: 20,
    status: 'ACEPTADA',
    waiverRequested: false,
    prizePaidConfirmed: true, // Ya confirmado
    prizePayoutRequestedAt: '2026-11-19T05:00:00Z',
  })

  assert.strictEqual(result.showMenu, false)
  assert.strictEqual(result.canRequestPayout, false)
  assert.strictEqual(result.showWaitingBanner, false)
})

test('resolveCotitularCardActions - vista del cotitular con premio pendiente muestra botón confirmar cobro recibido', () => {
  const result = resolveCotitularCardActions({
    isOwner: false,
    isMe: true,
    ticketStatus: 'VALIDADO',
    prizeAmountCents: 200000, // 2.000 €
    percentage: 15,
    status: 'ACEPTADA',
    waiverRequested: false,
    prizePaidConfirmed: false,
    prizePayoutRequestedAt: '2026-11-19T05:00:00Z',
  })

  assert.strictEqual(result.showMenu, false) // El cotitular no ve menú de propietario
  assert.strictEqual(result.canParticipantConfirmPayout, true)
  assert.strictEqual(result.showWaitingBanner, true)
  assert.strictEqual(result.proportionalPrizeFormatted, '300,00 €')
})

test('resolveCotitularCardActions - cotitular que ya cobró no ve botón confirmar', () => {
  const result = resolveCotitularCardActions({
    isOwner: false,
    isMe: true,
    ticketStatus: 'LIQUIDADO',
    prizeAmountCents: 200000,
    percentage: 15,
    status: 'ACEPTADA',
    waiverRequested: false,
    prizePaidConfirmed: true,
    prizePayoutRequestedAt: null,
  })

  assert.strictEqual(result.canParticipantConfirmPayout, false)
  assert.strictEqual(result.showWaitingBanner, false)
})
