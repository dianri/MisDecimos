import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export interface LegalPdfParticipantItem {
  name: string
  appName?: string | null
  legalName?: string | null
  percentage: number
  amountEuros: number
  status: string
  isOwner?: boolean
  signedNif?: string | null
  certIssuer?: string | null
  certSerial?: string | null
  certMethod?: string | null
  signedAt?: string | null
}

export interface LegalPdfEventItem {
  created_at: string
  event_type: string
  actor_name: string
  actor_nif?: string | null
  share_percentage?: number | null
  share_amount?: number | null
  cert_method?: string | null
  payload_sha256: string
}

export interface LegalPdfInput {
  ticket: {
    id: string
    number: string
    serie: string | null
    fraccion: string | null
    draw_name: string
    draw_date: string
    ticket_price: number
  }
  certification: {
    verification_code: string
    custodian_name: string
    custodian_app_name?: string | null
    custodian_nif: string
    cert_issuer: string
    cert_serial: string
    cert_method: string
    payload_sha256: string
    photo_sha256: string
    signed_at: string
  }
  photoBytes?: Uint8Array | null
  photoMimeType?: string | null
  participants: LegalPdfParticipantItem[]
  events: LegalPdfEventItem[]
}

/**
 * Normaliza texto a caracteres seguros para fuentes estándar WinAnsi en pdf-lib,
 * sustituyendo viñetas y símbolos Unicode no soportados por separadores ASCII estándar.
 */
function safePdfText(text: string): string {
  return String(text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2022\u2023\u25E6\u2043\u00B7]/g, '-')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2192/g, '->')
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, '')
}

