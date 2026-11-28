import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from '../hooks/useSearchParams'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RealisticTicketCard } from '../components/tickets/RealisticTicketCard'
import {
  OwnershipBreakdownCard,
  type OwnershipShare,
  type PendingInvite,
} from '../components/tickets/OwnershipBreakdownCard'
import { ShareInviteModal } from '../components/tickets/ShareInviteModal'
import type { ShareableInviteItem } from '../lib/shareBatchHelper'
import {
  TicketAuditTimeline,
  type AuditEvent,
} from '../components/tickets/TicketAuditTimeline'
import {
  countActiveRepartoItems,
  findActiveUserShare,
  hasActiveDigitalParticipationSignature,
  mergeAuditAndLegalEvents,
  resolveTicketSealState,
} from '../lib/legalAuditHelper'
import { PrizeCheckCard } from '../components/tickets/PrizeCheckCard'
import {
  LegalCertificationTab,
  type TicketCertificationRow,
  type TicketLegalEventRow,
} from '../components/tickets/LegalCertificationTab'
import type { TicketHandwrittenSignatureRow } from '../components/tickets/HandwrittenSignatureTab'
import {
  simulateTicketPrize,
  resetTicketPrizeSimulation,
} from '../services/prizeService'
import {
  consumeSelectShareToast,
  SELECT_SHARE_TOAST_TITLE,
  SELECT_SHARE_TOAST_SUBTITLE,
} from '../lib/cardQuickActions'
import type { Database } from '../types/database.types'
import {
  ArrowLeft,
  Lock,
  Users,
  Shield,
  ShieldCheck,
  Loader2,
  Calendar,
  Barcode,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  X,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']
type DrawTemplate = Database['public']['Tables']['draw_templates']['Row']

export interface TicketDetailPageProps {
  ticketId: string
  onBack: () => void
  onNavigateToRoot?: (
    tab?: 'decimos' | 'participaciones' | 'archivados',
    options?: { toastMsg?: string }
  ) => void
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
  const [certification, setCertification] = useState<TicketCertificationRow | null>(null)
  const [handwrittenSignatures, setHandwrittenSignatures] = useState<TicketHandwrittenSignatureRow[]>([])
  const [legalEvents, setLegalEvents] = useState<TicketLegalEventRow[]>([])
  const [isArchived, setIsArchived] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabsSectionRef = useRef<HTMLDivElement | null>(null)

  const resolveDetailTab = useCallback(
    (queryTab: string | null, stateTab?: string): 'propiedad' | 'certificacion' | 'historial' | null => {
      const candidate = (queryTab || stateTab || '').trim().toLowerCase()
      if (candidate === 'certification' || candidate === 'certificacion') return 'certificacion'
      if (candidate === 'historial' || candidate === 'history') return 'historial'
      if (candidate === 'propiedad' || candidate === 'reparto') return 'propiedad'
      return null
    },
    []
  )

  const [activeTab, setActiveTabState] = useState<'propiedad' | 'certificacion' | 'historial'>(() => {
    const stateTab =
      typeof window !== 'undefined'
        ? (window.history.state as { openTab?: string } | null)?.openTab
        : undefined
    return resolveDetailTab(searchParams.get('tab'), stateTab) || 'propiedad'
  })

  const setActiveTab = useCallback(
    (nextTab: 'propiedad' | 'certificacion' | 'historial') => {
      setActiveTabState(nextTab)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('tab', nextTab === 'certificacion' ? 'certification' : nextTab)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Sincronizar ?tab=... y history.state tanto en entrada inicial como al navegar entre rutas
  useEffect(() => {
    const syncTabFromUrlOrState = () => {
      const stateTab =
        typeof window !== 'undefined'
          ? (window.history.state as { openTab?: string } | null)?.openTab
          : undefined
      const queryTab =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('tab')
          : searchParams.get('tab')
      const resolved = resolveDetailTab(queryTab, stateTab)
      if (resolved) {
        setActiveTabState(resolved)
        if (!queryTab) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('tab', resolved === 'certificacion' ? 'certification' : resolved)
              return next
            },
            { replace: true }
          )
        }
      }
    }

    syncTabFromUrlOrState()
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', syncTabFromUrlOrState)
      return () => window.removeEventListener('popstate', syncTabFromUrlOrState)
    }
  }, [searchParams, ticketId, resolveDetailTab, setSearchParams])
  const [autoOpenRenounceModal, setAutoOpenRenounceModal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stateAction = (window.history.state as { action?: string } | null)?.action
      const queryAction = new URLSearchParams(window.location.search).get('action')
      return stateAction === 'renounce' || queryAction === 'renounce'
    }
    return false
  })
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )
  const [autoOpenCreateShare, setAutoOpenCreateShare] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean((window.history.state as { openCreateShare?: boolean } | null)?.openCreateShare)
    }
    return false
  })
  const [shareSelectToast, setShareSelectToast] = useState<{
    title: string
    subtitle: string
  } | null>(null)
  const [shareModalInvitations, setShareModalInvitations] = useState<ShareableInviteItem[]>([])
  const hasTriggeredShareToastRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  // Disparar toast flotante al entrar con selectShareToShare: true una vez cargado el décimo
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || !ticket) return

    const { shouldTrigger, cleanedState } = consumeSelectShareToast({
      historyState: window.history.state,
      isTicketLoaded: true,
      alreadyTriggered: hasTriggeredShareToastRef.current,
    })

    if (shouldTrigger) {
      hasTriggeredShareToastRef.current = true
      setShareSelectToast({
        title: SELECT_SHARE_TOAST_TITLE,
        subtitle: SELECT_SHARE_TOAST_SUBTITLE,
      })
      if (cleanedState) {
        window.history.replaceState(cleanedState, '', window.location.href)
      }
    }
  }, [isLoading, ticket])

  // Auto-cierre del toast flotante tras 5 segundos (idéntico a Comprobar sorteo)
  useEffect(() => {
    if (!shareSelectToast) return
    const timer = setTimeout(() => {
      setShareSelectToast(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [shareSelectToast])

  const handleAutoOpenHandled = useCallback(() => {
    setAutoOpenCreateShare(false)
    if (typeof window !== 'undefined' && window.history.state?.openCreateShare) {
      const nextState = { ...window.history.state }
      delete nextState.openCreateShare
      window.history.replaceState(nextState, '', window.location.href)
    }
  }, [])

  // Diagnóstico: Modo Prueba de Premio (propietario en DEV o 5 toques consecutivos en el sello digital)
  const [showSimulationPanel, setShowSimulationPanel] = useState(
    Boolean(import.meta.env.DEV)
  )
  const [sealTapCount, setSealTapCount] = useState(0)
  const [isSimulating, setIsSimulating] = useState(false)
  const lastTapRef = useRef<number>(0)

  const handleNumberBoxClick = () => {
    const now = Date.now()
    if (now - lastTapRef.current > 2500) {
      setSealTapCount(1)
    } else {
      const nextCount = sealTapCount + 1
      setSealTapCount(nextCount)
      if (nextCount >= 5) {
        setShowSimulationPanel((prev) => !prev)
        setSealTapCount(0)
      }
    }
    lastTapRef.current = now
  }

  const handleOpenCertificationFromSeal = () => {
    setActiveTab('certificacion')
    tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSimulatePrize = async (amount: number = 1000) => {
    if (!ticket) return
    setIsSimulating(true)
    setStatusMsg(null)
    try {
      const res = await simulateTicketPrize(ticket.id, amount)
      setStatusMsg({
        type: 'success',
        text: `Simulación activada: Premio de ${res.formattedPrize} registrado para el décimo.`,
      })
      await loadTicketDetails()
    } catch (err: unknown) {
      console.error('Error simulando premio:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al simular premio.',
      })
    } finally {
      setIsSimulating(false)
    }
  }

  const handleResetSimulation = async () => {
    if (!ticket) return
    setIsSimulating(true)
    setStatusMsg(null)
    try {
      await resetTicketPrizeSimulation(ticket.id)
      setStatusMsg({
        type: 'success',
        text: 'Simulación restablecida: Décimo devuelto a 0,00 € y estado PENDIENTE.',
      })
      await loadTicketDetails()
    } catch (err: unknown) {
      console.error('Error restableciendo simulación:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al restablecer simulación.',
      })
    } finally {
      setIsSimulating(false)
    }
  }

  const loadTicketDetails = useCallback(async () => {
    if (!ticketId || !user?.id) return

    try {
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true)
      }

      // 1. Cargar datos del billete
      const { data: ticketData, error: ticketErr } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single()

      if (ticketErr) throw ticketErr
      hasLoadedOnceRef.current = true
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
      const loadedShares = (sharesData as unknown as OwnershipShare[]) || []
      setShares(loadedShares)

      // Protección de acceso: si el usuario no es propietario, verificar que conserve participación activa
      const isTicketOwner = ticketData.owner_id === user.id
      if (!isTicketOwner) {
        const myShare = loadedShares.find((s) => s.user_id === user.id)
        const hasActiveShare = Boolean(
          myShare &&
          (myShare.status === 'ACEPTADA' || myShare.status === 'PENDIENTE') &&
          Number(myShare.percentage) > 0
        )

        if (!hasActiveShare) {
          const isRenounced = myShare?.status === 'RENUNCIADA'
          const toastMsg = isRenounced
            ? 'Ya no tienes acceso a este décimo porque renunciaste a tu participación.'
            : 'Ya no tienes acceso a este décimo.'

          if (user?.id && ticketId) {
            try {
              await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('ticket_id', ticketId)
            } catch (notifErr) {
              console.error('Error al marcar notificaciones como leídas:', notifErr)
            }
          }

          if (onNavigateToRoot) {
            onNavigateToRoot('participaciones', { toastMsg })
          } else if (onBack) {
            onBack()
          } else if (typeof window !== 'undefined') {
            window.location.replace('/?tab=participaciones')
          }
          return
        }
      }

      // 4. Cargar invitaciones pendientes (pending_invites) exclusivamente si el usuario es el propietario
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

      // 6. Verificar estado archivado del usuario para mostrar insignia en cabecera
      const { data: hideData } = await supabase
        .from('ticket_archive_hides')
        .select('ticket_id')
        .eq('ticket_id', ticketId)
        .eq('user_id', user.id)
        .maybeSingle()

      setIsArchived(!!hideData || ticketData.status === 'ARCHIVADO')

      // 7. Cargar certificación digital, firmas manuscritas y eventos legales inmutables
      const [{ data: certData }, { data: hwData }, { data: legalData }] = await Promise.all([
        supabase
          .from('ticket_certifications')
          .select('*')
          .eq('ticket_id', ticketId)
          .maybeSingle(),
        supabase
          .from('ticket_handwritten_signatures')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('signed_at', { ascending: true }),
        supabase
          .from('ticket_legal_events')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true }),
      ])

      setCertification(certData || null)
      setHandwrittenSignatures(hwData || [])
      setLegalEvents(legalData || [])
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

  // Sincronizar automáticamente participaciones y datos legales al cambiar a Certificación Legal
  const prevActiveTabRef = useRef(activeTab)
  useEffect(() => {
    if (activeTab === 'certificacion' && prevActiveTabRef.current !== 'certificacion') {
      loadTicketDetails()
    }
    prevActiveTabRef.current = activeTab
  }, [activeTab, loadTicketDetails])

  // Capturar toast de confirmación si se viene de reclamar una participación
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history.state?.claimMessage) {
      setStatusMsg({
        type: 'success',
        text: String(window.history.state.claimMessage),
      })
      const nextState = { ...window.history.state }
      delete nextState.claimMessage
      window.history.replaceState(nextState, '', window.location.href)
    }
  }, [])

  // Salida automática al renunciar a una participación
  const handleShareRenounced = useCallback(async () => {
    if (user?.id && ticketId) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('ticket_id', ticketId)
      } catch (notifErr) {
        console.error('Error marcando notificaciones al renunciar:', notifErr)
      }
    }

    const toastMsg =
      'Has renunciado a la participación. El décimo se ha retirado de tus participaciones.'
    if (onNavigateToRoot) {
      onNavigateToRoot('participaciones', { toastMsg })
    } else if (onBack) {
      onBack()
    } else if (typeof window !== 'undefined') {
      window.location.replace('/?tab=participaciones')
    }
  }, [user?.id, ticketId, onNavigateToRoot, onBack])

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
    const fromTab = historyState?.fromTab || historyState?.directFallbackTab
    const isParticipant = Boolean(ticket && user?.id && ticket.owner_id !== user.id)
    const targetTab: 'decimos' | 'participaciones' | 'archivados' =
      fromTab === 'participaciones' || fromTab === 'archivados'
        ? fromTab
        : isParticipant
        ? 'participaciones'
        : 'decimos'

    if (onNavigateToRoot) {
      onNavigateToRoot(targetTab)
    } else if (onBack) {
      onBack()
    } else if (typeof window !== 'undefined') {
      const search = targetTab === 'participaciones' ? '?tab=participaciones' : ''
      window.location.href = `/${search}`
    }
  }, [ticket, user?.id, onBack, onNavigateToRoot])

  if (isLoading && !ticket) {
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
          <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Décimo no encontrado
          </h3>
          <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 mt-1">
            {statusMsg?.type === 'error'
              ? statusMsg.text
              : 'No se ha podido localizar el décimo o no tienes permisos para acceder a él.'}
          </p>
        </div>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-semibold shadow transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a la lista
        </button>
      </div>
    )
  }

  const isOwner = ticket.owner_id === user?.id
  const userShare = findActiveUserShare(shares, user?.id)
  const hasActiveShare = Boolean(
    isOwner ||
      (userShare &&
        (userShare.status === 'ACEPTADA' || userShare.status === 'PENDIENTE') &&
        Number(userShare.percentage) > 0)
  )

  if (!hasActiveShare) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-7 w-7 animate-spin text-lottery" />
      </div>
    )
  }

  const hasAcceptedThirdPartyShares = shares.some(
    (s) => s.user_id !== user?.id && s.status === 'ACEPTADA'
  )

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'LIQUIDADO':
      case 'VALIDADO':
        return 'bg-[#3A5245] text-[#FFFFFF] border-[#3A5245]'
      case 'ARCHIVADO':
        return 'bg-[#1D1D1F]/10 dark:bg-[#F5F5F7]/10 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 border-transparent'
      default:
        return 'bg-[#C5A880]/20 text-[#1D1D1F] dark:text-[#F5F5F7] border-[#C5A880]/40'
    }
  }

  const activeRepartoCount = countActiveRepartoItems(shares, pendingInvites)
  const mergedTimelineEvents = mergeAuditAndLegalEvents(auditEvents, legalEvents)
  const hasCurrentUserDigitalSignature = hasActiveDigitalParticipationSignature(
    legalEvents,
    user?.id,
    userShare?.id
  )
  const ticketSealStatus = resolveTicketSealState({
    hasDigitalCert: Boolean(certification),
    hasCustodianHandwritten: handwrittenSignatures.some((h) => h.signer_role === 'custodian'),
    verificationCode: certification?.verification_code || null,
  })

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 max-w-xl mx-auto">
      {/* 1. Cabecera */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver atrás"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-white dark:bg-[#1D1D1F] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-80 active:scale-95 transition shadow-xs shrink-0 cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight truncate">
              Detalles del Décimo
            </h2>
            <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 truncate">
              #{ticket.number} · {ticket.draw_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isArchived && ticket.status !== 'ARCHIVADO' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider bg-[#1D1D1F]/10 dark:bg-[#F5F5F7]/10 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
              ARCHIVADO
            </span>
          )}
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase tracking-wider ${getStatusBadgeStyle(
              ticket.status
            )}`}
          >
            {ticket.status}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-2xl text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'bg-[#3A5245] text-[#FFFFFF]'
              : 'bg-[#D04848] text-[#FFFFFF]'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#C5A880]" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#FFFFFF]" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 2. Pestañas de PROPIEDAD, CERTIFICACIÓN LEGAL e HISTORIAL */}
      <div ref={tabsSectionRef} className="space-y-2.5 sm:space-y-4">
        <div className="grid grid-cols-3 border-b border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10">
          <button
            type="button"
            onClick={() => setActiveTab('propiedad')}
            className={`min-h-[44px] flex items-center justify-center gap-1 px-2 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'propiedad'
                ? 'border-[#C5A880] text-[#1D1D1F] dark:text-[#F5F5F7]'
                : 'border-transparent text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Reparto ({activeRepartoCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('certificacion')}
            className={`min-h-[44px] flex items-center justify-center gap-1 px-2 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'certificacion'
                ? 'border-[#C5A880] text-[#1D1D1F] dark:text-[#F5F5F7]'
                : 'border-transparent text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Certificación</span>
            <span className="hidden sm:inline">Certificación Legal</span>
            {(certification || handwrittenSignatures.length > 0) && (
              <span
                aria-label="Décimo certificado o firmado"
                className="w-2 h-2 rounded-full bg-[#3A5245] dark:bg-[#96BFA9] shrink-0"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historial')}
            className={`min-h-[44px] flex items-center justify-center gap-1 px-2 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'historial'
                ? 'border-[#C5A880] text-[#1D1D1F] dark:text-[#F5F5F7]'
                : 'border-transparent text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
            }`}
          >
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span>Historial ({mergedTimelineEvents.length})</span>
          </button>
        </div>

        {activeTab === 'propiedad' ? (
          <div className="space-y-3">
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
              onRenounced={handleShareRenounced}
              autoOpenCreateShare={autoOpenCreateShare}
              onAutoOpenHandled={handleAutoOpenHandled}
              onOpenShareModal={(invites) => setShareModalInvitations(invites)}
              hasDigitalSignatureForCurrentUser={hasCurrentUserDigitalSignature}
              isCertifiedTicket={Boolean(certification)}
              onRequireDigitalRenounce={() => {
                setActiveTab('certificacion')
                setAutoOpenRenounceModal(true)
              }}
            />
          </div>
        ) : activeTab === 'certificacion' ? (
          <LegalCertificationTab
            ticket={ticket}
            shares={shares}
            pendingInvites={pendingInvites}
            isOwner={isOwner}
            userShare={userShare}
            certification={certification}
            handwrittenSignatures={handwrittenSignatures}
            legalEvents={legalEvents}
            autoOpenRenounce={autoOpenRenounceModal}
            onAutoOpenRenounceHandled={() => setAutoOpenRenounceModal(false)}
            onRefresh={loadTicketDetails}
            onRenounced={handleShareRenounced}
          />
        ) : (
          <TicketAuditTimeline
            events={mergedTimelineEvents}
            onRefresh={loadTicketDetails}
          />
        )}
      </div>

      {/* 3. Tarjeta Realista del Boleto y Metadatos */}
      <div className="space-y-2.5 sm:space-y-3 pt-0 sm:pt-2">
        <RealisticTicketCard
          ticket={ticket}
          template={template}
          variant="full"
          sealStatus={ticketSealStatus}
          onSealClick={handleOpenCertificationFromSeal}
          onNumberBoxClick={isOwner ? handleNumberBoxClick : undefined}
        />

        {/* Fila inferior de metadatos */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs px-2 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
          <div className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums text-[11px]">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              FECHA SORTEO:{' '}
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{ticket.draw_date}</strong>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[#3A5245] dark:text-[#C5A880] text-[11px]">
            <Barcode className="h-3.5 w-3.5 shrink-0" />
            <span>ORIGEN: {ticket.origin === 'BARCODE_GS1' ? 'Escáner GS1-128' : 'Manual'}</span>
          </div>
        </div>
      </div>

      {/* 4. Tarjeta de Premio Oficial (solo si el décimo ya está premiado) */}
      {ticket.prize_amount_cents > 0 && (
        <PrizeCheckCard
          ticket={ticket}
          userShare={userShare}
          shares={shares}
          isOwner={isOwner}
          hideCheckButton={true}
          onRefresh={loadTicketDetails}
        />
      )}

      {/* 5. Panel Diagnóstico: Modo Prueba de Premio (propietario en DEV o 5 taps en Sello Digital) */}
      {isOwner && showSimulationPanel && (
        <div className="bg-white dark:bg-[#1D1D1F] border border-[#C5A880]/40 rounded-[22px] p-4 text-[#1D1D1F] dark:text-[#F5F5F7] space-y-3 shadow-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#C5A880]/20 text-[#C5A880]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight">
                  Modo Prueba de Premio
                </h4>
                <p className="text-[10px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                  Panel de diagnóstico
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase bg-[#C5A880]/20 text-[#1D1D1F] dark:text-[#F5F5F7] tracking-wider">
              Diagnóstico
            </span>
          </div>

          <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 leading-relaxed">
            Permite simular un premio oficial para validar el reparto proporcional en euros, el cobro de cotitulares y las notificaciones Web Push, o restablecer el décimo a su estado pendiente original.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSimulatePrize(1000)}
              disabled={isSimulating}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition shadow-xs disabled:opacity-45 cursor-pointer"
            >
              {isSimulating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simular premio (1.000 €)</span>
            </button>

            <button
              type="button"
              onClick={handleResetSimulation}
              disabled={isSimulating}
              className="py-2.5 px-3 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-80 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition disabled:opacity-45 cursor-pointer"
              title="Restablecer décimo a estado pendiente sin premio"
            >
              {isSimulating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              <span>Restablecer</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Aviso de seguridad si tiene cotitulares activos */}
      {hasAcceptedThirdPartyShares && (
        <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 text-[#1D1D1F] dark:text-[#F5F5F7] text-xs flex items-start gap-2.5">
          <Lock className="h-4 w-4 text-[#C5A880] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[#1D1D1F]/80 dark:text-[#F5F5F7]/80">
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Protección de cotitulares:</strong> Este décimo cuenta con participaciones aceptadas por terceros. El número y datos del sorteo están bloqueados e inmutables para salvaguardar los derechos de todos los participantes.
          </p>
        </div>
      )}

      {/* Toast flotante al acceder desde Compartir con participaciones previas */}
      {shareSelectToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 inset-x-4 max-w-sm mx-auto z-50 px-4 py-3 text-white text-xs font-semibold rounded-2xl shadow-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 bg-emerald-800 border-emerald-600"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold leading-snug">{shareSelectToast.title}</p>
              <p className="text-[11px] font-medium text-emerald-100/90 leading-snug">
                {shareSelectToast.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShareSelectToast(null)}
            className="p-1 text-white/80 hover:text-white transition cursor-pointer shrink-0"
            title="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {/* Modal persistente de Compartir Participación (inmune a refrescos en segundo plano) */}
      <ShareInviteModal
        isOpen={shareModalInvitations.length > 0}
        onClose={() => setShareModalInvitations([])}
        invitations={shareModalInvitations}
      />
    </div>
  )
}
