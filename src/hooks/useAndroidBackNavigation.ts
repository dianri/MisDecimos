import { useState, useEffect, useRef, useCallback } from 'react'
import type { TabType } from '../components/layout/AppShell'

interface HistoryItemState {
  tab: TabType
  ticketId: string | null
  idx: number
  exitGuard?: boolean
  isBase?: boolean
  isDirectEntry?: boolean
  modalOpen?: boolean
  fromTab?: string
  subTab?: string
  directFallbackTab?: string
}

export function parseRouteFromPath(rawPath: string): { tab: TabType; ticketId: string | null } {
  let pathname = rawPath || '/'
  try {
    if (pathname.includes('://')) {
      pathname = new URL(pathname).pathname
    }
  } catch {
    // fallback si no es URL absoluta válida
  }

  const cleanPath = pathname.split('?')[0].split('#')[0].trim()
  const lower = cleanPath.toLowerCase()

  const ticketPrefixes = [
    '/billetes/',
    '/billete/',
    '/decimos/',
    '/decimo/',
    '/tickets/',
    '/ticket/',
  ]

  for (const prefix of ticketPrefixes) {
    if (lower.startsWith(prefix)) {
      const id = cleanPath.substring(prefix.length).replace(/\/+$/, '').trim()
      return { tab: 'billetes', ticketId: id || null }
    }
  }

  if (lower === '/premios' || lower === '/premios/') {
    return { tab: 'premios', ticketId: null }
  }
  if (lower === '/alertas' || lower === '/alertas/') {
    return { tab: 'alertas', ticketId: null }
  }
  if (lower === '/auditoria' || lower === '/auditoria/') {
    return { tab: 'auditoria', ticketId: null }
  }
  if (lower === '/perfil' || lower === '/perfil/') {
    return { tab: 'perfil', ticketId: null }
  }

  return { tab: 'billetes', ticketId: null }
}

function parseInitialRoute(): { tab: TabType; ticketId: string | null } {
  if (typeof window === 'undefined') {
    return { tab: 'billetes', ticketId: null }
  }
  return parseRouteFromPath(window.location.pathname)
}

function getPathForRoute(tab: TabType, ticketId: string | null): string {
  if (ticketId) return `/billetes/${ticketId}`
  if (tab === 'billetes') return '/'
  return `/${tab}`
}

