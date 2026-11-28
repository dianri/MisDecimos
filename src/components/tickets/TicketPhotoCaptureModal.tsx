import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import { X, Camera, FolderOpen, RefreshCw, AlertCircle } from 'lucide-react'

export interface TicketPhotoCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onPhotoCaptured: (file: File) => void
  onPickFromGallery: () => void
}

/**
 * Visor de cámara en vivo con estética Apple Cava Granite (idéntico al escáner de décimos)
 * para capturar el anverso del décimo antes de la certificación digital.
 */
export const TicketPhotoCaptureModal: React.FC<TicketPhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  onPickFromGallery,
}) => {
  useModalBackHandler({ isOpen, onClose, modalKey: 'ticket_photo_capture_modal' })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignorar errores al detener pista
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setIsInitializing(true)
    setErrorMsg(null)
    stopCamera()

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setIsInitializing(false)
      setErrorMsg('Tu navegador no permite abrir la cámara en vivo. Usa la cámara nativa o elige una imagen de tu galería/carpeta.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsInitializing(false)
    } catch {
      setIsInitializing(false)
      setErrorMsg(
        'No se pudo acceder a la cámara trasera. Puedes conceder permiso, usar la cámara nativa del dispositivo o elegir una imagen desde tu galería/carpeta.'
      )
    }
  }, [stopCamera])

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera])

  const handleCaptureFrame = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `decimo-anverso-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        stopCamera()
        onPhotoCaptured(file)
        onClose()
      },
      'image/jpeg',
      0.92
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-sm rounded-3xl bg-[#1D1D1F] border border-[#F5F5F7]/10 text-[#F5F5F7] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        role="dialog"
        aria-modal="true"
        aria-label="Fotografiar anverso del décimo"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-[#F5F5F7]/10">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3A5245]/25 text-[#7AA38D]">
              <Camera className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-[#F5F5F7]">
              Fotografiar Anverso del Décimo
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera()
              onClose()
            }}
            aria-label="Cerrar cámara"
            className="rounded-lg p-1 text-[#F5F5F7]/50 hover:bg-[#F5F5F7]/10 hover:text-[#F5F5F7] transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visor de cámara */}
        <div className="relative bg-[#000000] flex items-center justify-center min-h-[300px] overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full max-h-[360px] object-cover ${errorMsg ? 'hidden' : 'block'}`}
          />

          {/* Marco guía horizontal para el décimo */}
          {!errorMsg && !isInitializing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative w-72 h-44 border-2 border-[#3A5245] rounded-2xl shadow-lg">
                <span className="absolute -top-0.5 -left-0.5 h-4 w-4 border-t-2 border-l-2 border-[#7AA38D] rounded-tl-xl" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 border-t-2 border-r-2 border-[#7AA38D] rounded-tr-xl" />
                <span className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-2 border-l-2 border-[#7AA38D] rounded-bl-xl" />
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-2 border-r-2 border-[#7AA38D] rounded-br-xl" />
                <span className="absolute -top-9 inset-x-0 text-center text-[11px] font-medium text-[#F5F5F7]/90 tracking-wide px-2 leading-tight">
                  Encuadra el anverso completo del décimo
                </span>
              </div>
            </div>
          )}

          {isInitializing && !errorMsg && (
            <div className="absolute inset-0 bg-[#1D1D1F]/90 flex flex-col items-center justify-center gap-2 text-xs text-[#F5F5F7]/60 z-10">
              <RefreshCw className="h-6 w-6 animate-spin text-[#7AA38D]" />
              <span>Iniciando cámara...</span>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-4 flex flex-col items-center justify-center text-center p-5 bg-[#1D1D1F]/95 rounded-2xl border border-[#D04848]/40 space-y-3 z-30">
              <AlertCircle className="h-8 w-8 text-[#D04848] shrink-0" />
              <p className="text-xs text-[#F5F5F7]/80 leading-relaxed max-w-xs">{errorMsg}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-2 rounded-xl bg-[#F5F5F7]/10 hover:bg-[#F5F5F7]/15 text-xs font-semibold text-[#F5F5F7] transition cursor-pointer"
                >
                  Reintentar cámara
                </button>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-xs font-semibold text-[#1D1D1F] transition cursor-pointer"
                >
                  Cámara nativa
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input oculto de respaldo para cámara nativa */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) {
              stopCamera()
              onPhotoCaptured(file)
              onClose()
            }
          }}
          className="hidden"
        />

        {/* Barra inferior de acciones */}
        <div className="p-4 bg-[#1D1D1F] border-t border-[#F5F5F7]/10 space-y-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {!errorMsg && (
            <button
              type="button"
              disabled={isInitializing}
              onClick={handleCaptureFrame}
              className="w-full py-3 px-4 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Camera className="h-4 w-4 shrink-0" />
              <span>Capturar foto</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera()
                onClose()
                onPickFromGallery()
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#F5F5F7]/[0.08] hover:bg-[#F5F5F7]/[0.14] border border-[#F5F5F7]/10 text-xs font-medium text-[#F5F5F7] transition cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#C5A880] shrink-0" />
              <span className="whitespace-nowrap">Galería / Archivo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera()
                onClose()
              }}
              className="px-3 py-2.5 rounded-xl bg-[#F5F5F7]/[0.06] hover:bg-[#F5F5F7]/[0.12] text-xs font-medium text-[#F5F5F7]/70 transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
