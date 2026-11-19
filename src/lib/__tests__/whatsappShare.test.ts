import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWhatsAppShareMessage,
  buildWhatsAppShareUrl,
} from '../shareHelper.ts'

test('buildWhatsAppShareMessage - genera mensaje completo con porcentaje, décimo, código y URL', () => {
  const message = buildWhatsAppShareMessage({
    percentage: 20,
    ticketNumber: '87671',
    drawName: 'Sorteo Extraordinario de Navidad',
    shortCode: '481920',
    shareUrl: 'https://misdecimos.dianrie.com/invite/8f5a6b7c-1234-5678-90ab-cdef12345678',
  })

  // Validar contenidos esenciales
  assert.ok(message.includes('20%'), 'Debe incluir el porcentaje del 20%')
  assert.ok(message.includes('87671'), 'Debe incluir el número del décimo')
  assert.ok(message.includes('Sorteo Extraordinario de Navidad'), 'Debe incluir el nombre del sorteo')
  assert.ok(message.includes('481920'), 'Debe incluir el código de 6 dígitos')
  assert.ok(
    message.includes('https://misdecimos.dianrie.com/invite/8f5a6b7c-1234-5678-90ab-cdef12345678'),
    'Debe incluir la URL completa de invitación'
  )

  // Validar ausencia total de caracteres de reemplazo corruptos \uFFFD
  assert.equal(message.includes('\uFFFD'), false, 'No debe contener el carácter de reemplazo corrupto \uFFFD')
  assert.equal(message.includes('\u{FFFD}'), false, 'No debe contener secuencias malformadas')

  // Validar presencia de emojis seguros
  assert.ok(message.includes('\u{1F3AB}'), 'Debe contener el emoji de décimo 🎟️')
  assert.ok(message.includes('\u{1F511}'), 'Debe contener el emoji de llave 🔑')
  assert.ok(message.includes('\u{1F449}'), 'Debe contener el emoji indicador 👉')
})

test('buildWhatsAppShareMessage - maneja valores opcionales o nulos de forma limpia', () => {
  const message = buildWhatsAppShareMessage({
    percentage: 50,
    ticketNumber: null,
    drawName: null,
    shortCode: '123456',
    shareUrl: 'https://misdecimos.dianrie.com/invite/token-abc',
  })

  assert.ok(!message.includes('null'), 'No debe renderizar "null"')
  assert.ok(!message.includes('undefined'), 'No debe renderizar "undefined"')
  assert.ok(message.includes('50%'))
  assert.ok(message.includes('Lotería'))
  assert.ok(message.includes('123456'))
  assert.ok(message.includes('https://misdecimos.dianrie.com/invite/token-abc'))
  assert.equal(message.includes('\uFFFD'), false)
})

test('buildWhatsAppShareUrl - codifica limpiamente y permite decodificación exacta preservando emojis', () => {
  const originalMessage = buildWhatsAppShareMessage({
    percentage: 15,
    ticketNumber: '04930',
    drawName: 'El Niño',
    shortCode: '992014',
    shareUrl: 'https://misdecimos.dianrie.com/invite/test-token',
  })

  const url = buildWhatsAppShareUrl(originalMessage)

  assert.ok(url.startsWith('https://api.whatsapp.com/send?text='), 'Debe apuntar al endpoint oficial api.whatsapp.com')

  // Extraer el parámetro text y decodificar
  const encodedText = url.replace('https://api.whatsapp.com/send?text=', '')
  const decodedText = decodeURIComponent(encodedText)

  assert.equal(decodedText, originalMessage, 'La decodificación debe ser exactamente idéntica al mensaje original')
  assert.equal(decodedText.includes('\uFFFD'), false, 'El texto decodificado no debe tener caracteres corruptos')
  assert.ok(decodedText.includes('\u{1F3AB}'))
  assert.ok(decodedText.includes('\u{1F511}'))
  assert.ok(decodedText.includes('\u{1F449}'))
})
