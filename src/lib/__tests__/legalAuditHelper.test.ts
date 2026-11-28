import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  countActiveRepartoItems,
  getTicketDeletionBlockReason,
  hasActiveDigitalParticipationSignature,
  mergeAuditAndLegalEvents,
  type TicketLegalEventRow,
} from '../legalAuditHelper.ts'

test('countActiveRepartoItems excluye canceladas, renunciadas y rechazadas', () => {
  const shares = [
    { status: 'ACEPTADA' },
    { status: 'ACEPTADA' },
    { status: 'RENUNCIADA' },
    { status: 'RECHAZADA' },
    { status: 'CANCELADA' },
    { status: 'renounced' },
    { status: 'declined' },
  ]
  const invites = [
    { status: 'PENDIENTE' },
    { status: 'CANCELADA' },
    { status: 'ACEPTADA' },
    { status: 'RECHAZADA' },
    { status: 'cancelled' },
  ]

  assert.equal(countActiveRepartoItems(shares, invites), 3)
  assert.equal(countActiveRepartoItems([{ status: 'ACEPTADA' }], []), 1)
})

test('hasActiveDigitalParticipationSignature detecta firma digital activa y se limpia tras renuncia', () => {
  const baseEv: TicketLegalEventRow = {
    id: 'e1',
    ticket_id: 't1',
    participation_id: 's1',
    actor_user_id: 'u2',
    event_type: 'PARTICIPATION_SIGNED',
    actor_name: 'Lucía Gómez',
    actor_nif: '87654321B',
    cert_issuer: 'FNMT',
    cert_serial: '01AB',
    cert_method: 'p12',
    signature_b64: 'SIGB64',
    payload_sha256: 'hash',
    share_percentage: 25,
    share_amount: 5,
    metadata: {},
    created_at: '2026-11-28T01:00:00Z',
  }

  assert.equal(hasActiveDigitalParticipationSignature([baseEv], 'u2', 's1'), true)
  assert.equal(hasActiveDigitalParticipationSignature([baseEv], 'u3', 's2'), false)

  const renouncedEv: TicketLegalEventRow = {
    ...baseEv,
    id: 'e2',
    event_type: 'PARTICIPATION_RENOUNCED',
    created_at: '2026-11-28T02:00:00Z',
  }
  assert.equal(hasActiveDigitalParticipationSignature([baseEv, renouncedEv], 'u2', 's1'), false)
})

test('mergeAuditAndLegalEvents unifica y formatea eventos legales junto a audit_events', () => {
  const legalEvents: TicketLegalEventRow[] = [
    {
      id: 'le1',
      ticket_id: 't1',
      participation_id: null,
      actor_user_id: 'u1',
      event_type: 'CUSTODY_CERTIFIED',
      actor_name: 'Carlos Ruiz',
      actor_nif: '12345678Z',
      cert_issuer: 'FNMT',
      cert_serial: 'AA11',
      cert_method: 'autofirma',
      signature_b64: 'SIG1',
      payload_sha256: 'h1',
      share_percentage: 100,
      share_amount: 20,
      metadata: { verification_code: 'MD-2026-AA11-BB22' },
      created_at: '2026-11-28T02:00:00Z',
    },
    {
      id: 'le2',
      ticket_id: 't1',
      participation_id: 's1',
      actor_user_id: 'u2',
      event_type: 'HANDWRITTEN_PARTICIPATION_SIGNED',
      actor_name: 'Lucía Gómez',
      actor_nif: '87654321B',
      cert_issuer: null,
      cert_serial: null,
      cert_method: 'handwritten',
      signature_b64: null,
      payload_sha256: 'h2',
      share_percentage: 25,
      share_amount: 5,
      metadata: {},
      created_at: '2026-11-28T03:00:00Z',
    },
  ]

  const auditEvents = [
    {
      id: 'a1',
      action: 'DECIMO_CREADO',
      created_at: '2026-11-28T01:00:00Z',
      percentage: 100,
      metadata: null,
      actor: { display_name: 'Carlos Ruiz', email: null, avatar_url: null },
    },
  ]

  const merged = mergeAuditAndLegalEvents(auditEvents, legalEvents)
  assert.equal(merged.length, 3)
  assert.equal(merged[0].id, 'legal-le2')
  assert.ok(merged[0].legalDescription?.includes('Participación (25%) firmada de forma manuscrita por Lucía Gómez (NIF 87654321B)'))
  assert.equal(merged[1].id, 'legal-le1')
  assert.ok(merged[1].legalDescription?.includes('Custodia certificada con Certificado Digital por Carlos Ruiz (NIF 12345678Z)'))
  const meta1 = merged[1].metadata as Record<string, unknown>
  assert.equal(meta1?.legal_method, 'AutoFirma')
  assert.equal(meta1?.verification_code, 'MD-2026-AA11-BB22')
  assert.equal(merged[2].id, 'a1')
})

test('Responsive móvil y blindaje de renuncia en UI y migración SQL', () => {
  const detail = readFileSync(resolve(process.cwd(), 'src/pages/TicketDetailPage.tsx'), 'utf8')
  const legalTab = readFileSync(resolve(process.cwd(), 'src/components/tickets/LegalCertificationTab.tsx'), 'utf8')
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20261128030000_guard_signed_share_renounce.sql'),
    'utf8'
  )

  assert.ok(detail.includes('sm:hidden') && detail.includes('sm:inline'))
  assert.ok(legalTab.includes('aria-expanded={isDigitalCertOpen}'))
  assert.ok(migration.includes('trg_guard_signed_participation_renounce'))
  assert.ok(migration.includes('-- ROLLBACK:'))
})

test('getTicketDeletionBlockReason devuelve mensajes específicos para no propietario, participaciones aceptadas y liquidado', () => {
  assert.equal(
    getTicketDeletionBlockReason({
      isOwner: false,
      acceptedThirdPartyCount: 0,
      ticketStatus: 'PENDIENTE',
    }),
    'Solo el propietario del décimo puede eliminarlo.'
  )

  assert.equal(
    getTicketDeletionBlockReason({
      isOwner: true,
      acceptedThirdPartyCount: 1,
      ticketStatus: 'PENDIENTE',
    }),
    'No puedes eliminar este décimo porque tiene 1 participación aceptada. Para eliminarlo, el partícipe debe renunciar antes a su participación.'
  )

  assert.equal(
    getTicketDeletionBlockReason({
      isOwner: true,
      acceptedThirdPartyCount: 3,
      ticketStatus: 'VALIDADO',
    }),
    'No puedes eliminar este décimo porque tiene 3 participaciones aceptadas. Para eliminarlo, los partícipes deben renunciar antes a sus participaciones.'
  )

  assert.equal(
    getTicketDeletionBlockReason({
      isOwner: true,
      acceptedThirdPartyCount: 0,
      ticketStatus: 'LIQUIDADO',
    }),
    'No puedes eliminar este décimo porque el sorteo ya está liquidado.'
  )

  assert.equal(
    getTicketDeletionBlockReason({
      isOwner: true,
      acceptedThirdPartyCount: 0,
      ticketStatus: 'PENDIENTE',
    }),
    null
  )
})
