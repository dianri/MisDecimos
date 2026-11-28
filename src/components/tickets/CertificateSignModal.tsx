import React, { useState, useEffect, useRef } from 'react'
import { X, ShieldCheck, KeyRound, Smartphone, Upload, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import {
  signPayloadWithP12,
  generateAutoFirmaSessionId,
  buildAutoFirmaSignUrl,
  pollAutoFirmaRelay,
  type DigitalSignatureResult,
} from '../../lib/digitalSignature'

export interface CertificateSignModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  legalStatement: string
  canonicalPayload: string
  onSigned: (result: DigitalSignatureResult) => Promise<void> | void
}

export const CertificateSignModal: React.FC<CertificateSignModalProps> = ({
  isOpen,
  onClose,
  title,
  legalStatement,
  canonicalPayload,
  onSigned,
}) => {
  const [method, setMethod] = useState<'autofirma' | 'p12'>('autofirma')
  const [p12File, setP12File] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWaitingAutoFirma, setIsWaitingAutoFirma] = useState(false)
  const [autoFirmaNotInstalled, setAutoFirmaNotInstalled] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useModalBackHandler({ isOpen, onClose, modalKey: 'certificate-sign' })

  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      setMethod('autofirma')
      setPassword('')
      setP12File(null)
      setErrorMsg(null)
      setAutoFirmaNotInstalled(false)
      setIsWaitingAutoFirma(false)
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleCancelAutoFirmaWait = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsWaitingAutoFirma(false)
    setIsSubmitting(false)
  }

  const handleP12Sign = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!p12File) {
      setErrorMsg('Selecciona un archivo de certificado .p12 o .pfx.')
      return
    }
    if (!password) {
      setErrorMsg('Introduce la contraseña del certificado.')
      return
    }

    try {
      setIsSubmitting(true)
      const bytes = await p12File.arrayBuffer()
      const result = await signPayloadWithP12({
        p12Bytes: bytes,
        password,
        canonicalPayload,
      })
      setPassword('')
      await onSigned(result)
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo firmar con el certificado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAutoFirmaLaunch = async () => {
    setErrorMsg(null)
    setAutoFirmaNotInstalled(false)
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsWaitingAutoFirma(true)
    setIsSubmitting(true)

    let appSwitched = false
    const markAppSwitched = () => {
      if (document.hidden || !document.hasFocus()) {
        appSwitched = true
      }
    }
    const onBlur = () => {
      appSwitched = true
    }

    document.addEventListener('visibilitychange', markAppSwitched)
    window.addEventListener('blur', onBlur)

    const launchCheckTimer = window.setTimeout(() => {
      if (!appSwitched && !document.hidden && !controller.signal.aborted) {
        controller.abort()
        setAutoFirmaNotInstalled(true)
        setErrorMsg(
          'No se ha podido abrir AutoFirma. Asegúrate de tenerla instalada o usa tu archivo .p12 / .pfx.'
        )
        setIsWaitingAutoFirma(false)
        setIsSubmitting(false)
      }
    }, 3000)

    try {
      const opId = generateAutoFirmaSessionId()
      const url = buildAutoFirmaSignUrl({ canonicalPayload, opId })

      if (typeof window !== 'undefined') {
        window.location.href = url
      }

      const result = await pollAutoFirmaRelay({
        opId,
        canonicalPayload,
        timeoutMs: 90_000,
        pollIntervalMs: 1500,
        signal: controller.signal,
      })

      await onSigned(result)
      onClose()
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo completar la firma con AutoFirma.')
      }
    } finally {
      window.clearTimeout(launchCheckTimer)
      document.removeEventListener('visibilitychange', markAppSwitched)
      window.removeEventListener('blur', onBlur)
      setIsWaitingAutoFirma(false)
      setIsSubmitting(false)
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#1D1D1F] rounded-t-[26px] sm:rounded-[26px] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[#3A5245] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-[#C5A880]" />
            </span>
            <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-xl text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Declaración legal exacta antes de firmar */}
          <div className="p-3.5 rounded-2xl bg-[#FCF9F3] dark:bg-[#262017] border border-[#C5A880]/45 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#73562E] dark:text-[#C5A880]">
              Declaración Legal
            </p>
            <p className="text-xs leading-relaxed text-[#1D1D1F]/85 dark:text-[#F5F5F7]/85">
              {legalStatement}
            </p>
          </div>

          {/* Selector de método: AutoFirma primero (por defecto), Archivo .p12 / .pfx segundo */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#1D1D1F]/[0.05] dark:bg-[#F5F5F7]/[0.08]">
            <button
              type="button"
              disabled={isWaitingAutoFirma}
              onClick={() => {
                setMethod('autofirma')
                setErrorMsg(null)
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
                method === 'autofirma'
                  ? 'bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                  : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>AutoFirma</span>
            </button>
            <button
              type="button"
              disabled={isWaitingAutoFirma}
              onClick={() => {
                setMethod('p12')
                setErrorMsg(null)
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
                method === 'p12'
                  ? 'bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                  : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Archivo .p12 / .pfx</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#D04848]/10 border border-[#D04848]/30 text-[#D04848] text-xs space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {autoFirmaNotInstalled && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <a
                    href="https://play.google.com/store/apps/details?id=es.gob.afirma"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#2C2C2E] border border-[#D04848]/25 text-[#1D1D1F] dark:text-[#F5F5F7] text-[11px] font-semibold"
                  >
                    <span>Instalar AutoFirma</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('p12')
                      setErrorMsg(null)
                      setAutoFirmaNotInstalled(false)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3A5245] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Usar archivo .p12 / .pfx</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {method === 'autofirma' ? (
            <div className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-xs text-[#1D1D1F]/80 dark:text-[#F5F5F7]/80 leading-relaxed space-y-1.5">
                <p>
                  Requiere tener instalada la app oficial <strong>AutoFirma</strong> (Gobierno de España) con tu certificado importado. Si lo prefieres, puedes firmar sin instalar nada con tu <strong>Archivo .p12 / .pfx</strong>.
                </p>
                <a
                  href="https://play.google.com/store/apps/details?id=es.gob.afirma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3A5245] dark:text-[#C5A880] hover:underline"
                >
                  <span>Descargar AutoFirma en Google Play</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {isWaitingAutoFirma ? (
                <div className="p-4 rounded-2xl bg-[#FCF9F3] dark:bg-[#262017] border border-[#C5A880]/45 space-y-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#3A5245] dark:text-[#C5A880]" />
                    <span>Esperando firma en AutoFirma...</span>
                  </div>
                  <p className="text-[11px] text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
                    Completa la firma en AutoFirma y regresa a esta pantalla.
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelAutoFirmaWait}
                    className="px-4 py-2 rounded-xl bg-[#1D1D1F]/[0.07] dark:bg-[#F5F5F7]/[0.10] hover:bg-[#1D1D1F]/[0.12] text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] transition cursor-pointer"
                  >
                    Cancelar espera
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAutoFirmaLaunch}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-2xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Abrir AutoFirma</span>
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleP12Sign} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                  Certificado digital (.p12 o .pfx)
                </label>
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-[#C5A880]/60 bg-[#F5F5F7]/70 dark:bg-[#2C2C2E]/60 hover:bg-[#C5A880]/10 transition cursor-pointer text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <Upload className="w-4 h-4 text-[#C5A880] shrink-0" />
                  <span className="truncate">
                    {p12File ? p12File.name : 'Seleccionar certificado .p12 / .pfx'}
                  </span>
                  <input
                    type="file"
                    accept=".p12,.pfx,application/x-pkcs12"
                    onChange={(e) => setP12File(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                  Contraseña del certificado
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce la contraseña"
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                />
              </div>

              <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 leading-relaxed">
                Tu certificado y contraseña se procesan exclusivamente en la memoria de tu navegador; nunca se envían al servidor.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl bg-[#3A5245] hover:bg-[#2F4338] text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#C5A880]" />
                )}
                <span>{isSubmitting ? 'Firmando en memoria...' : 'Firmar con certificado'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
