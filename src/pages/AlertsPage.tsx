import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Database } from '../types/database.types'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'

type Notification = Database['public']['Tables']['notifications']['Row']

export const AlertsPage: React.FC = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    async function loadNotifications() {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setNotifications(data || [])
      } catch (err) {
        console.error('Error cargando notificaciones:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadNotifications()

    // Suscripción Realtime a nuevas notificaciones
    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const markAllAsRead = async () => {
    if (!user?.id) return
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marcando como leídas:', err)
    }
  }

  const markSingleAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
    } catch (err) {
      console.error('Error al marcar notificación:', err)
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Alertas</h2>
          <p className="text-xs text-gray-500">
            Avisos de invitaciones, renuncias y cobro de premios
          </p>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 active:scale-95 transition shadow-sm"
          >
            <CheckCheck className="h-3.5 w-3.5 text-lottery" />
            <span>Marcar leídas</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-lottery" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Bandeja de alertas al día</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Aquí recibirás notificaciones en tiempo real cuando alguien acepte tus participaciones o solicite renuncias.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => !item.is_read && markSingleAsRead(item.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                item.is_read
                  ? 'bg-white border-gray-100 text-gray-600'
                  : 'bg-emerald-50/50 border-emerald-200/80 shadow-sm text-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!item.is_read && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <h4 className="text-xs font-bold leading-tight">{item.title}</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-snug">{item.body}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                  {new Date(item.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
