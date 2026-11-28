import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import forge from 'node-forge'
import { PDFDocument } from 'pdf-lib'
import {
  extractNifFromText,
  extractIdentityFromX509Cert,
  signPayloadWithP12,
  generateAutoFirmaSessionId,
  buildAutoFirmaSignUrl,
  decodeCmsSignatureAndExtractIdentity,
} from '../digitalSignature.ts'
import {
  evaluateCertifiedTicketLock,
  requiresDigitalSignatureForRenounce,
  generateVerificationCode,
  buildCanonicalLegalPayload,
} from '../legalCustody.ts'
import { generateLegalCustodyPdf } from '../legalPdfGenerator.ts'

function createTestP12(options?: { expired?: boolean; nifInCnOnly?: boolean }) {
  const keys = forge.pki.rsa.generateKeyPair(1024)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01AB23CD'
  const now = new Date()
  if (options?.expired) {
    cert.validity.notBefore = new Date(now.getTime() - 10 * 86400_000)
    cert.validity.notAfter = new Date(now.getTime() - 1 * 86400_000)
  } else {
    cert.validity.notBefore = new Date(now.getTime() - 86400_000)
    cert.validity.notAfter = new Date(now.getTime() + 365 * 86400_000)
  }

  const attrs = options?.nifInCnOnly
    ? [{ name: 'commonName', value: 'LUCIA GOMEZ PEREZ - NIF 87654321B' }]
    : [
        { name: 'commonName', value: 'CARLOS RUIZ MARTIN' },
        { type: '2.5.4.5', value: 'IDCES-12345678Z' },
      ]

  cert.setSubject(attrs)
  cert.setIssuer([{ name: 'commonName', value: 'AC FNMT Usuarios Test' }])
  cert.sign(keys.privateKey, forge.md.sha256.create())

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'secret123', {
    algorithm: '3des',
  })
  const der = forge.asn1.toDer(p12Asn1).getBytes()
  const bytes = new Uint8Array(der.length)
  for (let i = 0; i < der.length; i += 1) {
    bytes[i] = der.charCodeAt(i)
  }
  return { cert, bytes }
}

test('extractNifFromText y extractIdentityFromX509Cert extraen nombre, NIF, emisor y serie', () => {
  assert.equal(extractNifFromText('IDCES-12345678Z'), '12345678Z')
  assert.equal(extractNifFromText('NOMBRE - NIF X1234567L'), 'X1234567L')

  const { cert } = createTestP12()
  const identity = extractIdentityFromX509Cert(cert)
  assert.equal(identity.fullName, 'CARLOS RUIZ MARTIN')
  assert.equal(identity.nif, '12345678Z')
  assert.equal(identity.issuer, 'AC FNMT Usuarios Test')
  assert.equal(identity.serialNumber, '01AB23CD')

  const { cert: certCn } = createTestP12({ nifInCnOnly: true })
  const identityCn = extractIdentityFromX509Cert(certCn)
  assert.equal(identityCn.fullName, 'LUCIA GOMEZ PEREZ')
  assert.equal(identityCn.nif, '87654321B')
})

