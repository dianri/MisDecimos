import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isStandaloneMode,
  detectDevicePlatform,
  type BeforeInstallPromptEvent,
} from '../../hooks/usePwaInstall.ts'

test('isStandaloneMode - detects display-mode: standalone correctly', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document

  // Standalone mode via matchMedia
  globalThis.window = {
    matchMedia: (query: string) => ({
      matches: query === '(display-mode: standalone)',
    }),
    navigator: {},
  } as unknown as Window & typeof globalThis

  assert.equal(isStandaloneMode(), true)

  // Standard browser tab (not standalone) even if localStorage has stale key
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: false },
  } as unknown as Window & typeof globalThis

  assert.equal(isStandaloneMode(), false)

  // iOS Safari navigator.standalone === true
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: true },
  } as unknown as Window & typeof globalThis

  assert.equal(isStandaloneMode(), true)

  // Android TWA referrer
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    navigator: {},
  } as unknown as Window & typeof globalThis
  globalThis.document = {
    referrer: 'android-app://com.example.misdecimos',
  } as unknown as Document

  assert.equal(isStandaloneMode(), true)

  globalThis.window = originalWindow
  globalThis.document = originalDocument
})

test('detectDevicePlatform - correctly classifies Android, iOS and Desktop', () => {
  // Android
  const androidNav = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
  }
  assert.equal(detectDevicePlatform(androidNav), 'android')

  // iPhone iOS
  const iphoneNav = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
  }
  assert.equal(detectDevicePlatform(iphoneNav), 'ios')

  // iPadOS with multitouch MacIntel
  const ipadosNav = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  }
  assert.equal(detectDevicePlatform(ipadosNav), 'ios')

  // Desktop Chrome on Windows
  const desktopNav = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
  }
  assert.equal(detectDevicePlatform(desktopNav), 'desktop')
})

test('window.__deferredPwaPrompt - global capture and appinstalled reset', () => {
  let promptCalled = false
  const mockPromptEvent = {
    preventDefault: () => {},
    prompt: async () => {
      promptCalled = true
    },
    userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
  } as unknown as BeforeInstallPromptEvent

  const listeners: Record<string, ((e: any) => void)[]> = {}
  const mockWindow = {
    __deferredPwaPrompt: null as BeforeInstallPromptEvent | null,
    addEventListener: (event: string, handler: (e: any) => void) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(handler)
    },
    removeEventListener: (event: string, handler: (e: any) => void) => {
      listeners[event] = (listeners[event] || []).filter((h) => h !== handler)
    },
    dispatchEvent: (event: Event) => {
      const handlers = listeners[event.type] || []
      handlers.forEach((h) => h(event))
      return true
    },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    navigator: {},
  }

  // Simulate main.tsx registration
  mockWindow.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    mockWindow.__deferredPwaPrompt = e
    mockWindow.dispatchEvent(new CustomEvent('pwa-deferred-prompt-ready'))
  })

  mockWindow.addEventListener('appinstalled', () => {
    mockWindow.__deferredPwaPrompt = null
    mockWindow.dispatchEvent(new CustomEvent('pwa-installed-event'))
  })

  // Trigger beforeinstallprompt
  let customEventDispatched = false
  mockWindow.addEventListener('pwa-deferred-prompt-ready', () => {
    customEventDispatched = true
  })

  mockWindow.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), mockPromptEvent))
  assert.equal(typeof mockWindow.__deferredPwaPrompt?.prompt, 'function')
  assert.equal(customEventDispatched, true)

  // Verify prompt can be called
  assert.equal(promptCalled, false)
  mockWindow.__deferredPwaPrompt?.prompt()
  assert.equal(promptCalled, true)

  // Trigger appinstalled to clean up
  let appInstalledDispatched = false
  mockWindow.addEventListener('pwa-installed-event', () => {
    appInstalledDispatched = true
  })
  mockWindow.dispatchEvent(new Event('appinstalled'))
  assert.equal(mockWindow.__deferredPwaPrompt, null)
  assert.equal(appInstalledDispatched, true)
})

test('installApp fallback simulation - opens instruction modal when deferredPrompt is null', async () => {
  let isModalOpen = false
  const openModal = () => {
    isModalOpen = true
  }

  // Simulate execution of installApp with deferredPrompt = null
  const installApp = async (prompt: BeforeInstallPromptEvent | null) => {
    if (prompt) {
      await prompt.prompt()
      return true
    } else {
      openModal()
      return false
    }
  }

  // Case 1: Prompt is null (Chrome Android cooldown after uninstallation or iOS Safari)
  const resultFallback = await installApp(null)
  assert.equal(resultFallback, false)
  assert.equal(isModalOpen, true)

  // Case 2: Prompt is available
  let promptExecuted = false
  const mockPrompt = {
    prompt: async () => {
      promptExecuted = true
    },
  } as BeforeInstallPromptEvent

  isModalOpen = false
  const resultPrompt = await installApp(mockPrompt)
  assert.equal(resultPrompt, true)
  assert.equal(promptExecuted, true)
  assert.equal(isModalOpen, false)
})
