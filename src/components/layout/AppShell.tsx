import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { safeImageUrl } from '../../lib/sanitize'
import { useAndroidBackNavigation, parseRouteFromPath } from '../../hooks/useAndroidBackNavigation'
import { usePushPermissionPrompt } from '../../hooks/usePushPermissionPrompt'
import { usePwaInstallPrompt } from '../../hooks/usePwaInstallPrompt'
import { PwaInstallBanner } from '../pwa/PwaInstallBanner'
import { PushPermissionModal } from '../pwa/PushPermissionModal'
import { VersionBadge } from '../common/VersionBadge'
import { syncPushSubscription } from '../../lib/pushNotifications'
import { TicketsPage } from '../../pages/TicketsPage'
import { TicketDetailPage } from '../../pages/TicketDetailPage'
import { AlertsPage } from '../../pages/AlertsPage'
import { AuditPage } from '../../pages/AuditPage'
import { ProfilePage } from '../../pages/ProfilePage'
import { Ticket, Bell, User as UserIcon, LogOut, BellOff, X } from 'lucide-react'

export type TabType = 'billetes' | 'alertas' | 'auditoria' | 'perfil'

interface NavItem {
  id: TabType
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'billetes', label: 'Billetes', icon: Ticket },
  { id: 'alertas', label: 'Alertas', icon: Bell },
]

