import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { forcePurgeCacheAndRedirect } from '../versionPurge.ts'

test('forcePurgeCacheAndRedirect - desregistra Service Workers, limpia CacheStorage y redirige a "/"', async () => {
  let unregisteredCount = 0
  const deletedCaches: string[] = []
  let navigatedTo: string | null = null

  await forcePurgeCacheAndRedirect({
    serviceWorker: {
      getRegistrations: async () => [
        {
          unregister: async () => {
            unregisteredCount += 1
            return true
          },
        },
        {
          unregister: async () => {
            unregisteredCount += 1
            return true
          },
        },
      ],
    },
    caches: {
      keys: async () => ['workbox-precache-v2', 'runtime-cache'],
      delete: async (key: string) => {
        deletedCaches.push(key)
        return true
      },
    },
    navigate: (url: string) => {
      navigatedTo = url
    },
  })

  assert.equal(unregisteredCount, 2)
  assert.deepEqual(deletedCaches, ['workbox-precache-v2', 'runtime-cache'])
  assert.equal(navigatedTo, '/')
})

test('ProfilePage muestra píldora flotante de versión exclusivamente en Mi Perfil y abre diagnóstico', () => {
  const profileSource = readFileSync(resolve(process.cwd(), 'src/pages/ProfilePage.tsx'), 'utf8')
  const badgeSource = readFileSync(resolve(process.cwd(), 'src/components/common/VersionBadge.tsx'), 'utf8')
  const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))

  // Píldora flotante en ProfilePage y ausente en el resto de páginas autenticadas
  assert.ok(profileSource.includes('<VersionBadge variant="floating"'))
  assert.ok(!profileSource.includes('<VersionBadge variant="inline"'))

  for (const page of ['LoginPage.tsx', 'TicketsPage.tsx', 'PrizesPage.tsx', 'AlertsPage.tsx', 'TicketDetailPage.tsx', 'AuditPage.tsx']) {
    const src = readFileSync(resolve(process.cwd(), `src/pages/${page}`), 'utf8')
    assert.ok(!src.includes('VersionBadge'), `${page} no debe renderizar VersionBadge`)
  }

  const loginSource = readFileSync(resolve(process.cwd(), 'src/pages/LoginPage.tsx'), 'utf8')
  assert.ok(!loginSource.includes('__APP_VERSION__'), 'LoginPage no debe mostrar número de versión')
  assert.ok(loginSource.includes('Mis Décimos · Plataforma segura PWA de reparto de Lotería'))

  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
  const shellSource = readFileSync(resolve(process.cwd(), 'src/components/layout/AppShell.tsx'), 'utf8')
  assert.ok(!appSource.includes('VersionBadge'), 'App.tsx no debe renderizar VersionBadge')
  assert.ok(!shellSource.includes('VersionBadge'), 'AppShell.tsx no debe renderizar VersionBadge')

  // Modal de diagnóstico se abre al pulsar la píldora y ejecuta limpieza hacia '/'
  assert.ok(badgeSource.includes('onClick={() => setIsOpen(true)}'))
  assert.ok(badgeSource.includes('Diagnóstico de Versión'))
  assert.ok(badgeSource.includes('forcePurgeCacheAndRedirect'))

  // vercel.json incluye rewrite SPA hacia /index.html
  assert.deepEqual(vercelConfig.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
})
