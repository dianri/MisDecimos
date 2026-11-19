import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RealisticTicketCard } from '../components/tickets/RealisticTicketCard'
import {
  OwnershipBreakdownCard,
  type OwnershipShare,
  type PendingInvite,
} from '../components/tickets/OwnershipBreakdownCard'
import {
  TicketAuditTimeline,
  type AuditEvent,
} from '../components/tickets/TicketAuditTimeline'
import { PrizeCheckCard } from '../components/tickets/PrizeCheckCard'
import type { Database } from '../types/database.types'
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Trash2,
  Lock,
  Users,
  Shield,
  Loader2,
  Calendar,
  Barcode,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']
type DrawTemplate = Database['public']['Tables']['draw_templates']['Row']

export interface TicketDetailPageProps {
  ticketId: string
  onBack: () => void
  onNavigateToRoot?: (tab?: 'decimos' | 'participaciones' | 'archivados') => void
}

export const TicketDetailPage: React.FC<TicketDetailPageProps> = ({
  ticketId,
  onBack,
  onNavigateToRoot,
}) => {
  const { user } = useAuth()

  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [template, setTemplate] = useState<DrawTemplate | null>(null)
  const [shares, setShares] = useState<OwnershipShare[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [isArchived, setIsArchived] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'propiedad' | 'historial'>('propiedad')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const loadTicketDetails = useCallback(async () => {
    if (!ticketId || !user?.id) return

    try {
      setIsLoading(true)

      // 1. Cargar datos del billete
      const { data: ticketData, error: ticketErr } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single()

      if (ticketErr) throw ticketErr
      setTicket(ticketData)

      // Si se accedió por entrada directa, marcar el fallback según si es cotitular o propietario
      if (typeof window !== 'undefined' && window.history.state?.isDirectEntry) {
        const isParticipant = ticketData.owner_id !== user.id
        window.history.replaceState(
          {
            ...window.history.state,
            directFallbackTab: isParticipant ? 'participaciones' : 'decimos',
          },
          '',
          window.location.href
        )
      }

      // 2. Cargar plantilla si tiene template_id
      if (ticketData.template_id) {
        const { data: tplData } = await supabase
          .from('draw_templates')
          .select('*')
          .eq('id', ticketData.template_id)
          .single()
        setTemplate(tplData)
      }

      // 3. Cargar participaciones (ownership_shares con perfiles)
      const { data: sharesData, error: sharesErr } = await supabase
        .from('ownership_shares')
        .select('*, profiles:profiles!ownership_shares_user_id_fkey(id, display_name, avatar_url, email)')
        .eq('ticket_id', ticketId)

      if (sharesErr) console.error('Error cargando participaciones:', sharesErr)
      setShares((sharesData as unknown as OwnershipShare[]) || [])

      // 4. Cargar invitaciones pendientes (pending_invites) exclusivamente si el usuario es el propietario
      const isTicketOwner = ticketData.owner_id === user.id
      if (isTicketOwner) {
        const { data: invitesData, error: invitesErr } = await supabase
          .from('pending_invites')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true })

        if (invitesErr) console.error('Error cargando invitaciones pendientes:', invitesErr)
        setPendingInvites(invitesData || [])
      } else {
        setPendingInvites([])
      }

      // 5. Cargar eventos de auditoría con perfil del actor
      const { data: auditData, error: auditErr } = await supabase
        .from('audit_events')
        .select('*, actor:profiles!audit_events_actor_id_fkey(display_name, email, avatar_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (auditErr) console.error('Error cargando eventos de auditoría:', auditErr)
      setAuditEvents((auditData as unknown as AuditEvent[]) || [])

      // 6. Comprobar si está archivado por el usuario actual
      const { data: hideData } = await supabase
        .from('ticket_archive_hides')
        .select('ticket_id')
        .eq('ticket_id', ticketId)
        .eq('user_id', user.id)
        .maybeSingle()

      setIsArchived(!!hideData || ticketData.status === 'ARCHIVADO')
    } catch (err: unknown) {
      console.error('Error al cargar detalle del décimo:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al cargar los datos del décimo.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [ticketId, user?.id])

  useEffect(() => {
    loadTicketDetails()

    // Suscripción Realtime a cambios de este décimo
    const channel = supabase
      .channel(`ticket-detail-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ownership_shares', filter: `ticket_id=eq.${ticketId}` },
        () => loadTicketDetails()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_invites', filter: `ticket_id=eq.${ticketId}` },
        () => loadTicketDetails()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_events', filter: `ticket_id=eq.${ticketId}` },
        () => loadTicketDetails()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        () => loadTicketDetails()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, loadTicketDetails])

  // Navegación hacia atrás respetando el historial o derivando según rol en entradas directas
  const handleBack = useCallback(() => {
    // 1. Si existe historial interno de navegación dentro de la app (idx > 0)
    const historyState = typeof window !== 'undefined' ? window.history.state : null
    const historyIdx = historyState?.idx
    const isDirectEntry = Boolean(historyState?.isDirectEntry)

    if (typeof historyIdx === 'number' && historyIdx > 0 && !isDirectEntry) {
      if (onBack) {
        onBack()
      } else if (typeof window !== 'undefined') {
        window.history.back()
      }
      return
    }

    // 2. Si se abrió directamente sin historial previo (notificación Push o enlace directo)
    const isParticipant = Boolean(ticket && user?.id && ticket.owner_id !== user.id)
    const targetTab: 'decimos' | 'participaciones' = isParticipant ? 'participaciones' : 'decimos'

    if (onNavigateToRoot) {
      onNavigateToRoot(targetTab)
    } else if (onBack) {
      onBack()
    } else if (typeof window !== 'undefined') {
      const search = targetTab === 'participaciones' ? '?tab=participaciones' : ''
      window.location.href = `/${search}`
    }
  }, [ticket, user?.id, onBack, onNavigateToRoot])

  // Archivar o Desarchivar
  const handleToggleArchive = async () => {
    if (!ticket || isActionLoading) return
    setIsActionLoading(true)
    setStatusMsg(null)

    try {
      const nextArchive = !isArchived
      const { error } = await supabase.rpc('toggle_archive_ticket', {
        p_ticket_id: ticket.id,
        p_archive: nextArchive,
      })

      if (error) throw error

      setIsArchived(nextArchive)
      setStatusMsg({
        type: 'success',
        text: nextArchive ? 'Décimo archivado en tu cuenta.' : 'Décimo desarchivado.',
      })
    } catch (err: unknown) {
      console.error('Error conmutando archivo:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al actualizar el estado de archivo.',
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  // Eliminar décimo (Solo si no tiene participaciones aceptadas de terceros)
  const handleDeleteTicket = async () => {
    if (!ticket) return
    if (!confirm('¿Estás seguro de que deseas eliminar este décimo? Esta acción no se puede deshacer.')) {
      return
    }

    setIsActionLoading(true)
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticket.id)
      if (error) throw error
      handleBack()
    } catch (err: unknown) {
      console.error('Error eliminando décimo:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo eliminar el décimo.',
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-7 w-7 animate-spin text-lottery" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12 px-4 space-y-4 max-w-sm mx-auto">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <div>
          <h3 className="text-sm font-bold text-gray-800">Décimo no encontrado</h3>
          <p className="text-xs text-gray-500 mt-1">
            {statusMsg?.type === 'error'
              ? statusMsg.text
              : 'No se ha podido localizar el décimo o no tienes permisos para acceder a él.'}
          </p>
        </div>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lottery text-white text-xs font-semibold shadow hover:bg-lottery-600 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a la lista
        </button>
      </div>
    )
  }

  const isOwner = ticket.owner_id === user?.id
  const userShare = shares.find((s) => s.user_id === user?.id)
  const hasAcceptedThirdPartyShares = shares.some(
    (s) => s.user_id !== user?.id && s.status === 'ACEPTADA'
  )

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'LIQUIDADO':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300'
      case 'VALIDADO':
        return 'bg-amber-50 text-amber-800 border-amber-300'
      case 'ARCHIVADO':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      default:
        return 'bg-lottery-50 text-lottery border-lottery-200'
    }
  }

  return (
    <div className="space-y-6 pb-16 max-w-xl mx-auto">
      {/* 1. Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-2xl bg-white border border-gray-200/80 text-gray-700 hover:bg-gray-50 active:scale-95 transition shadow-xs"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
              Detalles del Décimo
            </h2>
            <p className="text-[11px] text-gray-500">#{ticket.number} · {ticket.draw_name}</p>
          </div>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase tracking-wider ${getStatusBadgeStyle(
            ticket.status
          )}`}
        >
          {ticket.status}
        </span>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-2xl text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 2. Tarjeta Realista del Boleto */}
      <div className="space-y-3">
        <RealisticTicketCard ticket={ticket} template={template} variant="full" />

        {/* Fila inferior de metadatos */}
        <div className="flex items-center justify-between text-xs px-2 text-gray-500">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span>FECHA SORTEO: <strong className="text-gray-800">{ticket.draw_date}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-lottery text-[11px]">
            <Barcode className="h-3.5 w-3.5" />
            <span>ORIGEN: {ticket.origin === 'BARCODE_GS1' ? 'Escáner GS1-128' : 'Manual'}</span>
          </div>
        </div>
      </div>

      {/* 3. Tarjeta de Comprobación Oficial de Premios */}
      <PrizeCheckCard
        ticket={ticket}
        userShare={userShare}
        shares={shares}
        isOwner={isOwner}
        onRefresh={loadTicketDetails}
      />

      {/* 4. Acciones del Décimo */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleToggleArchive}
          disabled={isActionLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 active:scale-98 transition shadow-xs"
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="h-4 w-4 text-lottery" />
              <span>Desarchivar billete</span>
            </>
          ) : (
            <>
              <Archive className="h-4 w-4 text-lottery" />
              <span>Archivar billete</span>
            </>
          )}
        </button>

        {isOwner && !hasAcceptedThirdPartyShares && ticket.status !== 'LIQUIDADO' && (
          <button
            type="button"
            onClick={handleDeleteTicket}
            disabled={isActionLoading}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 active:scale-98 transition"
            title="Eliminar décimo"
          >
            <Trash2 className="h-4 w-4" />
            <span>Eliminar</span>
          </button>
        )}
      </div>

      {/* Aviso de seguridad si tiene cotitulares activos */}
      {hasAcceptedThirdPartyShares && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
          <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Protección de cotitulares:</strong> Este décimo cuenta con participaciones aceptadas por terceros. El número y datos del sorteo están bloqueados e inmutables para salvaguardar los derechos de todos los participantes.
          </p>
        </div>
      )}

      {/* 4. Pestañas de PROPIEDAD e HISTORIAL */}
      <div className="space-y-4 pt-2">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('propiedad')}
            className={`flex items-center gap-1.5 pb-2.5 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'propiedad'
                ? 'border-lottery text-lottery'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              Propiedad y Reparto ({shares.length + pendingInvites.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-1.5 pb-2.5 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'historial'
                ? 'border-lottery text-lottery'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Historial ({auditEvents.length})</span>
          </button>
        </div>

        {activeTab === 'propiedad' ? (
          <OwnershipBreakdownCard
            ticketId={ticket.id}
            ticketNumber={ticket.number}
            drawName={ticket.draw_name}
            ticketStatus={ticket.status}
            prizeAmountCents={ticket.prize_amount_cents}
            isOwner={isOwner}
            shares={shares}
            pendingInvites={pendingInvites}
            onRefresh={loadTicketDetails}
          />
        ) : (
          <TicketAuditTimeline
            events={auditEvents}
            onRefresh={loadTicketDetails}
          />
        )}
      </div>
    </div>
  )
}
