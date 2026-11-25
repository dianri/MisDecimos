import React, { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import { forcePurgeCacheAndRedirect } from '../../lib/versionPurge'
import { Wifi, WifiOff, RefreshCw, X, ShieldCheck, Terminal, Clock } from 'lucide-react'

interface VersionBadgeProps {
  className?: string
  variant?: 'floating' | 'inline'
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({
  className,
  variant = 'floating',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  useModalBackHandler({ isOpen, onClose: () => setIsOpen(false), modalKey: 'version_diag_modal' })
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isPurging, setIsPurging] = useState(false)

  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (r) {
        // Comprobar actualizaciones periódicamente cada 60 segundos
        setInterval(() => {
          r.update().catch((err) => console.error('Error al comprobar actualización de SW:', err))
        }, 60 * 1000)

        // Comprobar actualización al recuperar visibilidad o foco
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            r.update().catch((err) => console.error('Error al comprobar actualización de SW:', err))
          }
        })
      }
    },
    onNeedRefresh() {
      // Auto-aplicar la actualización inmediatamente sin mostrar ningún cartel al usuario
      updateServiceWorker(true).catch((err) => console.error('Error al auto-actualizar SW:', err))
    },
    onRegisterError(error) {
      console.error('Error al registrar SW:', error)
    },
  })

  // Recarga limpia cuando el nuevo Service Worker toma el control (clientes activos)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let refreshing = false
      const handleControllerChange = () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      }
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      }
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleForcePurgeCache = async () => {
    try {
      setIsPurging(true)
      await forcePurgeCacheAndRedirect()
    } catch (err) {
      console.error('Error al purgar la caché:', err)
      alert('Error al purgar la caché: ' + (err instanceof Error ? err.message : String(err)))
      setIsPurging(false)
    }
  }

  const formattedBuildTime = (() => {
    try {
      return new Date(__BUILD_TIME__).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    } catch {
      return __BUILD_TIME__
    }
  })()

  return (
    <>
      {/* Píldora flotante de versión (visible en Mi Perfil) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          variant === 'inline'
            ? `mx-auto inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#1D1D1F]/90 backdrop-blur-md border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shadow-sm text-xs font-mono text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 hover:border-[#C5A880] transition-colors cursor-pointer ${
                className || ''
              }`
            : `fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 z-30 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#1D1D1F]/90 backdrop-blur-md border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 shadow-sm text-xs font-mono text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 hover:border-[#C5A880] transition-colors cursor-pointer ${
                className || ''
              }`
        }
        title="Información de compilación y diagnóstico"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-[#3A5245] dark:bg-[#6EE7B7]' : 'bg-[#D04848]'
          }`}
        />
        <span>v{__APP_VERSION__}</span>
        <span className="opacity-50">·</span>
        <span>{__COMMIT_HASH__}</span>
      </button>

      {/* Modal de diagnóstico y purga */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-[22px] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 bg-white dark:bg-[#1D1D1F] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3A5245]/10 dark:bg-[#3A5245]/30 text-[#3A5245] dark:text-[#C5A880]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Diagnóstico de Versión
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                  <Terminal className="h-3.5 w-3.5" /> Versión App
                </span>
                <span className="font-mono font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  v{__APP_VERSION__}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                  <Terminal className="h-3.5 w-3.5" /> Commit Hash
                </span>
                <span className="font-mono font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {__COMMIT_HASH__}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                  <Clock className="h-3.5 w-3.5" /> Fecha Build
                </span>
                <span className="font-mono text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {formattedBuildTime}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                  {isOnline ? (
                    <Wifi className="h-3.5 w-3.5 text-[#3A5245] dark:text-[#6EE7B7]" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-[#D04848]" />
                  )}
                  Conectividad
                </span>
                <span
                  className={`font-medium ${
                    isOnline ? 'text-[#3A5245] dark:text-[#6EE7B7]' : 'text-[#D04848]'
                  }`}
                >
                  {isOnline ? 'Online (Conectado)' : 'Offline (Sin red)'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleForcePurgeCache}
                disabled={isPurging}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C5A880] hover:bg-[#B8996F] py-2.5 text-xs font-semibold text-[#1D1D1F] transition active:scale-98 disabled:opacity-45 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPurging ? 'animate-spin' : ''}`} />
                {isPurging ? 'Purgando Service Worker...' : 'Forzar actualización y limpiar caché'}
              </button>
              <p className="mt-2 text-center text-[10px] text-[#1D1D1F]/50 dark:text-[#F5F5F7]/50">
                Elimina Service Workers registrados, borra CacheStorage y recarga la app en /.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
