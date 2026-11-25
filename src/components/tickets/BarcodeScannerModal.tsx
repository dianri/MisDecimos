import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import { classifyScannedPayload } from '../../lib/scanPayloadClassifier'
import { X, Camera, AlertCircle, RefreshCw, KeyRound } from 'lucide-react'
import { DecimoIcon } from '../icons/DecimoIcon'

export interface BarcodeScannerModalProps {
  isOpen: boolean
  mode: 'TICKET_BARCODE' | 'INVITE_QR'
  onClose: () => void
  onScanSuccess: (decodedText: string) => void
  onManualEntry?: () => void
  onHaveCode?: () => void
}

const UNIFIED_SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
]

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  mode,
  onClose,
  onScanSuccess,
  onManualEntry,
  onHaveCode,
}) => {
  useModalBackHandler({ isOpen, onClose, modalKey: 'barcode_scanner_modal' })

  // 1. Estabilizar callbacks en refs para que el ciclo de vida de la cámara dependa exclusivamente de isOpen
  const onScanSuccessRef = useRef(onScanSuccess)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [warningMsg, setWarningMsg] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionGenerationRef = useRef(0)
  const isTransitioningRef = useRef(false)
  const readerId = useRef(`mc-scanner-${Math.random().toString(36).substring(7)}`).current

  // 2. Limpieza profunda y definitiva del hardware de cámara (detención de Html5Qrcode + parada explícita de MediaStreamTracks)
  const forceReleaseCamera = useCallback(async () => {
    // A. Detener y limpiar instancia de Html5Qrcode
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop()
        }
      } catch (err) {
        console.warn('Aviso deteniendo instancia activa de Html5Qrcode:', err)
      }
      try {
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.warn('Aviso limpiando instancia de Html5Qrcode:', err)
      }
      html5QrCodeRef.current = null
    }

    // B. Recorrer y detener forzosamente todas las pistas MediaStream de cualquier elemento <video>
    try {
      const container = document.getElementById(readerId)
      const videos = container
        ? container.querySelectorAll('video')
        : document.querySelectorAll(`#${readerId} video`)

      videos.forEach((video) => {
        const stream = (video as HTMLVideoElement).srcObject as MediaStream | null
        if (stream) {
          stream.getTracks().forEach((track) => {
            try {
              track.onended = null
              track.onmute = null
              track.stop()
            } catch (e) {
              console.warn('Aviso deteniendo MediaStreamTrack:', e)
            }
          })
          ;(video as HTMLVideoElement).srcObject = null
        }
      })
    } catch (err) {
      console.warn('Aviso liberando pistas de video del DOM:', err)
    }
  }, [readerId])

  // Limpiar temporizador al desmontar
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    }
  }, [])

  // 3. Manejar lectura exitosa con clasificación polimórfica y detención limpia
  const handleSuccess = useCallback(
    async (decodedText: string) => {
      const classified = classifyScannedPayload(decodedText)

      // Si no es un décimo ni una invitación reconocida, mostrar aviso inline y permitir seguir escaneando
      if (classified.kind === 'UNKNOWN') {
        setWarningMsg(classified.errorMessage)
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
        warningTimerRef.current = setTimeout(() => {
          setWarningMsg(null)
        }, 3500)
        return
      }

      // Código válido (TICKET o INVITE): limpiar avisos y liberar cámara antes de invocar callback
      setWarningMsg(null)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)

      await forceReleaseCamera()
      onScanSuccessRef.current(decodedText)
    },
    [forceReleaseCamera]
  )

  // 4. Arranque de cámara con reintento inteligente y suscripción a eventos de hardware
  const startCamera = useCallback(
    async (retryCount = 0): Promise<void> => {
      const currentSession = ++sessionGenerationRef.current
      isTransitioningRef.current = true
      setIsInitializing(true)
      setErrorMsg(null)
      setWarningMsg(null)

      try {
        // Liberar cualquier stream previo antes de solicitar uno nuevo
        await forceReleaseCamera()
        if (currentSession !== sessionGenerationRef.current) return

        // Esperar brevemente a que el DOM esté disponible para el contenedor
        let container = document.getElementById(readerId)
        if (!container) {
          await new Promise((r) => setTimeout(r, 100))
          container = document.getElementById(readerId)
        }
        if (!container || currentSession !== sessionGenerationRef.current) return

        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: UNIFIED_SUPPORTED_FORMATS,
          verbose: false,
        })
        html5QrCodeRef.current = scanner

        const qrbox = { width: 270, height: 160 }

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox,
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            handleSuccess(decodedText)
          },
          () => {
            // Frame a frame sin detección (operación normal)
          }
        )

        if (currentSession !== sessionGenerationRef.current) {
          await forceReleaseCamera()
          return
        }

        // Suscribirse a eventos de interrupción de hardware del sistema operativo
        const activeVideo = container.querySelector('video') as HTMLVideoElement | null
        if (activeVideo?.srcObject) {
          const stream = activeVideo.srcObject as MediaStream
          stream.getVideoTracks().forEach((track) => {
            const handleInterruption = () => {
              if (
                document.visibilityState === 'visible' &&
                !isTransitioningRef.current &&
                currentSession === sessionGenerationRef.current
              ) {
                console.warn('MediaStreamTrack interrumpida por el SO, recuperando cámara...')
                startCamera(0)
              }
            }
            track.onended = handleInterruption
            track.onmute = handleInterruption
          })
        }

        setIsInitializing(false)
      } catch (err: unknown) {
        console.warn(`Error iniciando cámara (intento ${retryCount + 1}):`, err)
        if (currentSession !== sessionGenerationRef.current) return

        const errorName = err instanceof Error ? err.name : String(err)
        const isPermissionError =
          errorName === 'NotAllowedError' ||
          errorName === 'PermissionDeniedError' ||
          (err instanceof Error && /permission|denied|not allowed/i.test(err.message))

        // Si no es fallo de permisos y quedan reintentos (hasta 2 reintentos, retryCount < 2)
        if (!isPermissionError && retryCount < 2) {
          await forceReleaseCamera()
          await new Promise((resolve) => setTimeout(resolve, 450))
          if (currentSession !== sessionGenerationRef.current) return
          return startCamera(retryCount + 1)
        }

        // Reintentos agotados o permiso denegado: limpiar hardware y mostrar diagnóstico
        await forceReleaseCamera()
        setIsInitializing(false)

        if (isPermissionError) {
          setErrorMsg(
            'Permiso de cámara denegado. Actívalo en los ajustes del navegador o sube una foto del décimo.'
          )
        } else {
          setErrorMsg(
            'La cámara se pausó al cambiar de aplicación. Pulsa reintentar para reactivarla.'
          )
        }
      } finally {
        isTransitioningRef.current = false
      }
    },
    [readerId, forceReleaseCamera, handleSuccess]
  )

  // 5. Gestión de Segundo Plano / Primer Plano con visibilitychange
  useEffect(() => {
    if (!isOpen) return

    let resumeTimer: NodeJS.Timeout | null = null

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        if (resumeTimer) clearTimeout(resumeTimer)
        // Segundo plano: liberar cámara de forma silenciosa sin error
        await forceReleaseCamera()
      } else if (document.visibilityState === 'visible') {
        setErrorMsg(null)
        setIsInitializing(true)
        if (resumeTimer) clearTimeout(resumeTimer)
        // Primer plano: esperar 350 ms para que Android reasigne el dispositivo y relanzar
        resumeTimer = setTimeout(() => {
          startCamera(0)
        }, 350)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (resumeTimer) clearTimeout(resumeTimer)
    }
  }, [isOpen, forceReleaseCamera, startCamera])

  // 6. Ciclo de vida principal dependiente exclusivamente de isOpen
  useEffect(() => {
    let mountTimer: NodeJS.Timeout | null = null

    if (isOpen) {
      mountTimer = setTimeout(() => {
        startCamera(0)
      }, 150)
    } else {
      forceReleaseCamera()
    }

    return () => {
      if (mountTimer) clearTimeout(mountTimer)
      forceReleaseCamera()
    }
  }, [isOpen, startCamera, forceReleaseCamera])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-sm rounded-3xl bg-[#1D1D1F] border border-[#F5F5F7]/10 text-[#F5F5F7] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between p-4 border-b border-[#F5F5F7]/10">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3A5245]/25 text-[#7AA38D]">
              <Camera className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-[#F5F5F7]">
              {mode === 'INVITE_QR' ? 'Escanear QR de Invitación' : 'Escanear Décimo o Invitación'}
            </h3>
          </div>
          <button
            onClick={() => onCloseRef.current()}
            className="rounded-lg p-1 text-[#F5F5F7]/50 hover:bg-[#F5F5F7]/10 hover:text-[#F5F5F7] transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visor de la Cámara */}
        <div className="relative bg-[#000000] flex items-center justify-center min-h-[300px] overflow-hidden">
          {/* El elemento de video del escáner se oculta visualmente si hay error activo para evitar mostrar imagen congelada */}
          <div id={readerId} className={`w-full h-full ${errorMsg ? 'hidden' : 'block'}`} />

          {/* Banner de aviso inline si se escanea un código no reconocido */}
          {warningMsg && !errorMsg && (
            <div className="absolute top-4 inset-x-4 z-20 flex items-center gap-2 p-3 bg-[#1D1D1F]/95 border border-[#C5A880]/60 text-[#F5F5F7] text-xs rounded-xl shadow-xl backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="h-4 w-4 text-[#C5A880] shrink-0" />
              <span className="flex-1">{warningMsg}</span>
              <button
                type="button"
                onClick={() => setWarningMsg(null)}
                className="p-1 text-[#F5F5F7]/60 hover:text-[#F5F5F7] transition"
                aria-label="Cerrar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Guía visual láser sobre el código */}
          {!errorMsg && !isInitializing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`relative border-2 border-[#3A5245] rounded-2xl shadow-lg transition-all ${
                  mode === 'INVITE_QR' ? 'w-56 h-56' : 'w-64 h-40'
                }`}
              >
                {/* Marcadores de esquina nítidos en Verde Granito claro */}
                <span className="absolute -top-0.5 -left-0.5 h-4 w-4 border-t-2 border-l-2 border-[#7AA38D] rounded-tl-xl" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 border-t-2 border-r-2 border-[#7AA38D] rounded-tr-xl" />
                <span className="absolute -bottom-0.5 -left-0.5 h-4 w-4 border-b-2 border-l-2 border-[#7AA38D] rounded-bl-xl" />
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 border-b-2 border-r-2 border-[#7AA38D] rounded-br-xl" />

                {/* Línea láser de escaneo animada */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#7AA38D] to-transparent shadow-[0_0_8px_#3A5245] animate-pulse top-1/2 -translate-y-1/2" />
                <span className="absolute -top-7 inset-x-0 text-center text-[11px] font-medium text-[#F5F5F7]/80 tracking-wide px-2 leading-tight">
                  {mode === 'INVITE_QR'
                    ? 'Apunta al código QR de invitación'
                    : 'Apunta al código de barras del décimo o al código QR de una participación'}
                </span>
              </div>
            </div>
          )}

          {/* Estado de carga */}
          {isInitializing && !errorMsg && (
            <div className="absolute inset-0 bg-[#1D1D1F]/90 flex flex-col items-center justify-center gap-2 text-xs text-[#F5F5F7]/60 z-10">
              <RefreshCw className="h-6 w-6 animate-spin text-[#7AA38D]" />
              <span>Iniciando cámara...</span>
            </div>
          )}

          {/* Mensaje de error / diagnóstico con botón de reintento limpio */}
          {errorMsg && (
            <div className="absolute inset-4 flex flex-col items-center justify-center text-center p-5 bg-[#1D1D1F]/95 rounded-2xl border border-[#D04848]/40 space-y-3 z-30 animate-in fade-in zoom-in-95 duration-200">
              <AlertCircle className="h-8 w-8 text-[#D04848] shrink-0" />
              <p className="text-xs text-[#F5F5F7]/80 leading-relaxed max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={async () => {
                  setErrorMsg(null)
                  await forceReleaseCamera()
                  startCamera(0)
                }}
                className="px-4 py-2 rounded-xl bg-[#F5F5F7]/10 hover:bg-[#F5F5F7]/15 text-xs font-semibold text-[#F5F5F7] transition active:scale-95 shadow-sm cursor-pointer"
              >
                Reintentar cámara
              </button>
            </div>
          )}
        </div>

        {/* Barra de opciones inferior (shrink-0) */}
        <div className="p-4 bg-[#1D1D1F] border-t border-[#F5F5F7]/10 space-y-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {(onHaveCode || onManualEntry) && (
            <div className={`grid gap-2 ${onHaveCode && onManualEntry ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {onHaveCode && (
                <button
                  type="button"
                  onClick={() => onHaveCode()}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-[#C5A880]/50 bg-[#C5A880]/12 hover:bg-[#C5A880]/20 text-sm font-medium text-[#E5CFA9] transition active:scale-98 cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-[#C5A880] shrink-0" />
                  <span className="whitespace-nowrap">Tengo un código</span>
                </button>
              )}

              {onManualEntry && (
                <button
                  type="button"
                  onClick={() => onManualEntry()}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-[#F5F5F7]/[0.08] hover:bg-[#F5F5F7]/[0.14] border border-[#F5F5F7]/10 text-sm font-medium text-[#F5F5F7] transition active:scale-98 cursor-pointer"
                >
                  <DecimoIcon className="w-4 h-4 text-[#7AA38D] shrink-0" />
                  <span className="whitespace-nowrap">Añadir manual</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7]/[0.06] hover:bg-[#F5F5F7]/[0.12] text-xs font-medium text-[#F5F5F7]/70 transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