test('signPayloadWithP12 firma en memoria con SHA-256 y rechaza certificados caducados o clave errónea', async () => {
  const { bytes } = createTestP12()
  const payload = buildCanonicalLegalPayload({
    eventType: 'CUSTODY_CERTIFIED',
    ticketId: 't-1',
    ticketNumber: '79432',
    drawDate: '2026-12-22',
    drawName: 'Sorteo Extraordinario de Navidad',
    serie: '001',
    fraccion: '01',
    ticketPrice: 20,
    photoSha256: 'abc123',
    actorUserId: 'u-1',
    sharePercentage: 100,
    timestampIso: '2026-11-28T00:00:00.000Z',
  })

  const res = await signPayloadWithP12({
    p12Bytes: bytes,
    password: 'secret123',
    canonicalPayload: payload,
  })
  assert.equal(res.method, 'p12')
  assert.equal(res.identity.nif, '12345678Z')
  assert.ok(res.signatureB64.length > 50)
  assert.equal(res.payloadSha256.length, 64)

  await assert.rejects(
    () =>
      signPayloadWithP12({
        p12Bytes: bytes,
        password: 'wrong',
        canonicalPayload: payload,
      }),
    /Contraseña incorrecta/
  )

  const { bytes: expiredBytes } = createTestP12({ expired: true })
  await assert.rejects(
    () =>
      signPayloadWithP12({
        p12Bytes: expiredBytes,
        password: 'secret123',
        canonicalPayload: payload,
      }),
    /caducado/
  )

  const opId = generateAutoFirmaSessionId()
  assert.equal(opId.length, 16)
  assert.match(opId, /^[A-Za-z0-9]{1,20}$/)
  assert.ok(!opId.includes('-'))

  const afirmaUrl = buildAutoFirmaSignUrl({ canonicalPayload: payload, opId })
  assert.ok(afirmaUrl.startsWith('afirma://sign?'))
  const parsedParams = new URLSearchParams(afirmaUrl.split('?')[1])
  assert.equal(parsedParams.get('op'), 'sign')
  const urlId = parsedParams.get('id') || ''
  assert.ok(urlId.length <= 20)
  assert.match(urlId, /^[A-Za-z0-9]{1,20}$/)
  assert.equal(parsedParams.get('key'), null)
  assert.ok((parsedParams.get('stservlet') || '').endsWith('/functions/v1/autofirma-relay'))
  assert.ok((parsedParams.get('rtservlet') || '').endsWith('/functions/v1/autofirma-relay'))
  assert.equal(parsedParams.get('format'), 'CAdES')
  assert.equal(parsedParams.get('algorithm'), 'SHA256withRSA')
  assert.equal(parsedParams.get('mode'), 'explicit')
  assert.ok((parsedParams.get('dat') || '').length > 10)

  assert.throws(
    () => buildAutoFirmaSignUrl({ canonicalPayload: payload, opId: 'invalid-id-1' }),
    /máximo 20 caracteres/
  )
  assert.throws(
    () => buildAutoFirmaSignUrl({ canonicalPayload: payload, opId: 'MD1234567890123456789' }),
    /máximo 20 caracteres/
  )

  // Decodificación CMS/PKCS#7 devuelto por AutoFirma (incluyendo formato Base64URL sin padding '=')
  const cmsBase64Url = res.signatureB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const cmsRes = await decodeCmsSignatureAndExtractIdentity(cmsBase64Url, payload)
  assert.equal(cmsRes.method, 'autofirma')
  assert.equal(cmsRes.identity.fullName, 'CARLOS RUIZ MARTIN')
  assert.equal(cmsRes.identity.nif, '12345678Z')
  assert.equal(cmsRes.identity.serialNumber, '01AB23CD')
})

test('evaluateCertifiedTicketLock y requiresDigitalSignatureForRenounce controlan bloqueo y renuncia', () => {
  const uncertified = evaluateCertifiedTicketLock({
    isCertified: false,
    acceptedThirdPartyCount: 2,
  })
  assert.equal(uncertified.isLocked, false)
  assert.equal(uncertified.canEditCriticalFields, true)
  assert.equal(uncertified.canDeleteTicket, true)

  const certifiedNoAccepts = evaluateCertifiedTicketLock({
    isCertified: true,
    acceptedThirdPartyCount: 0,
  })
  assert.equal(certifiedNoAccepts.isLocked, false)
  assert.equal(certifiedNoAccepts.canEditCriticalFields, true)
  assert.equal(certifiedNoAccepts.canDeleteTicket, true)
  assert.ok(certifiedNoAccepts.statusLabel.includes('Editable'))

  const certifiedLocked = evaluateCertifiedTicketLock({
    isCertified: true,
    acceptedThirdPartyCount: 1,
  })
  assert.equal(certifiedLocked.isLocked, true)
  assert.equal(certifiedLocked.canEditCriticalFields, false)
  assert.equal(certifiedLocked.canDeleteTicket, false)
  assert.equal(certifiedLocked.statusLabel, 'Bloqueado · Custodia protegida')

  assert.equal(requiresDigitalSignatureForRenounce(false), false)
  assert.equal(requiresDigitalSignatureForRenounce(true), true)

  const code = generateVerificationCode(2026)
  assert.match(code, /^MD-2026-[0-9A-F]{4}-[0-9A-F]{4}$/)
})

