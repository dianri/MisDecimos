import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import { classifyScannedPayload } from '../../lib/scanPayloadClassifier'
import { X, Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react'

export interface BarcodeScannerModalProps {
  isOpen: boolean
  mode: 'TICKET_BARCODE' | 'INVITE_QR'
  onClose: () => void
  onScanSuccess: (decodedText: string) => void
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
}) => {
  useModalBackHandler({ isOpen, onClose, modalKey: 'barcode_scanner_modal' })

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [warningMsg, setWarningMsg] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isScanningFile, setIsScanningFile] = useState(false)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const readerId = useRef(`reader-${Math.random().toString(36).substring(7)}`).current

  // Limpiar temporizador al desmontar
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    }
  }, [])

  // Manejar resultado del escaneo
  const handleSuccess = useCallback((decodedText: string) => {
    // 1. Clasificar polimórficamente el código leído
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

    // Código válido (TICKET o INVITE): limpiar avisos y detener cámara
    setWarningMsg(null)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)

    if (html5QrCodeRef.current?.isScanning) {
      html5QrCodeRef.current.stop().then(() => {
        onScanSuccess(decodedText)
      }).catch(() => {
        onScanSuccess(decodedText)
      })
    } else {
      onScanSuccess(decodedText)
    }
  }, [onScanSuccess])

  // Iniciar cámara con Html5Qrcode habilitando siempre formatos 1D + QR
  const startCamera = useCallback(async () => {
    setIsInitializing(true)
    setErrorMsg(null)
    setWarningMsg(null)

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(readerId, {
          formatsToSupport: UNIFIED_SUPPORTED_FORMATS,
          verbose: false,
        })
      }

      // Guía visual unificada para abarcar tanto códigos de barras 1D horizontales como QR 2D
      const qrbox = { width: 270, height: 160 }

      await html5QrCodeRef.current.start(
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
          // Fallo frame a frame normal mientras busca código
        }
      )
    } catch (err: unknown) {
      console.warn('Error iniciando cámara para escaneo:', err)
      setErrorMsg(
        'No se pudo acceder a la cámara. Revisa los permisos del navegador o usa la opción de subir una foto.'
      )
    } finally {
      setIsInitializing(false)
    }
  }, [readerId, handleSuccess])

  // Iniciar / detener según isOpen
  useEffect(() => {
    if (isOpen) {
      // Breve espera para que el DOM monte el elemento readerId
      const timer = setTimeout(() => {
        startCamera()
      }, 150)
      return () => clearTimeout(timer)
    } else {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [isOpen, startCamera])

  // Detener al desmontar
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // Subir imagen desde galería/archivo para decodificar
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsScanningFile(true)
    setErrorMsg(null)

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(readerId, {
          formatsToSupport: UNIFIED_SUPPORTED_FORMATS,
          verbose: false,
        })
      }

      // Si la cámara estaba activa, pausar antes de analizar archivo
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true)
      handleSuccess(decodedText)
    } catch (err) {
      console.warn('Error decodificando código desde imagen:', err)
      setErrorMsg('No se detectó ningún código legible en la imagen subida.')
    } finally {
      setIsScanningFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className="w-full max-w-sm rounded-3xl bg-gray-900 border border-gray-800 text-white shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lottery/30 text-lottery-300">
              <Camera className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-white">
              {mode === 'INVITE_QR' ? 'Escanear QR de Invitación' : 'Escanear Décimo o Invitación'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visor de la Cámara */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
          <div id={readerId} className="w-full h-full" />

          {/* Banner de aviso inline si se escanea un código no reconocido */}
          {warningMsg && (
            <div className="absolute top-4 inset-x-4 z-20 flex items-center gap-2 p-3 bg-amber-900/90 border border-amber-500/70 text-amber-100 text-xs rounded-xl shadow-xl backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="flex-1">{warningMsg}</span>
              <button
                type="button"
                onClick={() => setWarningMsg(null)}
                className="p-1 text-amber-300 hover:text-white transition"
                aria-label="Cerrar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Guía visual láser sobre el código */}
          {!errorMsg && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`relative border-2 border-lottery-400/90 rounded-2xl shadow-lg transition-all ${
                  mode === 'INVITE_QR' ? 'w-56 h-56' : 'w-64 h-40'
                }`}
              >
                {/* Línea láser de escaneo animada */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-lottery-300 to-transparent shadow-[0_0_8px_#5fa788] animate-pulse top-1/2 -translate-y-1/2" />
                <span className="absolute -top-7 inset-x-0 text-center text-[11px] font-medium text-gray-300 tracking-wide px-2 leading-tight">
                  {mode === 'INVITE_QR'
                    ? 'Apunta al código QR de invitación'
                    : 'Apunta al código de barras del décimo o al código QR de una participación'}
                </span>
              </div>
            </div>
          )}

          {/* Estado de carga */}
          {isInitializing && (
            <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center gap-2 text-xs text-gray-400">
              <RefreshCw className="h-6 w-6 animate-spin text-lottery" />
              <span>Iniciando cámara...</span>
            </div>
          )}

          {/* Mensaje de error / alternativa */}
          {errorMsg && (
            <div className="absolute inset-4 flex flex-col items-center justify-center text-center p-4 bg-gray-900/95 rounded-2xl border border-rose-900/50 space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="text-xs text-gray-300">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white transition"
              >
                Reintentar cámara
              </button>
            </div>
          )}
        </div>

        {/* Barra de opciones inferior (shrink-0) */}
        <div className="p-4 bg-gray-900/90 border-t border-gray-800 flex items-center justify-between gap-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningFile}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 transition active:scale-98 disabled:opacity-50"
          >
            <Upload className="h-4 w-4 text-lottery-300" />
            <span>{isScanningFile ? 'Analizando...' : 'Subir foto del código'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-400 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
