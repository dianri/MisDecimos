import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('TicketDetailPage - fila de metadatos FECHA SORTEO y ORIGEN usa flex-wrap y whitespace-nowrap sin partir líneas', () => {
  const detailSource = readFileSync(
    resolve(process.cwd(), 'src/pages/TicketDetailPage.tsx'),
    'utf8'
  )

  assert.ok(
    detailSource.includes('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs'),
    'El contenedor de metadatos debe permitir flex-wrap limpio con gap-x-4 gap-y-2'
  )
  assert.ok(
    detailSource.includes('inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums text-[11px]'),
    'FECHA SORTEO debe envolverse con inline-flex y whitespace-nowrap'
  )
  assert.ok(
    detailSource.includes('inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[#3A5245] dark:text-[#C5A880] text-[11px]'),
    'ORIGEN debe envolverse con inline-flex y whitespace-nowrap'
  )
  assert.ok(
    detailSource.includes('<Calendar className="h-3.5 w-3.5 shrink-0" />'),
    'El icono Calendar debe llevar shrink-0'
  )
  assert.ok(
    detailSource.includes('<Barcode className="h-3.5 w-3.5 shrink-0" />'),
    'El icono Barcode debe llevar shrink-0'
  )
})

test('RealisticTicketCard - SERIE y FRACCIÓN mantienen whitespace-nowrap y alineación limpia en móviles estrechos', () => {
  const cardSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/RealisticTicketCard.tsx'),
    'utf8'
  )

  assert.ok(
    cardSource.includes('flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-xs tabular-nums'),
    'El contenedor de SERIE y FRACCIÓN debe usar flex-wrap centrado'
  )
  assert.ok(
    cardSource.includes('<span className="whitespace-nowrap">\n                    SERIE:'),
    'SERIE debe llevar whitespace-nowrap'
  )
  assert.ok(
    cardSource.includes('<span className="whitespace-nowrap">\n                    FRACCIÓN:'),
    'FRACCIÓN debe llevar whitespace-nowrap'
  )
})
