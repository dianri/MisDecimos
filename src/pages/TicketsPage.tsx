import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TicketListItemCard } from '../components/tickets/TicketListItemCard'
import { SwipeableTicketCard } from '../components/tickets/SwipeableTicketCard'
import { TicketFormModal } from '../components/tickets/TicketFormModal'
import { InviteClaimModal } from '../components/tickets/InviteClaimModal'
import { BarcodeScannerModal } from '../components/tickets/BarcodeScannerModal'
import { parseSelaeBarcode, type SelaeParsedTicket } from '../lib/selaeBarcodeParser'
import { classifyScannedPayload } from '../lib/scanPayloadClassifier'
import { useSearchParams } from '../hooks/useSearchParams'
import {
  classifyUserTickets,
  type UserTicketListsAndMetrics,
  type TicketRow,
} from '../lib/ticketMetrics'
import {
  resolveShareButtonNavigation,
  evaluateQuickPrizeCheckPrecondition,
  formatQuickPrizeCheckToast,
} from '../lib/cardQuickActions'
import { resolveScannerHaveCodeTransition } from '../lib/swipeCardState'
import { checkTicketPrize } from '../services/prizeService'
import {
  Ticket,
  Users,
  Archive,
  Loader2,
  Camera,
  CheckCircle2,
  CalendarClock,
  X,
} from 'lucide-react'

export interface TicketsPageProps {
  onSelectTicket?: (
    ticketId: string,
    options?: {
      state?: {
        fromTab?: string
        claimMessage?: string
        openCreateShare?: boolean
        [key: string]: unknown
      }
    }
  ) => void
}

