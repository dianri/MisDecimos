import type { Session } from '@supabase/supabase-js'

export const SESSION_REFRESH_THRESHOLD_SECONDS = 60

export interface SessionAuthClient {
  getSession: () => Promise<{
    data: { session: Session | null }
    error: { message?: string } | null
  }>
  refreshSession: () => Promise<{
    data: { session: Session | null }
    error: { message?: string; status?: number } | null
  }>
  signOut: () => Promise<{ error: { message?: string } | null } | void>
}

export interface EnsureFreshSessionOptions {
  force?: boolean
}

function isInvalidRefreshError(error: { message?: string; status?: number } | null | undefined): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.status === 400 ||
    error.status === 401 ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found') ||
    msg.includes('expired') ||
    msg.includes('invalid_grant')
  )
}

/**
 * Crea un gestor de sesión con deduplicación de refrescos concurrentes (`inFlightRefresh`)
 * para proteger la rotación de refresh tokens de un solo uso en Supabase.
 */
export function createSessionManager(
  authClient: SessionAuthClient,
  nowMs: () => number = () => Date.now()
) {
  let inFlightRefresh: Promise<Session | null> | null = null

  const ensureFreshSession = async (
    options: EnsureFreshSessionOptions = {}
  ): Promise<Session | null> => {
    if (inFlightRefresh) {
      return inFlightRefresh
    }

    const run = async (): Promise<Session | null> => {
      const {
        data: { session },
      } = await authClient.getSession()

      if (!session && !options.force) {
        return null
      }

      const nowSeconds = Math.floor(nowMs() / 1000)
      const expiresAt = session?.expires_at ?? 0
      const secondsRemaining = expiresAt - nowSeconds

      const needsRefresh =
        options.force === true || !expiresAt || secondsRemaining < SESSION_REFRESH_THRESHOLD_SECONDS

      if (!needsRefresh && session) {
        return session
      }

      const { data: refreshedData, error: refreshError } = await authClient.refreshSession()

      if (refreshError || !refreshedData?.session) {
        if (isInvalidRefreshError(refreshError) || !refreshedData?.session) {
          await authClient.signOut().catch(() => {})
        }
        return null
      }

      return refreshedData.session
    }

    inFlightRefresh = run().finally(() => {
      inFlightRefresh = null
    })

    return inFlightRefresh
  }

  return {
    ensureFreshSession,
  }
}
