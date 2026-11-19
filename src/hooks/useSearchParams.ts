import { useState, useEffect, useCallback } from 'react'

export type SearchParamsInit =
  | string
  | string[][]
  | Record<string, string | number | boolean | undefined | null>
  | URLSearchParams

/**
 * Hook ligero de parámetros de búsqueda en la URL compatible con la API de URLSearchParams.
 * Sincroniza de forma reactiva las lecturas y escrituras con window.location.search y popstate
 * sin dependencias externas pesadas, preservando el estado de navegación nativo de MisDecimos.
 */
export function useSearchParams(
  defaultInit?: SearchParamsInit
): [
  URLSearchParams,
  (
    nextInit: SearchParamsInit | ((prev: URLSearchParams) => SearchParamsInit),
    options?: { replace?: boolean; state?: Record<string, unknown> }
  ) => void
] {
  const getSearchParams = useCallback(() => {
    if (typeof window === 'undefined') {
      return new URLSearchParams(
        defaultInit as string | string[][] | Record<string, string> | undefined
      )
    }
    return new URLSearchParams(window.location.search)
  }, [defaultInit])

  const [searchParams, setSearchParamsState] = useState<URLSearchParams>(getSearchParams)

  // Escuchar eventos popstate del historial del navegador (navegación atrás/adelante)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setSearchParamsState(new URLSearchParams(window.location.search))
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const setSearchParams = useCallback(
    (
      nextInit: SearchParamsInit | ((prev: URLSearchParams) => SearchParamsInit),
      options?: { replace?: boolean; state?: Record<string, unknown> }
    ) => {
      if (typeof window === 'undefined') return

      const currentParams = new URLSearchParams(window.location.search)
      const resolved = typeof nextInit === 'function' ? nextInit(currentParams) : nextInit

      const newParams = new URLSearchParams()
      if (
        typeof resolved === 'string' ||
        Array.isArray(resolved) ||
        resolved instanceof URLSearchParams
      ) {
        const temp = new URLSearchParams(resolved)
        temp.forEach((val, key) => newParams.set(key, val))
      } else if (resolved && typeof resolved === 'object') {
        Object.entries(resolved).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            newParams.set(key, String(val))
          }
        })
      }

      const newSearchString = newParams.toString()
      const searchSuffix = newSearchString ? `?${newSearchString}` : ''
      const newUrl = `${window.location.pathname}${searchSuffix}${window.location.hash}`

      const nextState = {
        ...(window.history.state || {}),
        ...(options?.state || {}),
      }

      if (options?.replace) {
        window.history.replaceState(nextState, '', newUrl)
      } else {
        window.history.pushState(nextState, '', newUrl)
      }

      setSearchParamsState(newParams)
    },
    []
  )

  return [searchParams, setSearchParams]
}
