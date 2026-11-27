import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  findNextPendingInviteIndex,
  sortCreatedInvitations,
  type ShareableInviteItem,
} from '../shareBatchHelper.ts'

test('sortCreatedInvitations - ordena invitaciones de lote por Parte 2, Parte 3, etc.', () => {
  const unsorted = [
    { id: '3', short_code: '333333', label: 'Parte 4' },
    { id: '1', short_code: '111111', label: 'Parte 2' },
    { id: '2', short_code: '222222', label: 'Parte 3' },
  ]

  const sorted = sortCreatedInvitations(unsorted)
  assert.deepEqual(
    sorted.map((i) => i.label),
    ['Parte 2', 'Parte 3', 'Parte 4']
  )
})

test('findNextPendingInviteIndex - avanza al siguiente código no compartido y devuelve null al completar el lote', () => {
  const batch: ShareableInviteItem[] = [
    { id: 'inv-1', short_code: '111111', invite_token: 'tok-1', percentage: 33.33, label: 'Parte 2' },
    { id: 'inv-2', short_code: '222222', invite_token: 'tok-2', percentage: 33.33, label: 'Parte 3' },
  ]

  // 1 única invitación: nunca muestra avance
  assert.equal(findNextPendingInviteIndex([batch[0]], new Set(['inv-1']), 0), null)

  // Lote de 2: al compartir inv-1 (index 0) avanza a inv-2 (index 1)
  assert.equal(findNextPendingInviteIndex(batch, new Set(['inv-1']), 0), 1)

  // Al compartir inv-2 (index 1) con inv-1 ya compartida: devuelve null (todas compartidas)
  assert.equal(findNextPendingInviteIndex(batch, new Set(['inv-1', 'inv-2']), 1), null)
})

test('CreateParticipationSheet, OwnershipBreakdownCard y ShareInviteModal integran apertura automática y selector de lote', () => {
  const sheetSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/CreateParticipationSheet.tsx'),
    'utf8'
  )
  const breakdownSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/OwnershipBreakdownCard.tsx'),
    'utf8'
  )
  const modalSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/ShareInviteModal.tsx'),
    'utf8'
  )

  // Equal split recupera invitaciones creadas y las pasa ordenadas
  assert.ok(sheetSource.includes('sortCreatedInvitations'))
  assert.ok(sheetSource.includes('onEqualSplitComplete(mappedInvites)'))

  // OwnershipBreakdownCard abre ShareInviteModal automáticamente tras crear 1 o varias
  assert.ok(breakdownSource.includes('setActiveShareBatch([newInvite])'))
  assert.ok(breakdownSource.includes('setActiveShareBatch(createdInvitations)'))

  // ShareInviteModal distingue modo individual (length === 1) vs lote (length > 1)
  assert.ok(modalSource.includes('const isBatchMode = effectiveInvites.length > 1'))
  assert.ok(modalSource.includes('Invitación {currentIndex + 1} de {effectiveInvites.length} · Código único por persona'))
  assert.ok(modalSource.includes('markCurrentSharedAndAdvance'))
  assert.ok(modalSource.includes('Todas las invitaciones han sido compartidas'))
  assert.ok(modalSource.includes('<span>Listo</span>'))
})
