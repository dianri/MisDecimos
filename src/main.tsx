import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import type { BeforeInstallPromptEvent } from './hooks/usePwaInstall'

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null
  }
}

// Captura global de beforeinstallprompt y appinstalled en el arranque temprano
if (typeof window !== 'undefined') {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
    (typeof document !== 'undefined' && Boolean(document.referrer?.startsWith('android-app://')))

  // En modo navegador, limpiar cualquier marca previa de app instalada para recuperar el flujo tras desinstalar
  if (!isStandalone && typeof localStorage !== 'undefined') {
    localStorage.removeItem('misdecimos_pwa_installed')
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    window.__deferredPwaPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('pwa-deferred-prompt-ready'))
  })

  window.addEventListener('appinstalled', () => {
    window.__deferredPwaPrompt = null
    window.dispatchEvent(new CustomEvent('pwa-installed-event'))
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
