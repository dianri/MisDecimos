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
import {
  findActiveUserShare,
  hasActiveDigitalParticipationSignature,
  extractSupabaseErrorMessage,
  type TicketLegalEventRow,
} from '../legalAuditHelper.ts'
import {
  evaluateHandwrittenAccordionState,
  resolveLockedCertificateIdentity,
} from '../handwrittenCustody.ts'

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

  // Formato compuesto real de AutoFirma: <certX509_base64url>|<cms_base64url> (incluyendo '+' convertido a espacio)
  const { cert } = createTestP12()
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const certBase64UrlWithSpaces = forge.util
    .encode64(certDer)
    .replace(/\+/g, ' ')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  const pipePayload = `${certBase64UrlWithSpaces}|${cmsBase64Url}`
  const pipeRes = await decodeCmsSignatureAndExtractIdentity(pipePayload, payload)
  assert.equal(pipeRes.method, 'autofirma')
  assert.equal(pipeRes.identity.fullName, 'CARLOS RUIZ MARTIN')
  assert.equal(pipeRes.identity.nif, '12345678Z')
  assert.equal(pipeRes.identity.issuer, 'AC FNMT Usuarios Test')
  assert.equal(pipeRes.identity.serialNumber, '01AB23CD')
  assert.equal(pipeRes.signatureB64, res.signatureB64)

  // Cadena de certificados DER concatenados en Android KeyChain (bytes residuales tras el 1.º cert) + %7C + CMS
  const { cert: caCert } = createTestP12({ nifInCnOnly: true })
  const caCertDer = forge.asn1.toDer(forge.pki.certificateToAsn1(caCert)).getBytes()
  const chainedCertsDer = certDer + caCertDer
  const chainedCertsBase64Url = forge.util
    .encode64(chainedCertsDer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  const androidRes = await decodeCmsSignatureAndExtractIdentity(
    `${chainedCertsBase64Url}%7C${cmsBase64Url}`,
    payload
  )
  assert.equal(androidRes.method, 'autofirma')
  assert.equal(androidRes.identity.fullName, 'CARLOS RUIZ MARTIN')
  assert.equal(androidRes.identity.nif, '12345678Z')
  assert.equal(androidRes.signatureB64, res.signatureB64)
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

test('ciclo completo de renuncia y nueva participación en el mismo décimo aísla estrictamente por participation_id', () => {
  const shares = [
    {
      id: 'part-1',
      user_id: 'u-2',
      status: 'RENUNCIADA',
      created_at: '2026-11-28T01:00:00.000Z',
    },
    {
      id: 'part-2',
      user_id: 'u-2',
      status: 'ACEPTADA',
      created_at: '2026-11-28T02:00:00.000Z',
    },
  ]

  // 1. Debe seleccionar exclusivamente la participación activa (part-2) ignorando part-1
  const activeShare = findActiveUserShare(shares, 'u-2')
  assert.equal(activeShare?.id, 'part-2')

  // 2. part-1 fue firmada digitalmente y luego renunciada (o incluso si quedara un evento previo sin renuncia)
  const legalEvents: TicketLegalEventRow[] = [
    {
      id: 'ev-1',
      ticket_id: 't-1',
      participation_id: 'part-1',
      actor_user_id: 'u-2',
      event_type: 'PARTICIPATION_SIGNED',
      actor_name: 'Lucía Gómez',
      actor_nif: '87654321B',
      cert_issuer: 'FNMT',
      cert_serial: 'SER-1',
      cert_method: 'autofirma',
      signature_b64: 'SIG-1',
      payload_sha256: 'hash-1',
      share_percentage: 25,
      share_amount: 5,
      metadata: {},
      created_at: '2026-11-28T01:10:00.000Z',
    },
    {
      id: 'ev-2',
      ticket_id: 't-1',
      participation_id: 'part-1',
      actor_user_id: 'u-2',
      event_type: 'PARTICIPATION_RENOUNCED',
      actor_name: 'Lucía Gómez',
      actor_nif: '87654321B',
      cert_issuer: 'FNMT',
      cert_serial: 'SER-1',
      cert_method: 'autofirma',
      signature_b64: 'SIG-R1',
      payload_sha256: 'hash-r1',
      share_percentage: 25,
      share_amount: 5,
      metadata: {},
      created_at: '2026-11-28T01:20:00.000Z',
    },
  ]

  // part-2 NO debe heredar la firma de part-1 aunque pertenezcan al mismo actor_user_id y ticket_id
  const hasPart2Signed = hasActiveDigitalParticipationSignature(legalEvents, 'u-2', 'part-2')
  assert.equal(hasPart2Signed, false)
  assert.equal(requiresDigitalSignatureForRenounce(hasPart2Signed), false)

  // Incluso si part-1 tuviera una firma activa sin renuncia registrada o evento huérfano null, part-2 sigue limpia
  const orphanAndPart1Signed: TicketLegalEventRow[] = [
    legalEvents[0],
    {
      ...legalEvents[0],
      id: 'ev-orphan',
      participation_id: null,
    },
  ]
  assert.equal(hasActiveDigitalParticipationSignature(orphanAndPart1Signed, 'u-2', 'part-2'), false)
  assert.equal(hasActiveDigitalParticipationSignature(orphanAndPart1Signed, 'u-2', 'part-1'), true)

  // 3. extractSupabaseErrorMessage muestra el mensaje real de PostgREST/RPC aunque no sea instanceof Error
  assert.equal(
    extractSupabaseErrorMessage(
      { message: 'Esta participación (part-1) fue firmada con certificado digital.', code: 'P0001' },
      'Fallback'
    ),
    'Esta participación (part-1) fue firmada con certificado digital.'
  )
})

test('generateLegalCustodyPdf muestra nombres duales (app + certificado), renunciadas, sin "?" y secuencia cronológica completa con paginación', async () => {
  const { inflateSync } = await import('node:zlib')

  // Generar una lista larga de eventos incluyendo la secuencia completa
  const baseEvents = [
    {
      created_at: '2026-11-28T01:00:00.000Z',
      event_type: 'CUSTODY_CERTIFIED',
      actor_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
      actor_nif: '12345678Z',
      share_percentage: 100,
      payload_sha256: 'a'.repeat(64),
    },
    {
      created_at: '2026-11-28T01:05:00.000Z',
      event_type: 'PARTICIPATION_ACCEPTED',
      actor_name: 'dianrie-gmail',
      share_percentage: 25,
      payload_sha256: 'b'.repeat(64),
    },
    {
      created_at: '2026-11-28T01:10:00.000Z',
      event_type: 'PARTICIPATION_SIGNED',
      actor_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
      actor_nif: '87654321B',
      share_percentage: 25,
      payload_sha256: 'c'.repeat(64),
    },
    {
      created_at: '2026-11-28T01:15:00.000Z',
      event_type: 'PARTICIPATION_RENOUNCED',
      actor_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
      actor_nif: '87654321B',
      share_percentage: 25,
      payload_sha256: 'd'.repeat(64),
    },
    {
      created_at: '2026-11-28T01:20:00.000Z',
      event_type: 'PARTICIPATION_ACCEPTED',
      actor_name: 'dianrie-gmail',
      share_percentage: 25,
      payload_sha256: 'e'.repeat(64),
    },
  ]

  // Añadir eventos adicionales para forzar salto de página automático en Sección 4
  const extraEvents = Array.from({ length: 16 }, (_, idx) => ({
    created_at: `2026-11-28T02:${String(idx).padStart(2, '0')}:00.000Z`,
    event_type: 'PARTICIPATION_ACCEPTED',
    actor_name: `participe-${idx} • test`,
    share_percentage: 5,
    payload_sha256: String(idx % 10).repeat(64),
  }))

  const pdfBytes = await generateLegalCustodyPdf({
    ticket: {
      id: 't-dual',
      number: '79432',
      serie: '001',
      fraccion: '01',
      draw_name: 'Sorteo Extraordinario de Navidad',
      draw_date: '2026-12-22',
      ticket_price: 20,
    },
    certification: {
      verification_code: 'MD-2026-DUAL-0001',
      custodian_app_name: 'dianrie',
      custodian_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
      custodian_nif: '12345678Z',
      cert_issuer: 'AC FNMT Usuarios',
      cert_serial: 'SER-999',
      cert_method: 'autofirma',
      payload_sha256: 'f'.repeat(64),
      photo_sha256: '1'.repeat(64),
      signed_at: '2026-11-28T01:00:00.000Z',
    },
    participants: [
      {
        name: 'dianrie',
        appName: 'dianrie',
        legalName: 'DIEGO ANGEL FERNANDEZ GARCIA',
        percentage: 75,
        amountEuros: 15,
        status: 'ACEPTADA',
        isOwner: true,
        signedNif: '12345678Z',
      },
      {
        name: 'dianrie-gmail',
        appName: 'dianrie-gmail',
        legalName: 'DIEGO ANGEL FERNANDEZ GARCIA',
        percentage: 25,
        amountEuros: 5,
        status: 'RENUNCIADA',
        signedNif: '87654321B',
      },
      {
        name: 'dianrie-gmail',
        appName: 'dianrie-gmail',
        legalName: 'DIEGO ANGEL FERNANDEZ GARCIA',
        percentage: 25,
        amountEuros: 5,
        status: 'ACEPTADA',
        signedNif: '87654321B',
      },
    ],
    events: [...baseEvents, ...extraEvents],
  })

  const parsed = await PDFDocument.load(pdfBytes)
  assert.ok(parsed.getPageCount() >= 2, 'Debe paginar automáticamente cuando el anexo supera la página 1')

  // Extraer texto de los streams descomprimidos del PDF (decodificando strings hex <...> de pdf-lib)
  const rawStr = Buffer.from(pdfBytes).toString('latin1')
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let streamContent = ''
  let m: RegExpExecArray | null
  while ((m = streamRegex.exec(rawStr)) !== null) {
    const chunk = Buffer.from(m[1], 'latin1')
    try {
      streamContent += inflateSync(chunk).toString('latin1') + '\n'
    } catch {
      streamContent += chunk.toString('latin1') + '\n'
    }
  }
  const hexStrings = Array.from(streamContent.matchAll(/<([0-9a-fA-F]+)>/g)).map((match) =>
    Buffer.from(match[1], 'hex').toString('latin1')
  )
  const extractedText = streamContent + '\n' + hexStrings.join('\n')

  assert.ok(extractedText.includes('dianrie-gmail'), 'Debe incluir el alias de la app')
  assert.ok(
    extractedText.includes('DIEGO ANGEL FERNANDEZ GARCIA'),
    'Debe incluir el nombre legal del certificado'
  )
  assert.ok(extractedText.includes('RENUNCIADA'), 'Debe incluir participaciones renunciadas')
  assert.ok(extractedText.includes('Participaci') && extractedText.includes('aceptada'))
  assert.ok(!hexStrings.some((s) => s.includes('?')), 'No debe generar caracteres "?" por símbolos WinAnsi')
})

test('evaluateHandwrittenAccordionState distingue propietario de partícipes activos e ignora renunciadas', () => {
  const shares = [
    { id: 'share-owner', user_id: 'u-owner', role: 'PROPIETARIO', status: 'ACEPTADA' },
    { id: 'part-old', user_id: 'u-p1', role: 'PARTICIPANTE', status: 'RENUNCIADA' },
    { id: 'part-active', user_id: 'u-p1', role: 'PARTICIPANTE', status: 'ACEPTADA' },
    { id: 'part-p2', user_id: 'u-p2', role: 'PARTICIPANTE', status: 'ACEPTADA' },
  ]

  const legalEvents = [
    {
      event_type: 'HANDWRITTEN_PARTICIPATION_SIGNED',
      actor_user_id: 'u-p1',
      participation_id: 'part-old',
    },
    {
      event_type: 'HANDWRITTEN_PARTICIPATION_SIGNED',
      actor_user_id: 'u-p2',
      participation_id: 'part-p2',
    },
  ]

  // Propietario aún no ha firmado manuscrito: debe ver OPCIONAL + 1 partícipe firmado (u-p2)
  const ownerState = evaluateHandwrittenAccordionState({
    isOwner: true,
    currentUserId: 'u-owner',
    shares,
    legalEvents,
  })
  assert.equal(ownerState.hasCurrentUserHandwrittenSigned, false)
  assert.equal(ownerState.otherActiveHandwrittenCount, 1)

  // u-p1 tiene part-active sin firma manuscrita (part-old fue renunciada): hasCurrentUserHandwrittenSigned === false
  const p1State = evaluateHandwrittenAccordionState({
    isOwner: false,
    currentUserId: 'u-p1',
    activeUserShareId: 'part-active',
    activeUserShareStatus: 'ACEPTADA',
    shares,
    legalEvents,
  })
  assert.equal(p1State.hasCurrentUserHandwrittenSigned, false)
  assert.equal(p1State.otherActiveHandwrittenCount, 1)

  // u-p2 sí firmó en su participación activa part-p2
  const p2State = evaluateHandwrittenAccordionState({
    isOwner: false,
    currentUserId: 'u-p2',
    activeUserShareId: 'part-p2',
    activeUserShareStatus: 'ACEPTADA',
    shares,
    legalEvents,
  })
  assert.equal(p2State.hasCurrentUserHandwrittenSigned, true)
  assert.equal(p2State.otherActiveHandwrittenCount, 0)
})

test('resolveLockedCertificateIdentity bloquea Nombre y NIF desde el Certificado Digital cuando existe firma digital previa', () => {
  const ownerLocked = resolveLockedCertificateIdentity({
    isOwner: true,
    certification: {
      custodian_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
      custodian_nif: '12345678Z',
    },
    legalEvents: [],
  })
  assert.equal(ownerLocked.isLocked, true)
  assert.equal(ownerLocked.fullName, 'DIEGO ANGEL FERNANDEZ GARCIA')
  assert.equal(ownerLocked.nif, '12345678Z')

  const participantLocked = resolveLockedCertificateIdentity({
    isOwner: false,
    activeUserShareId: 'part-2',
    legalEvents: [
      {
        event_type: 'PARTICIPATION_SIGNED',
        participation_id: 'part-2',
        actor_name: 'LUCIA GOMEZ PEREZ',
        actor_nif: '87654321B',
        signature_b64: 'SIG-B64',
        cert_serial: 'SER-2',
      },
    ],
  })
  assert.equal(participantLocked.isLocked, true)
  assert.equal(participantLocked.fullName, 'LUCIA GOMEZ PEREZ')
  assert.equal(participantLocked.nif, '87654321B')

  const participantUnlocked = resolveLockedCertificateIdentity({
    isOwner: false,
    activeUserShareId: 'part-3',
    legalEvents: [
      {
        event_type: 'PARTICIPATION_SIGNED',
        participation_id: 'part-2',
        actor_name: 'LUCIA GOMEZ PEREZ',
        actor_nif: '87654321B',
        signature_b64: 'SIG-B64',
        cert_serial: 'SER-2',
      },
    ],
  })
  assert.equal(participantUnlocked.isLocked, false)
})

test('generateLegalCustodyPdf incluye eventos manuscritos en anexo e incrusta firma PNG manuscrita', async () => {
  const { inflateSync } = await import('node:zlib')
  const validPng1x1Base64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  const pdfBytes = await generateLegalCustodyPdf({
    ticket: {
      id: 't-hw',
      number: '79432',
      serie: '001',
      fraccion: '01',
      draw_name: 'Sorteo Extraordinario de Navidad',
      draw_date: '2026-12-22',
      ticket_price: 20,
    },
    certification: {
      verification_code: 'MD-2026-HW-0001',
      custodian_app_name: 'dianrie',
      custodian_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
      custodian_nif: '12345678Z',
      cert_issuer: 'AC FNMT Usuarios',
      cert_serial: 'SER-999',
      cert_method: 'autofirma',
      payload_sha256: 'a'.repeat(64),
      photo_sha256: 'b'.repeat(64),
      signed_at: '2026-11-28T01:00:00.000Z',
    },
    participants: [
      {
        name: 'dianrie',
        appName: 'dianrie',
        legalName: 'DIEGO ANGEL FERNANDEZ GARCIA',
        percentage: 100,
        amountEuros: 20,
        status: 'ACEPTADA',
        isOwner: true,
        signedNif: '12345678Z',
      },
    ],
    events: [
      {
        created_at: '2026-11-28T01:10:00.000Z',
        event_type: 'HANDWRITTEN_CUSTODY_SIGNED',
        actor_name: 'DIEGO ANGEL FERNANDEZ GARCIA',
        actor_nif: '12345678Z',
        share_percentage: 100,
        payload_sha256: 'c'.repeat(64),
        metadata: { phone: '600112233' },
      },
      {
        created_at: '2026-11-28T01:15:00.000Z',
        event_type: 'HANDWRITTEN_PARTICIPATION_SIGNED',
        actor_name: 'LUCIA GOMEZ PEREZ',
        actor_nif: '87654321B',
        share_percentage: 25,
        payload_sha256: 'd'.repeat(64),
        metadata: { phone: '611223344' },
      },
      {
        created_at: '2026-11-28T01:20:00.000Z',
        event_type: 'HANDWRITTEN_PARTICIPATION_RENOUNCED',
        actor_name: 'LUCIA GOMEZ PEREZ',
        actor_nif: '87654321B',
        share_percentage: 25,
        payload_sha256: 'e'.repeat(64),
      },
    ],
    handwrittenSigners: [
      {
        role: 'custodian',
        fullName: 'DIEGO ANGEL FERNANDEZ GARCIA',
        nif: '12345678Z',
        phone: '600112233',
        percentage: 100,
        amountEuros: 20,
        status: 'ACEPTADA',
        signaturePngBase64: validPng1x1Base64,
        signatureSha256: 'f'.repeat(64),
        signedAt: '2026-11-28T01:10:00.000Z',
      },
    ],
  })

  const parsed = await PDFDocument.load(pdfBytes)
  assert.ok(parsed.getPageCount() >= 1)

  const rawStr = Buffer.from(pdfBytes).toString('latin1')
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let streamContent = ''
  let m: RegExpExecArray | null
  while ((m = streamRegex.exec(rawStr)) !== null) {
    const chunk = Buffer.from(m[1], 'latin1')
    try {
      streamContent += inflateSync(chunk).toString('latin1') + '\n'
    } catch {
      streamContent += chunk.toString('latin1') + '\n'
    }
  }
  const hexStrings = Array.from(streamContent.matchAll(/<([0-9a-fA-F]+)>/g)).map((match) =>
    Buffer.from(match[1], 'hex').toString('latin1')
  )
  const combined = streamContent + '\n' + hexStrings.join('\n')

  assert.ok(combined.includes('5. FIRMAS MANUSCRITAS REGISTRADAS'))
  assert.ok(combined.includes('600112233'))
  assert.ok(combined.includes('611223344'))
  assert.ok(rawStr.includes('/Subtype /Image'), 'Debe incrustar el objeto XObject de imagen PNG en el PDF')
})