export const AppShell: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()
  const {
    activeTab,
    selectedTicketId,
    showExitToast,
    navigateTo,
    navigateToRootWithSearch,
    goBack,
  } = useAndroidBackNavigation()
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0)

  // Estado del modal de push para coordinar exclusividad mutua con el instalador PWA
  const [isPushModalOpen, setIsPushModalOpen] = useState(false)

  // Instalador y guía PWA multiplataforma (evita solapamiento con modal push o detalle de ticket)
  const pwaPrompt = usePwaInstallPrompt({
    isBlocked: isPushModalOpen || !!selectedTicketId,
  })

  // Onboarding inteligente de permisos de notificaciones push (evita solapamiento con modal PWA o ticket)
  const {
    isPromptOpen,
    promptContext,
    isActivating,
    showDismissToast,
    handleActivate,
    handleDismiss,
    closeDismissToast,
  } = usePushPermissionPrompt({
    userId: user?.id,
    profile,
    unreadCount: unreadAlertsCount,
    refreshProfile,
    isBlocked: pwaPrompt.isOpen || !!selectedTicketId,
  })

  // Sincronizar estado para el detector de bloqueo
  useEffect(() => {
    setIsPushModalOpen(isPromptOpen)
  }, [isPromptOpen])

  // Sincronización silenciosa de la suscripción Web Push al iniciar sesión o abrir la PWA
  useEffect(() => {
    if (!user?.id) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    if (Notification.permission === 'granted') {
      syncPushSubscription(user.id).catch((err) => {
        console.warn('Sincronización silenciosa de push pospuesta:', err)
      })
    }
  }, [user?.id])

  // Escuchar eventos de clic en notificaciones Push nativas desde el Service Worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'PUSH_NOTIFICATION_CLICK') {
        const { ticketId, notificationId, url } = data

        // 1. Navegación directa al recurso especificado
        if (ticketId) {
          navigateTo({ tab: 'billetes', ticketId })
        } else if (url) {
          const target = parseRouteFromPath(url)
          navigateTo(target)
        } else {
          navigateTo({ tab: 'alertas', ticketId: null })
        }

        // 2. Marcar la notificación como leída silenciosamente en Supabase si se provee su ID
        if (notificationId && user?.id) {
          Promise.resolve(
            supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('id', notificationId)
          ).catch((err: unknown) => {
            console.warn('Error marcando notificación push como leída:', err)
          })
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSwMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage)
    }
  }, [navigateTo, user?.id])

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
    <div className="min-h-screen bg-cream text-gray-900 flex flex-col justify-between selection:bg-lottery selection:text-white pb-24 md:pb-10">
      {/* 1. Cabecera Superior Fija */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs pt-[calc(0.875rem+env(safe-area-inset-top))] pb-3.5 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-2">
          {/* Izquierda: Logotipo y Marca MisDecimos -> Inicio (/) (Común Móvil y Escritorio) */}
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'billetes' && !selectedTicketId) {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              } else {
                navigateTo({ tab: 'billetes', ticketId: null })
              }
            }}
            aria-label="Ir a la pantalla principal"
            title="Inicio · Mis Billetes Compartidos"
            className="flex items-center gap-2 sm:gap-2.5 rounded-xl p-1 -ml-1 hover:bg-black/[0.03] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6146]/40 shrink-0"
          >
            <img
              src="/pwa-192x192.png"
              alt="MisDecimos"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-xs shrink-0"
              width={36}
              height={36}
            />
            <span className="text-base sm:text-lg font-bold tracking-tight text-gray-900">MisDecimos</span>
          </button>

          {/* Derecha Móvil (< 768px): Perfil de Usuario Compacto */}
          <div className="flex md:hidden items-center shrink-0">
            {(() => {
              const isProfileActive = (activeTab === 'perfil' || activeTab === 'auditoria') && !selectedTicketId
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'perfil' && !selectedTicketId) {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    } else {
                      navigateTo({ tab: 'perfil', ticketId: null })
                    }
                  }}
                  aria-label="Abrir mi perfil"
                  title="Ir a mi perfil"
                  className={`flex items-center gap-2 rounded-xl p-1 sm:px-2 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6146]/40 cursor-pointer ${
                    isProfileActive
                      ? 'bg-[#2E6146]/[0.08] ring-1 ring-[#2E6146]/30'
                      : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border border-lottery/30 overflow-hidden bg-lottery-50 flex items-center justify-center shrink-0 shadow-xs transition-all ${
                      isProfileActive ? 'ring-2 ring-[#2E6146]/50' : ''
                    }`}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-lottery" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-900 truncate max-w-[110px] leading-tight">
                    {profile?.display_name || user?.email?.split('@')[0] || 'Mi Cuenta'}
                  </span>
                </button>
              )
            })()}
          </div>

          {/* Derecha Escritorio (>= 768px): Enlaces de Navegación + Separador + Perfil de Usuario */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <nav aria-label="Navegación de escritorio" className="flex items-center gap-1.5">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id && !selectedTicketId
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigateTo({ tab: id, ticketId: null })}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#2E6146]/10 text-[#2E6146] font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.04] font-medium'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                      {id === 'alertas' && unreadAlertsCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                      )}
                    </div>
                    <span>{label}</span>
                    {id === 'alertas' && unreadAlertsCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {unreadAlertsCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Separador vertical sutil */}
            <div className="h-6 w-px bg-gray-200 mx-1" aria-hidden="true" />

            {/* Botón de Perfil Compacto en Escritorio */}
            {(() => {
              const isProfileActive = (activeTab === 'perfil' || activeTab === 'auditoria') && !selectedTicketId
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'perfil' && !selectedTicketId) {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    } else {
                      navigateTo({ tab: 'perfil', ticketId: null })
                    }
                  }}
                  aria-label="Abrir mi perfil"
                  title="Ir a mi perfil"
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6146]/40 cursor-pointer ${
                    isProfileActive
                      ? 'bg-[#2E6146]/[0.08] ring-1 ring-[#2E6146]/30'
                      : 'hover:bg-black/[0.04]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border border-lottery/30 overflow-hidden bg-lottery-50 flex items-center justify-center shrink-0 shadow-xs transition-all ${
                      isProfileActive ? 'ring-2 ring-[#2E6146]/50' : ''
                    }`}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-lottery" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-900 truncate max-w-[140px] leading-tight">
                    {profile?.display_name || user?.email?.split('@')[0] || 'Mi Cuenta'}
                  </span>
                </button>
              )
            })()}
          </div>
        </div>
      </header>

      {/* 2. Contenedor de Contenido Principal según Pestaña */}
      <main className="max-w-xl mx-auto px-4 pt-4 flex-1 w-full">
        {activeTab === 'billetes' && (
          selectedTicketId ? (
            <TicketDetailPage
              ticketId={selectedTicketId}
              onBack={goBack}
              onNavigateToRoot={(subTab) => {
                const search = subTab && subTab !== 'decimos' ? `?tab=${subTab}` : ''
                navigateToRootWithSearch(search)
              }}
            />
          ) : (
            <TicketsPage
              onSelectTicket={(id, options) =>
                navigateTo({
                  tab: 'billetes',
                  ticketId: id,
                  state: options?.state,
                })
              }
            />
          )
        )}
        {activeTab === 'alertas' && (
          <AlertsPage
            onBack={goBack}
            onSelectTicket={(ticketId) => navigateTo({ tab: 'billetes', ticketId })}
          />
        )}
        {activeTab === 'auditoria' && (
          <AuditPage
            onSelectTicket={(ticketId) => navigateTo({ tab: 'billetes', ticketId })}
            onBack={() => navigateTo({ tab: 'perfil', ticketId: null })}
          />
        )}
        {activeTab === 'perfil' && (
          <ProfilePage
            onNavigateToAudit={() => navigateTo({ tab: 'auditoria', ticketId: null })}
          />
        )}
      </main>

      {/* 4. Badge Anti-Caché flotante (por encima de la barra inferior en móvil) */}
      <VersionBadge className="bottom-20 md:bottom-6 right-3" />

      {/* 5. Modal de Solicitud Inteligente de Notificaciones Push */}
      <PushPermissionModal
        isOpen={isPromptOpen}
        context={promptContext}
        isActivating={isActivating}
        onActivate={handleActivate}
        onDismiss={handleDismiss}
      />

      {/* 6. Modal / Sheet Flotante de Instalación PWA Multiplataforma */}
      <PwaInstallBanner
        isOpen={pwaPrompt.isOpen}
        platform={pwaPrompt.platform}
        hasNativePrompt={pwaPrompt.hasNativePrompt}
        onInstall={pwaPrompt.install}
        onDismiss={pwaPrompt.dismiss}
        onNeverShowAgain={pwaPrompt.neverShowAgain}
      />

      {/* 7. Toast informativo al descartar notificaciones push (5s con enlace a Perfil) */}
      {showDismissToast && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 inset-x-4 max-w-md mx-auto z-50 bg-gray-900/95 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border border-white/10 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start gap-2.5">
            <BellOff className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-white">Notificaciones push no activadas</p>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                No recibirás notificaciones push en este dispositivo. Siempre puedes activarlas o desactivarlas en tu{' '}
                <button
                  type="button"
                  onClick={() => {
                    closeDismissToast()
                    navigateTo({ tab: 'perfil', ticketId: null })
                  }}
                  className="underline font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  Perfil
                </button>
                .
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDismissToast}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition shrink-0 cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 8. Toast flotante de confirmación de salida en Android */}
      {showExitToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 inset-x-0 mx-auto max-w-xs z-50 px-4 py-2.5 bg-gray-900/95 text-white text-xs font-medium rounded-full shadow-2xl backdrop-blur-md border border-white/10 flex items-center justify-center gap-2 pointer-events-none select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <LogOut className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Pulsa atrás de nuevo para cerrar la aplicación</span>
        </div>
      )}

      {/* 9. Barra de Navegación Inferior Fija Móvil (< 768px) */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-lg pb-safe"
      >
        <div className="max-w-xl mx-auto px-2 h-16 flex items-center justify-around">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigateTo({ tab: id, ticketId: null })}
                className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
                  isActive
                    ? 'text-lottery font-bold'
                    : 'text-gray-400 hover:text-gray-600 font-medium'
                }`}
              >
                <div
                  className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                    isActive ? 'bg-[#E6F0EB]' : 'bg-transparent'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {id === 'alertas' && unreadAlertsCount > 0 && (
                    <span className="absolute top-1 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
