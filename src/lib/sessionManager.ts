import { supabase } from './supabase'
import { createSessionManager } from './sessionManagerCore'

export {
  createSessionManager,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  type SessionAuthClient,
  type EnsureFreshSessionOptions,
} from './sessionManagerCore'

const defaultSessionManager = createSessionManager(supabase.auth)

export const ensureFreshSession = defaultSessionManager.ensureFreshSession

/**
 * Registra un listener `visibilitychange` que renueva preventivamente la sesión
 * cuando la PWA vuelve a primer plano si existe una sesión activa.
 */
export function registerVisibilitySessionRefresh(): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const handleVisibilityChange = async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        await ensureFreshSession()
      }
    } catch (err) {
      console.warn('[sessionManager] Error en refresco preventivo al recuperar foco:', err)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
