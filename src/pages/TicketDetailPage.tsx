import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RealisticTicketCard } from '../components/tickets/RealisticTicketCard'
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
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']
type DrawTemplate = Database['public']['Tables']['draw_templates']['Row']
type OwnershipShare = Database['public']['Tables']['ownership_shares']['Row']
type AuditEvent = Database['public']['Tables']['audit_events']['Row']

export interface TicketDetailPageProps {
  ticketId: string
  onBack: () => void
}

export const TicketDetailPage: React.FC<TicketDetailPageProps> = ({
  ticketId,
  onBack,
}) => {
  const { user } = useAuth()

  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [template, setTemplate] = useState<DrawTemplate | null>(null)
  const [shares, setShares] = useState<OwnershipShare[]>([])
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

      // 2. Cargar plantilla si tiene template_id
      if (ticketData.template_id) {
        const { data: tplData } = await supabase
          .from('draw_templates')
          .select('*')
          .eq('id', ticketData.template_id)
          .single()
        setTemplate(tplData)
      }

      // 3. Cargar participaciones (ownership_shares)
      const { data: sharesData } = await supabase
        .from('ownership_shares')
        .select('*')
        .eq('ticket_id', ticketId)

      setShares(sharesData || [])

      // 4. Cargar eventos de auditoría
      const { data: auditData } = await supabase
        .from('audit_events')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      setAuditEvents(auditData || [])

      // 5. Comprobar si está archivado por el usuario actual
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
        { event: '*', schema: 'public', table: 'audit_events', filter: `ticket_id=eq.${ticketId}` },
        () => loadTicketDetails()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, loadTicketDetails])

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
      onBack()
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
      <div className="text-center py-12 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Décimo no encontrado.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-lottery text-white text-xs font-semibold"
        >
          Volver a la lista
        </button>
      </div>
    )
  }

  const isOwner = ticket.owner_id === user?.id
  const hasAcceptedThirdPartyShares = shares.some(
    (s) => s.user_id !== user?.id && s.status === 'ACEPTADA'
  )

  return (
    <div className="space-y-6 pb-16 max-w-xl mx-auto">
      {/* 1. Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
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

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase tracking-wider bg-lottery-50 text-lottery border-lottery-200">
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

      {/* 3. Acciones del Décimo */}
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

        {isOwner && !hasAcceptedThirdPartyShares && ticket.status === 'PENDIENTE' && (
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
      <div className="space-y-3 pt-2">
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
            <span>Propiedad y Reparto ({shares.length})</span>
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
            <span>Historial de Auditoría ({auditEvents.length})</span>
          </button>
        </div>

        {activeTab === 'propiedad' ? (
          <div className="space-y-3">
            <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm divide-y divide-gray-100">
              {shares.map((share) => (
                <div key={share.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">
                        {share.user_id === user?.id ? 'Tú' : 'Cotitular'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {share.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono">
                      Estado: {share.status}
                    </p>
                  </div>

                  <span className="text-sm font-extrabold font-mono text-lottery bg-lottery-50 px-2.5 py-1 rounded-xl">
                    {share.percentage}%
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-center text-gray-400">
              El reparto a partes iguales y solicitudes de renuncia se activarán en la Fase 4.
            </p>
          </div>
        ) : (
          /* Pestaña: Historial */
          <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm divide-y divide-gray-100">
            {auditEvents.length === 0 ? (
              <p className="text-xs text-center text-gray-400 py-4">Sin eventos registrados</p>
            ) : (
              auditEvents.map((evt) => (
                <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-lottery bg-lottery-50 px-2 py-0.5 rounded text-[10px]">
                      {evt.action}
                    </span>
                    {evt.percentage !== null && (
                      <p className="text-[11px] text-gray-600 pt-0.5">
                        Cuota: {evt.percentage}%
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(evt.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