function formatDateEs(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatEventLabel(eventType: string): string {
  switch (eventType) {
    case 'CUSTODY_CERTIFIED':
      return 'Custodia certificada digitalmente'
    case 'HANDWRITTEN_CUSTODY_SIGNED':
      return 'Custodia firmada de forma manuscrita'
    case 'PARTICIPATION_ACCEPTED':
      return 'Participación aceptada'
    case 'PARTICIPATION_SIGNED':
      return 'Participación firmada con certificado'
    case 'HANDWRITTEN_PARTICIPATION_SIGNED':
      return 'Participación firmada de forma manuscrita'
    case 'PARTICIPATION_RENOUNCED':
      return 'Renuncia de participación'
    case 'HANDWRITTEN_PARTICIPATION_RENOUNCED':
      return 'Renuncia de participación (manuscrita)'
    default:
      return eventType
  }
}

/**
 * Genera el Documento Legal PDF de Custodia y Participación con pdf-lib.
 */
export async function generateLegalCustodyPdf(input: LegalPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const margin = 42
  const contentWidth = pageWidth - margin * 2

  const dark = rgb(0.11, 0.11, 0.12)
  const muted = rgb(0.38, 0.38, 0.41)
  const granite = rgb(0.227, 0.322, 0.271) // #3A5245
  const cava = rgb(0.773, 0.659, 0.502) // #C5A880
  const lightBg = rgb(0.97, 0.96, 0.94)
  const border = rgb(0.85, 0.85, 0.87)

  let page: PDFPage = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const ensureSpace = (needed: number) => {
    if (y - needed < 70) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    font: PDFFont = fontRegular,
    color = dark
  ) => {
    page.drawText(safePdfText(text), { x, y: yPos, size, font, color })
  }

  const drawWrappedLine = (
    text: string,
    x: number,
    maxWidth: number,
    size: number,
    lineHeight: number,
    font: PDFFont = fontRegular,
    color = dark
  ) => {
    const words = safePdfText(text).split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        ensureSpace(lineHeight + 4)
        drawText(line, x, y, size, font, color)
        y -= lineHeight
        line = word
      } else {
        line = candidate
      }
    }
    if (line) {
      ensureSpace(lineHeight + 4)
      drawText(line, x, y, size, font, color)
      y -= lineHeight
    }
  }

  // 1. Cabecera legal
  page.drawRectangle({
    x: margin,
    y: y - 54,
    width: contentWidth,
    height: 54,
    color: granite,
  })
  drawText('MIS DECIMOS · CERTIFICADO LEGAL DE CUSTODIA', margin + 14, y - 22, 13, fontBold, rgb(1, 1, 1))
  drawText(
    `Codigo de verificacion: ${input.certification.verification_code}   |   Emitido: ${formatDateEs(new Date().toISOString())}`,
    margin + 14,
    y - 40,
    8.5,
    fontRegular,
    rgb(0.92, 0.88, 0.8)
  )
  y -= 70

  // 2. Datos del décimo y huella SHA-256 de la foto + Imagen del anverso
  drawText('1. IDENTIFICACION DEL DECIMO Y PRUEBA GRAFICA', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: cava,
  })
  y -= 16

  const ticketLeftY = y
  drawText(`Numero: ${input.ticket.number}`, margin, y, 11, fontBold, dark)
  y -= 15
  drawText(
    `Serie: ${input.ticket.serie || '001'}   |   Fraccion: ${input.ticket.fraccion || '01'}`,
    margin,
    y,
    9.5,
    fontRegular,
    dark
  )
  y -= 14
  drawText(`Sorteo: ${input.ticket.draw_name}`, margin, y, 9.5, fontRegular, dark)
  y -= 14
  drawText(
    `Fecha sorteo: ${input.ticket.draw_date}   |   Precio nominal: ${Number(input.ticket.ticket_price || 20).toFixed(2)} €`,
    margin,
    y,
    9.5,
    fontRegular,
    dark
  )
  y -= 14
  drawWrappedLine(
    `SHA-256 anverso: ${input.certification.photo_sha256}`,
    margin,
    input.photoBytes ? contentWidth - 180 : contentWidth,
    8,
    11,
    fontRegular,
    muted
  )

  // Incrustar imagen del anverso si está disponible
  let imageBottomY = y
  if (input.photoBytes && input.photoBytes.length > 0) {
    try {
      const isPng =
        input.photoMimeType?.includes('png') ||
        (input.photoBytes[0] === 0x89 && input.photoBytes[1] === 0x50)
      const embeddedImg = isPng
        ? await doc.embedPng(input.photoBytes)
        : await doc.embedJpg(input.photoBytes)

      const dims = embeddedImg.scaleToFit(165, 95)
      const imgX = margin + contentWidth - dims.width
      const imgY = ticketLeftY - dims.height + 8

      page.drawRectangle({
        x: imgX - 2,
        y: imgY - 2,
        width: dims.width + 4,
        height: dims.height + 4,
        borderColor: border,
        borderWidth: 0.8,
      })
      page.drawImage(embeddedImg, {
        x: imgX,
        y: imgY,
        width: dims.width,
        height: dims.height,
      })
      imageBottomY = imgY - 12
    } catch {
      // Si la imagen no pudiera embeberse, se conserva su huella SHA-256
    }
  }

  y = Math.min(y, imageBottomY) - 12

  // 3. Bloque de certificación digital del depositario
  const custodianAppName = input.certification.custodian_app_name?.trim() || ''
  const custodianLegalName = input.certification.custodian_name.trim()
  const hasDualCustodianName = Boolean(
    custodianAppName && custodianAppName.toLowerCase() !== custodianLegalName.toLowerCase()
  )
  const custodianBoxHeight = hasDualCustodianName ? 92 : 78

  ensureSpace(custodianBoxHeight + 38)
  drawText('2. CERTIFICACION DIGITAL DEL DEPOSITARIO', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: cava,
  })
  y -= 14

  page.drawRectangle({
    x: margin,
    y: y - (custodianBoxHeight - 4),
    width: contentWidth,
    height: custodianBoxHeight,
    color: lightBg,
    borderColor: cava,
    borderWidth: 0.8,
  })

  if (hasDualCustodianName) {
    drawText(
      `Titular depositario: ${custodianAppName}`,
      margin + 10,
      y - 14,
      9.5,
      fontBold,
      dark
    )
    drawText(
      `${custodianLegalName} (NIF: ${input.certification.custodian_nif})`,
      margin + 10,
      y - 27,
      9,
      fontRegular,
      dark
    )
    drawText(
      `Metodo: ${input.certification.cert_method === 'autofirma' ? 'AutoFirma' : 'Certificado X.509 (.p12/.pfx)'}   |   Emisor: ${input.certification.cert_issuer}`,
      margin + 10,
      y - 41,
      8.5,
      fontRegular,
      dark
    )
    drawText(
      `N.º Serie Certificado: ${input.certification.cert_serial}   |   Firmado: ${formatDateEs(input.certification.signed_at)}`,
      margin + 10,
      y - 55,
      8.5,
      fontRegular,
      dark
    )
    drawText(
      `Huella SHA-256 firma: ${input.certification.payload_sha256}`,
      margin + 10,
      y - 69,
      7.5,
      fontRegular,
      muted
    )
  } else {
    drawText(
      `Titular depositario: ${custodianLegalName}   (NIF: ${input.certification.custodian_nif})`,
      margin + 10,
      y - 14,
      9.5,
      fontBold,
      dark
    )
    drawText(
      `Metodo: ${input.certification.cert_method === 'autofirma' ? 'AutoFirma' : 'Certificado X.509 (.p12/.pfx)'}   |   Emisor: ${input.certification.cert_issuer}`,
      margin + 10,
      y - 29,
      8.5,
      fontRegular,
      dark
    )
    drawText(
      `N.º Serie Certificado: ${input.certification.cert_serial}   |   Firmado: ${formatDateEs(input.certification.signed_at)}`,
      margin + 10,
      y - 43,
      8.5,
      fontRegular,
      dark
    )
    drawText(
      `Huella SHA-256 firma: ${input.certification.payload_sha256}`,
      margin + 10,
      y - 57,
      7.5,
      fontRegular,
      muted
    )
  }
  y -= custodianBoxHeight + 14

  // 4. Tabla de partícipes
  ensureSpace(75)
  drawText('3. CUADRO DE PARTICIPACIONES Y FIRMAS', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: cava,
  })
  y -= 16

  drawText('Titular / Participe', margin, y, 8.5, fontBold, muted)
  drawText('Cuota', margin + 195, y, 8.5, fontBold, muted)
  drawText('Estado', margin + 275, y, 8.5, fontBold, muted)
  drawText('Firma digital / NIF', margin + 355, y, 8.5, fontBold, muted)
  y -= 12

  for (const p of input.participants) {
    const appName = (p.appName || p.name || '').trim()
    const legalName = (p.legalName || '').trim()
    const hasDualName = Boolean(legalName && legalName.toLowerCase() !== appName.toLowerCase())

    ensureSpace(hasDualName ? 28 : 18)

    const isRenounced = p.status === 'RENUNCIADA' || p.status === 'RENOUNCED'
    const statusText = isRenounced
      ? 'RENUNCIADA'
      : p.status === 'PENDIENTE'
      ? 'PENDIENTE'
      : 'ACTIVA'
    const displayPct = isRenounced ? 0 : p.percentage
    const displayAmount = isRenounced ? 0 : p.amountEuros
    const sigText = p.signedNif
      ? `${p.certMethod === 'handwritten' ? 'Manuscrita' : 'Certificado'} (${p.signedNif})`
      : p.isOwner
      ? `Depositario (${input.certification.custodian_nif})`
      : 'Aceptacion estandar'

    drawText(appName.slice(0, 32), margin, y, 8.8, hasDualName ? fontBold : fontRegular, dark)
    drawText(`${displayPct}% (${displayAmount.toFixed(2)} €)`, margin + 195, y, 8.8, fontRegular, dark)
    drawText(statusText, margin + 275, y, 8.5, fontBold, isRenounced ? muted : granite)
    drawText(sigText.slice(0, 30), margin + 355, y, 8.3, fontRegular, muted)

    if (hasDualName) {
      y -= 10
      drawText(legalName.slice(0, 38), margin, y, 7.8, fontRegular, muted)
    }
    y -= 14
  }

  y -= 10

  // 5. Anexo cronológico inmutable de eventos legales
  ensureSpace(60)
  drawText('4. ANEXO CRONOLOGICO INMUTABLE DE EVENTOS Y RENUNCIAS', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: cava,
  })
  y -= 16

  if (input.events.length === 0) {
    drawText('No hay eventos legales adicionales registrados.', margin, y, 8.8, fontRegular, muted)
    y -= 14
  } else {
    for (const ev of input.events) {
      ensureSpace(46)
      const pctStr = ev.share_percentage != null ? ` - ${ev.share_percentage}%` : ''
      const nifStr = ev.actor_nif ? ` (${ev.actor_nif})` : ''
      drawText(
        `${formatDateEs(ev.created_at)} - ${formatEventLabel(ev.event_type)}`,
        margin,
        y,
        8.8,
        fontBold,
        dark
      )
      y -= 12
      drawText(
        `Actor: ${ev.actor_name}${nifStr}${pctStr}`,
        margin + 10,
        y,
        8,
        fontRegular,
        dark
      )
      y -= 11
      drawWrappedLine(
        `SHA-256: ${ev.payload_sha256}`,
        margin + 10,
        contentWidth - 10,
        7.5,
        10,
        fontRegular,
        muted
      )
      y -= 6
    }
  }

  return doc.save()
}

