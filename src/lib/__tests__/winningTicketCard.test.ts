import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  filterHomeTickets,
  formatDrawLabel,
  resolveTicketCardPresentation,
} from '../ticketCardHelper.ts'

test('resolveTicketCardPresentation - billete pendiente sin premio', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'PENDIENTE',
    userPercentage: 100,
  })

  assert.strictEqual(result.isPrized, false)
  assert.strictEqual(result.isCheckedWithoutPrize, false)
  assert.strictEqual(result.statusBadgeLabel, 'PENDIENTE')
  assert.ok(result.statusBadgeClasses.includes('bg-transparent'))
  assert.ok(result.containerClasses.includes('bg-white'))
  assert.ok(result.containerClasses.includes('dark:bg-[#1D1D1F]'))
  assert.ok(result.containerClasses.includes('rounded-[22px]'))
  assert.ok(!result.containerClasses.includes('from-[#FCF9F3]'))
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

test('resolveTicketCardPresentation - billete premiado usa superficie champán luminosa con borde Oro Cava (#C5A880)', () => {
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
  assert.ok(result.containerClasses.includes('from-[#FCF9F3]'))
  assert.ok(result.containerClasses.includes('dark:from-[#262017]'))
  assert.ok(result.containerClasses.includes('border-[#C5A880]'))
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
  assert.ok(result.containerClasses.includes('from-[#FCF9F3]'))
})

test('resolveTicketCardPresentation - billete archivado premiado preserva fondo champán Oro Cava', () => {
  const result = resolveTicketCardPresentation({
    prizeAmountCents: 150000,
    status: 'VALIDADO',
    userPercentage: 25,
    isArchived: true,
  })

  assert.strictEqual(result.isPrized, true)
  assert.strictEqual(result.statusBadgeLabel, '¡PREMIADO!')
  assert.strictEqual(result.userPrizeFormatted, '375,00 €')
  assert.ok(result.containerClasses.includes('from-[#FCF9F3]'))
})

test('resolveTicketCardPresentation - isShared distingue décimo propio 100% sin participaciones vs compartido', () => {
  const soloOwner = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 100,
    isOwner: true,
    hasParticipations: false,
  })
  assert.strictEqual(soloOwner.isShared, false)

  const sharedOwner = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 75,
    isOwner: true,
    hasParticipations: true,
  })
  assert.strictEqual(sharedOwner.isShared, true)

  const participant = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 25,
    isOwner: false,
  })
  assert.strictEqual(participant.isShared, true)
})

test('filterHomeTickets - Todos, Premiados y Sin premio excluyen estrictamente los pendientes', () => {
  const items = [
    { id: 'pending', ticket: { status: 'PENDIENTE', last_checked_at: null, prize_amount_cents: 0 } },
    { id: 'winner', ticket: { status: 'VALIDADO', last_checked_at: '2026-12-22T12:00:00Z', prize_amount_cents: 2000 } },
    { id: 'settled', ticket: { status: 'LIQUIDADO', last_checked_at: '2026-12-22T12:00:00Z', prize_amount_cents: 10000 } },
    { id: 'loser', ticket: { status: 'VALIDADO', last_checked_at: '2026-12-22T12:00:00Z', prize_amount_cents: 0 } },
  ]

  assert.deepStrictEqual(
    filterHomeTickets(items, 'todos').map((i) => i.id),
    ['pending', 'winner', 'settled', 'loser']
  )
  assert.deepStrictEqual(
    filterHomeTickets(items, 'premiados').map((i) => i.id),
    ['winner', 'settled']
  )
  assert.deepStrictEqual(
    filterHomeTickets(items, 'sin_premio').map((i) => i.id),
    ['loser']
  )
})

test('formatDrawLabel - formatea Navidad (12-22), El Niño (01-06) y fechas ordinarias', () => {
  assert.strictEqual(formatDrawLabel('2026-12-22'), 'Sorteo de Navidad')
  assert.strictEqual(formatDrawLabel('2025-12-22'), 'Sorteo de Navidad')
  assert.strictEqual(formatDrawLabel('2027-01-06'), 'Sorteo del Niño')
  assert.strictEqual(formatDrawLabel('2026-01-06'), 'Sorteo del Niño')
  assert.strictEqual(formatDrawLabel('2026-07-18'), 'Sorteo: 2026-07-18')
})

