import React, { useState, useEffect } from 'react'
import {
  previewInvite,
  claimInvite,
  rejectInvite,
  type InvitePreviewResult,
} from '../services/inviteService'
import { Ticket, CheckCircle2, AlertCircle, Loader2, XCircle } from 'lucide-react'

export interface InvitePageProps {
  inviteToken?: string
  onSelectTicket?: (ticketId: string, options?: { state?: Record<string, unknown> }) => void
  onCancel?: () => void
}

export const InvitePage: React.FC<InvitePageProps> = ({
  inviteToken,
  onSelectTicket,
  onCancel,
}) => {
  const [token] = useState<string>(() => {
    if (inviteToken) return inviteToken
    if (typeof window !== 'undefined') {
      const matchPath = window.location.pathname.match(/\/invite\/([a-zA-Z0-9_-]+)/)
      const matchHash = window.location.hash.match(/invite\/([a-zA-Z0-9_-]+)/)
      const fromUrl = matchPath?.[1] || matchHash?.[1]
      if (fromUrl) return fromUrl
      return sessionStorage.getItem('pending_invite_token') || ''
    }
    return ''
  })

  const [preview, setPreview] = useState<InvitePreviewResult | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<'claiming' | 'rejecting' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      setErrorMsg('No se ha proporcionado ningún enlace o código de invitación.')
      return
    }

    let isMounted = true
    setIsLoading(true)
    setErrorMsg(null)

    previewInvite(token)
      .then((data) => {
        if (isMounted) {
          setPreview(data)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          console.warn('Error al verificar invitación en InvitePage:', err)
          setErrorMsg(
            err instanceof Error ? err.message : 'Invitación no válida, expirada o ya aceptada.'
          )
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const handleAccept = async () => {
    if (!token || isSubmitting) return

    setIsSubmitting('claiming')
    setErrorMsg(null)

    try {
      const result = await claimInvite(token)
      const ticketId = result.ticket_id || preview?.ticket_id
      const pct = result.percentage ?? preview?.percentage
      const pctText = pct ? ` del ${pct}%` : ''
      const confirmationMsg = `¡Participación${pctText} reclamada correctamente!`

      setToastMsg(confirmationMsg)

      // 1. Sustituye la entrada actual /invite/:id en el historial por /?tab=participaciones
      if (typeof window !== 'undefined') {
        window.history.replaceState(
          {
            ...(window.history.state || {}),
            tab: 'billetes',
            ticketId: null,
            fromTab: 'participaciones',
            subTab: 'participaciones',
            directFallbackTab: 'participaciones',
          },
          '',
          '/?tab=participaciones'
        )
      }

      // 2. Navega inmediatamente a la ficha del décimo con state: { fromTab: 'participaciones' }
      if (ticketId && onSelectTicket) {
        onSelectTicket(ticketId, {
          state: {
            fromTab: 'participaciones',
            claimMessage: confirmationMsg,
          },
        })
      } else if (ticketId && typeof window !== 'undefined') {
        window.location.href = `/billetes/${ticketId}`
      }
    } catch (err: unknown) {
      console.error('Error aceptando invitación:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al confirmar la participación en el décimo.'
      )
      setIsSubmitting(null)
    }
  }

  const handleReject = async () => {
    if (!token || isSubmitting) return

    setIsSubmitting('rejecting')
    setErrorMsg(null)

    try {
      await rejectInvite(token)

      // Reemplazar historial a /?tab=participaciones
      if (typeof window !== 'undefined') {
        window.history.replaceState(
          {
            ...(window.history.state || {}),
            tab: 'billetes',
            ticketId: null,
            fromTab: 'participaciones',
          },
          '',
          '/?tab=participaciones'
        )
      }

      if (onCancel) {
        onCancel()
      } else if (typeof window !== 'undefined') {
        window.location.href = '/?tab=participaciones'
      }
    } catch (err: unknown) {
      console.error('Error rechazando invitación:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al rechazar la invitación.'
      )
      setIsSubmitting(null)
    }
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 max-w-md mx-auto">
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 inset-x-4 max-w-sm mx-auto z-50 px-4 py-3 bg-emerald-800 text-white text-xs font-semibold rounded-2xl shadow-2xl border border-emerald-600 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lottery-50 text-lottery shadow-xs mx-auto">
            <Ticket className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Reclamar Participación
          </h2>
          <p className="text-xs text-gray-500">
            Confirma tu cuota en el décimo compartido
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-lottery" />
            <span className="text-xs text-gray-500 font-medium">Verificando invitación...</span>
          </div>
        ) : errorMsg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-rose-800">No se pudo procesar la invitación</p>
                <p className="text-rose-700 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel()
                else if (typeof window !== 'undefined') window.location.href = '/'
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Volver al inicio
            </button>
          </div>
        ) : preview ? (
          <div className="space-y-5">
            {/* Tarjeta de preview */}
            <div className="rounded-2xl border-2 border-lottery/20 bg-lottery-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-lottery uppercase tracking-wider">
                  {preview.draw_name || 'Lotería Nacional'}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-lottery text-white text-xs font-bold font-mono">
                  {preview.percentage}%
                </span>
              </div>

              <div className="text-center py-2">
                <span className="text-xs text-gray-500 block mb-0.5">Número del décimo</span>
                <span className="text-4xl font-extrabold font-mono tracking-wider text-gray-950">
                  {preview.number}
                </span>
              </div>

              <div className="border-t border-lottery/15 pt-2 flex items-center justify-between text-[11px] text-gray-600">
                <span>Compartido por: <strong>{preview.owner_name}</strong></span>
                <span className="font-mono">PIN: {preview.short_code}</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleAccept}
                disabled={isSubmitting !== null}
                className="w-full py-3 px-4 rounded-xl bg-lottery text-white text-xs font-bold shadow-md hover:bg-lottery-600 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting === 'claiming' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Aceptando participación...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Aceptar y ver mi participación</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting !== null}
                className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting === 'rejecting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Rechazando...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-gray-400" />
                    <span>Rechazar invitación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
