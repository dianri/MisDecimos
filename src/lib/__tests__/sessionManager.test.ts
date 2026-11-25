import test from 'node:test'
import assert from 'node:assert/strict'
import type { Session } from '@supabase/supabase-js'
import { createSessionManager } from '../sessionManagerCore.ts'
import { createEdgeFunctionInvoker } from '../edgeFunctionError.ts'

function makeSession(expiresAtSeconds: number, token = 'jwt-token'): Session {
  return {
    access_token: token,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: expiresAtSeconds,
    token_type: 'bearer',
    user: { id: 'user-1' } as Session['user'],
  }
}

test('ensureFreshSession - deduplica múltiples llamadas simultáneas ejecutando refreshSession una sola vez', async () => {
  const nowMs = 1_700_000_000_000
  const nowSec = Math.floor(nowMs / 1000)
  const expiringSession = makeSession(nowSec + 20, 'old-jwt') // < 60s para caducar
  const freshSession = makeSession(nowSec + 3600, 'fresh-jwt')

  let refreshCalls = 0
  let signOutCalls = 0

  const { ensureFreshSession } = createSessionManager(
    {
      getSession: async () => ({ data: { session: expiringSession }, error: null }),
      refreshSession: async () => {
        refreshCalls += 1
        await new Promise((r) => setTimeout(r, 25))
        return { data: { session: freshSession }, error: null }
      },
      signOut: async () => {
        signOutCalls += 1
      },
    },
    () => nowMs
  )

  const [s1, s2, s3] = await Promise.all([
    ensureFreshSession(),
    ensureFreshSession(),
    ensureFreshSession(),
  ])

  assert.equal(refreshCalls, 1)
  assert.equal(signOutCalls, 0)
  assert.equal(s1?.access_token, 'fresh-jwt')
  assert.equal(s2?.access_token, 'fresh-jwt')
  assert.equal(s3?.access_token, 'fresh-jwt')
})

test('ensureFreshSession - ejecuta signOut si refreshSession falla con token inválido o expirado', async () => {
  const nowMs = 1_700_000_000_000
  const nowSec = Math.floor(nowMs / 1000)
  const expiredSession = makeSession(nowSec - 120, 'expired-jwt')

  let signOutCalls = 0

  const { ensureFreshSession } = createSessionManager(
    {
      getSession: async () => ({ data: { session: expiredSession }, error: null }),
      refreshSession: async () => ({
        data: { session: null },
        error: { message: 'Invalid Refresh Token: Already Used', status: 400 },
      }),
      signOut: async () => {
        signOutCalls += 1
      },
    },
    () => nowMs
  )

  const result = await ensureFreshSession()
  assert.equal(result, null)
  assert.equal(signOutCalls, 1)
})

test('invokeEdgeFunction - reintenta automáticamente una vez tras recibir un 401 inicial y tiene éxito', async () => {
  const nowSec = Math.floor(Date.now() / 1000)
  const refreshedSession = makeSession(nowSec + 3600, 'renewed-jwt')

  let invokeCalls = 0
  let forceRefreshCalls = 0
  let signOutCalls = 0

  const invokeEdgeFunction = createEdgeFunctionInvoker({
    ensureFreshSession: async (opts) => {
      if (opts?.force) {
        forceRefreshCalls += 1
        return refreshedSession
      }
      return makeSession(nowSec + 300, 'stale-jwt')
    },
    signOut: async () => {
      signOutCalls += 1
    },
    invoke: async <T>() => {
      invokeCalls += 1
      if (invokeCalls === 1) {
        const res = new Response(JSON.stringify({ error: 'Usuario no autenticado o sesión expirada' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
        return {
          data: null,
          error: { message: 'Edge Function returned a non-2xx status code', context: res },
        }
      }
      return {
        data: { ok: true, prizeAmountCents: 2000 } as T,
        error: null,
      }
    },
  })

  const data = await invokeEdgeFunction<{ ok: boolean; prizeAmountCents: number }>('check-prizes')
  assert.equal(invokeCalls, 2)
  assert.equal(forceRefreshCalls, 1)
  assert.equal(signOutCalls, 0)
  assert.deepEqual(data, { ok: true, prizeAmountCents: 2000 })
})

test('invokeEdgeFunction - ejecuta signOut si falla la renovación tras un 401', async () => {
  let signOutCalls = 0
  let invokeCalls = 0

  const invokeEdgeFunction = createEdgeFunctionInvoker({
    ensureFreshSession: async (opts) => {
      if (opts?.force) return null
      return makeSession(Math.floor(Date.now() / 1000) + 300, 'stale-jwt')
    },
    signOut: async () => {
      signOutCalls += 1
    },
    invoke: async () => {
      invokeCalls += 1
      const res = new Response(JSON.stringify({ error: 'Sesión expirada' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
      return {
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: res },
      }
    },
  })

  await assert.rejects(
    () => invokeEdgeFunction('check-prizes'),
    (err: Error) => err.message === 'Sesión expirada'
  )
  assert.equal(invokeCalls, 1)
  assert.equal(signOutCalls, 1)
})
