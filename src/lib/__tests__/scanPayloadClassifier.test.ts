import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyScannedPayload } from '../scanPayloadClassifier.ts'

test('classifyScannedPayload - detecta URLs completas de invitación con token o PIN', () => {
  // 1. URL estándar con ruta /invite/<token>
  const token = '4f7e2a44-8d48-43f1-b844-cbdfc525f05b'
  const url1 = `https://misdecimos.dianrie.com/invite/${token}`
  const res1 = classifyScannedPayload(url1)
  assert.equal(res1.kind, 'INVITE')
  if (res1.kind === 'INVITE') {
    assert.equal(res1.inviteCodeOrToken, token)
    assert.equal(res1.sourceFormat, 'url')
  }

  // 2. URL con código de 6 dígitos en ruta
  const url2 = 'https://misdecimos.dianrie.com/invite/847392'
  const res2 = classifyScannedPayload(url2)
  assert.equal(res2.kind, 'INVITE')
  if (res2.kind === 'INVITE') {
    assert.equal(res2.inviteCodeOrToken, '847392')
  }

  // 3. URL con query param ?token=
  const url3 = 'https://misdecimos.dianrie.com/?token=ABC123'
  const res3 = classifyScannedPayload(url3)
  assert.equal(res3.kind, 'INVITE')
  if (res3.kind === 'INVITE') {
    assert.equal(res3.inviteCodeOrToken, 'ABC123')
  }

  // 4. Ruta alternativa /claim/<token>
  const url4 = `https://misdecimos.dianrie.com/claim/${token}`
  const res4 = classifyScannedPayload(url4)
  assert.equal(res4.kind, 'INVITE')
  if (res4.kind === 'INVITE') {
    assert.equal(res4.inviteCodeOrToken, token)
  }
})

test('classifyScannedPayload - detecta token UUID o PIN directo de invitación', () => {
  // Token UUID
  const uuid = '550e8400-e29b-41d4-a716-446655440000'
  const resUuid = classifyScannedPayload(uuid)
  assert.equal(resUuid.kind, 'INVITE')
  if (resUuid.kind === 'INVITE') {
    assert.equal(resUuid.inviteCodeOrToken, uuid)
    assert.equal(resUuid.sourceFormat, 'token')
  }

  // PIN de 6 dígitos numéricos
  const resPin = classifyScannedPayload('847392')
  assert.equal(resPin.kind, 'INVITE')
  if (resPin.kind === 'INVITE') {
    assert.equal(resPin.inviteCodeOrToken, '847392')
    assert.equal(resPin.sourceFormat, 'pin')
  }

  // PIN de 6 caracteres alfanumérico
  const resAlphaPin = classifyScannedPayload('X7Y8Z9')
  assert.equal(resAlphaPin.kind, 'INVITE')
  if (resAlphaPin.kind === 'INVITE') {
    assert.equal(resAlphaPin.inviteCodeOrToken, 'X7Y8Z9')
    assert.equal(resAlphaPin.sourceFormat, 'pin')
  }
})

test('classifyScannedPayload - detecta payload JSON de invitación', () => {
  const jsonRaw = JSON.stringify({ inviteToken: '4f7e2a44-8d48-43f1-b844-cbdfc525f05b', label: 'Familia' })
  const resJson = classifyScannedPayload(jsonRaw)
  assert.equal(resJson.kind, 'INVITE')
  if (resJson.kind === 'INVITE') {
    assert.equal(resJson.inviteCodeOrToken, '4f7e2a44-8d48-43f1-b844-cbdfc525f05b')
    assert.equal(resJson.sourceFormat, 'json')
  }

  const jsonPin = JSON.stringify({ pin: 123456 })
  const resJsonPin = classifyScannedPayload(jsonPin)
  assert.equal(resJsonPin.kind, 'INVITE')
  if (resJsonPin.kind === 'INVITE') {
    assert.equal(resJsonPin.inviteCodeOrToken, '123456')
  }
})

test('classifyScannedPayload - detecta códigos de barras oficiales SELAE de 20 dígitos y décimos', () => {
  // Código real de producción 1 con separador >
  const barcode1 = '5102607065>0023205830'
  const res1 = classifyScannedPayload(barcode1)
  assert.equal(res1.kind, 'TICKET')
  if (res1.kind === 'TICKET') {
    assert.equal(res1.parsed.ticketNumber, '02320')
    assert.equal(res1.parsed.series, '065')
    assert.equal(res1.parsed.fraction, '07')
    assert.equal(res1.parsed.isValid, true)
  }

  // Código real de producción 2
  const barcode2 = '51020101100876719833'
  const res2 = classifyScannedPayload(barcode2)
  assert.equal(res2.kind, 'TICKET')
  if (res2.kind === 'TICKET') {
    assert.equal(res2.parsed.ticketNumber, '87671')
    assert.equal(res2.parsed.series, '110')
    assert.equal(res2.parsed.fraction, '10')
    assert.equal(res2.parsed.isValid, true)
  }

  // Número directo de 5 dígitos
  const res5 = classifyScannedPayload('02320')
  assert.equal(res5.kind, 'TICKET')
  if (res5.kind === 'TICKET') {
    assert.equal(res5.parsed.ticketNumber, '02320')
    assert.equal(res5.parsed.isValid, true)
  }
})

test('classifyScannedPayload - devuelve UNKNOWN ante URLs o códigos ajenos no válidos', () => {
  // URL ajena
  const resGoogle = classifyScannedPayload('https://www.google.com/search?q=loteria')
  assert.equal(resGoogle.kind, 'UNKNOWN')

  // Texto arbitrario
  const resText = classifyScannedPayload('Hola mundo este no es un código válido')
  assert.equal(resText.kind, 'UNKNOWN')

  // Cadena vacía
  const resEmpty = classifyScannedPayload('   ')
  assert.equal(resEmpty.kind, 'UNKNOWN')
})