test('Marca "Mis Décimos", filtro en pantalla principal y tarjeta sin cabecera redundante', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const shell = readFileSync(resolve(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf8')
  const login = readFileSync(resolve(process.cwd(), 'src/pages/LoginPage.tsx'), 'utf8')
  const ticketsPage = readFileSync(resolve(process.cwd(), 'src/pages/TicketsPage.tsx'), 'utf8')
  const card = readFileSync(resolve(process.cwd(), 'src/components/tickets/TicketListItemCard.tsx'), 'utf8')

  assert.ok(html.includes('<title>Mis Décimos</title>'))
  assert.ok(shell.includes('Mis Décimos'))
  assert.ok(login.includes('Mis Décimos'))
  assert.ok(!ticketsPage.includes('Mis Décimos y Participaciones'))
  assert.ok(ticketsPage.includes('Todos') && ticketsPage.includes('Premiados') && ticketsPage.includes('Sin premio'))

  assert.ok(!card.includes('{/* Cabecera */}'))
  assert.ok(card.includes('Banknote'))
  assert.ok(card.includes('Clover'))
  assert.ok(card.includes('Has ganado {userPrizeFormatted}'))
  assert.ok(card.includes('De un total de {totalPrizeFormatted}'))
  assert.ok(card.includes("'COBRADO' : 'PREMIADO'"))
  assert.ok(card.includes('No premiado'))
  assert.ok(card.includes('formatDrawLabel(ticket.draw_date)'))

  // Simetría Compartir (isOwner) vs Participación (!isOwner) y margen inferior pb-28
  assert.ok(card.includes('{isOwner ? ('), 'Debe bifurcar la posición derecha según isOwner')
  assert.ok(card.includes('<span>Compartir</span>'))
  assert.ok(card.includes('<span>Participación</span>'))
  assert.ok(card.includes('<Users className="w-3.5 h-3.5 shrink-0" />'))
  assert.ok(
    card.includes('bg-[#FFFFFF] dark:bg-[#2C2C2E] border border-[#E5E5EA] dark:border-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7]'),
    'La etiqueta Participación debe usar estilo neutro claro/oscuro sin tonos rojizos'
  )
  assert.ok(
    !card.includes('text-rose-') && !card.includes('bg-rose-') && !card.includes('text-red-') && !card.includes('bg-red-') && !card.includes('#D04848'),
    'La etiqueta Participación no debe usar colores rojizos ni rosados'
  )
  assert.ok(ticketsPage.includes('space-y-3 pb-28'), 'El listado principal debe incluir pb-28')
})

test('resolveTicketCardPresentation - restaura bordes originales sin filos pastel superior/inferior', () => {
  const ownNormal = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'PENDIENTE',
    userPercentage: 100,
    isOwner: true,
  })
  assert.ok(!ownNormal.containerClasses.includes('#B6D0C0'))
  assert.ok(!ownNormal.containerClasses.includes('#BFD1E5'))
  assert.ok(ownNormal.containerClasses.includes('border-y border-y-[#1D1D1F]/[0.07] dark:border-y-[#F5F5F7]/[0.08]'))

  const partNormal = resolveTicketCardPresentation({
    prizeAmountCents: 0,
    status: 'PENDIENTE',
    userPercentage: 25,
    isOwner: false,
  })
  assert.ok(!partNormal.containerClasses.includes('#B6D0C0'))
  assert.ok(!partNormal.containerClasses.includes('#BFD1E5'))
  assert.ok(partNormal.containerClasses.includes('border-y border-y-[#1D1D1F]/[0.07] dark:border-y-[#F5F5F7]/[0.08]'))

  const partPrized = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 25,
    isOwner: false,
  })
  assert.ok(partPrized.containerClasses.includes('from-[#FCF9F3]'))
  assert.ok(partPrized.containerClasses.includes('border-[1.5px] border-[#C5A880]'))
  assert.ok(!partPrized.containerClasses.includes('#BFD1E5'))
})

test('TicketListItemCard y resolveTicketCardPresentation - acción Marcar cobrado exclusiva del propietario con premio', () => {
  const uncollectedOwner = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 100,
    isOwner: true,
    isCollected: false,
  })
  assert.strictEqual(uncollectedOwner.isCollected, false)

  const collectedOwner = resolveTicketCardPresentation({
    prizeAmountCents: 100000,
    status: 'VALIDADO',
    userPercentage: 50,
    isOwner: true,
    isCollected: true,
  })
  assert.strictEqual(collectedOwner.isCollected, true)

  const card = readFileSync(resolve(process.cwd(), 'src/components/tickets/TicketListItemCard.tsx'), 'utf8')
  const ticketsPage = readFileSync(resolve(process.cwd(), 'src/pages/TicketsPage.tsx'), 'utf8')
  assert.ok(card.includes('isOwner && isPrized'), 'Botón Marcar cobrado debe restringirse a isOwner && isPrized')
  assert.ok(card.includes("isCollected ? 'COBRADO' : 'PREMIADO'"))
  assert.ok(card.includes("isCollected ? 'Cobrado' : 'Marcar cobrado'"))
  assert.ok(ticketsPage.includes('toggleOwnerPrizeCollected'))
})
