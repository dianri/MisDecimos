import React, { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
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
      // 1. Desregistrar Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.unregister()
        }
      }

      // 2. Vaciar cachés de CacheStorage
      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map((key) => caches.delete(key)))
      }

      // 3. Recargar limpio con timestamp
      const url = new URL(window.location.href)
      url.searchParams.set('t', Date.now().toString())
      window.location.href = url.toString()
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
      {/* Badge de versión (solo visible en Mi Perfil cuando es inline) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          variant === 'inline'
            ? `mx-auto flex items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-2.5 text-xs font-mono text-gray-600 shadow-xs transition-all hover:border-lottery-400 hover:text-lottery-700 hover:shadow-sm ${
                className || ''
              }`
            : `fixed z-40 flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-mono text-gray-600 shadow-sm backdrop-blur-sm transition-all hover:border-lottery-400 hover:text-lottery-700 hover:shadow ${
                className || 'bottom-20 right-3'
              }`
        }
        title="Información de compilación y diagnóstico"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
          }`}
        />
        <span>v{__APP_VERSION__}</span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-400">{__COMMIT_HASH__}</span>
      </button>

      {/* Modal de diagnóstico y purga */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lottery-50 text-lottery">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-gray-900">Diagnóstico de Versión</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Terminal className="h-3.5 w-3.5" /> Versión App
                </span>
                <span className="font-mono font-medium text-gray-900">v{__APP_VERSION__}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Terminal className="h-3.5 w-3.5" /> Commit Hash
                </span>
                <span className="font-mono font-medium text-gray-900">{__COMMIT_HASH__}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Clock className="h-3.5 w-3.5" /> Fecha Build
                </span>
                <span className="font-mono text-[11px] font-medium text-gray-800">{formattedBuildTime}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-gray-500">
                  {isOnline ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-rose-600" />}
                  Conectividad
                </span>
                <span className={`font-medium ${isOnline ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isOnline ? 'Online (Conectado)' : 'Offline (Sin red)'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleForcePurgeCache}
                disabled={isPurging}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lottery py-2.5 text-xs font-semibold text-white transition hover:bg-lottery-600 active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPurging ? 'animate-spin' : ''}`} />
                {isPurging ? 'Purgando Service Worker...' : 'Forzar actualización y limpiar caché'}
              </button>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                Elimina Service Workers registrados, borra CacheStorage y recarga la app.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
