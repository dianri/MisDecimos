import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { safeImageUrl } from '../../lib/sanitize'
import { PwaInstallBanner } from '../pwa/PwaInstallBanner'
import { VersionBadge } from '../common/VersionBadge'
import { TicketsPage } from '../../pages/TicketsPage'
import { TicketDetailPage } from '../../pages/TicketDetailPage'
import { AlertsPage } from '../../pages/AlertsPage'
import { AuditPage } from '../../pages/AuditPage'
import { ProfilePage } from '../../pages/ProfilePage'
import { Ticket, Bell, Shield, User as UserIcon, LogOut } from 'lucide-react'

export type TabType = 'billetes' | 'alertas' | 'auditoria' | 'perfil'

export const AppShell: React.FC = () => {
  const { user, profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('billetes')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0)

  // Consultar notificaciones no leídas y suscribirse a Realtime
  useEffect(() => {
    if (!user?.id) return

    async function checkUnread() {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('is_read', false)

        if (!error && typeof count === 'number') {
          setUnreadAlertsCount(count)
        }
      } catch (err) {
        console.error('Error verificando alertas no leídas:', err)
      }
    }

    checkUnread()

    const channel = supabase
      .channel('unread-alerts-counter')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          checkUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const userAvatar = safeImageUrl(profile?.avatar_url)

  return (
    <div className="min-h-screen bg-cream text-gray-900 flex flex-col justify-between selection:bg-lottery selection:text-white pb-20">
      {/* 1. Cabecera Superior Fija */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="max-w-xl mx-auto px-4 h-15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full border border-lottery/30 overflow-hidden bg-lottery-50 flex items-center justify-center shrink-0">
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-lottery" />
              )}
            </div>
            <div className="truncate max-w-[200px] sm:max-w-xs">
              <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                {profile?.display_name || user?.email?.split('@')[0] || 'Mi Cuenta'}
              </p>
              <p className="text-[10px] text-gray-400 font-mono truncate">{user?.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('¿Deseas cerrar la sesión en este dispositivo?')) {
                signOut()
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* 2. Banner de instalación PWA (si corresponde) */}
      <div className="max-w-xl mx-auto w-full">
        <PwaInstallBanner />
      </div>

      {/* 3. Contenedor de Contenido Principal según Pestaña */}
      <main className="max-w-xl mx-auto px-4 pt-4 flex-1 w-full">
        {activeTab === 'billetes' && (
          selectedTicketId ? (
            <TicketDetailPage
              ticketId={selectedTicketId}
              onBack={() => setSelectedTicketId(null)}
            />
          ) : (
            <TicketsPage
              onSelectTicket={(id) => setSelectedTicketId(id)}
              onNavigateToAlerts={() => {
                setSelectedTicketId(null)
                setActiveTab('alertas')
              }}
            />
          )
        )}
        {activeTab === 'alertas' && <AlertsPage />}
        {activeTab === 'auditoria' && <AuditPage />}
        {activeTab === 'perfil' && <ProfilePage />}
      </main>

      {/* 4. Badge Anti-Caché flotante (por encima de la barra inferior) */}
      <VersionBadge className="bottom-20 right-3" />

      {/* 5. Barra de Navegación Inferior Fija (BottomNav) */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-lg pb-safe"
      >
        <div className="max-w-xl mx-auto px-2 h-16 flex items-center justify-around">
          {/* Pestaña: Billetes */}
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'billetes') {
                setSelectedTicketId(null)
              }
              setActiveTab('billetes')
            }}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'billetes'
                ? 'text-lottery font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <div
              className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                activeTab === 'billetes' ? 'bg-[#E6F0EB]' : 'bg-transparent'
              }`}
            >
              <Ticket className="h-5 w-5" />
            </div>
            <span className="text-[10px] mt-0.5">Billetes</span>
          </button>

          {/* Pestaña: Alertas */}
          <button
            type="button"
            onClick={() => setActiveTab('alertas')}
            className={`relative flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'alertas'
                ? 'text-lottery font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <div
              className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                activeTab === 'alertas' ? 'bg-[#E6F0EB]' : 'bg-transparent'
              }`}
            >
              <Bell className="h-5 w-5" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">Alertas</span>
          </button>

          {/* Pestaña: Auditoría */}
          <button
            type="button"
            onClick={() => setActiveTab('auditoria')}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'auditoria'
                ? 'text-lottery font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <div
              className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                activeTab === 'auditoria' ? 'bg-[#E6F0EB]' : 'bg-transparent'
              }`}
            >
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-[10px] mt-0.5">Auditoría</span>
          </button>

          {/* Pestaña: Perfil */}
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'perfil'
                ? 'text-lottery font-bold'
                : 'text-gray-400 hover:text-gray-600 font-medium'
            }`}
          >
            <div
              className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                activeTab === 'perfil' ? 'bg-[#E6F0EB]' : 'bg-transparent'
              }`}
            >
              <UserIcon className="h-5 w-5" />
            </div>
            <span className="text-[10px] mt-0.5">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
