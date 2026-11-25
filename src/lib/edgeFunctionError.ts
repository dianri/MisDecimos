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
