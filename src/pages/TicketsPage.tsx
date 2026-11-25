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
  buildUnifiedActiveTicketsList,
  type UserTicketListsAndMetrics,
  type TicketRow,
  type OwnershipShareRow,
} from '../lib/ticketMetrics'
import {
  resolveShareButtonNavigation,
  evaluateQuickPrizeCheckPrecondition,
  formatQuickPrizeCheckToast,
  hasThirdPartyParticipations,
} from '../lib/cardQuickActions'
import { resolveScannerHaveCodeTransition } from '../lib/swipeCardState'
import { checkTicketPrize } from '../services/prizeService'
import { DecimoIcon } from '../components/icons/DecimoIcon'
import {
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
  const [allShares, setAllShares] = useState<OwnershipShareRow[]>([])
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

      setAllShares(sharesData || [])
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

  // Listas extraídas del clasificador reactivo
  const {
    activeTickets,
    misArchivados,
  } = ticketLists

  const unifiedActiveTickets = buildUnifiedActiveTicketsList(activeTickets)

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
    <div className="space-y-4 pb-32 max-w-xl mx-auto">
      {/* Cabecera de listado unificado (sin subpestañas Décimos/Participaciones) */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
          {activeTab === 'archivados'
            ? `Archivados (${misArchivados.length})`
            : `Mis Décimos y Participaciones (${unifiedActiveTickets.length})`}
        </h2>

        {(misArchivados.length > 0 || activeTab === 'archivados') && (
          <button
            type="button"
            onClick={() =>
              handleTabChange(activeTab === 'archivados' ? 'decimos' : 'archivados')
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <Archive className="h-3.5 w-3.5 text-gray-500" />
            <span>
              {activeTab === 'archivados'
                ? 'Ver activos'
                : `Archivados (${misArchivados.length})`}
            </span>
          </button>
        )}
      </div>

      {/* Listado unificado o archivados */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-lottery" />
        </div>
      ) : activeTab === 'archivados' ? (
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
                allowDelete={item.isOwner}
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
                  isOwner={item.isOwner}
                  participantsCount={item.participantsCount}
                  hasParticipations={hasThirdPartyParticipations({
                    ticketId: item.ticket.id,
                    shares: allShares,
                    pendingInviteTicketIds,
                  })}
                  isArchived={true}
                  isCheckingPrize={checkingTicketId === item.ticket.id}
                  onShareClick={handleQuickShare}
                  onCheckPrizeClick={handleQuickPrizeCheck}
                />
              </SwipeableTicketCard>
            ))}
          </div>
        )
      ) : unifiedActiveTickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-8 text-center space-y-2">
          <DecimoIcon className="mx-auto w-10 h-10 text-gray-300" />
          <h3 className="text-sm font-bold text-gray-800">
            No tienes décimos ni participaciones
          </h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Pulsa el botón Añadir abajo para escanear un décimo, introducirlo manualmente o canjear un código.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {unifiedActiveTickets.map((item) => (
            <SwipeableTicketCard
              key={item.ticket.id}
              ticketId={item.ticket.id}
              isArchived={item.isArchived}
              allowDelete={item.isOwner}
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
                isOwner={item.isOwner}
                participantsCount={item.participantsCount}
                hasParticipations={hasThirdPartyParticipations({
                  ticketId: item.ticket.id,
                  shares: allShares,
                  pendingInviteTicketIds,
                })}
                isArchived={item.isArchived}
                isCheckingPrize={checkingTicketId === item.ticket.id}
                onShareClick={handleQuickShare}
                onCheckPrizeClick={handleQuickPrizeCheck}
              />
            </SwipeableTicketCard>
          ))}
        </div>
      )}

      {/* Botón flotante "Añadir" justo encima de BottomNav */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 right-4 z-30 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => {
            setScannedTicketData(null)
            setIsTicketScannerOpen(true)
          }}
          aria-label="Añadir décimo"
          className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition"
        >
          <Camera className="w-4.5 h-4.5 text-white shrink-0" />
          <span>Añadir</span>
        </button>
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
