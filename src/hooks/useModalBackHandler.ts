import { useEffect, useRef } from 'react'

export interface ModalBackHandlerOptions {
  isOpen: boolean
  onClose: () => void
  modalKey?: string
}

interface ModalStackEntry {
  id: string
  modalKey: string
  onClose: () => void
  hasHistoryEntry: boolean
  closedByPopstate: boolean
}

// Pila global de modales y sheets activos
const activeModalStack: ModalStackEntry[] = []

// Contador global de llamadas programáticas a window.history.back()
// para evitar que los eventos popstate resultantes cierren modales padre en cascada
let programmaticBackCount = 0

// Indicador para registrar un único listener global de popstate
let isGlobalListenerAttached = false

function ensureGlobalListener() {
  if (typeof window === 'undefined' || isGlobalListenerAttached) return

  window.addEventListener('popstate', () => {
    // Si el popstate fue provocado por un history.back() programático (cierre por código)
    if (programmaticBackCount > 0) {
      programmaticBackCount--
      return
    }

    // El usuario pulsó el botón 'Atrás' físico de Android:
    // Solo debe responder y cerrarse el modal situado en la CIMA de la pila
    const topModal = activeModalStack.pop()
    if (topModal) {
      topModal.closedByPopstate = true
      topModal.onClose()
    }
  })

  isGlobalListenerAttached = true
}

export function _getActiveModalStackCount(): number {
  return activeModalStack.length
}

export function _getProgrammaticBackCount(): number {
  return programmaticBackCount
}

export function _resetModalStackForTesting(): void {
  activeModalStack.length = 0
  programmaticBackCount = 0
}

/**
 * useModalBackHandler
 *
 * Hook para integrar diálogos modales y bottom sheets con el botón 'Atrás' del sistema (Android).
 *
 * 1. Gestiona una pila global de modales activos (activeModalStack).
 * 2. Al abrirse (isOpen: true): empuja un estado en window.history ({ modalOpen: true, modalKey }).
 * 3. Si el usuario pulsa 'Atrás' físico (evento popstate): solo el modal superior responde y se cierra.
 * 4. Si un modal hijo se cierra programáticamente (ej. escáner al leer un código): su history.back()
 *    es absorbido por programmaticBackCount y NO cierra en cascada al modal padre.
 */
export function useModalBackHandler({
  isOpen,
  onClose,
  modalKey = 'modal',
}: ModalBackHandlerOptions) {
  const idRef = useRef(`modal_${Math.random().toString(36).substring(2, 9)}`)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const hasHistoryEntryRef = useRef(false)
  const closedByPopstateRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    ensureGlobalListener()

    const id = idRef.current

    if (isOpen) {
      closedByPopstateRef.current = false

      // Si aún no está en la pila, registrarlo y empujar entrada en history
      const existingIdx = activeModalStack.findIndex((m) => m.id === id)
      if (existingIdx === -1) {
        window.history.pushState(
          {
            modalOpen: true,
            modalKey,
            modalId: id,
            modalTimestamp: Date.now(),
          },
          ''
        )
        hasHistoryEntryRef.current = true

        activeModalStack.push({
          id,
          modalKey,
          onClose: () => {
            closedByPopstateRef.current = true
            onCloseRef.current()
          },
          hasHistoryEntry: true,
          closedByPopstate: false,
        })
      }
    } else {
      // Si el modal pasa a isOpen: false mientras tenía entrada activa en el historial
      const existingIdx = activeModalStack.findIndex((m) => m.id === id)
      if (existingIdx !== -1) {
        const entry = activeModalStack[existingIdx]
        activeModalStack.splice(existingIdx, 1)

        // Si se cerró por código (no por hardware back), revertir la entrada del historial
        if (hasHistoryEntryRef.current && !closedByPopstateRef.current && !entry.closedByPopstate) {
          programmaticBackCount++
          hasHistoryEntryRef.current = false
          window.history.back()
        }
      }
      closedByPopstateRef.current = false
    }
  }, [isOpen, modalKey])

  // Limpieza al desmontar el componente si aún quedó en la pila
  useEffect(() => {
    const id = idRef.current
    return () => {
      const existingIdx = activeModalStack.findIndex((m) => m.id === id)
      if (existingIdx !== -1) {
        const entry = activeModalStack[existingIdx]
        activeModalStack.splice(existingIdx, 1)

        if (hasHistoryEntryRef.current && !closedByPopstateRef.current && !entry.closedByPopstate) {
          programmaticBackCount++
          hasHistoryEntryRef.current = false
          window.history.back()
        }
      }
    }
  }, [])
}
