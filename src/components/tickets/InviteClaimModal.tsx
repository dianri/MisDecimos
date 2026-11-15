import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, KeyRound, Ticket, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface TicketPreview {
  valid: boolean
  ticket_id: string
  number: string
  serie?: string
  fraccion?: string
  draw_name: string
  draw_date: string
  percentage: number
  label?: string
  owner_name: string
  short_code: string
}

export interface InviteClaimModalProps {
  isOpen: boolean
  initialCode?: string | null
  onClose: () => void
  onClaimed: (ticketId: string) => void
}

export const InviteClaimModal: React.FC<InviteClaimModalProps> = ({
  isOpen,
  initialCode,
  onClose,
  onClaimed,
}) => {
  const [code, setCode] = useState(initialCode || '')
  const [preview, setPreview] = useState<TicketPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode)
      handleCheckCode(initialCode)
    } else {
      setPreview(null)
      setErrorMsg(null)
      setSuccessMsg(null)
    }
  }, [initialCode, isOpen])

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
      const { data, error } = await supabase.rpc('accept_pending_invite', {
        p_code_or_token: targetCode,
        p_confirm: false,
      })

      if (error) throw error

      if (data && typeof data === 'object') {
        setPreview(data as unknown as TicketPreview)
      }
    } catch (err: unknown) {
      console.warn('Error verificando código:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Código de invitación no válido o ya utilizado.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Rechazar participación (reintegro al propietario)
  const handleRejectInvite = async () => {
    if (!code.trim() || isRejecting) return
    setIsRejecting(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase.rpc('reject_pending_invite', {
        p_code_or_token: code.trim(),
      })

      if (error) throw error

      setSuccessMsg('Invitación rechazada. El porcentaje ha regresado a la cuota del propietario.')
      setTimeout(() => {
        onClose()
      }, 1400)
    } catch (err: unknown) {
      console.error('Error rechazando invitación:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al rechazar la invitación.'
      )
    } finally {
      setIsRejecting(false)
    }
  }
  const handleConfirmAccept = async () => {
    if (!code.trim()) return

    setIsConfirming(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.rpc('accept_pending_invite', {
        p_code_or_token: code.trim(),
        p_confirm: true,
      })

      if (error) throw error

      const result = data as { success?: boolean; ticket_id?: string }
      setSuccessMsg('¡Participación aceptada con éxito!')
      setTimeout(() => {
        if (result?.ticket_id) {
          onClaimed(result.ticket_id)
        }
        onClose()
      }, 1200)
    } catch (err: unknown) {
      console.error('Error aceptando participación:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al confirmar la participación en el décimo.'
      )
    } finally {
      setIsConfirming(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl bg-white border border-gray-100 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Código de Invitación</h3>
              <p className="text-[11px] text-gray-500">Reclama tu cuota en el décimo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{successMsg}</span>
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
                <label className="block text-xs font-semibold text-gray-700">
                  Código de invitación (6 dígitos o token)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej. 493072"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  className="w-full text-center tracking-widest text-xl font-bold font-mono py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery text-gray-900 shadow-sm transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-98 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-lottery text-white text-xs font-semibold shadow-sm hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50"
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
              <div className="rounded-2xl border border-lottery/30 bg-lottery-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lottery">
                    <Ticket className="h-4 w-4" />
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      {preview.draw_name}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-lottery text-white text-xs font-bold font-mono">
                    {preview.percentage}% cuota
                  </span>
                </div>

                <div className="text-center py-2 bg-white rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                    Número
                  </p>
                  <p className="text-2xl font-extrabold font-mono tracking-widest text-gray-900">
                    {preview.number}
                  </p>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <p>
                    Compartido por: <strong className="text-gray-900">{preview.owner_name}</strong>
                  </p>
                  <p>
                    Fecha del sorteo:{' '}
                    <span className="font-mono text-gray-800">{preview.draw_date}</span>
                  </p>
                  {preview.label && (
                    <p className="text-[11px] text-gray-500 italic">Etiqueta: {preview.label}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    disabled={isConfirming || isRejecting}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAccept}
                    disabled={isConfirming || isRejecting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-lottery text-white text-xs font-semibold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <span>Reclamar {preview.percentage}%</span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRejectInvite}
                  disabled={isConfirming || isRejecting}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition active:scale-98 disabled:opacity-50"
                >
                  {isRejecting ? 'Rechazando...' : 'Rechazar participación'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