export const TicketsPage: React.FC<TicketsPageProps> = ({
  onSelectTicket,
}) => {
  const { user } = useAuth()

  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const historyFromTab =
    typeof window !== 'undefined'
      ? (window.history.state as { fromTab?: string; subTab?: string } | null)?.fromTab
      : undefined

  const activeTab: 'decimos' | 'participaciones' | 'archivados' =
    tabParam === 'participaciones' || tabParam === 'archivados'
      ? tabParam
      : tabParam === 'decimos'
      ? 'decimos'
      : historyFromTab === 'participaciones' || historyFromTab === 'archivados'
      ? historyFromTab
      : 'decimos'

  const handleTabChange = (nextTab: 'decimos' | 'participaciones' | 'archivados') => {
    if (nextTab === 'decimos') {
      setSearchParams(
        {},
        { replace: true, state: { subTab: 'decimos', fromTab: 'decimos' } }
      )
    } else {
      setSearchParams(
        { tab: nextTab },
        { replace: true, state: { subTab: nextTab, fromTab: nextTab } }
      )
    }
  }
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
  const [toastVariant, setToastVariant] = useState<'success' | 'warning'>('success')
  const [pendingInviteTicketIds, setPendingInviteTicketIds] = useState<Set<string>>(new Set())
  const [checkingTicketId, setCheckingTicketId] = useState<string | null>(null)
  const [openSwipeTicketId, setOpenSwipeTicketId] = useState<string | null>(null)

  // Auto-cierre del toast de confirmación tras 5 segundos
  useEffect(() => {
    if (!claimToastMsg) return
    const timer = setTimeout(() => {
      setClaimToastMsg(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [claimToastMsg])

  // Captura de mensajes informativos/toasts procedentes del historial (ej. renuncia de participación)
  useEffect(() => {
    const toastFromState =
      typeof window !== 'undefined'
        ? (window.history.state as { toastMsg?: string; claimToastMsg?: string } | null)?.toastMsg ||
          (window.history.state as { toastMsg?: string; claimToastMsg?: string } | null)?.claimToastMsg
        : undefined

    if (toastFromState) {
      setClaimToastMsg(toastFromState)
      const nextState = { ...window.history.state }
      delete nextState.toastMsg
      delete nextState.claimToastMsg
      window.history.replaceState(nextState, '', window.location.href)
    }

    const handlePopState = (e: PopStateEvent) => {
      const msg = e.state?.toastMsg || e.state?.claimToastMsg
      if (msg) {
        setClaimToastMsg(msg)
        const nextState = { ...e.state }
        delete nextState.toastMsg
        delete nextState.claimToastMsg
        window.history.replaceState(nextState, '', window.location.href)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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

      // Cargar décimos archivados por el usuario
      const { data: hidesData } = await supabase
        .from('ticket_archive_hides')
        .select('ticket_id')
        .eq('user_id', user.id)

      // Cargar invitaciones pendientes para saber si el décimo ya tiene participaciones creadas
      const { data: pendingInvitesData } = await supabase
        .from('pending_invites')
        .select('ticket_id')
        .eq('status', 'PENDIENTE')

      setPendingInviteTicketIds(
        new Set((pendingInvitesData || []).map((inv) => inv.ticket_id))
      )

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
      onSelectTicket(ticketId, { state: { fromTab: activeTab } })
    }
  }

  const handleQuickShare = (ticketId: string, hasParticipations: boolean) => {
    if (!onSelectTicket) return
    const target = resolveShareButtonNavigation({
      ticketId,
      hasParticipations,
      fromTab: activeTab,
    })
    onSelectTicket(target.ticketId, { state: target.state })
  }

  const handleQuickPrizeCheck = async (ticket: TicketRow) => {
    const pre = evaluateQuickPrizeCheckPrecondition(ticket.draw_date)
    if (!pre.canCheck) {
      setToastVariant('warning')
      setClaimToastMsg(pre.message || `El sorteo del ${pre.shortDate} aún no se ha celebrado.`)
      return
    }

    setCheckingTicketId(ticket.id)
    try {
      const res = await checkTicketPrize({
        ticketId: ticket.id,
        number: ticket.number,
        drawType: ticket.draw_type,
        drawDate: ticket.draw_date,
        ticketPrice: Number(ticket.ticket_price),
        forceRefresh: !!ticket.last_checked_at,
      })

      const toast = formatQuickPrizeCheckToast(res, pre.shortDate)
      setToastVariant(toast.type)
      setClaimToastMsg(toast.text)

      if (res.ok !== false) {
        await loadTickets()
      }
    } catch (err: unknown) {
      console.error('Error comprobando sorteo desde tarjeta:', err)
      setToastVariant('warning')
      setClaimToastMsg(
        err instanceof Error ? err.message : 'Error al consultar resultados oficiales.'
      )
    } finally {
      setCheckingTicketId(null)
    }
  }

  const handleSwipeArchive = async (ticketId: string, isCurrentlyArchived: boolean) => {
    try {
      const nextArchive = !isCurrentlyArchived
      const { error } = await supabase.rpc('toggle_archive_ticket', {
        p_ticket_id: ticketId,
        p_archive: nextArchive,
      })

      if (error) throw error

      setToastVariant('success')
      setClaimToastMsg(nextArchive ? 'Décimo archivado en tu cuenta.' : 'Décimo desarchivado.')
      await loadTickets()
    } catch (err: unknown) {
      console.error('Error al archivar décimo:', err)
      setToastVariant('warning')
      setClaimToastMsg(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado de archivo.'
      )
    }
  }

  const handleSwipeDelete = async (
    ticketId: string,
    isOwnerTicket: boolean,
    participantsCount: number,
    ticketStatus: string
  ) => {
    if (!isOwnerTicket || participantsCount > 1 || ticketStatus === 'LIQUIDADO') {
      setToastVariant('warning')
      setClaimToastMsg(
        'Solo el propietario puede eliminar décimos sin participaciones aceptadas ni liquidados.'
      )
      return
    }

    if (
      !confirm(
        '¿Estás seguro de que deseas eliminar este décimo? Esta acción no se puede deshacer.'
      )
    ) {
      return
    }

    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticketId)
      if (error) throw error

      setToastVariant('success')
      setClaimToastMsg('Décimo eliminado correctamente.')
      await loadTickets()
    } catch (err: unknown) {
      console.error('Error eliminando décimo:', err)
      setToastVariant('warning')
      setClaimToastMsg(err instanceof Error ? err.message : 'No se pudo eliminar el décimo.')
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      {/* 1. Tarjeta Resumen Superior */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
            Mis Décimos Compartidos
          </h2>
        </div>

        {/* Dos recuadros métricos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F7F9F7] p-3.5 border border-gray-200/50 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              Décimos Activos
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

      {/* 2. Bloque de Acción Único a Ancho Completo */}
      <div>
        <button
          type="button"
          onClick={() => {
            setScannedTicketData(null)
            setIsTicketScannerOpen(true)
          }}
          aria-label="Añadir décimo"
          className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-900/15 transition"
        >
          <Camera className="w-4.5 h-4.5 text-white shrink-0" />
          <span>Añadir</span>
        </button>
      </div>

      {/* 3. Pestañas de Filtrado */}
      <div className="space-y-3 pt-2">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => handleTabChange('decimos')}
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
            onClick={() => handleTabChange('participaciones')}
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
            onClick={() => handleTabChange('archivados')}
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
                <SwipeableTicketCard
                  key={item.ticket.id}
                  ticketId={item.ticket.id}
                  isArchived={item.isArchived}
                  openSwipeTicketId={openSwipeTicketId}
                  onSwipeOpenChange={(id) => setOpenSwipeTicketId(id)}
                  onArchiveClick={(id) => handleSwipeArchive(id, item.isArchived)}
                  onDeleteClick={(id) =>
                    handleSwipeDelete(
                      id,
                      item.isOwner,
                      item.participantsCount,
                      item.ticket.status
                    )
                  }
                  onCardClick={handleTicketClick}
                >
                  <TicketListItemCard
                    ticket={item.ticket}
                    userPercentage={item.userPercentage}
                    participantsCount={item.participantsCount}
                    hasParticipations={
                      item.participantsCount > 1 || pendingInviteTicketIds.has(item.ticket.id)
                    }
                    isArchived={item.isArchived}
                    isCheckingPrize={checkingTicketId === item.ticket.id}
                    onClick={handleTicketClick}
                    onShareClick={handleQuickShare}
                    onCheckPrizeClick={handleQuickPrizeCheck}
                  />
                </SwipeableTicketCard>
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
                <SwipeableTicketCard
                  key={item.ticket.id}
                  ticketId={item.ticket.id}
                  isArchived={item.isArchived}
                  openSwipeTicketId={openSwipeTicketId}
                  onSwipeOpenChange={(id) => setOpenSwipeTicketId(id)}
                  onArchiveClick={(id) => handleSwipeArchive(id, item.isArchived)}
                  onDeleteClick={(id) =>
                    handleSwipeDelete(
                      id,
                      item.isOwner,
                      item.participantsCount,
                      item.ticket.status
                    )
                  }
                  onCardClick={handleTicketClick}
                >
                  <TicketListItemCard
                    ticket={item.ticket}
                    userPercentage={item.userPercentage}
                    participantsCount={item.participantsCount}
                    hasParticipations={
                      item.participantsCount > 1 || pendingInviteTicketIds.has(item.ticket.id)
                    }
                    isArchived={item.isArchived}
                    isCheckingPrize={checkingTicketId === item.ticket.id}
                    onClick={handleTicketClick}
                    onShareClick={handleQuickShare}
                    onCheckPrizeClick={handleQuickPrizeCheck}
                  />
                </SwipeableTicketCard>
              ))}
            </div>
          )
        ) : (
          /* Pestaña: Archivados */
          misArchivados.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center space-y-2">
              <Archive className="mx-auto w-10 h-10 text-gray-300" />
              <h3 className="text-sm font-bold text-gray-800">Sin décimos archivados</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Los décimos que decidas ocultar u archivar se mostrarán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {misArchivados.map((item) => (
                <SwipeableTicketCard
                  key={item.ticket.id}
                  ticketId={item.ticket.id}
                  isArchived={true}
                  openSwipeTicketId={openSwipeTicketId}
                  onSwipeOpenChange={(id) => setOpenSwipeTicketId(id)}
                  onArchiveClick={(id) => handleSwipeArchive(id, true)}
                  onDeleteClick={(id) =>
                    handleSwipeDelete(
                      id,
                      item.isOwner,
                      item.participantsCount,
                      item.ticket.status
                    )
                  }
                  onCardClick={handleTicketClick}
                >
                  <TicketListItemCard
                    ticket={item.ticket}
                    userPercentage={item.userPercentage}
                    participantsCount={item.participantsCount}
                    hasParticipations={
                      item.participantsCount > 1 || pendingInviteTicketIds.has(item.ticket.id)
                    }
                    isArchived={true}
                    isCheckingPrize={checkingTicketId === item.ticket.id}
                    onClick={handleTicketClick}
                    onShareClick={handleQuickShare}
                    onCheckPrizeClick={handleQuickPrizeCheck}
                  />
                </SwipeableTicketCard>
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
        onRequestScanner={() => {
          setIsAddTicketOpen(false)
          setIsTicketScannerOpen(true)
        }}
      />

      {/* Escáner unificado abierto desde el botón Añadir o desde Escanear Código */}
      <BarcodeScannerModal
        isOpen={isTicketScannerOpen}
        mode="TICKET_BARCODE"
        onClose={() => setIsTicketScannerOpen(false)}
        onScanSuccess={handleUnifiedBarcodeScanned}
        onHaveCode={() => {
          const next = resolveScannerHaveCodeTransition()
          if (next.closeScanner) setIsTicketScannerOpen(false)
          if (next.resetClaimCode) setClaimInitialCode(null)
          if (next.openClaimModal) setIsClaimModalOpen(true)
        }}
        onManualEntry={() => {
          setIsTicketScannerOpen(false)
          setScannedTicketData(null)
          setAddTicketInitialTab('manual')
          setIsAddTicketOpen(true)
        }}
      />

      <InviteClaimModal
        isOpen={isClaimModalOpen}
        initialCode={claimInitialCode}
        initialInviteCode={claimInitialCode}
        onClose={() => {
          setIsClaimModalOpen(false)
          setClaimInitialCode(null)
        }}
        onClaimed={(ticketId, percentage) => {
          setIsClaimModalOpen(false)
          setClaimInitialCode(null)

          const pctText = percentage ? ` del ${percentage}%` : ''
          const toastMsg = `¡Participación${pctText} reclamada correctamente!`
          setClaimToastMsg(toastMsg)

          // 1. Sustituye la entrada actual del historial por /?tab=participaciones
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
          setSearchParams(
            { tab: 'participaciones' },
            {
              replace: true,
              state: {
                fromTab: 'participaciones',
                subTab: 'participaciones',
                directFallbackTab: 'participaciones',
              },
            }
          )

          // 2. Recargar billetes en segundo plano
          loadTickets()

          // 3. Navega inmediatamente a la ficha del décimo
          if (onSelectTicket && ticketId) {
            onSelectTicket(ticketId, {
              state: {
                fromTab: 'participaciones',
                claimMessage: toastMsg,
              },
            })
          }
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

      {/* Toast informativo de acciones rápidas o reclamaciones */}
      {claimToastMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 md:bottom-6 inset-x-4 max-w-sm mx-auto z-50 px-4 py-3 text-white text-xs font-semibold rounded-2xl shadow-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toastVariant === 'warning'
              ? 'bg-amber-800 border-amber-600'
              : 'bg-emerald-800 border-emerald-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastVariant === 'warning' ? (
              <CalendarClock className="h-4 w-4 text-amber-300 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
            )}
            <span>{claimToastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setClaimToastMsg(null)}
            className="p-1 text-white/80 hover:text-white transition cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