export function useAndroidBackNavigation() {
  const initialRoute = useRef(parseInitialRoute())
  const [activeTab, setActiveTab] = useState<TabType>(initialRoute.current.tab)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialRoute.current.ticketId
  )
  const [showExitToast, setShowExitToast] = useState(false)

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  const selectedTicketIdRef = useRef(selectedTicketId)
  selectedTicketIdRef.current = selectedTicketId

  const showExitToastRef = useRef(showExitToast)
  showExitToastRef.current = showExitToast

  const historyIdxRef = useRef(0)
  const exitTimerRef = useRef<number | null>(null)
  const isExitingRef = useRef(false)

  // Inicialización de historial en el arranque
  useEffect(() => {
    if (typeof window === 'undefined') return

    const { tab, ticketId } = initialRoute.current
    const isRoot = tab === 'billetes' && ticketId === null

    if (isRoot) {
      const currentSearch = window.location.search || ''
      const rootPath = `/${currentSearch}`

      // Estado base de la app
      window.history.replaceState(
        { tab: 'billetes', ticketId: null, idx: 0, isBase: true },
        '',
        rootPath
      )
      // Estado centinela para interceptar el botón Atrás de Android
      window.history.pushState(
        { tab: 'billetes', ticketId: null, idx: 0, exitGuard: true },
        '',
        rootPath
      )
      historyIdxRef.current = 0
    } else {
      // Entrada directa por deep-link o notificación
      const path = getPathForRoute(tab, ticketId)
      window.history.replaceState(
        { tab, ticketId, idx: 0, isDirectEntry: true },
        '',
        path
      )
      historyIdxRef.current = 0
    }

    const handlePopState = (e: PopStateEvent) => {
      // 1. Si un modal estaba abierto, el hook useModalBackHandler se encarga
      if (e.state?.modalOpen) {
        return
      }

      // 2. Si ya se confirmó la salida por doble tap
      if (isExitingRef.current) {
        return
      }

      const state = e.state as HistoryItemState | null
      const isCurrentlyAtRoot =
        activeTabRef.current === 'billetes' && selectedTicketIdRef.current === null

      // 3. Manejo en la RUTA RAÍZ: Interceptación y aviso de salida
      if (isCurrentlyAtRoot) {
        if (showExitToastRef.current) {
          // SEGUNDO TAP DENTRO DE LOS 2.5 SEGUNDOS -> Permitir salir de la PWA
          isExitingRef.current = true
          if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current)
            exitTimerRef.current = null
          }
          setShowExitToast(false)
          showExitToastRef.current = false
          window.history.back()
          return
        } else {
          // PRIMER TAP -> Interceptar y mostrar toast por 2.5 segundos
          setShowExitToast(true)
          showExitToastRef.current = true

          if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current)
          }

          exitTimerRef.current = window.setTimeout(() => {
            setShowExitToast(false)
            showExitToastRef.current = false
            exitTimerRef.current = null
          }, 2500)

          const currentSearch = window.location.search || ''
          const rootPath = `/${currentSearch}`

          // Rearmar la guardia centinela para capturar el siguiente tap
          window.history.pushState(
            { tab: 'billetes', ticketId: null, idx: 0, exitGuard: true },
            '',
            rootPath
          )
          return
        }
      }

      // 4. Manejo en RUTAS SECUNDARIAS
      const isCurrentSecondary =
        activeTabRef.current !== 'billetes' || selectedTicketIdRef.current !== null
      const isDirectEntry =
        state?.isDirectEntry ||
        (typeof state?.idx === 'number' &&
          state.idx === 0 &&
          !state.exitGuard &&
          !state.isBase)

      // 4A. Si se accedió por enlace directo sin historial previo dentro de la app (idx === 0)
      if (isCurrentSecondary && (historyIdxRef.current === 0 || isDirectEntry || !state)) {
        setActiveTab('billetes')
        setSelectedTicketId(null)
        historyIdxRef.current = 0

        const fallbackSubTab = state?.directFallbackTab
        const search =
          fallbackSubTab && fallbackSubTab !== 'decimos'
            ? `?tab=${fallbackSubTab}`
            : window.location.search || ''
        const rootPath = `/${search}`

        window.history.replaceState(
          { tab: 'billetes', ticketId: null, idx: 0, isBase: true },
          '',
          rootPath
        )
        window.history.pushState(
          { tab: 'billetes', ticketId: null, idx: 0, exitGuard: true },
          '',
          rootPath
        )
        return
      }

      // 4B. Navegación hacia atrás normal dentro de la app (idx > 0)
      if (state) {
        const nextTab = state.tab || 'billetes'
        const nextTicketId = state.ticketId || null
        setActiveTab(nextTab)
        setSelectedTicketId(nextTicketId)
        historyIdxRef.current =
          typeof state.idx === 'number'
            ? state.idx
            : Math.max(0, historyIdxRef.current - 1)

        // Si regresamos a la raíz y cayó en isBase, rearmar centinela
        if (nextTab === 'billetes' && nextTicketId === null && !state.exitGuard) {
          const currentSearch = window.location.search || ''
          const rootPath = `/${currentSearch}`
          window.history.pushState(
            { tab: 'billetes', ticketId: null, idx: 0, exitGuard: true },
            '',
            rootPath
          )
        }
      } else {
        // Respaldo defensivo
        setActiveTab('billetes')
        setSelectedTicketId(null)
        historyIdxRef.current = 0
        const currentSearch = window.location.search || ''
        const rootPath = `/${currentSearch}`
        window.history.replaceState(
          { tab: 'billetes', ticketId: null, idx: 0, isBase: true },
          '',
          rootPath
        )
        window.history.pushState(
          { tab: 'billetes', ticketId: null, idx: 0, exitGuard: true },
          '',
          rootPath
        )
      }

      // Limpiar toast si estaba activo
      if (showExitToastRef.current) {
        setShowExitToast(false)
        showExitToastRef.current = false
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current)
          exitTimerRef.current = null
        }
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

  // Navegar a una pestaña o billete añadiendo entrada al historial (sin replace: true)
  const navigateTo = useCallback(
    ({
      tab,
      ticketId = null,
      state: extraState = {},
    }: {
      tab: TabType
      ticketId?: string | null
      state?: Record<string, unknown>
    }) => {
      if (tab === activeTabRef.current && ticketId === selectedTicketIdRef.current) {
        return
      }

      const targetPath = getPathForRoute(tab, ticketId)
      const nextIdx = historyIdxRef.current + 1
      historyIdxRef.current = nextIdx

      window.history.pushState(
        {
          tab,
          ticketId,
          idx: nextIdx,
          ...extraState,
        },
        '',
        targetPath
      )

      setActiveTab(tab)
      setSelectedTicketId(ticketId)

      if (showExitToastRef.current) {
        setShowExitToast(false)
        showExitToastRef.current = false
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current)
          exitTimerRef.current = null
        }
      }
    },
    []
  )

  // Navegar a la raíz de billetes preservando o actualizando parámetros de búsqueda (?tab=...)
  const navigateToRootWithSearch = useCallback(
    (search: string = '', options?: { toastMsg?: string }) => {
      const cleanSearch = search ? (search.startsWith('?') ? search : `?${search}`) : ''
      const rootPath = `/${cleanSearch}`

      const baseState = {
        tab: 'billetes' as TabType,
        ticketId: null,
        idx: 0,
        isBase: true,
        ...(options?.toastMsg
          ? { toastMsg: options.toastMsg, claimToastMsg: options.toastMsg }
          : {}),
      }

      window.history.replaceState(
        baseState,
        '',
        rootPath
      )
      window.history.pushState(
        { ...baseState, exitGuard: true },
        '',
        rootPath
      )
      historyIdxRef.current = 0
      setActiveTab('billetes')
      setSelectedTicketId(null)

      if (showExitToastRef.current) {
        setShowExitToast(false)
        showExitToastRef.current = false
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current)
          exitTimerRef.current = null
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new PopStateEvent('popstate', {
            state: { ...baseState, exitGuard: true },
          })
        )
      }
    },
    []
  )

  // Retroceder en el historial
  const goBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  }, [])

  return {
    activeTab,
    selectedTicketId,
    showExitToast,
    navigateTo,
    navigateToRootWithSearch,
    goBack,
  }
}
