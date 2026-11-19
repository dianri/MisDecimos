import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TicketListItemCard } from '../components/tickets/TicketListItemCard'
import { TicketFormModal } from '../components/tickets/TicketFormModal'
import { InviteClaimModal } from '../components/tickets/InviteClaimModal'
import { BarcodeScannerModal } from '../components/tickets/BarcodeScannerModal'
import { parseSelaeBarcode, type SelaeParsedTicket } from '../lib/selaeBarcodeParser'
import { classifyScannedPayload } from '../lib/scanPayloadClassifier'
import {
  classifyUserTickets,
  type UserTicketListsAndMetrics,
} from '../lib/ticketMetrics'
import {
  Ticket,
  KeyRound,
  QrCode,
  Users,
  Archive,
  Loader2,
  Camera,
  CheckCircle2,
  X,
} from 'lucide-react'

export interface TicketsPageProps {
  onSelectTicket?: (ticketId: string) => void
}

export const TicketsPage: React.FC<TicketsPageProps> = ({
  onSelectTicket,
}) => {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'decimos' | 'participaciones' | 'archivados'>('decimos')
  const [ticketLists, setTicketLists] = useState<UserTicketListsAndMetrics>(() =>
    classifyUserTickets([], [], new Set(), '')
  )
  const [isLoading, setIsLoading] = useState(true)

  // Modales
  const [isAddTicketOpen, setIsAddTicketOpen] = useState(false)
  const [addTicketInitialTab, setAddTicketInitialTab] = useState<'scanner' | 'manual'>('manual')
  const [isTicketScannerOpen, setIsTicketScannerOpen] = useState(false)
  const [scannedTicketData, setScannedTicketData] = useState<SelaeParsedTicket | null>(null)
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [claimInitialCode, setClaimInitialCode] = useState<string | null>(null)
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false)
  const [claimToastMsg, setClaimToastMsg] = useState<string | null>(null)

  // Auto-cierre del toast de confirmación tras 5 segundos
  useEffect(() => {
    if (!claimToastMsg) return
    const timer = setTimeout(() => {
      setClaimToastMsg(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [claimToastMsg])

  // Manejar escaneo inteligente unificado (décimos 1D o invitaciones QR)
  const handleUnifiedBarcodeScanned = (rawCode: string) => {
    setIsTicketScannerOpen(false)
    setIsQrScannerOpen(false)

    const classified = classifyScannedPayload(rawCode)
    if (classified.kind === 'INVITE') {
      setClaimInitialCode(classified.inviteCodeOrToken)
      setIsClaimModalOpen(true)
    } else if (classified.kind === 'TICKET') {
      setScannedTicketData(classified.parsed)
      setAddTicketInitialTab('manual')
      setIsAddTicketOpen(true)
    } else {
      const parsed = parseSelaeBarcode(rawCode)
      setScannedTicketData(parsed)
      setAddTicketInitialTab('manual')
      setIsAddTicketOpen(true)
    }
  }

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

      const metrics = classifyUserTickets(
        ticketsData || [],
        sharesData || [],
        archivedTicketIds,
        user.id
      )

      setTicketLists(metrics)
    } catch (err) {
      console.error('Error cargando billetes:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadTickets()

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
  }, [loadTickets])

  // Listas y métricas extraídas del clasificador reactivo
  const {
    misDecimos,
    misParticipaciones,
    misArchivados,
    totalActivosCount,
    totalPremiosGanados,
  } = ticketLists

  const handleTicketClick = (ticketId: string) => {
    if (onSelectTicket) {
      onSelectTicket(ticketId)
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      {/* 1. Tarjeta Resumen Superior */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
            Mis Billetes Compartidos
          </h2>
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
              className="flex-1 min-h-[54px] flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-white border-2 border-lottery text-lottery hover:bg-lottery-50 active:scale-[0.98] transition font-bold text-xs shadow-xs"
            >
              <Ticket className="h-4.5 w-4.5 text-lottery shrink-0" />
              <span>Añadir décimo manual</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScannedTicketData(null)
                setIsTicketScannerOpen(true)
              }}
              aria-label="Escanear décimo con cámara"
              title="Escanear décimo con cámara"
              className="w-[54px] min-h-[54px] aspect-square shrink-0 flex items-center justify-center rounded-2xl bg-[#2E6146] hover:bg-[#244d37] active:scale-[0.98] text-white shadow-md shadow-lottery/25 transition"
            >
              <Camera className="w-6 h-6 text-white" size={24} strokeWidth={2.2} />
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
        initialScannedData={scannedTicketData}
        onClose={() => {
          setIsAddTicketOpen(false)
          setScannedTicketData(null)
        }}
        onCreated={(newTicketId) => {
          loadTickets()
          if (onSelectTicket) onSelectTicket(newTicketId)
        }}
        onInviteScanned={(inviteCode) => {
          setClaimInitialCode(inviteCode)
          setIsClaimModalOpen(true)
        }}
      />

      {/* Escáner de décimo abierto desde el botón rápido verde */}
      <BarcodeScannerModal
        isOpen={isTicketScannerOpen}
        mode="TICKET_BARCODE"
        onClose={() => setIsTicketScannerOpen(false)}
        onScanSuccess={handleUnifiedBarcodeScanned}
      />

      <InviteClaimModal
        isOpen={isClaimModalOpen}
        initialCode={claimInitialCode}
        initialInviteCode={claimInitialCode}
        onClose={() => {
          setIsClaimModalOpen(false)
          setClaimInitialCode(null)
        }}
        onClaimed={(_ticketId, percentage) => {
          loadTickets()
          const pctText = percentage ? ` del ${percentage}%` : ''
          setClaimToastMsg(`¡Participación${pctText} añadida a tus billetes!`)
        }}
        onRejected={() => {
          loadTickets()
          setClaimToastMsg('Invitación rechazada. El porcentaje ha regresado a la cuota del propietario.')
        }}
      />

      <BarcodeScannerModal
        isOpen={isQrScannerOpen}
        mode="INVITE_QR"
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={handleUnifiedBarcodeScanned}
      />

      {/* Toast informativo al reclamar o rechazar participación */}
      {claimToastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 inset-x-4 max-w-sm mx-auto z-50 px-4 py-3 bg-emerald-800 text-white text-xs font-semibold rounded-2xl shadow-2xl border border-emerald-600 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>{claimToastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setClaimToastMsg(null)}
            className="p-1 text-emerald-200 hover:text-white transition cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
