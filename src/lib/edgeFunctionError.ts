import type { FunctionInvokeOptions, Session } from '@supabase/supabase-js'
import type { EnsureFreshSessionOptions } from './sessionManagerCore.ts'

/**
 * Extrae el mensaje de error real devuelto en el cuerpo JSON/texto de un
 * FunctionsHttpError de `supabase.functions.invoke`, evitando el mensaje opaco
 * "Edge Function returned a non-2xx status code".
 */
export async function extractFunctionErrorMessage(
  error: unknown,
  fallbackMessage = 'Error al consultar resultados oficiales.'
): Promise<string> {
  if (!error || typeof error !== 'object') {
    return fallbackMessage
  }

  const errObj = error as { message?: string; context?: unknown }
  const ctx = errObj.context

  if (ctx && typeof ctx === 'object') {
    const responseLike = ctx as {
      clone?: () => Response
      json?: () => Promise<unknown>
      text?: () => Promise<string>
    }

    try {
      const target = typeof responseLike.clone === 'function' ? responseLike.clone() : responseLike

      if (typeof target.text === 'function') {
        const rawText = await target.text().catch(() => '')
        if (rawText && rawText.trim()) {
          try {
            const parsed = JSON.parse(rawText) as { error?: unknown; message?: unknown }
            if (typeof parsed?.error === 'string' && parsed.error.trim()) {
              return parsed.error.trim()
            }
            if (typeof parsed?.message === 'string' && parsed.message.trim()) {
              return parsed.message.trim()
            }
          } catch {
            return rawText.trim()
          }
        }
      } else if (typeof target.json === 'function') {
        const body = await target.json().catch(() => null)
        if (body && typeof body === 'object') {
          const parsed = body as { error?: unknown; message?: unknown }
          if (typeof parsed.error === 'string' && parsed.error.trim()) {
            return parsed.error.trim()
          }
          if (typeof parsed.message === 'string' && parsed.message.trim()) {
            return parsed.message.trim()
          }
        }
      }
    } catch {
      // Si falla la lectura del cuerpo, se recurre a error.message
    }
  }

  if (typeof errObj.message === 'string' && errObj.message.trim()) {
    return errObj.message.trim()
  }

  return fallbackMessage
}

function isUnauthorizedFunctionError(error: unknown, extractedMessage: string): boolean {
  if (error && typeof error === 'object') {
    const errObj = error as { status?: number; context?: { status?: number } }
    if (errObj.context?.status === 401 || errObj.status === 401) {
      return true
    }
  }

  const lower = extractedMessage.toLowerCase()
  return (
    lower.includes('no autenticado') ||
    lower.includes('sesión expirada') ||
    lower.includes('jwt expired') ||
    lower.includes('invalid jwt') ||
    lower.includes('401')
  )
}

export interface EdgeFunctionInvokerDeps {
  invoke: <T>(
    functionName: string,
    options?: FunctionInvokeOptions
  ) => Promise<{ data: T | null; error: unknown }>
  ensureFreshSession: (options?: EnsureFreshSessionOptions) => Promise<Session | null>
  signOut: () => Promise<unknown>
}

/**
 * Crea un invocador resiliente de Edge Functions con refresco preventivo de sesión,
 * reintento único ante HTTP 401 y cierre de sesión limpio si el refresh token caducó.
 */
export function createEdgeFunctionInvoker(deps: EdgeFunctionInvokerDeps) {
  return async function invokeEdgeFunction<T = unknown>(
    functionName: string,
    options?: FunctionInvokeOptions
  ): Promise<T> {
    await deps.ensureFreshSession()

    const { data, error } = await deps.invoke<T>(functionName, options)

    if (!error) {
      return data as T
    }

    const firstMessage = await extractFunctionErrorMessage(error)
    if (!isUnauthorizedFunctionError(error, firstMessage)) {
      throw new Error(firstMessage)
    }

    // Reintento único tras forzar renovación de sesión
    const refreshedSession = await deps.ensureFreshSession({ force: true })
    if (!refreshedSession) {
      await deps.signOut().catch(() => {})
      throw new Error(firstMessage)
    }

    const { data: retryData, error: retryError } = await deps.invoke<T>(functionName, options)
    if (!retryError) {
      return retryData as T
    }

    const retryMessage = await extractFunctionErrorMessage(retryError)
    if (isUnauthorizedFunctionError(retryError, retryMessage)) {
      await deps.signOut().catch(() => {})
    }

    throw new Error(retryMessage)
  }
}
