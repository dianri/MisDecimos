export interface PurgeCacheDeps {
  serviceWorker?: {
    getRegistrations: () => Promise<ReadonlyArray<{ unregister: () => Promise<boolean> }>>
  }
  caches?: {
    keys: () => Promise<string[]>
    delete: (key: string) => Promise<boolean>
  }
  navigate?: (url: string) => void
}

/**
 * Desregistra todos los Service Workers activos, vacía CacheStorage y
 * redirige limpiamente a la raíz '/' para evitar errores 404 en recargas SPA.
 */
export async function forcePurgeCacheAndRedirect(deps?: PurgeCacheDeps): Promise<void> {
  const sw =
    deps?.serviceWorker ??
    (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : undefined)

  if (sw) {
    const registrations = await sw.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister()
    }
  }

  const cacheStorage =
    deps?.caches ??
    (typeof window !== 'undefined' && 'caches' in window ? window.caches : undefined)

  if (cacheStorage) {
    const cacheKeys = await cacheStorage.keys()
    await Promise.all(cacheKeys.map((key) => cacheStorage.delete(key)))
  }

  const navigate =
    deps?.navigate ??
    ((url: string) => {
      if (typeof window !== 'undefined') {
        window.location.replace(url)
      }
    })

  navigate('/')
}
