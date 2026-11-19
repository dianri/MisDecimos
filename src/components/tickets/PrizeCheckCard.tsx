import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { checkTicketPrize } from '../../services/prizeService'
import type { Database } from '../../types/database.types'
import type { OwnershipShare } from './OwnershipBreakdownCard'
import {
  Search,
  Loader2,
  Trophy,
  CheckCircle2,
  ShieldCheck,
  Bell,
  Sparkles,
  AlertCircle,
  BadgeCheck,
  CalendarClock,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']

interface PrizeCheckCardProps {
  ticket: TicketRow
  userShare?: OwnershipShare
  shares: OwnershipShare[]
  isOwner?: boolean
  onRefresh: () => Promise<void>
}

export const PrizeCheckCard: React.FC<PrizeCheckCardProps> = ({
  ticket,
  userShare,
  shares,
  onRefresh,
}) => {
  const [isChecking, setIsChecking] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error' | 'historical_unavailable' | 'future' | 'in_progress'
    text: string
  } | null>(null)

  // Determinar si el sorteo ya se ha celebrado en hora peninsular española (Europe/Madrid)
  // Navidad: 22 de diciembre a las 09:00 CET
  // El Niño: 6 de enero a las 12:00 CET
  const isElNino = ticket.draw_type === 'EL_NINO' || ticket.draw_date.includes('-01-06')
  const drawStartHour = isElNino ? '12:00:00' : '09:00:00'
  const drawStartIso = `${ticket.draw_date}T${drawStartHour}+01:00`
  const parsedDrawStart = Date.parse(drawStartIso)
  const drawStartTimestamp = isNaN(parsedDrawStart)
    ? Date.parse(`${ticket.draw_date}T${drawStartHour}`)
    : parsedDrawStart
  const now = Date.now()
  const isDrawHeld = now >= drawStartTimestamp

  // Formateo de fechas para el mensaje y el botón
  const [yearStr, monthStr, dayStr] = ticket.draw_date.split('-')
  const drawDateObj = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr))
  const formattedDrawDate = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(drawDateObj)
  const shortDrawDate = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(drawDateObj)

  const diffMs = drawStartTimestamp - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const daysRemainingText =
    diffDays <= 0 ? 'se celebra hoy' : diffDays === 1 ? 'falta 1 día' : `faltan ${diffDays} días`

  const handleCheckPrize = async () => {
    if (!isDrawHeld) {
      setFeedbackMsg({
        type: 'future',
        text: `El sorteo aún no se ha realizado. Podrás comprobar tu décimo el ${formattedDrawDate}.`,
      })
      return
    }

    setIsChecking(true)
    setFeedbackMsg(null)

    try {
      const res = await checkTicketPrize({
        ticketId: ticket.id,
        number: ticket.number,
        drawType: ticket.draw_type,
        drawDate: ticket.draw_date,
        ticketPrice: Number(ticket.ticket_price),
        forceRefresh: !!ticket.last_checked_at,
      })

      if (res.ok === false) {
        if (res.code === 'HISTORICAL_UNAVAILABLE') {
          setFeedbackMsg({
            type: 'historical_unavailable',
            text:
              res.message ||
              `No hay resultados históricos disponibles en el proveedor oficial para el sorteo del ${shortDrawDate}.`,
          })
        } else if (res.code === 'DRAW_NOT_HELD_YET') {
          setFeedbackMsg({
            type: 'future',
            text:
              res.message ||
              `Este sorteo se celebrará el ${formattedDrawDate}. Aún no hay resultados oficiales.`,
          })
        } else {
          setFeedbackMsg({
            type: 'in_progress',
            text:
              res.message ||
              'El sorteo está en curso o aún no hay resultados oficiales publicados.',
          })
        }
        return
      }

      if (res.prizeAmountCents > 0) {
        setFeedbackMsg({
          type: 'success',
          text: `¡Comprobación finalizada! Premio registrado: ${res.formattedPrize}`,
        })
      } else {
        setFeedbackMsg({
          type: 'success',
          text: `Comprobación finalizada. El décimo no tiene premio registrado en el sorteo del ${shortDrawDate}.`,
        })
      }

      await onRefresh()
    } catch (err: unknown) {
      console.error('Error comprobando premio:', err)
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al consultar resultados oficiales.',
      })
    } finally {
      setIsChecking(false)
    }
  }

  // Participante o Propietario confirma recepción del premio
  const handleConfirmReceived = async () => {
    if (!userShare) return

    const myShareAmount = (
      (ticket.prize_amount_cents / 100) *
      (Number(userShare.percentage) / 100)
    ).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const confirmationText =
      userShare.role === 'PROPIETARIO'
        ? `¿Confirmas que has cobrado el premio de ${myShareAmount} €? El décimo pasará a estado LIQUIDADO.`
        : `¿Confirmas que el propietario te ha abonado tu parte del premio (${myShareAmount} €)? Esta acción quedará registrada de forma inmutable en la auditoría del décimo.`

    if (!confirm(confirmationText)) return

    setIsActionLoading(true)
    setFeedbackMsg(null)
    try {
      const { data, error } = await supabase.rpc('confirm_prize_received', {
        p_ticket_id: ticket.id,
      })

      if (error) throw error

      const res = data as { fully_liquidated?: boolean }
      if (res?.fully_liquidated) {
        setFeedbackMsg({
          type: 'success',
          text: '¡Enhorabuena! Todos los participantes han confirmado su cobro. Décimo LIQUIDADO.',
        })
      } else {
        setFeedbackMsg({
          type: 'success',
          text: 'Cobro confirmado correctamente. Ha quedado registrado en la auditoría.',
        })
      }

      await onRefresh()
    } catch (err: unknown) {
      console.error('Error confirmando cobro de premio:', err)
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al confirmar el cobro.',
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  // Propietario envía recordatorio a participantes con cobro pendiente
  const handleSendReminder = async () => {
    setIsActionLoading(true)
    setFeedbackMsg(null)
    try {
      const { error } = await supabase.rpc('request_payout_confirmation_reminder', {
        p_ticket_id: ticket.id,
      })

      if (error) throw error

      setFeedbackMsg({
        type: 'success',
        text: 'Recordatorio enviado a los cotitulares pendientes de confirmar su premio.',
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error enviando recordatorio:', err)
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al enviar recordatorio.',
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  // Cálculos de premios
  const prizeAmountCents = ticket.prize_amount_cents || 0
  const isPrized = prizeAmountCents > 0
  const isLiquidated = ticket.status === 'LIQUIDADO'
  const isChecked = isDrawHeld && (ticket.last_checked_at !== null || ticket.status !== 'PENDIENTE')

  const formattedTotalPrize = (prizeAmountCents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Participantes de terceros con cuota aceptada
  const thirdPartyShares = shares.filter(
    (s) => s.role === 'PARTICIPANTE' && s.status === 'ACEPTADA' && Number(s.percentage) > 0
  )
  const pendingPayoutShares = thirdPartyShares.filter((s) => !s.prize_paid_confirmed)
  const hasThirdPartyParticipants = thirdPartyShares.length > 0

  // Mi cuota e importe personal
  const myPct = userShare ? Number(userShare.percentage) : 0
  const myProportionalPrize = ((prizeAmountCents / 100) * (myPct / 100)).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div className="space-y-3">
      {/* 1. Botón Principal Dorado/Ámbar */}
      {!isDrawHeld ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full py-3.5 px-5 rounded-2xl bg-amber-100/90 text-amber-900 border border-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-not-allowed select-none"
        >
          <CalendarClock className="h-4 w-4 text-amber-700" />
          <span>Disponible el {shortDrawDate}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCheckPrize}
          disabled={isChecking}
          className="w-full py-3.5 px-5 rounded-2xl bg-[#D97706] hover:bg-[#b45309] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-98 transition disabled:opacity-75 cursor-pointer"
        >
          {isChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Consultando resultados oficiales...</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-white" />
              <span>
                {!isChecked || ticket.status === 'PENDIENTE'
                  ? 'Comprobar premio'
                  : 'Comprobar de nuevo'}
              </span>
            </>
          )}
        </button>
      )}

      {/* Mensaje de feedback temporal */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs shadow-xs transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 font-semibold'
              : feedbackMsg.type === 'historical_unavailable'
              ? 'bg-slate-50 border border-slate-200/90 text-slate-800 flex items-start gap-2.5 font-medium'
              : feedbackMsg.type === 'future' || feedbackMsg.type === 'in_progress'
              ? 'bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 font-medium'
              : 'bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 font-medium'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <>
              <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </>
          ) : feedbackMsg.type === 'historical_unavailable' ? (
            <>
              <CalendarClock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">Histórico no disponible</p>
                <p className="text-[11px] leading-relaxed text-slate-600">{feedbackMsg.text}</p>
              </div>
            </>
          ) : feedbackMsg.type === 'future' || feedbackMsg.type === 'in_progress' ? (
            <>
              <CalendarClock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900">
                  {feedbackMsg.type === 'future' ? 'Sorteo no celebrado' : 'Sorteo en curso'}
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">{feedbackMsg.text}</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{feedbackMsg.text}</span>
            </>
          )}
        </div>
      )}

      {/* 2. Recuadro Informativo de Sorteo Pendiente O Resultado */}
      {!isDrawHeld ? (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-amber-900 shadow-xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-700 shadow-xs">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 font-mono">
              Sorteo no celebrado
            </h4>
            <p className="text-xs text-amber-950/90 leading-relaxed">
              El sorteo aún no se ha realizado. Se celebrará el{' '}
              <span className="font-semibold text-amber-950">{formattedDrawDate}</span> ({daysRemainingText}).
              Podrás comprobar si tiene premio a partir de ese día.
            </p>
          </div>
        </div>
      ) : isChecked ? (
        <div className="rounded-2xl overflow-hidden transition shadow-xs">
          {!isPrized ? (
            /* CASO A: Sin Premio */
            <div className="bg-[#F3F4F6] border border-gray-200/80 p-4 text-center space-y-1.5">
              <p className="text-sm font-extrabold text-gray-900 tracking-tight">
                Sin premio en el sorteo oficial del {shortDrawDate}
              </p>
              <p className="text-[10px] text-gray-500 font-medium">
                Fuente: {ticket.check_source || 'oficial'} · Datos orientativos, verifica en{' '}
                <a
                  href="https://www.loteriasyapuestas.es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-700"
                >
                  loteriasyapuestas.es
                </a>
              </p>
            </div>
          ) : (
            /* CASO B: Décimo Premiado */
            <div className="bg-emerald-50 border border-emerald-200 p-4 space-y-4">
              {/* Encabezado del premio total */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 shadow-xs">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 font-mono">
                    Resultado Oficial
                  </span>
                  <h4 className="text-base sm:text-lg font-black text-emerald-950 tracking-tight">
                    ¡Premiado con {formattedTotalPrize} €!
                  </h4>
                </div>
              </div>

              {/* Tarjeta de desglose personal del usuario actual */}
              {userShare && myPct > 0 && (
                <div className="bg-white rounded-2xl p-3.5 border border-emerald-100 shadow-xs space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-500 font-medium text-[11px]">Tu cuota asignada:</span>
                      <p className="font-bold text-gray-900">{myPct}% del décimo</p>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 font-medium text-[11px]">Tu premio proporcional:</span>
                      <p className="text-base font-black text-lottery font-mono">
                        {myProportionalPrize} €
                      </p>
                    </div>
                  </div>

                  {/* Acciones de liquidación según rol */}
                  <div className="pt-1 border-t border-gray-100">
                    {userShare.role === 'PARTICIPANTE' ? (
                      /* Participante */
                      !userShare.prize_paid_confirmed ? (
                        <button
                          type="button"
                          onClick={handleConfirmReceived}
                          disabled={isActionLoading}
                          className="w-full py-2.5 px-3 rounded-xl bg-lottery hover:bg-lottery-dark text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>He recibido mi premio ({myProportionalPrize} €)</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            Cobro confirmado{' '}
                            {userShare.prize_paid_confirmed_at
                              ? `el ${new Date(userShare.prize_paid_confirmed_at).toLocaleDateString('es-ES')}`
                              : 'correctamente'}
                          </span>
                        </div>
                      )
                    ) : (
                      /* Propietario */
                      <div className="space-y-2">
                        {!hasThirdPartyParticipants ? (
                          /* Propietario 100% único custodio */
                          !isLiquidated ? (
                            <button
                              type="button"
                              onClick={handleConfirmReceived}
                              disabled={isActionLoading}
                              className="w-full py-2.5 px-3 rounded-xl bg-lottery hover:bg-lottery-dark text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <BadgeCheck className="h-4 w-4" />
                              )}
                              <span>Marcar premio como cobrado (Liquidar décimo)</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>Premio cobrado íntegramente por el propietario</span>
                            </div>
                          )
                        ) : (
                          /* Propietario con cotitulares */
                          pendingPayoutShares.length > 0 && (
                            <button
                              type="button"
                              onClick={handleSendReminder}
                              disabled={isActionLoading}
                              className="w-full py-2 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100 transition active:scale-98"
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
                              ) : (
                                <Bell className="h-3.5 w-3.5 text-amber-700" />
                              )}
                              <span>
                                Solicitar confirmación de cobro ({pendingPayoutShares.length}{' '}
                                pendiente{pendingPayoutShares.length > 1 ? 's' : ''})
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sello de Décimo Liquidado si todos los cotitulares han confirmado */}
              {isLiquidated && (
                <div className="p-3 bg-emerald-600 text-white rounded-2xl flex items-center gap-2.5 text-xs font-bold shadow-xs">
                  <ShieldCheck className="h-5 w-5 text-emerald-200 shrink-0" />
                  <p className="text-[11px] leading-tight font-medium">
                    Todos los participantes han confirmado la recepción de su premio. Décimo liquidado con trazabilidad completa.
                  </p>
                </div>
              )}

              {/* Nota legal oficial */}
              <p className="text-[10px] text-emerald-800/80 font-medium text-center">
                Fuente: {ticket.check_source || 'elpais'} · Datos orientativos, verifica en{' '}
                <a
                  href="https://www.loteriasyapuestas.es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-emerald-950 font-semibold"
                >
                  loteriasyapuestas.es
                </a>
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
