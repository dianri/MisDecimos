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

  // Validar presencia de símbolos seguros BMP
  assert.ok(message.includes('\u2605'), 'Debe contener la estrella BMP \u2605 (★)')
  assert.ok(message.includes('\u2022'), 'Debe contener la viñeta BMP \u2022 (•)')
  assert.ok(message.includes('\u2192'), 'Debe contener la flecha BMP \u2192 (→)')

  // Validar ausencia de emojis de 4 bytes que corrompen api.whatsapp.com/send
  assert.equal(message.includes('\u{1F3AB}'), false, 'No debe contener el emoji de 4 bytes 🎟️')
  assert.equal(message.includes('\u{1F511}'), false, 'No debe contener el emoji de 4 bytes 🔑')
  assert.equal(message.includes('\u{1F449}'), false, 'No debe contener el emoji de 4 bytes 👉')
})

test('buildWhatsAppShareMessage - todos los caracteres pertenecen al plano BMP (<= 0xFFFF) sin pares subrogados', () => {
  const message = buildWhatsAppShareMessage({
    percentage: 33,
    ticketNumber: '12345',
    drawName: 'El Niño 2026',
    shortCode: '654321',
    shareUrl: 'https://misdecimos.dianrie.com/invite/test-uuid',
  })

  // Verificar que cada punto de código está en el plano BMP (<= 0xFFFF)
  for (const char of message) {
    const codePoint = char.codePointAt(0)
    assert.ok(
      codePoint !== undefined && codePoint <= 0xFFFF,
      `El carácter "${char}" (U+${codePoint?.toString(16).toUpperCase()}) excede el plano BMP (<= 0xFFFF)`
    )
  }

  // Verificar que ninguna unidad de código UTF-16 pertenece al rango de subrogados (0xD800 - 0xDFFF)
  for (let i = 0; i < message.length; i++) {
    const charCode = message.charCodeAt(i)
    const isSurrogate = charCode >= 0xD800 && charCode <= 0xDFFF
    assert.equal(
      isSurrogate,
      false,
      `La posición ${i} contiene una unidad subrogada UTF-16 (0x${charCode.toString(16).toUpperCase()})`
    )
  }

  // Sin carácter de reemplazo corrupto
  assert.equal(message.includes('\uFFFD'), false, 'No debe contener \uFFFD')
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

  // Validar también que todos los caracteres son BMP
  for (const char of message) {
    const cp = char.codePointAt(0)
    assert.ok(cp !== undefined && cp <= 0xFFFF)
  }
})

test('buildWhatsAppShareUrl - codifica limpiamente y permite decodificación exacta preservando símbolos BMP', () => {
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
  assert.ok(decodedText.includes('\u2605'), 'Debe conservar la estrella BMP \u2605')
  assert.ok(decodedText.includes('\u2022'), 'Debe conservar la viñeta BMP \u2022')
  assert.ok(decodedText.includes('\u2192'), 'Debe conservar la flecha BMP \u2192')
})
