import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('BarcodeScannerModal - botón Añadir manual usa DecimoIcon sin truncado y paleta Carbon Black / Oro Cava / Verde Granito', () => {
  const scannerSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/BarcodeScannerModal.tsx'),
    'utf8'
  )

  // Superficies Carbon Black y Negro puro sin tonos azulados/pizarra
  assert.ok(
    scannerSource.includes('bg-[#1D1D1F] border border-[#F5F5F7]/10'),
    'El contenedor del escáner debe usar Carbon Black #1D1D1F con borde hairline'
  )
  assert.ok(
    scannerSource.includes('bg-[#000000]'),
    'El visor de cámara debe usar Negro puro #000000'
  )
  assert.ok(
    !scannerSource.includes('bg-gray-900') && !scannerSource.includes('bg-slate-900'),
    'No debe quedar bg-gray-900 ni bg-slate-900 en el modal del escáner'
  )

  // Marco de enfoque en Verde Granito
  assert.ok(
    scannerSource.includes('border-[#3A5245]') && scannerSource.includes('border-[#7AA38D]'),
    'El marco de enfoque y esquinas deben usar Verde Granito (#3A5245 / #7AA38D)'
  )

  // Botón Tengo un código en Oro Cava
  assert.ok(
    scannerSource.includes('border-[#C5A880]/50 bg-[#C5A880]/12') &&
      scannerSource.includes('text-[#E5CFA9]'),
    'El botón Tengo un código debe usar el acento Oro Cava'
  )

  // Botón Añadir manual con DecimoIcon y whitespace-nowrap
  assert.ok(
    scannerSource.includes('<DecimoIcon className="w-4 h-4 text-[#7AA38D] shrink-0" />'),
    'El botón manual debe usar <DecimoIcon />'
  )
  assert.ok(!scannerSource.includes('<Ticket '), 'No debe quedar el icono antiguo <Ticket />')
  assert.ok(
    scannerSource.includes('<span className="whitespace-nowrap">Añadir manual</span>'),
    'La etiqueta debe ser "Añadir manual" con whitespace-nowrap sin truncado'
  )
  assert.ok(
    !scannerSource.includes('Añadir décimo manual'),
    'No debe quedar la etiqueta larga anterior "Añadir décimo manual"'
  )
})
