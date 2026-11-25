import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import type { Database } from '../../types/database.types'
import { CreateParticipationSheet } from './CreateParticipationSheet'
import { ShareInviteModal } from './ShareInviteModal'
import {
  RefreshCw,
  QrCode,
  Share2,
  Trash2,
  MoreVertical,
  AlertTriangle,
  Check,
  X,
  Loader2,
  ShieldCheck,
  Clock,
  LogOut,
  BadgeCheck,
  CheckCircle2,
} from 'lucide-react'
import {
  requestPrizePayoutConfirmation,
  confirmPrizePayoutReceived,
} from '../../services/prizeService'

export type OwnershipShare = Database['public']['Tables']['ownership_shares']['Row'] & {
  profiles?: {
    id: string
    display_name: string | null
    avatar_url: string | null
    email: string | null
  } | null
}

export type PendingInvite = Database['public']['Tables']['pending_invites']['Row']

interface OwnershipBreakdownCardProps {
  ticketId: string
  ticketNumber: string
  drawName: string
  ticketStatus: string
  prizeAmountCents?: number
  isOwner: boolean
  shares: OwnershipShare[]
  pendingInvites: PendingInvite[]
  onRefresh: () => Promise<void>
  onRenounced?: () => void
  autoOpenCreateShare?: boolean
  onAutoOpenHandled?: () => void
}

import {
  computeSolidDonutArcs,
  DONUT_RADIUS,
  DONUT_STROKE_WIDTH,
} from '../../lib/ownershipSegments'

