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
} from 'lucide-react'

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
  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const loadNotifications = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
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

    if (notif.ticket_id && onSelectTicket) {
      onSelectTicket(notif.ticket_id)
    }
  }

  // Responder a solicitud de renuncia directamente desde la alerta
  const handleRespondWaiver = async (notif: Notification, accept: boolean) => {
    const meta = notif.metadata as Record<string, unknown> | null
    const shareId = meta?.share_id as string | undefined

    if (!shareId) {
      if (notif.ticket_id && onSelectTicket) {
        onSelectTicket(notif.ticket_id)
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

      // Marcar notificación como leída
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)

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
              className="p-2 rounded-2xl bg-white border border-gray-200/80 text-gray-700 hover:bg-gray-50 active:scale-95 transition shadow-xs"
              title="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              Mis Notificaciones
            </h2>
            <p className="text-[11px] text-gray-500">
              Avisos de sorteos, participaciones y cobros
            </p>
          </div>
        </div>

        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lottery hover:bg-lottery-dark text-white text-xs font-bold shadow-xs active:scale-95 transition"
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
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 2. Listado de Notificaciones */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-lottery" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Bandeja al día</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Aquí recibirás notificaciones en tiempo real cuando alguien acepte tus participaciones o se comprueben los sorteos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const iconConfig = getNotificationIcon(item.type)
            const Icon = iconConfig.icon
            const isWaiverRequest = item.type === 'WAIVER_REQUEST'

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={`p-4 rounded-2xl border transition-all relative overflow-hidden cursor-pointer shadow-xs ${
                  item.is_read
                    ? 'bg-white border-gray-200/80 hover:border-gray-300'
                    : 'bg-white border-lottery/40 border-l-4 border-l-lottery hover:border-lottery shadow-sm'
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
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate ${
                          item.is_read ? 'text-gray-900' : 'text-gray-950'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                        {formatNotificationTime(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed">{item.body}</p>

                    {/* Acciones directas para solicitudes de renuncia */}
                    {isWaiverRequest && (
                      <div
                        className="flex items-center gap-2 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleRespondWaiver(item, true)}
                          disabled={actionLoadingId === item.id}
                          className="py-1 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-700 active:scale-95 transition shadow-2xs"
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
                          className="py-1 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-bold flex items-center gap-1 hover:bg-gray-50 active:scale-95 transition"
                        >
                          <X className="h-3 w-3" />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    )}

                    {/* Enlace al billete si tiene ticket_id */}
                    {item.ticket_id && (
                      <div className="pt-1 flex items-center gap-1 text-[10px] font-semibold text-lottery">
                        <span>Ver billete</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
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
