import React, { useRef, useState, useEffect } from 'react'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import {
  SWIPE_ACTION_WIDTH,
  clampSwipeOffset,
  detectHorizontalSwipeLock,
  resolveSwipeSnap,
  resolveCardTapWithSwipe,
  type SwipeSide,
} from '../../lib/swipeCardState'

export interface SwipeableTicketCardProps {
  ticketId: string
  isArchived?: boolean
  allowDelete?: boolean
  openSwipeTicketId: string | null
  onSwipeOpenChange: (ticketId: string | null, side: SwipeSide) => void
  onArchiveClick: (ticketId: string) => void
  onDeleteClick: (ticketId: string) => void
  onCardClick: (ticketId: string) => void
  children: React.ReactNode
}

export const SwipeableTicketCard: React.FC<SwipeableTicketCardProps> = ({
  ticketId,
  isArchived = false,
  allowDelete = true,
  openSwipeTicketId,
  onSwipeOpenChange,
  onArchiveClick,
  onDeleteClick,
  onCardClick,
  children,
}) => {
  const isOpen = openSwipeTicketId === ticketId
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)

  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const baseOffsetRef = useRef(0)
  const lockRef = useRef<'horizontal' | 'vertical' | 'undecided'>('undecided')
  const openSideRef = useRef<SwipeSide>(null)
  const didDragRef = useRef(false)

  // Sincronizar con el estado global de una única tarjeta abierta
  useEffect(() => {
    if (!isOpen && !isDragging) {
      setDragOffset(0)
      openSideRef.current = null
      baseOffsetRef.current = 0
    }
  }, [isOpen, isDragging])

  const handleStart = (clientX: number, clientY: number) => {
    startXRef.current = clientX
    startYRef.current = clientY
    baseOffsetRef.current = dragOffset
    lockRef.current = 'undecided'
    didDragRef.current = false
  }

  const handleMove = (clientX: number, clientY: number) => {
    const dx = clientX - startXRef.current
    const dy = clientY - startYRef.current

    if (lockRef.current === 'undecided') {
      lockRef.current = detectHorizontalSwipeLock(dx, dy)
    }

    if (lockRef.current !== 'horizontal') {
      return
    }

    if (!isDragging) {
      setIsDragging(true)
    }
    didDragRef.current = true
    setDragOffset(clampSwipeOffset(dx, baseOffsetRef.current, allowDelete))
  }

  const handleEnd = () => {
    if (lockRef.current !== 'horizontal') {
      setIsDragging(false)
      return
    }

    const { side, snappedOffset } = resolveSwipeSnap(dragOffset, allowDelete)
    setIsDragging(false)
    setDragOffset(snappedOffset)
    openSideRef.current = side
    onSwipeOpenChange(side ? ticketId : null, side)
  }

  const handleWrapperClick = (e: React.MouseEvent) => {
    // Si el clic proviene de un botón, enlace o elemento marcado para no navegar, abortar
    const targetEl = e.target as HTMLElement | null
    if (targetEl?.closest('button, a, [data-no-card-nav="true"]')) {
      return
    }

    // Si hubo arrastre horizontal real, evitar clic accidental
    if (didDragRef.current) {
      e.stopPropagation()
      didDragRef.current = false
      return
    }

    // Si esta tarjeta está abierta en swipe, al pulsarla se cierra sin navegar
    const tap = resolveCardTapWithSwipe(ticketId, openSwipeTicketId)
    if (tap.action === 'close_swipe') {
      e.stopPropagation()
      setDragOffset(0)
      openSideRef.current = null
      onSwipeOpenChange(null, null)
      return
    }

    onCardClick(ticketId)
  }

  return (
    <div className="relative rounded-[22px] overflow-hidden select-none touch-pan-y">
      {/* Fondo izquierdo: botón Archivar / Desarchivar (revelado al deslizar hacia la derecha) */}
      <div
        className={`absolute inset-y-0 left-0 flex items-center justify-center transition-opacity ${
          dragOffset > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ width: `${SWIPE_ACTION_WIDTH}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDragOffset(0)
            onSwipeOpenChange(null, null)
            onArchiveClick(ticketId)
          }}
          aria-label={isArchived ? 'Desarchivar décimo' : 'Archivar décimo'}
          className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#3A5245] hover:bg-[#2F4338] text-white font-semibold text-[11px] active:scale-95 transition"
        >
          {isArchived ? (
            <ArchiveRestore className="w-5 h-5" />
          ) : (
            <Archive className="w-5 h-5" />
          )}
          <span>{isArchived ? 'Restaurar' : 'Archivar'}</span>
        </button>
      </div>

      {/* Fondo derecho: botón Eliminar (revelado al deslizar hacia la izquierda, solo si allowDelete) */}
      {allowDelete && (
        <div
          className={`absolute inset-y-0 right-0 flex items-center justify-center transition-opacity ${
            dragOffset < 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ width: `${SWIPE_ACTION_WIDTH}px` }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDragOffset(0)
              onSwipeOpenChange(null, null)
              onDeleteClick(ticketId)
            }}
            aria-label="Eliminar décimo"
            className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#D04848] hover:bg-[#B83B3B] text-white font-semibold text-[11px] active:scale-95 transition"
          >
            <Trash2 className="w-5 h-5" />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {/* Contenido deslizable de la tarjeta */}
      <div
        onTouchStart={(e) => {
          if ((e.target as HTMLElement | null)?.closest('button, a, [data-no-card-nav="true"]')) return
          const t = e.touches[0]
          if (t) handleStart(t.clientX, t.clientY)
        }}
        onTouchMove={(e) => {
          if ((e.target as HTMLElement | null)?.closest('button, a, [data-no-card-nav="true"]')) return
          const t = e.touches[0]
          if (t) handleMove(t.clientX, t.clientY)
        }}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest('button, a, [data-no-card-nav="true"]')) return
          if (e.pointerType === 'mouse' && e.button === 0) {
            handleStart(e.clientX, e.clientY)
          }
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' && e.buttons === 1) {
            handleMove(e.clientX, e.clientY)
          }
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse') {
            handleEnd()
          }
        }}
        onClick={handleWrapperClick}
        style={{
          transform: `translate3d(${dragOffset}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="relative z-10"
      >
        {children}
      </div>
    </div>
  )
}
