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
  assert.strictEqual(result.isCheckedWithoutPrize, false)
  assert.strictEqual(result.statusBadgeLabel, 'PENDIENTE')
  assert.ok(result.containerClasses.includes('bg-white'))
  assert.ok(result.containerClasses.includes('dark:bg-[#1D1D1F]'))
  assert.ok(result.containerClasses.includes('rounded-[22px]'))
  assert.ok(!result.containerClasses.includes('bg-[#C5A880]'))
})

test('resolveTicketCardPresentation - billete validado sin premio muestra [✓ Comprobado] en Verde Granito', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'VALIDADO',
    userPercentage: 100,
  })

  assert.strictEqual(result.isPrized, false)
  assert.strictEqual(result.isCheckedWithoutPrize, true)
  assert.strictEqual(result.statusBadgeLabel, '✓ Comprobado')
  assert.ok(result.statusBadgeClasses.includes('bg-[#3A5245]'))
  assert.ok(result.containerClasses.includes('bg-white'))
})

test('resolveTicketCardPresentation - billete premiado cambia toda su superficie a Oro Cava (#C5A880)', () => {
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
  assert.ok(result.statusBadgeClasses.includes('bg-[#3A5245]'))
  assert.ok(result.containerClasses.includes('bg-[#C5A880]'))
  assert.ok(result.containerClasses.includes('text-[#1D1D1F]'))
  assert.ok(result.containerClasses.includes('rounded-[22px]'))
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
  assert.ok(result.statusBadgeClasses.includes('bg-[#3A5245]'))
  assert.ok(result.containerClasses.includes('bg-[#C5A880]'))
})

test('resolveTicketCardPresentation - billete archivado premiado preserva fondo Oro Cava', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 150000,
    status: 'VALIDADO',
    userPercentage: 25,
    isArchived: true,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.statusBadgeLabel, '¡PREMIADO!')
  assert.strictEqual(result.userPrizeFormatted, '375,00 €')
  assert.ok(result.containerClasses.includes('bg-[#C5A880]'))
})
