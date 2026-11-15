import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
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
  UserPlus,
  Loader2,
  ShieldCheck,
  Clock,
} from 'lucide-react'

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
  isOwner: boolean
  shares: OwnershipShare[]
  pendingInvites: PendingInvite[]
  onRefresh: () => Promise<void>
}

const BLUE_PALETTE = ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD']

export const OwnershipBreakdownCard: React.FC<OwnershipBreakdownCardProps> = ({
  ticketId,
  ticketNumber,
  drawName,
  ticketStatus,
  isOwner,
  shares,
  pendingInvites,
  onRefresh,
}) => {
  const { user } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modales
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [activeShareInvite, setActiveShareInvite] = useState<PendingInvite | null>(null)
  const [activeMenuShareId, setActiveMenuShareId] = useState<string | null>(null)

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

  // Cálculo para el Donut Chart SVG
  const ownerShare = shares.find((s) => s.role === 'PROPIETARIO' && s.status === 'ACEPTADA')
  const participantShares = shares.filter((s) => s.role === 'PARTICIPANTE' && s.status === 'ACEPTADA')
  const activePendingInvites = pendingInvites.filter((i) => i.status === 'PENDIENTE')

  const ownerPct = ownerShare ? Number(ownerShare.percentage) : 0
  const totalAllocated =
    shares.reduce((acc, s) => acc + (s.status === 'ACEPTADA' ? Number(s.percentage) : 0), 0) +
    activePendingInvites.reduce((acc, i) => acc + Number(i.percentage), 0)

  // Geometría del Donut SVG
  const radius = 38
  const circumference = 2 * Math.PI * radius // ~238.76

  // Segmentos del anillo
  let cumulativePct = 0
  const segments: Array<{
    id: string
    color: string
    percentage: number
    strokeDasharray: string
    strokeDashoffset: number
    isDashed: boolean
  }> = []

  // 1. Propietario (Verde)
  if (ownerPct > 0) {
    const length = (ownerPct / 100) * circumference
    segments.push({
      id: 'owner',
      color: '#2E6146',
      percentage: ownerPct,
      strokeDasharray: `${length} ${circumference - length}`,
      strokeDashoffset: -((cumulativePct / 100) * circumference),
      isDashed: false,
    })
    cumulativePct += ownerPct
  }

  // 2. Participantes aceptados (Azules)
  participantShares.forEach((share, idx) => {
    const pct = Number(share.percentage)
    if (pct > 0) {
      const length = (pct / 100) * circumference
      segments.push({
        id: `share-${share.id}`,
        color: BLUE_PALETTE[idx % BLUE_PALETTE.length],
        percentage: pct,
        strokeDasharray: `${length} ${circumference - length}`,
        strokeDashoffset: -((cumulativePct / 100) * circumference),
        isDashed: false,
      })
      cumulativePct += pct
    }
  })

  // 3. Invitaciones pendientes (Ámbar discontinuo)
  activePendingInvites.forEach((invite) => {
    const pct = Number(invite.percentage)
    if (pct > 0) {
      const length = (pct / 100) * circumference
      segments.push({
        id: `invite-${invite.id}`,
        color: '#D97706',
        percentage: pct,
        strokeDasharray: `${length} ${circumference - length}`,
        strokeDashoffset: -((cumulativePct / 100) * circumference),
        isDashed: true,
      })
      cumulativePct += pct
    }
  })

  return (
    <div className="space-y-5">
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

      {/* 2. Gráfico Donut SVG */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col items-center justify-center">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Pista de fondo */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-gray-100"
              strokeWidth="9"
              stroke="currentColor"
              fill="transparent"
            />

            {/* Segmentos del Donut */}
            {segments.map((seg) => (
              <circle
                key={seg.id}
                cx="50"
                cy="50"
                r={radius}
                stroke={seg.color}
                strokeWidth="9"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="butt"
                strokeDashoffset-transition="all 0.5s ease"
                strokeDasharray-transition="all 0.5s ease"
                strokeDasharray-offset={seg.isDashed ? '4, 2' : undefined}
                fill="transparent"
                style={{
                  transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease',
                  strokeDasharray: seg.isDashed ? '4 2' : seg.strokeDasharray,
                }}
              />
            ))}
          </svg>

          {/* Texto Central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-2xl font-black text-lottery tracking-tight">
              {Math.round(totalAllocated)}%
            </span>
            <span className="text-[11px] font-bold text-lottery uppercase tracking-wider">
              Distribuido
            </span>
            <span className="text-[9px] text-gray-400 font-medium">
              Propiedad Distribuida
            </span>
          </div>
        </div>

        {/* Leyenda Visual */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-[11px] font-medium text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E6146]" />
            <span>Propietario ({ownerPct}%)</span>
          </div>

          {participantShares.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              <span>
                Cotitulares (
                {participantShares.reduce((a, b) => a + Number(b.percentage), 0)}%)
              </span>
            </div>
          )}

          {activePendingInvites.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] border border-amber-300" />
              <span>
                Pendientes (
                {activePendingInvites.reduce((a, b) => a + Number(b.percentage), 0)}%)
              </span>
            </div>
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
                  <span>ACEPTADA · Custodio físico</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-base font-extrabold font-mono text-lottery">
                {ownerShare.percentage}%
              </span>
              <p className="text-[10px] text-gray-500 font-mono">
                {((Number(ownerShare.percentage) / 100) * 20).toFixed(2)} €
              </p>
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
              className="bg-white border border-gray-200/80 rounded-2xl p-3.5 relative overflow-hidden shadow-xs space-y-2"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2563EB]" />

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
                    <p className="text-[10px] text-gray-400 font-mono">
                      {((Number(share.percentage) / 100) * 20).toFixed(2)} €
                    </p>
                  </div>

                  {/* Menú de acciones para el Propietario (Solicitar Renuncia) */}
                  {isOwner && !share.waiver_requested && ticketStatus === 'PENDIENTE' && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuShareId(
                            activeMenuShareId === share.id ? null : share.id
                          )
                        }
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        title="Opciones"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {activeMenuShareId === share.id && (
                        <div className="absolute right-0 top-7 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 text-xs">
                          <button
                            type="button"
                            onClick={() => handleRequestWaiver(share.id)}
                            disabled={actionLoadingId === share.id}
                            className="w-full text-left px-3 py-2 text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                            <span>Solicitar renuncia</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

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
            </div>
          )
        })}

        {/* 4. Invitaciones Pendientes */}
        {activePendingInvites.map((invite) => (
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

              {isOwner && ticketStatus === 'PENDIENTE' && (
                <button
                  type="button"
                  onClick={() => handleCancelInvite(invite.id)}
                  disabled={actionLoadingId === invite.id}
                  className="py-1.5 px-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 hover:bg-rose-100 active:scale-95 transition"
                  title="Cancelar invitación y recuperar cuota"
                >
                  {actionLoadingId === invite.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Cancelar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 5. Botón Inferior: "Añadir participación" */}
      {isOwner && ticketStatus === 'PENDIENTE' && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowCreateSheet(true)}
            disabled={ownerPct <= 0}
            className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-98 ${
              ownerPct > 0
                ? 'bg-lottery hover:bg-lottery-dark text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>
              {ownerPct > 0
                ? `Añadir participación (hasta ${ownerPct}% disponible)`
                : '100% de la propiedad distribuida'}
            </span>
          </button>
        </div>
      )}

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
    </div>
  )
}
