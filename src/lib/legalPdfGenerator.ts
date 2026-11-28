import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export interface LegalPdfParticipantItem {
  name: string
  percentage: number
  amountEuros: number
  status: string
  isOwner?: boolean
  signedNif?: string | null
  certIssuer?: string | null
  certSerial?: string | null
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
 * Normaliza texto a caracteres seguros para fuentes estándar WinAnsi en pdf-lib.
 */
function safePdfText(text: string): string {
  return String(text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, '?')
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
    case 'PARTICIPATION_ACCEPTED':
      return 'Participación aceptada'
    case 'PARTICIPATION_SIGNED':
      return 'Participación firmada con certificado'
    case 'PARTICIPATION_RENOUNCED':
      return 'Renuncia de participación'
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
    if (y - needed < margin + 20) {
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

      const maxBoxW = 165
      const maxBoxH = 95
      const scale = Math.min(maxBoxW / embeddedImg.width, maxBoxH / embeddedImg.height)
      const imgW = embeddedImg.width * scale
      const imgH = embeddedImg.height * scale
      const imgX = margin + contentWidth - imgW
      const imgY = ticketLeftY - imgH + 8

      page.drawRectangle({
        x: imgX - 2,
        y: imgY - 2,
        width: imgW + 4,
        height: imgH + 4,
        borderColor: border,
        borderWidth: 0.8,
      })
      page.drawImage(embeddedImg, {
        x: imgX,
        y: imgY,
        width: imgW,
        height: imgH,
      })
      imageBottomY = imgY - 8
    } catch {
      // Si la imagen no pudiera embeberse, se conserva su huella SHA-256
    }
  }

  y = Math.min(y, imageBottomY) - 10

  // 3. Bloque de certificación digital del depositario
  ensureSpace(110)
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
    y: y - 74,
    width: contentWidth,
    height: 78,
    color: lightBg,
    borderColor: cava,
    borderWidth: 0.8,
  })

  drawText(
    `Titular depositario: ${input.certification.custodian_name}   (NIF: ${input.certification.custodian_nif})`,
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
  y -= 92

  // 4. Tabla de partícipes
  ensureSpace(70)
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
  drawText('Estado', margin + 265, y, 8.5, fontBold, muted)
  drawText('Firma digital / NIF', margin + 350, y, 8.5, fontBold, muted)
  y -= 12

  for (const p of input.participants) {
    ensureSpace(20)
    const statusText =
      p.status === 'RENUNCIADA'
        ? 'RENUNCIADA'
        : p.status === 'PENDIENTE'
        ? 'PENDIENTE'
        : 'ACTIVA'
    const sigText = p.signedNif
      ? `Certificado (${p.signedNif})`
      : p.isOwner
      ? `Depositario (${input.certification.custodian_nif})`
      : 'Aceptacion estandar'

    drawText(p.name.slice(0, 32), margin, y, 8.8, fontRegular, dark)
    drawText(`${p.percentage}% (${p.amountEuros.toFixed(2)} €)`, margin + 195, y, 8.8, fontRegular, dark)
    drawText(statusText, margin + 265, y, 8.5, fontBold, statusText === 'RENUNCIADA' ? muted : granite)
    drawText(sigText.slice(0, 30), margin + 350, y, 8.3, fontRegular, muted)
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
      ensureSpace(34)
      const pctStr = ev.share_percentage != null ? ` · ${ev.share_percentage}%` : ''
      const nifStr = ev.actor_nif ? ` (${ev.actor_nif})` : ''
      drawText(
        `${formatDateEs(ev.created_at)} — ${formatEventLabel(ev.event_type)}`,
        margin,
        y,
        8.8,
        fontBold,
        dark
      )
      y -= 11
      drawText(
        `Actor: ${ev.actor_name}${nifStr}${pctStr}   |   SHA-256: ${ev.payload_sha256.slice(0, 24)}...`,
        margin + 10,
        y,
        7.8,
        fontRegular,
        muted
      )
      y -= 14
    }
  }

  return doc.save()
}
