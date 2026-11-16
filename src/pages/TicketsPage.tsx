import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TicketListItemCard } from '../components/tickets/TicketListItemCard'
import { TicketFormModal } from '../components/tickets/TicketFormModal'
import { InviteClaimModal } from '../components/tickets/InviteClaimModal'
import { BarcodeScannerModal } from '../components/tickets/BarcodeScannerModal'
import type { Database } from '../types/database.types'
import {
  Ticket,
  Bell,
  KeyRound,
  QrCode,
  Users,
  Archive,
  Loader2,
  Camera,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']

interface TicketItemWithMeta {
  ticket: TicketRow
  userPercentage: number
  participantsCount: number
  isOwner: boolean
  isArchived: boolean
}

export interface TicketsPageProps {
  onSelectTicket?: (ticketId: string) => void
  onNavigateToAlerts?: () => void
}

export const TicketsPage: React.FC<TicketsPageProps> = ({
  onSelectTicket,
  onNavigateToAlerts,
}) => {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'decimos' | 'participaciones' | 'archivados'>('decimos')
  const [ticketsWithMeta, setTicketsWithMeta] = useState<TicketItemWithMeta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Modales
  const [isAddTicketOpen, setIsAddTicketOpen] = useState(false)
  const [addTicketInitialTab, setAddTicketInitialTab] = useState<'scanner' | 'manual'>('manual')
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [claimInitialCode, setClaimInitialCode] = useState<string | null>(null)
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)

  // 1. Comprobar deep-link pendiente al montar
  useEffect(() => {
    const pending = sessionStorage.getItem('pending_invite_token')
    if (pending) {
      setClaimInitialCode(pending)
      setIsClaimModalOpen(true)
      sessionStorage.removeItem('pending_invite_token')
    }
  }, [])

  // 2. Cargar billetes y calcular cuotas
  const loadTickets = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)

      // Cargar décimos asociados al usuario
      const { data: ticketsData, error: ticketsErr } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (ticketsErr) throw ticketsErr

      // Cargar cuotas de titularidad
      const { data: sharesData, error: sharesErr } = await supabase
        .from('ownership_shares')
        .select('*')

      if (sharesErr) throw sharesErr

      // Cargar billetes archivados por el usuario
      const { data: hidesData } = await supabase
        .from('ticket_archive_hides')
        .select('ticket_id')
        .eq('user_id', user.id)

      const archivedTicketIds = new Set((hidesData || []).map((h) => h.ticket_id))

      // Ensamblar metadatos por billete
      const assembled: TicketItemWithMeta[] = (ticketsData || []).map((ticket) => {
        const ticketShares = (sharesData || []).filter((s) => s.ticket_id === ticket.id)
        const myShare = ticketShares.find((s) => s.user_id === user.id)
        const isOwner = ticket.owner_id === user.id
        const userPercentage = myShare ? Number(myShare.percentage) : isOwner ? 100 : 0
        const activeShares = ticketShares.filter((s) => s.status === 'ACEPTADA')
        const isArchived = archivedTicketIds.has(ticket.id) || ticket.status === 'ARCHIVADO'

        return {
          ticket,
          userPercentage,
          participantsCount: activeShares.length || 1,
          isOwner,
          isArchived,
        }
      })

      setTicketsWithMeta(assembled)
    } catch (err) {
      console.error('Error cargando billetes:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // 3. Consultar contador de alertas no leídas
  const checkAlerts = useCallback(async () => {
    if (!user?.id) return
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    } catch (e) {
      console.warn('Error al verificar alertas:', e)
    }
  }, [user?.id])

  useEffect(() => {
    loadTickets()
    checkAlerts()

    // Suscripción Realtime para actualizar al haber cambios en tickets o shares
    const channel = supabase
      .channel('tickets-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => loadTickets()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ownership_shares' },
        () => loadTickets()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTickets, checkAlerts])

  // Filtrado de listas
  const activeTickets = ticketsWithMeta.filter((t) => !t.isArchived)
  const misDecimos = activeTickets.filter((t) => t.isOwner)
  const misParticipaciones = activeTickets.filter((t) => !t.isOwner && t.userPercentage > 0)
  const misArchivados = ticketsWithMeta.filter((t) => t.isArchived)

  // Cálculo de totales para el cuadro de mando
  const totalActivosCount = activeTickets.length
  const totalPremiosGanados = activeTickets.reduce((acc, curr) => {
    if (curr.ticket.prize_amount_cents > 0) {
      const userPrizeCents = (curr.ticket.prize_amount_cents * curr.userPercentage) / 100
      return acc + userPrizeCents / 100
    }
    return acc
  }, 0)

  const handleTicketClick = (ticketId: string) => {
    if (onSelectTicket) {
      onSelectTicket(ticketId)
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      {/* 1. Tarjeta Resumen Superior */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
              Mis Billetes Compartidos
            </h2>
            <p className="text-[11px] text-gray-400 font-medium">
              MisDecimos · Trazabilidad Asegurada
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToAlerts}
            className="relative p-2.5 rounded-2xl bg-gray-50 border border-gray-200/80 text-gray-600 hover:text-lottery hover:bg-lottery-50 transition"
            title="Ver alertas"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
            )}
          </button>
        </div>

        {/* Dos recuadros métricos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F7F9F7] p-3.5 border border-gray-200/50 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              Billetes Activos
            </span>
            <p className="text-2xl font-extrabold font-mono text-lottery">
              {totalActivosCount}
            </p>
          </div>

          <div className="rounded-2xl bg-[#F7F9F7] p-3.5 border border-gray-200/50 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              Total Premios
            </span>
            <p className="text-2xl font-extrabold font-mono text-gold-600">
              {totalPremiosGanados.toLocaleString('es-ES', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{' '}
              €
            </p>
          </div>
        </div>
      </div>

      {/* 2. Bloques de Acción */}
      <div className="space-y-3">
        {/* Sección: AÑADIR UN DÉCIMO */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase px-1">
            Añadir un Décimo
          </span>
          <div className="flex items-stretch gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAddTicketInitialTab('manual')
                setIsAddTicketOpen(true)
              }}
              className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-lottery text-white text-xs font-bold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition"
            >
              <Ticket className="h-4 w-4" />
              <span>Añadir décimo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAddTicketInitialTab('scanner')
                setIsAddTicketOpen(true)
              }}
              aria-label="Escanear décimo con cámara"
              title="Escanear décimo con cámara"
              className="aspect-square shrink-0 flex items-center justify-center rounded-2xl bg-lottery-50 border border-lottery-200 text-lottery hover:bg-lottery-100 hover:text-lottery-700 hover:border-lottery-300 active:scale-95 transition shadow-sm"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sección: AÑADIR UNA PARTICIPACIÓN */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase px-1">
            Añadir una Participación
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setClaimInitialCode(null)
                setIsClaimModalOpen(true)
              }}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 hover:border-gray-300 shadow-xs active:scale-98 transition"
            >
              <KeyRound className="h-4 w-4 text-gold-600" />
              <span>Tengo un código</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 hover:border-gray-300 shadow-xs active:scale-98 transition"
            >
              <QrCode className="h-4 w-4 text-lottery" />
              <span>Escanear QR de invitación</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Pestañas de Filtrado */}
      <div className="space-y-3 pt-2">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('decimos')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'decimos'
                ? 'border-lottery text-lottery'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>Décimos ({misDecimos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('participaciones')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'participaciones'
                ? 'border-lottery text-lottery'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Participaciones ({misParticipaciones.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archivados')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'archivados'
                ? 'border-lottery text-lottery'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archivados ({misArchivados.length})</span>
          </button>
        </div>

        {/* 4. Listado de Billetes según Pestaña */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-lottery" />
          </div>
        ) : activeTab === 'decimos' ? (
          misDecimos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center space-y-2">
              <Ticket className="mx-auto w-10 h-10 text-gray-300" />
              <h3 className="text-sm font-bold text-gray-800">No tienes décimos propios</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Registra tu primer décimo con la cámara o introduciendo los datos manualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {misDecimos.map((item) => (
                <TicketListItemCard
                  key={item.ticket.id}
                  ticket={item.ticket}
                  userPercentage={item.userPercentage}
                  participantsCount={item.participantsCount}
                  isArchived={item.isArchived}
                  onClick={handleTicketClick}
                />
              ))}
            </div>
          )
        ) : activeTab === 'participaciones' ? (
          misParticipaciones.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Sin participaciones</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Aquí aparecerán los décimos en los que participas con otros propietarios.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {misParticipaciones.map((item) => (
                <TicketListItemCard
                  key={item.ticket.id}
                  ticket={item.ticket}
                  userPercentage={item.userPercentage}
                  participantsCount={item.participantsCount}
                  isArchived={item.isArchived}
                  onClick={handleTicketClick}
                />
              ))}
            </div>
          )
        ) : (
          /* Pestaña: Archivados */
          misArchivados.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center space-y-2">
              <Archive className="mx-auto w-10 h-10 text-gray-300" />
              <h3 className="text-sm font-bold text-gray-800">Sin billetes archivados</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Los décimos que decidas ocultar u archivar se mostrarán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {misArchivados.map((item) => (
                <TicketListItemCard
                  key={item.ticket.id}
                  ticket={item.ticket}
                  userPercentage={item.userPercentage}
                  participantsCount={item.participantsCount}
                  isArchived={true}
                  onClick={handleTicketClick}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modales */}
      <TicketFormModal
        isOpen={isAddTicketOpen}
        initialTab={addTicketInitialTab}
        onClose={() => setIsAddTicketOpen(false)}
        onCreated={(newTicketId) => {
          loadTickets()
          if (onSelectTicket) onSelectTicket(newTicketId)
        }}
      />

      <InviteClaimModal
        isOpen={isClaimModalOpen}
        initialCode={claimInitialCode}
        onClose={() => {
          setIsClaimModalOpen(false)
          setClaimInitialCode(null)
        }}
        onClaimed={(ticketId) => {
          loadTickets()
          if (onSelectTicket) onSelectTicket(ticketId)
        }}
      />

      <BarcodeScannerModal
        isOpen={isQrScannerOpen}
        mode="INVITE_QR"
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          setIsQrScannerOpen(false)
          // Si es URL https://.../invite/TOKEN extraer TOKEN
          const match = decodedText.match(/invite\/([a-zA-Z0-9_-]+)/)
          const token = match ? match[1] : decodedText
          setClaimInitialCode(token)
          setIsClaimModalOpen(true)
        }}
      />
    </div>
  )
}
