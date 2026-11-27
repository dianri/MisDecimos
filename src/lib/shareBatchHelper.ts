export interface ShareableInviteItem {
  id: string
  short_code: string
  invite_token: string
  percentage: number
  label?: string | null
  ticketNumber?: string
  drawName?: string
}

function extractPartNumber(label?: string | null): number | null {
  if (!label) return null
  const match = /parte\s*(\d+)/i.exec(label)
  return match ? Number(match[1]) : null
}

/**
 * Ordena un lote de invitaciones por número de parte (Parte 2, Parte 3...) o etiqueta.
 */
export function sortCreatedInvitations<T extends { label?: string | null; short_code?: string }>(
  invites: T[]
): T[] {
  return [...invites].sort((a, b) => {
    const partA = extractPartNumber(a.label)
    const partB = extractPartNumber(b.label)
    if (partA !== null && partB !== null && partA !== partB) {
      return partA - partB
    }
    if (partA !== null && partB === null) return -1
    if (partA === null && partB !== null) return 1
    return String(a.label || a.short_code || '').localeCompare(
      String(b.label || b.short_code || '')
    )
  })
}

/**
 * Devuelve el índice de la siguiente invitación pendiente de compartir tras marcar la actual,
 * buscando primero hacia adelante y luego desde el principio. Devuelve null si todas están compartidas.
 */
export function findNextPendingInviteIndex(
  invites: Pick<ShareableInviteItem, 'id'>[],
  sharedIds: ReadonlySet<string>,
  currentIndex: number
): number | null {
  if (invites.length <= 1) return null

  for (let i = currentIndex + 1; i < invites.length; i += 1) {
    if (!sharedIds.has(invites[i].id)) return i
  }
  for (let i = 0; i < currentIndex; i += 1) {
    if (!sharedIds.has(invites[i].id)) return i
  }
  return null
}
