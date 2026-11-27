import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { safeImageUrl } from '../../lib/sanitize'
import { useAndroidBackNavigation, parseRouteFromPath } from '../../hooks/useAndroidBackNavigation'
import { usePushPermissionPrompt } from '../../hooks/usePushPermissionPrompt'
import { usePwaInstallPrompt } from '../../hooks/usePwaInstallPrompt'
import { PwaInstallBanner } from '../pwa/PwaInstallBanner'
import { PushPermissionModal } from '../pwa/PushPermissionModal'
import { syncPushSubscription } from '../../lib/pushNotifications'
import { TicketsPage } from '../../pages/TicketsPage'
import { PrizesPage } from '../../pages/PrizesPage'
import { TicketDetailPage } from '../../pages/TicketDetailPage'
import { AlertsPage } from '../../pages/AlertsPage'
import { AuditPage } from '../../pages/AuditPage'
import { ProfilePage } from '../../pages/ProfilePage'
import { DecimoIcon } from '../icons/DecimoIcon'
import { Trophy, Bell, User as UserIcon, LogOut, BellOff, X } from 'lucide-react'
import {
  resolveAlertDotPriority,
  getAlertDotColorClass,
  type UnreadAlertSummaryItem,
} from '../../lib/alertBadgePriority'

export type TabType = 'billetes' | 'premios' | 'alertas' | 'auditoria' | 'perfil'

interface NavItem {
  id: TabType
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'billetes', label: 'Décimos', icon: DecimoIcon },
  { id: 'premios', label: 'Premios', icon: Trophy },
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
  const [unreadAlerts, setUnreadAlerts] = useState<UnreadAlertSummaryItem[]>([])
  const unreadAlertsCount = unreadAlerts.length
  const alertDotPriority = resolveAlertDotPriority(unreadAlerts)
  const alertDotColorClass = getAlertDotColorClass(alertDotPriority)

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
        const { data, error } = await supabase
          .from('notifications')
          .select('type')
          .eq('user_id', user!.id)
          .eq('is_read', false)

        if (!error && Array.isArray(data)) {
          setUnreadAlerts(data)
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
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col justify-between selection:bg-[#C5A880] selection:text-[#1D1D1F] pb-24 md:pb-10 transition-colors">
      {/* 1. Cabecera Superior Fija */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1D1D1F]/95 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] pt-[calc(0.875rem+env(safe-area-inset-top))] pb-3.5 px-4 sm:px-6 transition-colors">
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
            title="Inicio · Mis Décimos Compartidos"
            className="flex items-center gap-2 sm:gap-2.5 rounded-xl p-1 -ml-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A880]/60 shrink-0"
          >
            <img
              src="/logo-4mills.png"
              alt="Mis Décimos"
              className="w-9 h-9 rounded-xl object-contain shadow-sm shrink-0"
              width={36}
              height={36}
            />
            <span className="text-base sm:text-lg font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Mis Décimos
            </span>
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
                  className={`flex items-center gap-2 rounded-xl p-1 sm:px-2 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A880]/60 cursor-pointer ${
                    isProfileActive
                      ? 'bg-[#3A5245]/12 dark:bg-[#3A5245]/30 ring-1 ring-[#3A5245]/40'
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border border-[#C5A880]/50 overflow-hidden bg-white dark:bg-[#1D1D1F] flex items-center justify-center shrink-0 shadow-xs transition-all ${
                      isProfileActive ? 'ring-2 ring-[#C5A880]/60' : ''
                    }`}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-[#1D1D1F] dark:text-[#F5F5F7]" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate max-w-[110px] leading-tight">
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
                const isAlertsBell = id === 'alertas'
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigateTo({ tab: id, ticketId: null })}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1D1D1F] text-[#F5F5F7] dark:bg-[#F5F5F7] dark:text-[#1D1D1F] font-semibold'
                        : 'text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      {isAlertsBell ? (
                        <Bell
                          className="w-4 h-4"
                          strokeWidth={1.75}
                          fill={isActive ? 'currentColor' : 'none'}
                        />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      {isAlertsBell && alertDotPriority && (
                        <span
                          aria-label="Alertas sin leer"
                          className={`absolute -top-0.5 -right-0.5 w-[7px] h-[7px] rounded-full ${alertDotColorClass} ring-2 ring-white dark:ring-[#1D1D1F]`}
                        />
                      )}
                    </div>
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Separador vertical sutil */}
            <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1" aria-hidden="true" />

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
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A880]/60 cursor-pointer ${
                    isProfileActive
                      ? 'bg-[#3A5245]/12 dark:bg-[#3A5245]/30 ring-1 ring-[#3A5245]/40'
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border border-[#C5A880]/50 overflow-hidden bg-white dark:bg-[#1D1D1F] flex items-center justify-center shrink-0 shadow-xs transition-all ${
                      isProfileActive ? 'ring-2 ring-[#C5A880]/60' : ''
                    }`}
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-[#1D1D1F] dark:text-[#F5F5F7]" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate max-w-[140px] leading-tight">
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
              onNavigateToRoot={(subTab, options) => {
                const search = subTab && subTab !== 'decimos' ? `?tab=${subTab}` : ''
                navigateToRootWithSearch(search, options)
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
        {activeTab === 'premios' && (
          <PrizesPage
            onSelectTicket={(ticketId) => navigateTo({ tab: 'billetes', ticketId })}
          />
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
            onSelectTicket={(ticketId) => navigateTo({ tab: 'billetes', ticketId })}
          />
        )}
      </main>

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
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#1D1D1F]/95 backdrop-blur-md border-t border-black/[0.08] dark:border-white/[0.1] shadow-lg pb-safe transition-colors"
      >
        <div className="max-w-xl mx-auto px-2 h-16 grid grid-cols-3 items-center">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            const isAlertsBell = id === 'alertas'
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigateTo({ tab: id, ticketId: null })}
                className={`min-h-[44px] w-full flex flex-col items-center justify-center py-1 transition-all ${
                  isActive
                    ? 'text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold'
                    : 'text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50 hover:text-[#1D1D1F]/80 dark:hover:text-[#F5F5F7]/80 font-medium'
                }`}
              >
                <div
                  className={`relative flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                    isActive ? 'bg-[#C5A880]/25 dark:bg-[#C5A880]/20' : 'bg-transparent'
                  }`}
                >
                  {isAlertsBell ? (
                    <Bell
                      className="h-5 w-5"
                      strokeWidth={1.75}
                      fill={isActive ? 'currentColor' : 'none'}
                    />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {isAlertsBell && alertDotPriority && (
                    <span
                      aria-label="Alertas sin leer"
                      className={`absolute top-0.5 right-1.5 w-[7px] h-[7px] rounded-full ${alertDotColorClass} ring-2 ring-white dark:ring-[#1D1D1F]`}
                    />
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
