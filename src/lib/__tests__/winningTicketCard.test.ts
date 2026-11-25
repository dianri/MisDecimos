import { test } from 'node:test'
import assert from 'node:assert'
import { resolveTicketCardPresentation } from '../ticketCardHelper.ts'

test('resolveTicketCardPresentation - billete pendiente sin premio', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'PENDIENTE',
    userPercentage: 100,
  })

  assert.strictEqual(result.isPrized, false)
  assert.strictEqual(result.statusBadgeLabel, 'PENDIENTE')
  assert.ok(result.statusBadgeClasses.includes('bg-amber-50'))
  assert.ok(result.containerClasses.includes('bg-white'))
  assert.ok(!result.containerClasses.includes('from-amber-50'))
})

test('resolveTicketCardPresentation - billete validado sin premio (0,00 €)', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'VALIDADO',
    userPercentage: 100,
  })

  assert.strictEqual(result.isPrized, false)
  assert.strictEqual(result.statusBadgeLabel, 'VALIDADO')
  assert.ok(result.statusBadgeClasses.includes('bg-blue-50'))
  assert.ok(result.containerClasses.includes('bg-white'))
})

test('resolveTicketCardPresentation - billete premiado con cuota activa (¡PREMIADO!)', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 100000, // 1.000,00 €
    status: 'VALIDADO',
    userPercentage: 50,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.isUserActive, true)
  assert.strictEqual(result.totalPrizeFormatted, '1.000,00 €')
  assert.strictEqual(result.userPrizeFormatted, '500,00 €')
  assert.strictEqual(result.statusBadgeLabel, '¡PREMIADO!')
  assert.ok(result.statusBadgeClasses.includes('from-amber-500'))
  assert.ok(result.containerClasses.includes('bg-gradient-to-br from-amber-50/90'))
  assert.ok(result.containerClasses.includes('border-y-2 border-y-amber-400/85'))
  assert.ok(result.containerClasses.includes('border-l-4 border-l-emerald-600'))
  assert.ok(result.containerClasses.includes('border-r-4 border-r-rose-500'))
  assert.ok(result.containerClasses.includes('ring-2 ring-amber-300/25'))
})

test('resolveTicketCardPresentation - billete premiado 100% propietario', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 40000, // 400,00 €
    status: 'VALIDADO',
    userPercentage: 100,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.isUserActive, true)
  assert.strictEqual(result.totalPrizeFormatted, '400,00 €')
  assert.strictEqual(result.userPrizeFormatted, '400,00 €')
  assert.strictEqual(result.statusBadgeLabel, '¡PREMIADO!')
})

test('resolveTicketCardPresentation - billete premiado con participación renunciada', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 0,
    isRenounced: true,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.isUserActive, false)
  assert.strictEqual(result.totalPrizeFormatted, '1.000,00 €')
  assert.strictEqual(result.userPrizeFormatted, '0,00 €')
})

test('resolveTicketCardPresentation - billete premiado liquidado (LIQUIDADO)', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 50000,
    status: 'LIQUIDADO',
    userPercentage: 20,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.statusBadgeLabel, 'LIQUIDADO')
  assert.ok(result.statusBadgeClasses.includes('bg-emerald-600'))
  assert.ok(result.containerClasses.includes('border-y-2 border-y-amber-400/85'))
  assert.ok(result.containerClasses.includes('border-l-4 border-l-emerald-600'))
  assert.ok(result.containerClasses.includes('border-r-4 border-r-rose-500'))
})

test('resolveTicketCardPresentation - billete archivado premiado preserva estilo destacado', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 150000,
    status: 'VALIDADO',
    userPercentage: 25,
    isArchived: true,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.statusBadgeLabel, '¡PREMIADO!')
  assert.strictEqual(result.userPrizeFormatted, '375,00 €')
  assert.ok(result.containerClasses.includes('bg-gradient-to-br from-amber-50/90'))
})
