import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import { X, Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react'

export interface BarcodeScannerModalProps {
  isOpen: boolean
  mode: 'TICKET_BARCODE' | 'INVITE_QR'
  onClose: () => void
  onScanSuccess: (decodedText: string) => void
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  mode,
  onClose,
  onScanSuccess,
}) => {
  useModalBackHandler({ isOpen, onClose, modalKey: 'barcode_scanner_modal' })

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isScanningFile, setIsScanningFile] = useState(false)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const readerId = useRef(`reader-${Math.random().toString(36).substring(7)}`).current

  // Manejar resultado exitoso del escaneo
  const handleSuccess = useCallback((decodedText: string) => {
    // Detener cámara antes de llamar callback
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

  // Iniciar cámara con Html5Qrcode
  const startCamera = useCallback(async () => {
    setIsInitializing(true)
    setErrorMsg(null)

    try {
      if (!html5QrCodeRef.current) {
        // Formatos de códigos de barras soportados
        const formatsToSupport =
          mode === 'TICKET_BARCODE'
            ? [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.QR_CODE,
              ]
            : [Html5QrcodeSupportedFormats.QR_CODE]

        html5QrCodeRef.current = new Html5Qrcode(readerId, {
          formatsToSupport,
          verbose: false,
        })
      }

      // Configuración de visor según el modo
      const qrbox =
        mode === 'TICKET_BARCODE'
          ? { width: 280, height: 120 } // Guía horizontal para código de barras de décimo
          : { width: 220, height: 220 } // Guía cuadrada para QR de invitación

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox,
          aspectRatio: mode === 'TICKET_BARCODE' ? 1.777778 : 1.0,
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
  }, [mode, readerId, handleSuccess])

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
        html5QrCodeRef.current = new Html5Qrcode(readerId, { verbose: false })
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
              {mode === 'TICKET_BARCODE' ? 'Escanear Código del Décimo' : 'Escanear QR de Invitación'}
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

          {/* Guía visual láser sobre el código */}
          {!errorMsg && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`relative border-2 border-lottery-400/90 rounded-2xl shadow-lg transition-all ${
                  mode === 'TICKET_BARCODE' ? 'w-64 h-28' : 'w-52 h-52'
                }`}
              >
                {/* Línea láser de escaneo animada */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-lottery-300 to-transparent shadow-[0_0_8px_#5fa788] animate-pulse top-1/2 -translate-y-1/2" />
                <span className="absolute -top-6 inset-x-0 text-center text-[11px] font-medium text-gray-300 tracking-wide">
                  {mode === 'TICKET_BARCODE'
                    ? 'Apunta al código de barras del décimo'
                    : 'Apunta al código QR de invitación'}
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
