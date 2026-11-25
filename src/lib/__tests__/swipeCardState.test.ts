import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SWIPE_ACTION_WIDTH,
  clampSwipeOffset,
  resolveSwipeSnap,
  detectHorizontalSwipeLock,
  resolveCardTapWithSwipe,
  resolveScannerHaveCodeTransition,
  resolveSwipeRightAction,
} from '../swipeCardState.ts'

test('clampSwipeOffset - limita el desplazamiento entre -SWIPE_ACTION_WIDTH y +SWIPE_ACTION_WIDTH', () => {
  assert.equal(clampSwipeOffset(200), SWIPE_ACTION_WIDTH)
  assert.equal(clampSwipeOffset(-200), -SWIPE_ACTION_WIDTH)
  assert.equal(clampSwipeOffset(40, 0), 40)
  assert.equal(clampSwipeOffset(-30, SWIPE_ACTION_WIDTH), SWIPE_ACTION_WIDTH - 30)
})

test('resolveSwipeSnap - abre a izquierda (Archivar) o derecha (Eliminar) según umbral o cierra', () => {
  const openArchive = resolveSwipeSnap(50)
  assert.equal(openArchive.side, 'left')
  assert.equal(openArchive.snappedOffset, SWIPE_ACTION_WIDTH)

  const openDelete = resolveSwipeSnap(-50)
  assert.equal(openDelete.side, 'right')
  assert.equal(openDelete.snappedOffset, -SWIPE_ACTION_WIDTH)

  const snapClosed = resolveSwipeSnap(20)
  assert.equal(snapClosed.side, null)
  assert.equal(snapClosed.snappedOffset, 0)
})

test('detectHorizontalSwipeLock - no bloquea el scroll vertical y detecta arrastre horizontal', () => {
  assert.equal(detectHorizontalSwipeLock(4, 3), 'undecided')
  assert.equal(detectHorizontalSwipeLock(5, 25), 'vertical')
  assert.equal(detectHorizontalSwipeLock(25, 5), 'horizontal')
})

test('resolveCardTapWithSwipe - cierra la tarjeta abierta en lugar de navegar', () => {
  assert.deepEqual(resolveCardTapWithSwipe('t-1', 't-1'), { action: 'close_swipe' })
  assert.deepEqual(resolveCardTapWithSwipe('t-2', 't-1'), { action: 'navigate' })
  assert.deepEqual(resolveCardTapWithSwipe('t-2', null), { action: 'navigate' })
})

test('resolveScannerHaveCodeTransition - cierra el escáner y abre el modal de reclamación con código limpio', () => {
  assert.deepEqual(resolveScannerHaveCodeTransition(), {
    closeScanner: true,
    openClaimModal: true,
    resetClaimCode: true,
  })
})

test('resolveSwipeRightAction - participación muestra Renunciar (nunca Eliminar) y décimo propio Eliminar', () => {
  assert.equal(resolveSwipeRightAction(true), 'delete')
  assert.equal(resolveSwipeRightAction(false), 'renounce')
})
