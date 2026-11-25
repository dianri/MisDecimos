import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectPwaPlatform,
  getPwaPromptCount,
  incrementPwaPromptCount,
  resetPwaPromptCount,
  isPwaInstalled,
  isPwaPromptDismissed,
  dismissPwaPromptTemporarily,
  clearStalePwaInstalledState,
  checkGetInstalledRelatedApps,
  PWA_PROMPT_COUNT_KEY,
  PWA_INSTALLED_KEY,
  PWA_DISMISSED_KEY,
  PWA_DISMISS_TTL_MS,
} from '../../hooks/usePwaInstallPrompt.ts'

// Mocking minimal browser globals for Node test environment
class MockStorage {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }
  setItem(key: string, value: string): void {
    this.store[key] = value
  }
  removeItem(key: string): void {
    delete this.store[key]
  }
  clear(): void {
    this.store = {}
  }
}

test('detectPwaPlatform - detects iOS and iPadOS correctly', () => {
  // iPhone
  const iphoneNav = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
  }
  assert.equal(detectPwaPlatform(iphoneNav), 'ios')

  // iPadOS 16 reporting MacIntel with multitouch
  const ipadosNav = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  }
  assert.equal(detectPwaPlatform(ipadosNav), 'ios')
})

test('detectPwaPlatform - detects macOS Safari desktop', () => {
  const macSafariNav = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  }
  assert.equal(detectPwaPlatform(macSafariNav), 'macos-safari')
})

test('detectPwaPlatform - detects Android and Chromium browsers', () => {
  // Android Chrome
  const androidNav = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
  }
  assert.equal(detectPwaPlatform(androidNav), 'chromium')

  // Desktop Chrome on Windows
  const windowsChromeNav = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
  }
  assert.equal(detectPwaPlatform(windowsChromeNav), 'chromium')
})

test('detectPwaPlatform - detects desktop other (Firefox)', () => {
  // Desktop Firefox on Windows
  const firefoxNav = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0',
    platform: 'Win32',
    maxTouchPoints: 0,
  }
  assert.equal(detectPwaPlatform(firefoxNav), 'desktop-other')
})

test('PWA prompt count management', () => {
  const originalWindow = globalThis.window
  const mockLocalStorage = new MockStorage()

  globalThis.window = { localStorage: mockLocalStorage } as unknown as Window & typeof globalThis
  globalThis.localStorage = mockLocalStorage as unknown as Storage

  // Initial count
  assert.equal(getPwaPromptCount(), 0)

  // Increment
  assert.equal(incrementPwaPromptCount(), 1)
  assert.equal(getPwaPromptCount(), 1)
  assert.equal(mockLocalStorage.getItem(PWA_PROMPT_COUNT_KEY), '1')

  assert.equal(incrementPwaPromptCount(), 2)
  assert.equal(incrementPwaPromptCount(), 3)
  assert.equal(getPwaPromptCount(), 3)

  // Reset
  resetPwaPromptCount()
  assert.equal(getPwaPromptCount(), 0)

  globalThis.window = originalWindow
})

test('isPwaInstalled - ignores and clears stale PWA_INSTALLED_KEY in browser mode', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalLocalStorage = globalThis.localStorage
  const mockLocalStorage = new MockStorage()

  // Case 1: Browser mode with stale PWA_INSTALLED_KEY -> must clear key and return false
  mockLocalStorage.setItem(PWA_INSTALLED_KEY, 'true')
  globalThis.window = {
    localStorage: mockLocalStorage,
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: false },
  } as unknown as Window & typeof globalThis
  globalThis.document = { referrer: '' } as unknown as Document
  globalThis.localStorage = mockLocalStorage as unknown as Storage
  assert.equal(isPwaInstalled(), false)
  assert.equal(mockLocalStorage.getItem(PWA_INSTALLED_KEY), null)

  // Case 2: display-mode: standalone (keeps PWA_INSTALLED_KEY if present)
  mockLocalStorage.setItem(PWA_INSTALLED_KEY, 'true')
  globalThis.window = {
    localStorage: mockLocalStorage,
    matchMedia: (query: string) => ({ matches: query === '(display-mode: standalone)' }),
    navigator: {},
  } as unknown as Window & typeof globalThis
  assert.equal(clearStalePwaInstalledState(), false)
  assert.equal(mockLocalStorage.getItem(PWA_INSTALLED_KEY), 'true')
  assert.equal(isPwaInstalled(), true)

  // Case 3: iOS standalone property
  mockLocalStorage.clear()
  globalThis.window = {
    localStorage: mockLocalStorage,
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: true },
  } as unknown as Window & typeof globalThis
  assert.equal(isPwaInstalled(), true)

  // Case 4: Not installed
  globalThis.window = {
    localStorage: mockLocalStorage,
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: false },
  } as unknown as Window & typeof globalThis
  globalThis.document = { referrer: '' } as unknown as Document
  assert.equal(isPwaInstalled(), false)

  globalThis.window = originalWindow
  globalThis.document = originalDocument
  globalThis.localStorage = originalLocalStorage
})

test('isPwaPromptDismissed - enforces 7-day temporary expiration and migrates legacy permanent flag', () => {
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const mockLocalStorage = new MockStorage()

  globalThis.window = { localStorage: mockLocalStorage } as unknown as Window & typeof globalThis
  globalThis.localStorage = mockLocalStorage as unknown as Storage

  const t0 = 1_700_000_000_000
  assert.equal(isPwaPromptDismissed(t0), false)

  // Legacy permanent 'true' value is cleared and treated as not dismissed
  mockLocalStorage.setItem(PWA_DISMISSED_KEY, 'true')
  assert.equal(isPwaPromptDismissed(t0), false)
  assert.equal(mockLocalStorage.getItem(PWA_DISMISSED_KEY), null)

  // Temporary 7-day dismissal
  const expiresAt = dismissPwaPromptTemporarily(t0)
  assert.equal(expiresAt, t0 + PWA_DISMISS_TTL_MS)
  assert.equal(isPwaPromptDismissed(t0 + 6 * 24 * 60 * 60 * 1000), true)

  // Expired after 7 days -> clears key and returns false
  assert.equal(isPwaPromptDismissed(t0 + PWA_DISMISS_TTL_MS), false)
  assert.equal(mockLocalStorage.getItem(PWA_DISMISSED_KEY), null)

  globalThis.window = originalWindow
  globalThis.localStorage = originalLocalStorage
})

test('checkGetInstalledRelatedApps - detects installed apps via navigator API', async () => {
  const originalWindow = globalThis.window
  const mockLocalStorage = new MockStorage()

  globalThis.window = { localStorage: mockLocalStorage } as unknown as Window & typeof globalThis
  globalThis.localStorage = mockLocalStorage as unknown as Storage

  // Case 1: API not supported
  assert.equal(await checkGetInstalledRelatedApps({}), false)

  // Case 2: API supported but no related apps
  const emptyNav = {
    getInstalledRelatedApps: async () => [],
  }
  assert.equal(await checkGetInstalledRelatedApps(emptyNav), false)

  // Case 3: API supported and returns related app
  const appNav = {
    getInstalledRelatedApps: async () => [{ platform: 'webapp', url: 'https://misdecimos.dianrie.com/manifest.webmanifest' }],
  }
  assert.equal(await checkGetInstalledRelatedApps(appNav), true)
  assert.equal(mockLocalStorage.getItem(PWA_INSTALLED_KEY), 'true')

  globalThis.window = originalWindow
})
