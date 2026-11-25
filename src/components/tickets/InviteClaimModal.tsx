import React, { useState, useEffect } from 'react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import {
  previewInvite,
  claimInvite,
  rejectInvite,
  type InvitePreviewResult,
} from '../../services/inviteService'
import { X, KeyRound, Ticket, Loader2, AlertCircle } from 'lucide-react'

type TicketPreview = InvitePreviewResult

export interface InviteClaimModalProps {
  isOpen: boolean
  initialCode?: string | null
  initialInviteCode?: string | null
  onClose: () => void
  onClaimed: (ticketId: string, percentage?: number) => void
  onRejected?: () => void
}

export const InviteClaimModal: React.FC<InviteClaimModalProps> = ({
  isOpen,
  initialCode,
  initialInviteCode,
  onClose,
  onClaimed,
  onRejected,
}) => {
  useModalBackHandler({ isOpen, onClose, modalKey: 'invite_claim_modal' })

  const effectiveInitial = initialInviteCode || initialCode
  const [code, setCode] = useState(effectiveInitial || '')
  const [preview, setPreview] = useState<TicketPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState<'claiming' | 'rejecting' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const raw = (initialInviteCode || initialCode || '').trim()
    if (raw) {
      setCode(raw)
      handleCheckCode(raw)
    } else {
      setCode('')
      setPreview(null)
      setErrorMsg(null)
      setIsSubmitting(null)
    }
  }, [initialCode, initialInviteCode, isOpen])

  // 1. Previsualizar invitación (p_confirm = false)
  const handleCheckCode = async (codeToCheck?: string) => {
    const targetCode = (codeToCheck || code).trim()
    if (!targetCode) {
      setErrorMsg('Introduce un código de 6 dígitos o token de invitación.')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setPreview(null)

    try {
      const data = await previewInvite(targetCode)
      setPreview(data)
    } catch (err: unknown) {
      console.warn('Error verificando código:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Código de invitación no válido o ya utilizado.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Rechazar participación (reintegro al propietario)
  const handleRejectInvite = async () => {
    if (!code.trim() || isSubmitting) return
    setIsSubmitting('rejecting')
    setErrorMsg(null)

    try {
      await rejectInvite(code.trim())

      // Cierre inmediato del modal sin esperas
      onClose()
      if (onRejected) {
        onRejected()
      }
    } catch (err: unknown) {
      console.error('Error rechazando invitación:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al rechazar la invitación.'
      )
    } finally {
      setIsSubmitting(null)
    }
  }

  // 3. Confirmar y reclamar participación (p_confirm = true)
  const handleConfirmAccept = async () => {
    if (!code.trim() || isSubmitting) return

    setIsSubmitting('claiming')
    setErrorMsg(null)

    try {
      const result = await claimInvite(code.trim())
      const claimedTicketId = result.ticket_id || preview?.ticket_id || ''
      const claimedPercentage = result.percentage ?? preview?.percentage

      // Cierre inmediato del modal sin esperas ni setTimeouts
      onClose()

      // Lanzar actualización de datos en segundo plano
      if (claimedTicketId) {
        onClaimed(claimedTicketId, claimedPercentage)
      }
    } catch (err: unknown) {
      console.error('Error aceptando participación:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al confirmar la participación en el décimo.'
      )
    } finally {
      setIsSubmitting(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-[22px] bg-white dark:bg-[#1D1D1F] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera (shrink-0) */}
        <div className="flex items-center justify-between p-5 border-b border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C5A880]/20 text-[#C5A880]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Código de Invitación
              </h3>
              <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                Reclama tu cuota en el décimo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#D04848]/10 border border-[#D04848]/30 text-[#D04848] text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#D04848]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Formulario de entrada de código si aún no hay preview confirmado */}
          {!preview ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCheckCode()
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Código de invitación (6 dígitos o token)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej. 493072"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  className="w-full text-center tracking-widest text-xl font-bold font-mono py-2.5 px-4 rounded-xl border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 bg-[#F5F5F7] dark:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-[#C5A880]/40 focus:border-[#C5A880] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 bg-[#F5F5F7] dark:bg-[#2C2C2E] text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-80 active:scale-98 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-semibold shadow-sm active:scale-98 transition disabled:opacity-45 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <span>Verificar Código</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Tarjeta de Confirmación de Participación */
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#3A5245]/30 bg-[#F5F5F7] dark:bg-[#2C2C2E] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#3A5245] dark:text-[#C5A880]">
                    <Ticket className="h-4 w-4" />
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      {preview.draw_name}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#3A5245] text-white text-xs font-bold font-mono">
                    {preview.percentage}% cuota
                  </span>
                </div>

                <div className="text-center py-2 bg-white dark:bg-[#1D1D1F] rounded-xl border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shadow-xs">
                  <p className="text-[10px] font-bold tracking-widest text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50 uppercase">
                    Número
                  </p>
                  <p className="text-2xl font-black tracking-tight tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {preview.number}
                  </p>
                </div>

                <div className="text-xs text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 space-y-1">
                  <p>
                    Compartido por:{' '}
                    <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {preview.owner_name}
                    </strong>
                  </p>
                  <p>
                    Fecha del sorteo:{' '}
                    <span className="font-mono text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {preview.draw_date}
                    </span>
                  </p>
                  {preview.label && (
                    <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 italic">
                      Etiqueta: {preview.label}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    disabled={isSubmitting !== null}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAccept}
                    disabled={isSubmitting !== null}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-lottery text-white text-xs font-semibold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting === 'claiming' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Reclamando...</span>
                      </>
                    ) : (
                      <span>Reclamar {preview.percentage}%</span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRejectInvite}
                  disabled={isSubmitting !== null}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting === 'rejecting' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Rechazando...</span>
                    </>
                  ) : (
                    <span>Rechazar participación</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
