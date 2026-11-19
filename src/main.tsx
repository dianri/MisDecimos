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