test('generateLegalCustodyPdf genera un PDF válido con imagen incrustada, partícipes y eventos', async () => {
  // PNG mínimo 1x1 válido en memoria
  const png1x1Base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const pngBytes = Uint8Array.from(Buffer.from(png1x1Base64, 'base64'))

  const pdfBytes = await generateLegalCustodyPdf({
    ticket: {
      id: 't-1',
      number: '79432',
      serie: '012',
      fraccion: '04',
      draw_name: 'Sorteo Extraordinario de Navidad',
      draw_date: '2026-12-22',
      ticket_price: 20,
    },
    certification: {
      verification_code: 'MD-2026-ABCD-1234',
      custodian_name: 'CARLOS RUIZ MARTIN',
      custodian_nif: '12345678Z',
      cert_issuer: 'AC FNMT Usuarios',
      cert_serial: '01AB23CD',
      cert_method: 'p12',
      payload_sha256: 'a'.repeat(64),
      photo_sha256: 'b'.repeat(64),
      signed_at: '2026-11-28T00:10:00.000Z',
    },
    photoBytes: pngBytes,
    photoMimeType: 'image/png',
    participants: [
      {
        name: 'Carlos Ruiz',
        percentage: 50,
        amountEuros: 10,
        status: 'ACEPTADA',
        isOwner: true,
      },
      {
        name: 'Lucia Gomez',
        percentage: 25,
        amountEuros: 5,
        status: 'ACEPTADA',
        signedNif: '87654321B',
      },
      {
        name: 'Mario Perez',
        percentage: 25,
        amountEuros: 5,
        status: 'RENUNCIADA',
      },
    ],
    events: [
      {
        created_at: '2026-11-28T00:10:00.000Z',
        event_type: 'CUSTODY_CERTIFIED',
        actor_name: 'CARLOS RUIZ MARTIN',
        actor_nif: '12345678Z',
        share_percentage: 100,
        payload_sha256: 'a'.repeat(64),
      },
      {
        created_at: '2026-11-28T00:15:00.000Z',
        event_type: 'PARTICIPATION_RENOUNCED',
        actor_name: 'Mario Perez',
        share_percentage: 25,
        payload_sha256: 'c'.repeat(64),
      },
    ],
  })

  assert.ok(pdfBytes.byteLength > 1000)
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii')
  assert.equal(header, '%PDF-')

  const parsed = await PDFDocument.load(pdfBytes)
  assert.ok(parsed.getPageCount() >= 1)
})

test('TicketDetailPage integra pestaña Certificación Legal y CertificateSignModal prioriza AutoFirma', () => {
  const detailSource = readFileSync(resolve(process.cwd(), 'src/pages/TicketDetailPage.tsx'), 'utf8')
  const modalSource = readFileSync(
    resolve(process.cwd(), 'src/components/tickets/CertificateSignModal.tsx'),
    'utf8'
  )
  const migrationSource = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20261128010500_ticket_digital_certifications.sql'),
    'utf8'
  )

  assert.ok(detailSource.includes('Certificación Legal'))
  assert.ok(detailSource.includes('<LegalCertificationTab'))
  assert.ok(modalSource.includes("useState<'autofirma' | 'p12'>('autofirma')"))
  assert.ok(modalSource.indexOf('AutoFirma') < modalSource.indexOf('Archivo .p12 / .pfx'))
  assert.ok(migrationSource.includes('if v_cert_id is null then'))
  assert.ok(migrationSource.includes('-- ROLLBACK:'))
  assert.ok(migrationSource.includes('trg_ticket_legal_events_immutable'))
})
