import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { validateSpanishDniNie, validateHandwrittenForm } from '../handwrittenCustody.ts'
import { generateHandwrittenAgreementPdf } from '../legalPdfGenerator.ts'

test('validateSpanishDniNie valida DNI y NIE oficiales con letra de control', () => {
  const validDni = validateSpanishDniNie('12345678z')
  assert.equal(validDni.valid, true)
  assert.equal(validDni.normalized, '12345678Z')

  const validNie = validateSpanishDniNie('X1234567L')
  assert.equal(validNie.valid, true)
  assert.equal(validNie.normalized, 'X1234567L')

  const badLetter = validateSpanishDniNie('12345678A')
  assert.equal(badLetter.valid, false)
  assert.ok(badLetter.error?.includes('se esperaba Z'))

  const badFormat = validateSpanishDniNie('1234')
  assert.equal(badFormat.valid, false)
})

test('validateHandwrittenForm exige nombre, DNI/NIE, foto, declaración y trazo (sin teléfono)', () => {
  const missingStroke = validateHandwrittenForm({
    fullName: 'Carlos Ruiz',
    nif: '12345678Z',
    hasPhoto: true,
    requirePhoto: true,
    declarationAccepted: true,
    hasSignatureStroke: false,
  })
  assert.equal(missingStroke.valid, false)
  assert.ok(missingStroke.errors[0].includes('firma manuscrita'))

  const missingPhoto = validateHandwrittenForm({
    fullName: 'Carlos Ruiz',
    nif: '12345678Z',
    hasPhoto: false,
    requirePhoto: true,
    declarationAccepted: true,
    hasSignatureStroke: true,
  })
  assert.equal(missingPhoto.valid, false)
  assert.ok(missingPhoto.errors[0].includes('anverso'))

  const valid = validateHandwrittenForm({
    fullName: 'Carlos Ruiz',
    nif: '12345678Z',
    hasPhoto: true,
    requirePhoto: true,
    declarationAccepted: true,
    hasSignatureStroke: true,
  })
  assert.equal(valid.valid, true)
  assert.equal(valid.normalizedNif, '12345678Z')
})

test('generateHandwrittenAgreementPdf incrusta firmas PNG manuscritas y aviso de acuerdo privado', async () => {
  const png1x1Base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const pngBytes = Uint8Array.from(Buffer.from(png1x1Base64, 'base64'))

  const pdfBytes = await generateHandwrittenAgreementPdf({
    ticket: {
      id: 't-hw-1',
      number: '79432',
      serie: '001',
      fraccion: '01',
      draw_name: 'Sorteo Extraordinario de Navidad',
      draw_date: '2026-12-22',
      ticket_price: 20,
    },
    verificationCode: 'MDF-2026-AA11-BB22',
    photoSha256: 'a'.repeat(64),
    photoBytes: pngBytes,
    photoMimeType: 'image/png',
    signers: [
      {
        role: 'custodian',
        fullName: 'Carlos Ruiz Martin',
        nif: '12345678Z',
        percentage: 75,
        amountEuros: 15,
        status: 'ACEPTADA',
        signaturePngBase64: `data:image/png;base64,${png1x1Base64}`,
        signatureSha256: 'b'.repeat(64),
        signedAt: '2026-11-28T01:48:00.000Z',
      },
    ],
    events: [
      {
        created_at: '2026-11-28T01:48:00.000Z',
        event_type: 'HANDWRITTEN_CUSTODY_SIGNED',
        actor_name: 'Carlos Ruiz Martin',
        actor_nif: '12345678Z',
        payload_sha256: 'b'.repeat(64),
      },
    ],
  })

  assert.ok(pdfBytes.byteLength > 1000)
  assert.equal(Buffer.from(pdfBytes.slice(0, 5)).toString('ascii'), '%PDF-')
  const parsed = await PDFDocument.load(pdfBytes)
  assert.ok(parsed.getPageCount() >= 1)
})

test('LegalCertificationTab unifica Certificado Digital y Firma Manuscrita en barra de 3 pestañas', () => {
  const detail = readFileSync(resolve(process.cwd(), 'src/pages/TicketDetailPage.tsx'), 'utf8')
  const legalTab = readFileSync(resolve(process.cwd(), 'src/components/tickets/LegalCertificationTab.tsx'), 'utf8')
  const pad = readFileSync(resolve(process.cwd(), 'src/components/tickets/SignaturePadCanvas.tsx'), 'utf8')
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20261128015000_handwritten_signatures.sql'),
    'utf8'
  )

  assert.ok(detail.includes('grid-cols-3'))
  assert.ok(!detail.includes('overflow-x-auto'))
  assert.ok(legalTab.includes('Certificado Digital'))
  assert.ok(legalTab.includes('Firma Manuscrita'))
  assert.ok(legalTab.includes('<HandwrittenSignatureTab'))
  assert.ok(pad.includes("touchAction: 'none'"))
  assert.ok(pad.includes('Borrar trazo'))
  assert.ok(migration.includes('if v_hw_id is null then'))
  assert.ok(migration.includes('-- ROLLBACK:'))
})
