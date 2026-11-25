import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Database } from '../types/database.types'
import {
  ArrowLeft,
  CheckCheck,
  Loader2,
  Bell,
  Trophy,
  UserPlus,
  AlertTriangle,
  Info,
  Check,
  X,
  ExternalLink,
  Ban,
} from 'lucide-react'
import {
  extractTicketIdFromNotification,
  isNotificationTicketRenounced,
} from '../lib/renouncedAlerts'

type Notification = Database['public']['Tables']['notifications']['Row']

export interface AlertsPageProps {
  onBack?: () => void
  onSelectTicket?: (ticketId: string) => void
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onBack,
  onSelectTicket,
}) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [renouncedTicketIds, setRenouncedTicketIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  const loadNotifications = async () => {
    if (!user?.id) return
    try {
      // 1. Cargar notificaciones del usuario
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])

      // 2. Cargar participaciones del usuario para identificar décimos renunciados
      const { data: sharesData } = await supabase
        .from('ownership_shares')
        .select('ticket_id, status, role')
        .eq('user_id', user.id)

      const renounced = new Set(
        (sharesData || [])
          .filter((s) => s.role !== 'PROPIETARIO' && s.status === 'RENUNCIADA')
          .map((s) => s.ticket_id)
      )
      setRenouncedTicketIds(renounced)
    } catch (err) {
      console.error('Error cargando notificaciones:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()

    // Suscripción Realtime a cambios en notifications
    const channel = supabase
      .channel('alerts-page-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Marcar todas como leídas
  const handleMarkAllRead = async () => {
    if (!user?.id || isMarkingAll) return
    setIsMarkingAll(true)
    setActionMsg(null)

    try {
      const { error } = await supabase.rpc('mark_all_notifications_read')
      if (error) throw error

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setActionMsg({ type: 'success', text: 'Todas las notificaciones marcadas como leídas.' })
    } catch (err: unknown) {
      console.error('Error al marcar todas como leídas:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al marcar notificaciones.',
      })
    } finally {
      setIsMarkingAll(false)
    }
  }

  // Marcar una como leída al tocarla
  const handleCardClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      )
    }

    const targetTicketId = extractTicketIdFromNotification(notif)
    const isRenounced = isNotificationTicketRenounced(notif, renouncedTicketIds)

    if (isRenounced) {
      setActionMsg({
        type: 'info',
        text: 'Ya renunciaste a esta participación; no tienes acceso al décimo.',
      })
      return
    }

    if (targetTicketId && onSelectTicket) {
      onSelectTicket(targetTicketId)
    }
  }

  // Responder a solicitud de renuncia directamente desde la alerta
  const handleRespondWaiver = async (notif: Notification, accept: boolean) => {
    const meta = notif.metadata as Record<string, unknown> | null
    const shareId = meta?.share_id as string | undefined

    if (!shareId) {
      const targetTicketId = extractTicketIdFromNotification(notif)
      if (targetTicketId && onSelectTicket && !isNotificationTicketRenounced(notif, renouncedTicketIds)) {
        onSelectTicket(targetTicketId)
      }
      return
    }

    const confirmText = accept
      ? '¿Confirmas que deseas renunciar a tu participación? Tu cuota volverá al propietario.'
      : '¿Deseas rechazar la solicitud de renuncia y conservar tu cuota?'

    if (!confirm(confirmText)) return

    setActionLoadingId(notif.id)
    setActionMsg(null)
    try {
      const { error } = await supabase.rpc('respond_share_waiver', {
        p_share_id: shareId,
        p_accept: accept,
      })

      if (error) throw error

      // Marcar notificación(es) como leídas
      const targetTicketId = extractTicketIdFromNotification(notif)
      if (accept && targetTicketId && user?.id) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('ticket_id', targetTicketId)
      } else {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      }

      setActionMsg({
        type: 'success',
        text: accept
          ? 'Has aceptado la renuncia a la cuota.'
          : 'Has rechazado la solicitud de renuncia.',
      })
      await loadNotifications()
    } catch (err: unknown) {
      console.error('Error respondiendo a la renuncia desde alerta:', err)
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al responder a la solicitud de renuncia.',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Formato exacto HH:mm - DD/MM
  const formatNotificationTime = (isoString: string) => {
    const d = new Date(isoString)
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${hours}:${minutes} - ${day}/${month}`
  }

  // Obtener icono contextual
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PRIZE_WON':
      case 'PRIZE_COLLECTED':
      case 'TICKET_LIQUIDATED':
        return {
          icon: Trophy,
          bgClass: 'bg-amber-100',
          colorClass: 'text-amber-700',
        }
      case 'INVITE_ACCEPTED':
      case 'INVITE_RECEIVED':
      case 'SHARE_CREATED':
        return {
          icon: UserPlus,
          bgClass: 'bg-blue-100',
          colorClass: 'text-blue-700',
        }
      case 'WAIVER_REQUEST':
      case 'WAIVER_REJECTED':
      case 'PAYOUT_REMINDER':
        return {
          icon: AlertTriangle,
          bgClass: 'bg-amber-100',
          colorClass: 'text-amber-800',
        }
      default:
        return {
          icon: Info,
          bgClass: 'bg-gray-100',
          colorClass: 'text-gray-600',
        }
    }
  }

  const hasUnread = notifications.some((n) => !n.is_read)

  return (
    <div className="space-y-5 pb-16 max-w-xl mx-auto">
      {/* 1. Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-2xl bg-white dark:bg-[#1D1D1F] border border-black/[0.06] dark:border-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] hover:opacity-80 active:scale-95 transition shadow-xs"
              title="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Mis Notificaciones
            </h2>
            <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
              Avisos de sorteos, participaciones y cobros
            </p>
          </div>
        </div>

        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-semibold shadow-xs active:scale-95 transition cursor-pointer"
          >
            {isMarkingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            <span>Leídas todas</span>
          </button>
        )}
      </div>

      {actionMsg && (
        <div
          className={`p-3 rounded-2xl text-xs font-medium flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-[#3A5245] text-[#FFFFFF]'
              : actionMsg.type === 'info'
              ? 'bg-[#C5A880] text-[#1D1D1F]'
              : 'bg-[#D04848] text-[#FFFFFF]'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="p-1 opacity-80 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 2. Listado de Notificaciones */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#C5A880]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-dashed border-black/10 dark:border-white/15 p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F]/40 dark:text-[#F5F5F7]/40 flex items-center justify-center">
            <Bell className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Bandeja al día</h3>
          <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 max-w-xs mx-auto">
            Aquí recibirás notificaciones en tiempo real cuando alguien acepte tus participaciones o se comprueben los sorteos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const iconConfig = getNotificationIcon(item.type)
            const Icon = iconConfig.icon
            const targetTicketId = extractTicketIdFromNotification(item)
            const isRenounced = isNotificationTicketRenounced(item, renouncedTicketIds)
            const isWaiverRequest = item.type === 'WAIVER_REQUEST'

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={`p-4 rounded-[22px] border transition-all relative overflow-hidden cursor-pointer shadow-xs ${
                  item.is_read
                    ? 'bg-white dark:bg-[#1D1D1F] border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08]'
                    : 'bg-white dark:bg-[#1D1D1F] border-[#C5A880] border-l-4 border-l-[#C5A880] shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Círculo de icono contextual */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconConfig.bgClass} ${iconConfig.colorClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Contenido de la alerta */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold truncate text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 shrink-0 tabular-nums">
                        {formatNotificationTime(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 leading-relaxed">
                      {item.body}
                    </p>

                    {/* Acciones directas para solicitudes de renuncia */}
                    {isWaiverRequest && !isRenounced && (
                      <div
                        className="flex items-center gap-2 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleRespondWaiver(item, true)}
                          disabled={actionLoadingId === item.id}
                          className="py-1.5 px-3 rounded-xl bg-[#3A5245] text-[#FFFFFF] text-[11px] font-semibold flex items-center gap-1 hover:opacity-90 active:scale-95 transition"
                        >
                          {actionLoadingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          <span>Aceptar renuncia</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRespondWaiver(item, false)}
                          disabled={actionLoadingId === item.id}
                          className="py-1.5 px-3 rounded-xl border border-black/10 dark:border-white/15 bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] text-[11px] font-semibold flex items-center gap-1 hover:opacity-80 active:scale-95 transition"
                        >
                          <X className="h-3 w-3" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    )}

                    {/* Indicador de renuncia o enlace al billete */}
                    {isRenounced ? (
                      <div className="pt-1.5 flex items-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F5F5F7] dark:bg-white/10 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 text-[10px] font-medium cursor-default select-none">
                          <Ban className="h-3 w-3" />
                          <span>Participación renunciada · Sin acceso</span>
                        </span>
                      </div>
                    ) : (
                      targetTicketId && (
                        <div className="pt-1 flex items-center gap-1 text-[10px] font-semibold text-[#C5A880]">
                          <span>Ver décimo</span>
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