export interface HandwrittenSignaturePdfSigner {
  role: 'custodian' | 'participant'
  fullName: string
  nif: string
  phone: string
  percentage: number
  amountEuros: number
  status: string
  signaturePngBase64: string
  signatureSha256: string
  signedAt: string
  userAgent?: string | null
}

export interface HandwrittenPdfInput {
  ticket: {
    id: string
    number: string
    serie: string | null
    fraccion: string | null
    draw_name: string
    draw_date: string
    ticket_price: number
  }
  verificationCode: string
  photoSha256?: string | null
  photoBytes?: Uint8Array | null
  photoMimeType?: string | null
  signers: HandwrittenSignaturePdfSigner[]
  events: LegalPdfEventItem[]
}

function decodeDataUrlPngBytes(dataUrlOrB64: string): Uint8Array {
  const b64 = dataUrlOrB64.includes(',') ? dataUrlOrB64.split(',')[1] : dataUrlOrB64
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    return out
  }
  return Uint8Array.from(Buffer.from(b64, 'base64'))
}

/**
 * Genera el Documento Privado PDF suscrito mediante firma manuscrita en pantalla (sin certificado digital).
 */
export async function generateHandwrittenAgreementPdf(input: HandwrittenPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 42
  const contentWidth = pageWidth - margin * 2

  const dark = rgb(0.11, 0.11, 0.12)
  const muted = rgb(0.38, 0.38, 0.41)
  const granite = rgb(0.227, 0.322, 0.271)
  const cava = rgb(0.773, 0.659, 0.502)
  const warnBg = rgb(0.99, 0.96, 0.9)
  const border = rgb(0.85, 0.85, 0.87)

  let page: PDFPage = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const ensureSpace = (needed: number) => {
    if (y - needed < 70) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    font: PDFFont = fontRegular,
    color = dark
  ) => {
    page.drawText(safePdfText(text), { x, y: yPos, size, font, color })
  }

  // Cabecera
  page.drawRectangle({
    x: margin,
    y: y - 54,
    width: contentWidth,
    height: 54,
    color: granite,
  })
  drawText(
    'MIS DECIMOS · DOCUMENTO PRIVADO (FIRMA MANUSCRITA)',
    margin + 14,
    y - 22,
    12.5,
    fontBold,
    rgb(1, 1, 1)
  )
  drawText(
    `Codigo: ${input.verificationCode}   |   Emitido: ${formatDateEs(new Date().toISOString())}`,
    margin + 14,
    y - 40,
    8.5,
    fontRegular,
    rgb(0.92, 0.88, 0.8)
  )
  y -= 68

  // Aviso explícito de firma manuscrita sin certificado digital
  page.drawRectangle({
    x: margin,
    y: y - 36,
    width: contentWidth,
    height: 36,
    color: warnBg,
    borderColor: cava,
    borderWidth: 0.8,
  })
  drawText(
    'AVISO: Documento suscrito mediante firma manuscrita en pantalla (sin certificado digital).',
    margin + 10,
    y - 14,
    8.5,
    fontBold,
    dark
  )
  drawText(
    'Constituye un acuerdo privado simple entre particulares sin fuerza de firma electronica cualificada.',
    margin + 10,
    y - 27,
    8,
    fontRegular,
    muted
  )
  y -= 52

  // 1. Datos del décimo y foto del anverso
  drawText('1. IDENTIFICACION DEL DECIMO', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 1, color: cava })
  y -= 16

  const imgTopY = y
  drawText(`Numero: ${input.ticket.number}`, margin, y, 11, fontBold, dark)
  y -= 14
  drawText(
    `Serie: ${input.ticket.serie || '001'}   |   Fraccion: ${input.ticket.fraccion || '01'}`,
    margin,
    y,
    9.5,
    fontRegular,
    dark
  )
  y -= 14
  drawText(`Sorteo: ${input.ticket.draw_name} (${input.ticket.draw_date})`, margin, y, 9.5, fontRegular, dark)
  y -= 14
  drawText(
    `Precio nominal: ${Number(input.ticket.ticket_price || 20).toFixed(2)} €`,
    margin,
    y,
    9.5,
    fontRegular,
    dark
  )
  y -= 14
  if (input.photoSha256) {
    drawText(`SHA-256 anverso: ${input.photoSha256.slice(0, 40)}...`, margin, y, 8, fontRegular, muted)
    y -= 14
  }

  let imgBottomY = y
  if (input.photoBytes && input.photoBytes.length > 0) {
    try {
      const isPng =
        input.photoMimeType?.includes('png') ||
        (input.photoBytes[0] === 0x89 && input.photoBytes[1] === 0x50)
      const embeddedImg = isPng
        ? await doc.embedPng(input.photoBytes)
        : await doc.embedJpg(input.photoBytes)
      const scale = Math.min(155 / embeddedImg.width, 85 / embeddedImg.height)
      const imgW = embeddedImg.width * scale
      const imgH = embeddedImg.height * scale
      const imgX = margin + contentWidth - imgW
      const imgY = imgTopY - imgH + 8
      page.drawRectangle({ x: imgX - 2, y: imgY - 2, width: imgW + 4, height: imgH + 4, borderColor: border, borderWidth: 0.8 })
      page.drawImage(embeddedImg, { x: imgX, y: imgY, width: imgW, height: imgH })
      imgBottomY = imgY - 8
    } catch {
      // ignorar si falla el embebido
    }
  }

  y = Math.min(y, imgBottomY) - 10

  // 2. Firmantes y firmas manuscritas PNG
  ensureSpace(90)
  drawText('2. FIRMANTES Y TRAZOS MANUSCRITOS', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 1, color: cava })
  y -= 14

  for (const signer of input.signers) {
    ensureSpace(92)
    page.drawRectangle({
      x: margin,
      y: y - 78,
      width: contentWidth,
      height: 82,
      borderColor: border,
      borderWidth: 0.8,
    })

    const roleLabel = signer.role === 'custodian' ? 'DEPOSITARIO' : 'PARTICIPE'
    drawText(
      `${roleLabel}: ${signer.fullName}   |   DNI/NIE: ${signer.nif}`,
      margin + 10,
      y - 14,
      9.2,
      fontBold,
      dark
    )
    drawText(
      `Tel: ${signer.phone}   |   Cuota: ${signer.percentage}% (${signer.amountEuros.toFixed(2)} €)   |   Estado: ${signer.status}`,
      margin + 10,
      y - 28,
      8.3,
      fontRegular,
      dark
    )
    drawText(
      `Fecha: ${formatDateEs(signer.signedAt)}   |   SHA-256 firma: ${signer.signatureSha256.slice(0, 24)}...`,
      margin + 10,
      y - 42,
      7.6,
      fontRegular,
      muted
    )

    try {
      const sigBytes = decodeDataUrlPngBytes(signer.signaturePngBase64)
      const sigImg = await doc.embedPng(sigBytes)
      const scale = Math.min(115 / sigImg.width, 46 / sigImg.height)
      const sw = sigImg.width * scale
      const sh = sigImg.height * scale
      page.drawImage(sigImg, {
        x: margin + contentWidth - sw - 12,
        y: y - 68,
        width: sw,
        height: sh,
      })
    } catch {
      // mantener datos si la imagen PNG no es válida
    }

    y -= 92
  }

  // 3. Eventos cronológicos
  ensureSpace(50)
  drawText('3. REGISTRO DE EVENTOS (FIRMA MANUSCRITA)', margin, y, 10.5, fontBold, granite)
  y -= 6
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 1, color: cava })
  y -= 14

  for (const ev of input.events) {
    ensureSpace(28)
    drawText(
      `${formatDateEs(ev.created_at)} — ${ev.event_type} — ${ev.actor_name}${ev.actor_nif ? ` (${ev.actor_nif})` : ''}`,
      margin,
      y,
      8.3,
      fontRegular,
      dark
    )
    y -= 13
  }

  return doc.save()
}
