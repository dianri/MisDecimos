import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TicketListItemCard } from '../components/tickets/TicketListItemCard'
import { PrizesHeroCard } from '../components/tickets/PrizesHeroCard'
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
import { resolveScannerHaveCodeTransition, resolveSwipeRightAction } from '../lib/swipeCardState'
import { ARCHIVE_SUCCESS_TOAST, RESTORE_SUCCESS_TOAST } from '../lib/archivedTickets'
import { filterHomeTickets, type HomeTicketFilter } from '../lib/ticketCardHelper'
import { buildPrizesSummary } from '../lib/prizesSummary'
import {
  extractSupabaseErrorMessage,
  findActiveUserShare,
  hasActiveDigitalParticipationSignature,
} from '../lib/legalAuditHelper'
import { checkTicketPrize, toggleOwnerPrizeCollected } from '../services/prizeService'
import { DecimoIcon } from '../components/icons/DecimoIcon'
import {
  Loader2,
  Camera,
  CheckCircle2,
  CalendarClock,
  X,
} from 'lucide-react'

export interface TicketsPageProps {
  resetFilterTrigger?: number
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
  resetFilterTrigger = 0,
  onSelectTicket,
}) => {
  const { user } = useAuth()

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: 'decimos' | 'participaciones' | 'archivados' = 'decimos'
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
  const [allTickets, setAllTickets] = useState<TicketRow[]>([])
  const [allShares, setAllShares] = useState<OwnershipShareRow[]>([])
  const [archivedTicketIds, setArchivedTicketIds] = useState<Set<string>>(new Set())
  const [checkingTicketId, setCheckingTicketId] = useState<string | null>(null)
  const [togglingCollectedTicketId, setTogglingCollectedTicketId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<HomeTicketFilter>(() => {
    const initialFilter = searchParams.get('filter')
    if (initialFilter === 'premiados' || initialFilter === 'sin_premio') {
      return initialFilter
    }
    return 'todos'
  })
  const [openSwipeTicketId, setOpenSwipeTicketId] = useState<string | null>(null)

  // Al pulsar "Mis Décimos" en la cabecera, volver al filtro Todos
  useEffect(() => {
    if (resetFilterTrigger > 0) {
      setActiveFilter('todos')
      if (searchParams.get('filter')) {
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('filter')
        setSearchParams(nextParams, { replace: true })
      }
    }
  }, [resetFilterTrigger, searchParams, setSearchParams])

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

      const nextArchivedIds = new Set((hidesData || []).map((h) => h.ticket_id))

      setAllTickets(ticketsData || [])
      setArchivedTicketIds(nextArchivedIds)
      setAllShares(sharesData || [])
      const metrics = classifyUserTickets(
        ticketsData || [],
        sharesData || [],
        nextArchivedIds,
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

  // Listas extraídas del clasificador reactivo (sin archivados en la pantalla principal)
  const { activeTickets } = ticketLists

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

  const handleToggleOwnerCollected = async (
    ticket: TicketRow,
    currentlyCollected: boolean,
    hasParticipations: boolean
  ) => {
    if (!user?.id || togglingCollectedTicketId) return
    const nextCollected = !currentlyCollected
    const previousShares = allShares

    // Actualización optimista en memoria
    setTogglingCollectedTicketId(ticket.id)
    setAllShares((prev) =>
      prev.map((share) =>
        share.ticket_id === ticket.id && share.user_id === user.id
          ? {
              ...share,
              prize_paid_confirmed: nextCollected,
              prize_paid_confirmed_at: nextCollected ? new Date().toISOString() : null,
            }
          : share
      )
    )

    try {
      await toggleOwnerPrizeCollected({
        ticketId: ticket.id,
        userId: user.id,
        nextCollected,
        hasThirdPartyParticipants: hasParticipations,
      })

      setToastVariant('success')
      setClaimToastMsg(
        nextCollected
          ? 'Premio marcado como cobrado.'
          : 'Premio desmarcado como pendiente de cobro.'
      )
      await loadTickets()
    } catch (err: unknown) {
      setAllShares(previousShares)
      console.error('Error actualizando cobro del propietario:', err)
      setToastVariant('warning')
      setClaimToastMsg(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado de cobro.'
      )
    } finally {
      setTogglingCollectedTicketId(null)
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
      setClaimToastMsg(nextArchive ? ARCHIVE_SUCCESS_TOAST : RESTORE_SUCCESS_TOAST)
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

  const handleSwipeRenounce = async (ticket: TicketRow, userPercentage: number) => {
    const userShare = findActiveUserShare(
      allShares.filter((s) => s.ticket_id === ticket.id && s.role === 'PARTICIPANTE'),
      user?.id
    )

    if (!userShare) {
      setToastVariant('warning')
      setClaimToastMsg('No se encontró una participación activa para renunciar.')
      return
    }

    // Verificar si la participación fue firmada con certificado digital
    if (user?.id) {
      const { data: legalRows } = await supabase
        .from('ticket_legal_events')
        .select('event_type, actor_user_id, participation_id, signature_b64, cert_serial')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })

      if (hasActiveDigitalParticipationSignature(legalRows || [], user.id, userShare.id)) {
        if (onSelectTicket) {
          onSelectTicket(ticket.id, {
            state: {
              fromTab: activeTab,
              openTab: 'certificacion',
              action: 'renounce',
            },
          })
        } else {
          setToastVariant('warning')
          setClaimToastMsg(
            'Esta participación está firmada con certificado digital y requiere firma electrónica para renunciar.'
          )
        }
        return
      }
    }

    if (
      !confirm(
        `¿Seguro que quieres renunciar a tu participación del ${userPercentage}% en el décimo #${ticket.number}? Tu porcentaje volverá al propietario.`
      )
    ) {
      return
    }

    try {
      const { error } = await supabase.rpc('renounce_own_participation', {
        p_share_id: userShare.id,
      })

      if (error) throw error

      setToastVariant('success')
      setClaimToastMsg(
        `Has renunciado a tu participación del ${userPercentage}% en el décimo #${ticket.number}.`
      )
      await loadTickets()
    } catch (err: unknown) {
      console.error('Error renunciando a participación:', err)
      setToastVariant('warning')
      setClaimToastMsg(
        extractSupabaseErrorMessage(err, 'No se pudo completar la renuncia a la participación.')
      )
    }
  }

  const todosCount = unifiedActiveTickets.length
  const premiadosCount = useMemo(
    () => filterHomeTickets(unifiedActiveTickets, 'premiados').length,
    [unifiedActiveTickets]
  )
  const sinPremioCount = useMemo(
    () => filterHomeTickets(unifiedActiveTickets, 'sin_premio').length,
    [unifiedActiveTickets]
  )

  const prizesSummary = useMemo(
    () => buildPrizesSummary(allTickets, allShares, archivedTicketIds, user?.id || ''),
    [allTickets, allShares, archivedTicketIds, user?.id]
  )

  const filteredActiveTickets = filterHomeTickets(unifiedActiveTickets, activeFilter)

  return (
    <div className="space-y-4 pb-24 max-w-xl mx-auto">
      {/* Selector segmentado de filtro (Todos / Premiados / Sin premio) con contadores */}
      <div
        role="tablist"
        aria-label="Filtrar décimos por resultado"
        className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#1D1D1F]/[0.05] dark:bg-[#F5F5F7]/[0.08] border border-[#1D1D1F]/[0.06] dark:border-[#F5F5F7]/[0.08]"
      >
        {(
          [
            { id: 'todos', label: 'Todos', count: todosCount },
            { id: 'premiados', label: 'Premiados', count: premiadosCount },
            { id: 'sin_premio', label: 'Sin premio', count: sinPremioCount },
          ] as const
        ).map((option) => {
          const isActive = activeFilter === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(option.id)}
              className={`py-2 px-2 sm:px-3 rounded-xl text-xs transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-[#1D1D1F] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold shadow-xs'
                  : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] font-medium'
              }`}
            >
              <span>{option.label}</span>
              <span className="tabular-nums text-[11px] font-bold opacity-70">
                {option.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Hero Card financiera Bento integrada en la pestaña Premiados */}
      {!isLoading && activeFilter === 'premiados' && (
        <PrizesHeroCard summary={prizesSummary} />
      )}

      {/* Listado unificado de décimos y participaciones activas */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#C5A880]" />
        </div>
      ) : filteredActiveTickets.length === 0 ? (
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-dashed border-black/10 dark:border-white/15 p-8 text-center space-y-2">
          <DecimoIcon className="mx-auto w-10 h-10 text-[#1D1D1F]/25 dark:text-[#F5F5F7]/25" />
          <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {unifiedActiveTickets.length === 0
              ? 'No tienes décimos ni participaciones'
              : activeFilter === 'premiados'
              ? 'No tienes décimos ni participaciones premiados'
              : 'No tienes décimos ni participaciones sin premio'}
          </h3>
          <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 max-w-xs mx-auto">
            {unifiedActiveTickets.length === 0
              ? 'Pulsa el botón Añadir abajo para escanear un décimo, introducirlo manualmente o canjear un código.'
              : activeFilter === 'premiados'
              ? 'Cuando compruebes un sorteo con premio, aparecerá aquí.'
              : 'Los décimos ya comprobados sin premio aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-28">
          {filteredActiveTickets.map((item) => {
            const ownerOrUserShare = allShares.find(
              (s) =>
                s.ticket_id === item.ticket.id &&
                s.user_id === user?.id &&
                s.status === 'ACEPTADA'
            )
            const isItemCollected =
              Boolean(ownerOrUserShare?.prize_paid_confirmed) ||
              item.ticket.status === 'LIQUIDADO'

            return (
              <SwipeableTicketCard
                key={item.ticket.id}
                ticketId={item.ticket.id}
                isArchived={item.isArchived}
                allowDelete={true}
                rightActionMode={resolveSwipeRightAction(item.isOwner)}
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
                onRenounceClick={() => handleSwipeRenounce(item.ticket, item.userPercentage)}
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
                  isCollected={isItemCollected}
                  isCheckingPrize={checkingTicketId === item.ticket.id}
                  isTogglingCollected={togglingCollectedTicketId === item.ticket.id}
                  onShareClick={handleQuickShare}
                  onCheckPrizeClick={handleQuickPrizeCheck}
                  onToggleCollectedClick={handleToggleOwnerCollected}
                />
              </SwipeableTicketCard>
            )
          })}
        </div>
      )}

      {/* Botón flotante "Añadir" */}
      <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 right-4 z-30 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => {
            setScannedTicketData(null)
            setIsTicketScannerOpen(true)
          }}
          aria-label="Añadir décimo"
          className="w-full min-h-[48px] px-6 py-3 rounded-[22px] bg-[#C5A880] hover:bg-[#B8996E] active:scale-[0.98] text-[#1D1D1F] font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/15 transition cursor-pointer"
        >
          <Camera className="w-4.5 h-4.5 text-[#1D1D1F] shrink-0" />
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
          className={`fixed bottom-20 md:bottom-6 inset-x-4 max-w-sm mx-auto z-50 px-4 py-3 text-xs font-semibold rounded-[20px] shadow-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toastVariant === 'warning'
              ? 'bg-[#D04848] border-[#D04848] text-white'
              : 'bg-[#3A5245] border-[#3A5245] text-white'
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
