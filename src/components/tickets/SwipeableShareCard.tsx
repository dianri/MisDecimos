import React, { useRef, useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import {
  SWIPE_ACTION_WIDTH,
  SWIPE_OPEN_THRESHOLD,
  detectHorizontalSwipeLock,
} from '../../lib/swipeCardState'

export interface SwipeableShareCardProps {
  shareId: string
  actionLabel: string | null
  openSwipeShareId: string | null
  onSwipeOpenChange: (shareId: string | null) => void
  onActionClick: (shareId: string) => void
  isActionDisabled?: boolean
  children: React.ReactNode
}

export const SwipeableShareCard: React.FC<SwipeableShareCardProps> = ({
  shareId,
  actionLabel,
  openSwipeShareId,
  onSwipeOpenChange,
  onActionClick,
  isActionDisabled = false,
  children,
}) => {
  const isEnabled = Boolean(actionLabel)
  const isOpen = openSwipeShareId === shareId
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)

  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const baseOffsetRef = useRef(0)
  const lockRef = useRef<'horizontal' | 'vertical' | 'undecided'>('undecided')
  const didDragRef = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen && !isDragging) {
      setDragOffset(0)
      baseOffsetRef.current = 0
    }
  }, [isOpen, isDragging])

  // Cerrar al tocar fuera de la tarjeta abierta
  useEffect(() => {
    if (!isOpen) return
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDragOffset(0)
        onSwipeOpenChange(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [isOpen, onSwipeOpenChange])

  if (!isEnabled) {
    return <>{children}</>
  }

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
    const raw = baseOffsetRef.current + dx
    setDragOffset(Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, raw)))
  }

  const handleEnd = () => {
    if (lockRef.current !== 'horizontal') {
      setIsDragging(false)
      return
    }

    const shouldOpen = dragOffset <= -SWIPE_OPEN_THRESHOLD
    setIsDragging(false)
    setDragOffset(shouldOpen ? -SWIPE_ACTION_WIDTH : 0)
    onSwipeOpenChange(shouldOpen ? shareId : null)
  }

  const handleWrapperClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest('button, a, [data-no-card-nav="true"]')) {
      return
    }
    if (didDragRef.current) {
      e.stopPropagation()
      didDragRef.current = false
      return
    }
    if (isOpen) {
      e.stopPropagation()
      setDragOffset(0)
      onSwipeOpenChange(null)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative rounded-[22px] overflow-hidden select-none touch-pan-y"
    >
      {/* Fondo derecho: acción en Rojo Coral (#D04848) revelada al deslizar a la izquierda */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-center transition-opacity ${
          dragOffset < 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ width: `${SWIPE_ACTION_WIDTH}px` }}
      >
        <button
          type="button"
          disabled={isActionDisabled}
          onClick={(e) => {
            e.stopPropagation()
            setDragOffset(0)
            onSwipeOpenChange(null)
            onActionClick(shareId)
          }}
          aria-label={actionLabel || 'Renunciar'}
          className="w-full h-full flex flex-col items-center justify-center gap-1 px-1.5 bg-[#D04848] hover:bg-[#B83B3B] text-white font-semibold text-[11px] leading-tight text-center active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          <span>{actionLabel}</span>
        </button>
      </div>

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
