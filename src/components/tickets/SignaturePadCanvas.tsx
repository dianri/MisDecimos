import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser } from 'lucide-react'

export interface SignaturePadCanvasProps {
  onSignatureChange: (pngDataUrl: string | null) => void
  disabled?: boolean
}

/**
 * Lienzo táctil responsivo para firma manuscrita en pantalla.
 * Usa touch-action: none para firmar cómodamente con el dedo sin desplazar la página.
 */
export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  onSignatureChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const hasStrokeRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const dpr = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2.4
      ctx.strokeStyle = '#1D1D1F'
    }
  }, [])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const { x, y } = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.01, y + 0.01)
    ctx.stroke()

    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true
      setHasStroke(true)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !isDrawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const finishStroke = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (canvas && hasStrokeRef.current) {
      onSignatureChange(canvas.toDataURL('image/png'))
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    hasStrokeRef.current = false
    setHasStroke(false)
    onSignatureChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
          Firma manuscrita en pantalla
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !hasStroke}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 transition cursor-pointer"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Borrar trazo</span>
        </button>
      </div>

      <div className="relative rounded-2xl border border-dashed border-[#C5A880]/70 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          style={{ touchAction: 'none' }}
          className="w-full h-36 block cursor-crosshair"
        />
        {!hasStroke && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-[#1D1D1F]/35 select-none">
            Firma aquí con tu dedo o ratón
          </span>
        )}
      </div>
    </div>
  )
}
