import { test } from 'node:test'
import assert from 'node:assert'
import {
  urlBase64ToUint8Array,
  detectPlatform,
  getNotificationPermissionState,
  isPushSupported,
} from '../pushNotifications.ts'

test('urlBase64ToUint8Array - decodes base64 url-safe strings correctly', () => {
  // Test key sample
  const base64VapidKey = 'BJEnxKuSifaT3qA_Go4HgQ-TUhDy2_f_BowWw6e-SpMLfRNan7ly83swkhQYQ8bnetdwWC8a6RbMSB8lUoh_4b8'
  const uint8Arr = urlBase64ToUint8Array(base64VapidKey)

  assert.ok(uint8Arr instanceof Uint8Array, 'Debe devolver una instancia de Uint8Array')
  assert.strictEqual(uint8Arr.length, 65, 'Una clave pública VAPID P-256 tiene 65 bytes')
  assert.strictEqual(uint8Arr[0], 0x04, 'El primer byte de una clave no comprimida P-256 es 0x04')
})

test('urlBase64ToUint8Array - handles padding and URL-safe characters', () => {
  // Simple known string: "hello world" in url-safe base64 is "aGVsbG8gd29ybGQ"
  const bytes = urlBase64ToUint8Array('aGVsbG8gd29ybGQ')
  const str = String.fromCharCode(...Array.from(bytes))
  assert.strictEqual(str, 'hello world')
})

test('detectPlatform - detects android from userAgent', () => {
  const origNav = globalThis.navigator
  // Mock navigator.userAgent
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
    },
    writable: true,
    configurable: true,
  })

  try {
    const platform = detectPlatform()
    assert.strictEqual(platform, 'android')
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      writable: true,
      configurable: true,
    })
  }
})

test('detectPlatform - detects ios from userAgent', () => {
  const origNav = globalThis.navigator
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    },
    writable: true,
    configurable: true,
  })

  try {
    const platform = detectPlatform()
    assert.strictEqual(platform, 'ios')
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      writable: true,
      configurable: true,
    })
  }
})

test('detectPlatform - defaults to desktop for other user agents', () => {
  const origNav = globalThis.navigator
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
    },
    writable: true,
    configurable: true,
  })

  try {
    const platform = detectPlatform()
    assert.strictEqual(platform, 'desktop')
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      writable: true,
      configurable: true,
    })
  }
})

test('isPushSupported & getNotificationPermissionState safe defaults in Node environment', () => {
  assert.strictEqual(typeof isPushSupported(), 'boolean')
  assert.strictEqual(getNotificationPermissionState(), 'denied')
})
