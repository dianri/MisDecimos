import test from 'node:test'
import assert from 'node:assert/strict'
import {
  _getActiveModalStackCount,
  _getProgrammaticBackCount,
  _resetModalStackForTesting,
} from '../../hooks/useModalBackHandler.ts'

test('modal stack helpers and initial state', () => {
  _resetModalStackForTesting()
  assert.equal(_getActiveModalStackCount(), 0)
  assert.equal(_getProgrammaticBackCount(), 0)
})

test('nested modal stack programmatic close simulation', () => {
  _resetModalStackForTesting()

  // Simulación de la pila idéntica a la implementada en useModalBackHandler
  const stack: { id: string; key: string; onClose: () => void; closedByPopstate: boolean }[] = []
  let programmaticBacks = 0
  let parentClosed = false
  let childClosed = false

  const closeParent = () => { parentClosed = true }
  const closeChild = () => { childClosed = true }

  // 1. Abre Modal Padre (TicketFormModal)
  stack.push({ id: '1', key: 'ticket_form_modal', onClose: closeParent, closedByPopstate: false })
  assert.equal(stack.length, 1)

  // 2. Abre Modal Hijo (BarcodeScannerModal)
  stack.push({ id: '2', key: 'barcode_scanner_modal', onClose: closeChild, closedByPopstate: false })
  assert.equal(stack.length, 2)

  // 3. El escáner lee el código y se cierra programáticamente
  const childIdx = stack.findIndex(m => m.id === '2')
  const childEntry = stack[childIdx]
  stack.splice(childIdx, 1)
  if (!childEntry.closedByPopstate) {
    programmaticBacks++
    // El navegador dispara popstate
    if (programmaticBacks > 0) {
      programmaticBacks--
      // Absorbido: NO cierra al padre
    }
  }

  assert.equal(stack.length, 1)
  assert.equal(childClosed, false) // se cerró por código, no por popstate
  assert.equal(parentClosed, false) // EL PADRE PERMANECE ABIERTO

  // 4. Ahora el usuario pulsa 'Atrás' físico de Android sobre el padre
  if (programmaticBacks === 0) {
    const top = stack.pop()
    if (top) {
      top.closedByPopstate = true
      top.onClose()
    }
  }

  assert.equal(parentClosed, true)
  assert.equal(stack.length, 0)
})