export const OwnershipBreakdownCard: React.FC<OwnershipBreakdownCardProps> = ({
  ticketId,
  ticketNumber,
  drawName,
  ticketStatus,
  prizeAmountCents = 0,
  isOwner,
  shares,
  pendingInvites,
  onRefresh,
  onRenounced,
  autoOpenCreateShare = false,
  onAutoOpenHandled,
}) => {
  const { user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modales
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [activeShareInvite, setActiveShareInvite] = useState<PendingInvite | null>(null)
  const [activeMenuShareId, setActiveMenuShareId] = useState<string | null>(null)
  const [renouncingShare, setRenouncingShare] = useState<OwnershipShare | null>(null)
  const [isRenouncing, setIsRenouncing] = useState(false)
  const menuContainerRef = useRef<HTMLDivElement>(null)

  // Integración con botón Atrás de Android para el modal de renuncia voluntaria
  useModalBackHandler({
    isOpen: !!renouncingShare,
    onClose: () => setRenouncingShare(null),
    modalKey: 'voluntary_waiver_modal',
  })

  // Apertura automática del modal de nueva participación si viene de la acción rápida "Compartir"
  useEffect(() => {
    if (autoOpenCreateShare && isOwner) {
      setShowCreateSheet(true)
      onAutoOpenHandled?.()
    }
  }, [autoOpenCreateShare, isOwner, onAutoOpenHandled])

  // Cerrar menú al hacer clic o tocar fuera
  useEffect(() => {
    if (!activeMenuShareId) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setActiveMenuShareId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [activeMenuShareId])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Cancelar invitación pendiente (solo propietario)
  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('¿Deseas cancelar esta invitación pendiente? La cuota volverá al propietario.')) {
      return
    }

    setActionLoadingId(inviteId)
    setActionMsg(null)
    try {
      const { error } = await supabase.rpc('cancel_pending_invite', {
        p_invite_id: inviteId,
      })
      if (error) throw error

      setActionMsg({ type: 'success', text: 'Invitación cancelada. El porcentaje ha regresado a tu cuenta.' })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error cancelando invitación:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al cancelar la invitación.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Cancelar todas las invitaciones pendientes en bloque
  const handleCancelAllPendingInvites = async () => {
    if (
      !confirm(
        `¿Estás seguro de que deseas cancelar todas las ${activePendingInvites.length} invitaciones pendientes y recuperar el ${totalPendingPct}% para tu cuenta?`
      )
    ) {
      return
    }

    setActionLoadingId('all-pending')
    setActionMsg(null)
    try {
      const { error } = await supabase.rpc('cancel_all_pending_invites', {
        p_ticket_id: ticketId,
      })
      if (error) throw error

      setActionMsg({
        type: 'success',
        text: `Se han cancelado las ${activePendingInvites.length} invitaciones pendientes. Has recuperado el ${totalPendingPct}% de cuota.`,
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error cancelando todas las invitaciones pendientes:', err)
      setActionMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Error al cancelar todas las invitaciones pendientes.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Solicitar renuncia (Propietario pide al participante que devuelva su cuota)
  const handleRequestWaiver = async (shareId: string) => {
    if (
      !confirm(
        '¿Deseas solicitar formalmente la renuncia de esta participación? El participante recibirá una notificación y deberá aceptar o rechazar devolver su cuota.'
      )
    ) {
      return
    }

    setActionLoadingId(shareId)
    setActiveMenuShareId(null)
    setActionMsg(null)
    try {
      const { error } = await supabase.rpc('request_share_waiver', {
        p_share_id: shareId,
      })
      if (error) throw error

      setActionMsg({
        type: 'success',
        text: 'Solicitud de renuncia enviada al participante.',
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error solicitando renuncia:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al enviar la solicitud de renuncia.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Responder a solicitud de renuncia (Participante acepta o rechaza devolver)
  const handleRespondWaiver = async (shareId: string, accept: boolean) => {
    const confirmationText = accept
      ? '¿Estás seguro de aceptar la renuncia? Tu cuota volverá al propietario y dejarás de ser cotitular.'
      : '¿Deseas rechazar la solicitud de renuncia y conservar tu participación?'

    if (!confirm(confirmationText)) return

    setActionLoadingId(shareId)
    setActionMsg(null)
    try {
      const { error } = await supabase.rpc('respond_share_waiver', {
        p_share_id: shareId,
        p_accept: accept,
      })
      if (error) throw error

      if (accept && onRenounced) {
        onRenounced()
        return
      }

      setActionMsg({
        type: 'success',
        text: accept
          ? 'Has renunciado a tu cuota correctamente.'
          : 'Has rechazado la solicitud de renuncia y conservas tu participación.',
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error respondiendo a la renuncia:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al responder a la solicitud de renuncia.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Renuncia voluntaria iniciada por el propio participante
  const handleConfirmVoluntaryWaiver = async () => {
    if (!renouncingShare) return

    setIsRenouncing(true)
    setActionMsg(null)

    try {
      const { error } = await supabase.rpc('renounce_own_participation', {
        p_share_id: renouncingShare.id,
      })

      if (error) throw error

      setRenouncingShare(null)

      if (onRenounced) {
        onRenounced()
        return
      }

      setActionMsg({
        type: 'success',
        text: `Has renunciado voluntariamente a tu participación del ${renouncingShare.percentage}%. La cuota ha vuelto a la custodia del propietario.`,
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error al renunciar voluntariamente:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al procesar la renuncia voluntaria.',
      })
    } finally {
      setIsRenouncing(false)
    }
  }

  // Custodio solicita confirmación de cobro al participante
  const handleRequestPrizePayoutConfirmation = async (shareId: string) => {
    setActionLoadingId(shareId)
    setActionMsg(null)
    try {
      await requestPrizePayoutConfirmation(shareId)
      setActionMsg({
        type: 'success',
        text: 'Solicitud de confirmación de cobro enviada al cotitular.',
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error solicitando confirmación de cobro:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al enviar la solicitud de confirmación de cobro.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Cotitular confirma la recepción de su parte del premio
  const handleConfirmPrizePayout = async (shareId: string) => {
    if (
      !confirm(
        '¿Confirmas que has recibido tu parte del premio? Esta acción quedará registrada de forma inmutable en la auditoría.'
      )
    ) {
      return
    }

    setActionLoadingId(shareId)
    setActionMsg(null)
    try {
      await confirmPrizePayoutReceived(shareId)
      setActionMsg({
        type: 'success',
        text: '¡Enhorabuena! Has confirmado la recepción de tu parte del premio.',
      })
      await onRefresh()
    } catch (err: unknown) {
      console.error('Error confirmando cobro de premio:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al confirmar la recepción del premio.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Cálculo para el Donut Chart SVG
  const ownerShare = shares.find((s) => s.role === 'PROPIETARIO' && s.status === 'ACEPTADA')
  const participantShares = shares.filter((s) => s.role === 'PARTICIPANTE' && s.status === 'ACEPTADA')
  const renouncedShares = shares.filter((s) => s.status === 'RENUNCIADA')
  const activePendingInvites = isOwner ? pendingInvites.filter((i) => i.status === 'PENDIENTE') : []
  const totalPendingPct = activePendingInvites.reduce((acc, i) => acc + Number(i.percentage), 0)

  const ownerPct = ownerShare ? Number(ownerShare.percentage) : 0
  const totalAcceptedSharesPct =
    shares.reduce((acc, s) => acc + (s.status === 'ACEPTADA' ? Number(s.percentage) : 0), 0)
  const unassignedPct = Math.max(0, Math.round((100 - totalAcceptedSharesPct) * 100) / 100)

  const coOwnersPct = participantShares.reduce((acc, s) => acc + Number(s.percentage), 0)
  const pendingPct = isOwner ? totalPendingPct : unassignedPct

  // Parámetros geométricos y arcos continuos para el anillo Donut sólido SVG
  const r = DONUT_RADIUS // 62
  const { circumference, arcs } = computeSolidDonutArcs(
    ownerPct,
    coOwnersPct,
    pendingPct,
    r
  )

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* 1. Header con Título y Refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
          CUADRO DE PROPIEDAD Y REPARTO
        </h3>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition active:scale-95"
          title="Actualizar reparto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-lottery' : ''}`} />
        </button>
      </div>

      {actionMsg && (
        <div
          className={`p-3 rounded-2xl text-xs font-medium flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Gráfico Donut SVG Sólido */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-5 border border-gray-100 shadow-sm flex flex-col items-center justify-center">
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
          <svg
            className="w-full h-full"
            viewBox="0 0 160 160"
            role="img"
            aria-label="Gráfico de distribución de propiedad"
          >
            {/* Círculo base completo (100 %) para representar cualquier porcentaje sin asignar */}
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={DONUT_STROKE_WIDTH}
            />

            {/* Arcos continuos y sólidos por categoría (> 0%) acumulando desplazamiento */}
            {arcs.map((arc) => (
              <circle
                key={arc.category}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={arc.color}
                strokeWidth={DONUT_STROKE_WIDTH}
                strokeLinecap="butt"
                strokeDasharray={`${arc.length} ${circumference}`}
                strokeDashoffset={arc.offset}
                transform="rotate(-90 80 80)"
                className="transition-all duration-500 ease-out"
              />
            ))}
          </svg>

          {/* Texto Central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-2xl font-black text-lottery tracking-tight">
              {ownerPct}%
            </span>
            <span className="text-[10px] font-semibold text-gray-500">
              Tu cuota
            </span>
          </div>
        </div>

        {/* Porcentaje por persona de forma limpia y legible */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2.5 sm:mt-4 text-xs font-medium text-gray-700">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E6146] shrink-0" />
            <span>
              {ownerShare?.profiles?.display_name || 'Propietario'}:{' '}
              <strong className="font-mono text-gray-900">{ownerPct}%</strong>
            </span>
          </div>

          {participantShares.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] shrink-0" />
              <span>
                {s.profiles?.display_name || 'Participante'}:{' '}
                <strong className="font-mono text-gray-900">{Number(s.percentage)}%</strong>
              </span>
            </div>
          ))}

          {isOwner ? (
            activePendingInvites.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] border border-amber-300 shrink-0" />
                <span>
                  Pendientes:{' '}
                  <strong className="font-mono text-gray-900">{totalPendingPct}%</strong>
                </span>
              </div>
            )
          ) : (
            unassignedPct > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] border border-amber-300 shrink-0" />
                <span>
                  Sin asignar:{' '}
                  <strong className="font-mono text-gray-900">{unassignedPct}%</strong>
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* 3. Listado de Cuotas de Titularidad */}
      <div className="space-y-3">
        {/* Tarjeta del Propietario */}
        {ownerShare && (
          <div className="bg-[#EAF3EE] border-2 border-lottery/40 rounded-2xl p-3.5 flex items-center justify-between relative overflow-hidden shadow-xs">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-lottery" />

            <div className="flex items-center gap-3 pl-2">
              <div className="w-10 h-10 rounded-full bg-lottery text-white flex items-center justify-center font-bold text-xs shadow-inner">
                {ownerShare.profiles?.avatar_url ? (
                  <img
                    src={ownerShare.profiles.avatar_url}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>
                    {(ownerShare.profiles?.display_name || 'YO').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {ownerShare.profiles?.display_name ||
                      (ownerShare.user_id === user?.id ? 'Tú (Propietario)' : 'Propietario')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-lottery text-white uppercase">
                    Propietario
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-lottery font-medium mt-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  <span>ACEPTADA</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-base font-extrabold font-mono text-lottery">
                {ownerShare.percentage}%
              </span>
              {prizeAmountCents > 0 ? (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-lottery font-mono">
                    {((prizeAmountCents / 100) * (Number(ownerShare.percentage) / 100)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                  <span className="inline-block px-1.5 py-0.2 rounded text-[8px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {ownerShare.prize_paid_confirmed ? 'COBRADO' : 'CUSTODIO'}
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 font-mono">
                  {((Number(ownerShare.percentage) / 100) * 20).toFixed(2)} €
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tarjetas de Participantes Aceptados */}
        {participantShares.map((share) => {
          const isMe = share.user_id === user?.id
          const shareDisplayName =
            share.profiles?.display_name || (isMe ? 'Tú (Participante)' : 'Cotitular')

          return (
            <div
              key={share.id}
              className={`bg-white border border-gray-200/80 rounded-2xl p-3.5 relative shadow-xs space-y-2 transition ${
                activeMenuShareId === share.id ? 'z-30' : 'z-10'
              }`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2563EB] rounded-l-2xl" />

              <div className="flex items-center justify-between pl-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                    {share.profiles?.avatar_url ? (
                      <img
                        src={share.profiles.avatar_url}
                        alt="Avatar"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{shareDisplayName.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">{shareDisplayName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        Cotitular
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-blue-700 font-medium mt-0.5">
                      <ShieldCheck className="h-3 w-3" />
                      <span>ACEPTADA · Participante</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-base font-extrabold font-mono text-blue-700">
                      {share.percentage}%
                    </span>
                    {prizeAmountCents > 0 ? (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-blue-700 font-mono">
                          {((prizeAmountCents / 100) * (Number(share.percentage) / 100)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </p>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-bold tracking-wider uppercase border ${
                            share.prize_paid_confirmed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {share.prize_paid_confirmed ? 'COBRO CONFIRMADO' : 'PENDIENTE DE COBRO'}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 font-mono">
                        {((Number(share.percentage) / 100) * 20).toFixed(2)} €
                      </p>
                    )}
                  </div>

                  {/* Menú de acciones para el Propietario (Solicitar Renuncia / Solicitar Confirmación de Cobro) */}
                  {(() => {
                    const canRequestWaiver = isOwner && !share.waiver_requested && ticketStatus === 'PENDIENTE'
                    const canRequestPayout = isOwner && prizeAmountCents > 0 && !share.prize_paid_confirmed
                    const showMoreMenu = canRequestWaiver || canRequestPayout

                    if (!showMoreMenu) return null

                    return (
                      <div
                        className="relative"
                        ref={activeMenuShareId === share.id ? menuContainerRef : null}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuShareId(
                              activeMenuShareId === share.id ? null : share.id
                            )
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                          title="Opciones del participante"
                          aria-label="Opciones del participante"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {activeMenuShareId === share.id && (
                          <div className="absolute right-0 top-full mt-1.5 min-w-[220px] rounded-xl bg-white shadow-xl border border-gray-200 z-40 py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                            {canRequestPayout && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuShareId(null)
                                  handleRequestPrizePayoutConfirmation(share.id)
                                }}
                                disabled={actionLoadingId === share.id}
                                className="w-full text-left py-2.5 px-3.5 text-amber-900 hover:bg-amber-50 flex items-center gap-2 font-medium transition active:bg-amber-100"
                              >
                                <BadgeCheck className="h-4 w-4 text-amber-600 shrink-0" />
                                <span>
                                  {share.prize_payout_requested_at
                                    ? 'Reenviar solicitud de cobro'
                                    : 'Solicitar confirmación de cobro'}
                                </span>
                              </button>
                            )}

                            {canRequestWaiver && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuShareId(null)
                                  handleRequestWaiver(share.id)
                                }}
                                disabled={actionLoadingId === share.id}
                                className="w-full text-left py-2.5 px-3.5 text-rose-700 hover:bg-rose-50 flex items-center gap-2 font-medium transition active:bg-rose-100"
                              >
                                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                                <span>Solicitar renuncia</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Si se ha solicitado confirmación de cobro y sigue pendiente */}
              {share.prize_payout_requested_at && !share.prize_paid_confirmed && (
                <div className="pl-2 pt-1.5 border-t border-amber-100/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Solicitud de confirmación de cobro enviada. Esperando respuesta del participante.</span>
                  </div>
                </div>
              )}

              {/* Botón para que el cotitular confirme la recepción de su premio */}
              {isMe &&
                share.role === 'PARTICIPANTE' &&
                share.status === 'ACEPTADA' &&
                prizeAmountCents > 0 &&
                !share.prize_paid_confirmed && (
                  <div className="pl-2 pt-2 border-t border-emerald-100">
                    <button
                      type="button"
                      onClick={() => handleConfirmPrizePayout(share.id)}
                      disabled={actionLoadingId === share.id}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-98 disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoadingId === share.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                      )}
                      <span>
                        Confirmar cobro recibido (
                        {((prizeAmountCents / 100) * (Number(share.percentage) / 100)).toLocaleString('es-ES', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        €)
                      </span>
                    </button>
                  </div>
                )}

              {/* Si la renuncia ya fue solicitada */}
              {share.waiver_requested && (
                <div className="pl-2 pt-1 border-t border-amber-100">
                  {isMe ? (
                    /* Participante viendo su propia renuncia solicitada */
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900 space-y-2">
                      <div className="flex items-start gap-1.5 text-xs">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Solicitud de renuncia recibida</p>
                          <p className="text-[11px] text-amber-800">
                            El propietario te solicita renunciar a este {share.percentage}%. Si aceptas, la cuota volverá al propietario.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRespondWaiver(share.id, true)}
                          disabled={actionLoadingId === share.id}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-emerald-700 active:scale-95 transition shadow-xs"
                        >
                          {actionLoadingId === share.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Aceptar y devolver</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRespondWaiver(share.id, false)}
                          disabled={actionLoadingId === share.id}
                          className="flex-1 py-1.5 px-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-gray-50 active:scale-95 transition"
                        >
                          <X className="h-3 w-3" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Propietario u otros viendo el aviso */
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                      <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>Solicitud de renuncia enviada. Esperando respuesta del participante.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botón de renuncia voluntaria para el participante autenticado */}
              {isMe &&
                share.role === 'PARTICIPANTE' &&
                share.status === 'ACEPTADA' &&
                ticketStatus !== 'LIQUIDADO' &&
                !(ticketStatus === 'VALIDADO' && prizeAmountCents > 0) &&
                !share.waiver_requested && (
                  <div className="pl-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-medium">
                      ¿Ya no deseas tu participación?
                    </span>
                    <button
                      type="button"
                      onClick={() => setRenouncingShare(share)}
                      disabled={actionLoadingId === share.id}
                      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-xl text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 active:scale-95 transition shadow-xs cursor-pointer"
                      title="Renunciar voluntariamente a mi participación"
                    >
                      <LogOut className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span>Renunciar a mi participación</span>
                    </button>
                  </div>
                )}
            </div>
          )
        })}

        {/* Participantes que han renunciado formalmente a su cuota */}
        {renouncedShares.map((share) => {
          const isMe = share.user_id === user?.id
          const shareDisplayName =
            share.profiles?.display_name || (isMe ? 'Tú (Renunciado)' : 'Cotitular (Renunciado)')

          return (
            <div
              key={share.id}
              className="bg-gray-50/80 border border-gray-200/70 rounded-2xl p-3.5 relative shadow-xs opacity-75"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-xs">
                    {share.profiles?.avatar_url ? (
                      <img
                        src={share.profiles.avatar_url}
                        alt="Avatar"
                        className="w-full h-full rounded-full object-cover grayscale"
                      />
                    ) : (
                      <span>{shareDisplayName.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">{shareDisplayName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-gray-200 text-gray-600 uppercase">
                        Renunciada
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium mt-0.5">
                      <span>0% · Renuncia formal registrada en auditoría</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-base font-extrabold font-mono text-gray-400">
                    0%
                  </span>
                  <p className="text-[10px] text-gray-400 font-mono">0,00 €</p>
                </div>
              </div>
            </div>
          )
        })}

        {/* 4. Invitaciones Pendientes (Exclusivo para el Propietario) */}
        {isOwner && activePendingInvites.map((invite) => (
          <div
            key={invite.id}
            className="bg-amber-50/60 border border-dashed border-amber-300 rounded-2xl p-3.5 relative overflow-hidden shadow-xs space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {invite.label || 'Invitación pendiente'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                    Pendiente
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-mono">
                  <span>CÓDIGO:</span>
                  <strong className="tracking-widest bg-white px-1.5 py-0.5 rounded border border-amber-200">
                    {invite.short_code}
                  </strong>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-extrabold font-mono text-amber-800">
                  {invite.percentage}%
                </span>
                <p className="text-[10px] text-amber-600 font-mono">
                  {((Number(invite.percentage) / 100) * 20).toFixed(2)} €
                </p>
              </div>
            </div>

            {/* Acciones de la invitación */}
            <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
              <button
                type="button"
                onClick={() => setActiveShareInvite(invite)}
                className="flex-1 py-1.5 px-2 bg-white border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-50 active:scale-95 transition shadow-xs"
              >
                <QrCode className="h-3.5 w-3.5 text-amber-700" />
                <Share2 className="h-3.5 w-3.5 text-amber-700" />
                <span>Ver QR / Compartir</span>
              </button>

              {isOwner && ticketStatus !== 'LIQUIDADO' && (
                <button
                  type="button"
                  onClick={() => handleCancelInvite(invite.id)}
                  disabled={actionLoadingId === invite.id}
                  className="py-1.5 px-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition"
                  title="Eliminar invitación y recuperar cuota"
                >
                  {actionLoadingId === invite.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Botón para cancelar todas las invitaciones pendientes en bloque */}
        {isOwner && activePendingInvites.length >= 2 && ticketStatus !== 'LIQUIDADO' && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleCancelAllPendingInvites}
              disabled={actionLoadingId === 'all-pending'}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100 text-xs font-semibold active:scale-95 transition shadow-xs"
            >
              {actionLoadingId === 'all-pending' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              )}
              <span>Cancelar todas las pendientes (recuperar {totalPendingPct}%)</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal / Bottom Sheet para crear participaciones */}
      <CreateParticipationSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        ticketId={ticketId}
        ticketNumber={ticketNumber}
        drawName={drawName}
        availablePercentage={ownerPct}
        onInviteCreated={async (newInvite) => {
          setShowCreateSheet(false)
          await onRefresh()
          setActiveShareInvite({
            id: newInvite.id,
            short_code: newInvite.short_code,
            invite_token: newInvite.invite_token,
            percentage: newInvite.percentage,
            label: newInvite.label || null,
            ticket_id: ticketId,
            status: 'PENDIENTE',
            created_by: user?.id || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            accepted_at: null,
            accepted_by_user_id: null,
          })
        }}
        onEqualSplitComplete={async () => {
          setShowCreateSheet(false)
          await onRefresh()
        }}
      />

      {/* Modal para ver QR y compartir invitación existente */}
      <ShareInviteModal
        isOpen={!!activeShareInvite}
        onClose={() => setActiveShareInvite(null)}
        invite={
          activeShareInvite
            ? {
                id: activeShareInvite.id,
                short_code: activeShareInvite.short_code,
                invite_token: activeShareInvite.invite_token,
                percentage: Number(activeShareInvite.percentage),
                label: activeShareInvite.label,
                ticketNumber,
                drawName,
              }
            : null
        }
      />

      {/* Modal de confirmación de renuncia voluntaria (z-50) */}
      {renouncingShare && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Cabecera con icono */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  ¿Renunciar a tu participación?
                </h3>
                <p className="text-[11px] text-gray-500">
                  Décimo #{ticketNumber} · {drawName}
                </p>
              </div>
            </div>

            {/* Explicación legal y de negocio */}
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3.5 text-xs text-rose-950 space-y-2">
              <p className="leading-relaxed">
                Vas a renunciar voluntariamente a tu participación del{' '}
                <span className="font-extrabold text-rose-900">
                  {renouncingShare.percentage}% (
                  {((Number(renouncingShare.percentage) / 100) * 20).toFixed(2)} €
                </span>
                ). Esta cuota volverá automáticamente al propietario del décimo y quedará registrada
                en el historial de auditoría.
              </p>
              <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                <span>Esta acción no se puede deshacer.</span>
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenouncingShare(null)}
                disabled={isRenouncing}
                className="flex-1 py-2.5 px-3 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmVoluntaryWaiver}
                disabled={isRenouncing}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isRenouncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Renunciando...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 text-white" />
                    <span>Sí, renunciar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
