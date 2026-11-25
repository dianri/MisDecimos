import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('InviteClaimModal - jerarquía de acciones, rechazo protegido y paleta Titanio/Oro Cava/Verde Granito', () => {
  const modalSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/InviteClaimModal.tsx'),
    'utf8'
  )

  // Contenedor y tarjeta interior en Modo Claro y Oscuro OLED
  assert.ok(
    modalSource.includes('rounded-[24px] bg-white dark:bg-[#1D1D1F] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08]'),
    'El contenedor del modal debe usar superficie Titanio/OLED con rounded-[24px]'
  )
  assert.ok(
    modalSource.includes('rounded-[18px] bg-[#F5F5F7] dark:bg-[#2C2C2E]/70 border border-[#1D1D1F]/[0.06] dark:border-[#F5F5F7]/[0.08]'),
    'La tarjeta interior del décimo debe usar fondo neutro y rounded-[18px]'
  )

  // Iconografía coherente: DecimoIcon y KeyRound en Oro Cava
  assert.ok(modalSource.includes('<DecimoIcon'), 'Debe usar <DecimoIcon /> en lugar de Ticket')
  assert.ok(!modalSource.includes('<Ticket '), 'No debe quedar el icono antiguo <Ticket />')
  assert.ok(
    modalSource.includes('bg-[#C5A880]/15 text-[#8C6D43] dark:bg-[#C5A880]/20 dark:text-[#E2CCA8]'),
    'El círculo del icono de llave debe usar el acento Oro Cava'
  )

  // Píldora de cuota en una sola línea
  assert.ok(
    modalSource.includes('items-start justify-between gap-3'),
    'La cabecera de la tarjeta debe alinear la píldora arriba a la derecha'
  )
  assert.ok(
    modalSource.includes('bg-[#3A5245] text-white text-xs font-bold font-mono whitespace-nowrap shrink-0'),
    'La píldora de cuota debe usar Verde Granito y whitespace-nowrap shrink-0'
  )

  // Importe en formato español con coma decimal y whitespace-nowrap
  assert.ok(modalSource.includes("toLocaleString('es-ES'"))
  assert.ok(modalSource.includes('Importe participación:'))
  assert.ok(modalSource.includes('whitespace-nowrap'))

  // Orden de botones: Reclamar (Oro Cava) -> Volver (secundario) -> Rechazar (enlace discreto con confirmación)
  const claimIdx = modalSource.indexOf('<span>Reclamar {preview.percentage}%</span>')
  const backIdx = modalSource.indexOf('Volver', claimIdx)
  const rejectIdx = modalSource.indexOf('<span>Rechazar participación</span>')
  assert.ok(claimIdx > -1 && backIdx > claimIdx && rejectIdx > backIdx, 'El orden debe ser Reclamar -> Volver -> Rechazar')

  assert.ok(
    modalSource.includes('w-full py-3.5 rounded-full bg-[#C5A880] hover:bg-[#B8996F] text-[#1D1D1F]'),
    'Reclamar debe ser botón full-width en Oro Cava'
  )
  assert.ok(
    modalSource.includes('w-full py-3 rounded-full bg-[#1D1D1F]/[0.05] hover:bg-[#1D1D1F]/[0.10] dark:bg-[#F5F5F7]/[0.08] dark:hover:bg-[#F5F5F7]/[0.14]'),
    'Volver debe ser botón secundario full-width neutro'
  )
  assert.ok(
    !modalSource.includes('bg-rose-50') && !modalSource.includes('border-rose-200'),
    'No debe existir el botón grande rosado/rojo para rechazar'
  )
  assert.ok(
    modalSource.includes('text-[#D04848]/80 hover:text-[#D04848] hover:underline underline-offset-4'),
    'Rechazar participación debe ser un enlace de texto discreto en Rojo Coral'
  )
  assert.ok(
    modalSource.includes('¿Confirmar rechazo? Pulsa de nuevo para rechazar'),
    'Debe requerir confirmación antes de rechazar'
  )
})

test('Formato español de importe proporcional de participación (25% de 20,00 € = 5,00 €)', () => {
  const formatEuro = (amount: number) =>
    `${amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`

  const totalEuro = 20
  const share25 = (totalEuro * 25) / 100
  const share12_5 = (totalEuro * 12.5) / 100

  assert.equal(formatEuro(totalEuro), '20,00 €')
  assert.equal(formatEuro(share25), '5,00 €')
  assert.equal(formatEuro(share12_5), '2,50 €')
})
