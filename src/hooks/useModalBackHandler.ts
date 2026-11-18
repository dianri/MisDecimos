import { useEffect, useRef } from 'react'

export interface ModalBackHandlerOptions {
  isOpen: boolean
  onClose: () => void
  modalKey?: string
}

/**
 * useModalBackHandler
 *
 * Hook para integrar diálogos modales y bottom sheets con el botón 'Atrás' del sistema (Android).
 *
 * 1. Al abrirse (isOpen: true): empuja un estado en window.history ({ modalOpen: true, modalKey }).
 * 2. Si el usuario pulsa 'Atrás' (evento popstate): intercepta el evento y ejecuta onClose() limpiamente.
 * 3. Si el modal se cierra desde la UI (botón X, backdrop, submit): hace window.history.back() para
 *    retirar la entrada de historial y no dejarla huérfana en la pila.
 */
export function useModalBackHandler({
  isOpen,
  onClose,
  modalKey = 'modal',
}: ModalBackHandlerOptions) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const hasHistoryEntryRef = useRef(false)
  const isClosingProgrammaticallyRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (isOpen) {
      if (!hasHistoryEntryRef.current) {
        const currentState = window.history.state || {}
        window.history.pushState(
          {
            ...currentState,
            modalOpen: true,
            modalKey,
            modalTimestamp: Date.now(),
          },
          ''
        )
        hasHistoryEntryRef.current = true
      }

      const handlePopState = () => {
        if (isClosingProgrammaticallyRef.current) {
          isClosingProgrammaticallyRef.current = false
          return
        }

        // El usuario pulsó 'Atrás' en Android: el navegador ya hizo pop de la entrada
        hasHistoryEntryRef.current = false
        onCloseRef.current()
      }

      window.addEventListener('popstate', handlePopState)

      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    } else {
      // Si el modal se cerró por UI mientras teníamos entrada activa en el historial
      if (hasHistoryEntryRef.current) {
        isClosingProgrammaticallyRef.current = true
        hasHistoryEntryRef.current = false
        window.history.back()
      }
    }
  }, [isOpen, modalKey])

  // Limpieza al desmontar el componente si aún quedó la entrada de historial abierta
  useEffect(() => {
    return () => {
      if (hasHistoryEntryRef.current) {
        isClosingProgrammaticallyRef.current = true
        hasHistoryEntryRef.current = false
        window.history.back()
      }
    }
  }, [])
}
