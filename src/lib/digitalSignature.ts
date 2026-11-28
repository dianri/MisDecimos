import forge from 'node-forge'
import { computeSha256Hex } from './legalCustody.ts'

export type CertificateMethod = 'p12' | 'autofirma'

export interface ExtractedCertificateIdentity {
  fullName: string
  nif: string
  issuer: string
  serialNumber: string
  validFrom: string
  validTo: string
}

export interface DigitalSignatureResult {
  method: CertificateMethod
  identity: ExtractedCertificateIdentity
  signatureB64: string
  payloadSha256: string
  signedAtIso: string
}

const NIF_NIE_REGEX = /\b([XYZ]\d{7}[A-Z]|\d{8}[A-Z])\b/i
export const ALPHANUMERIC_ID_REGEX = /^[A-Za-z0-9]{1,20}$/

function getAttributeValue(
  attrs: forge.pki.CertificateField[],
  namesOrOids: string[]
): string | null {
  for (const attr of attrs) {
    const type = String(attr.type || '')
    const shortName = String(attr.shortName || '')
    const name = String(attr.name || '')
    if (namesOrOids.includes(type) || namesOrOids.includes(shortName) || namesOrOids.includes(name)) {
      if (typeof attr.value === 'string' && attr.value.trim()) {
        return attr.value.trim()
      }
    }
  }
  return null
}

/**
 * Extrae el NIF/DNI/NIE desde el campo serialNumber (OID 2.5.4.5) o desde el CN del certificado X.509.
 */
export function extractNifFromText(raw: string): string | null {
  const match = raw.toUpperCase().match(NIF_NIE_REGEX)
  if (match && match[1]) return match[1]
  // Patrón FNMT típico: "IDCES-12345678A"
  const idcesMatch = raw.toUpperCase().match(/IDCES-([XYZ]\d{7}[A-Z]|\d{8}[A-Z])/)
  if (idcesMatch && idcesMatch[1]) return idcesMatch[1]
  return null
}

/**
 * Extrae Nombre completo, NIF, Emisor y Número de serie de un certificado X.509 de node-forge.
 */
export function extractIdentityFromX509Cert(
  cert: forge.pki.Certificate,
  now: Date = new Date()
): ExtractedCertificateIdentity {
  if (cert.validity?.notBefore && now < cert.validity.notBefore) {
    throw new Error('El certificado digital aún no es válido (fecha de inicio futura).')
  }
  if (cert.validity?.notAfter && now > cert.validity.notAfter) {
    throw new Error('El certificado digital está caducado.')
  }

  const subjectAttrs = cert.subject?.attributes || []
  const issuerAttrs = cert.issuer?.attributes || []

  const cn = getAttributeValue(subjectAttrs, ['CN', 'commonName', '2.5.4.3']) || ''
  const givenName = getAttributeValue(subjectAttrs, ['givenName', 'GN', '2.5.4.42'])
  const surname = getAttributeValue(subjectAttrs, ['surname', 'SN', '2.5.4.4'])
  const serialAttr = getAttributeValue(subjectAttrs, ['serialNumber', '2.5.4.5']) || ''

  const nif =
    extractNifFromText(serialAttr) ||
    extractNifFromText(cn) ||
    'NO-ESPECIFICADO'

  let fullName = ''
  if (givenName && surname) {
    fullName = `${givenName} ${surname}`.trim()
  } else if (cn) {
    fullName = cn
      .replace(/(-\s*)?\bNIF\s+[A-Z0-9-]+/i, '')
      .replace(NIF_NIE_REGEX, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\-–]+|[\s\-–]+$/g, '')
      .trim()
  }

  if (!fullName) {
    fullName = cn || 'Titular certificado'
  }

  const issuerCn =
    getAttributeValue(issuerAttrs, ['CN', 'commonName', '2.5.4.3']) ||
    getAttributeValue(issuerAttrs, ['O', 'organizationName', '2.5.4.10']) ||
    'Autoridad Certificadora'

  const serialNumber = (cert.serialNumber || '').toUpperCase() || 'SIN-SERIE'

  return {
    fullName,
    nif,
    issuer: issuerCn,
    serialNumber,
    validFrom: cert.validity?.notBefore ? cert.validity.notBefore.toISOString() : '',
    validTo: cert.validity?.notAfter ? cert.validity.notAfter.toISOString() : '',
  }
}

/**
 * Lee un archivo .p12 / .pfx exclusivamente en memoria del navegador, valida el certificado
 * y genera una firma PKCS#7 / CMS detached con SHA-256 sobre el payload canónico.
 */
export async function signPayloadWithP12(params: {
  p12Bytes: ArrayBuffer | Uint8Array
  password: string
  canonicalPayload: string
  now?: Date
}): Promise<DigitalSignatureResult> {
  const bytes = params.p12Bytes instanceof Uint8Array ? params.p12Bytes : new Uint8Array(params.p12Bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }

  let p12Asn1: forge.asn1.Asn1
  try {
    p12Asn1 = forge.asn1.fromDer(binary)
  } catch {
    throw new Error('El archivo seleccionado no es un contenedor PKCS#12 (.p12 / .pfx) válido.')
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, params.password)
  } catch {
    throw new Error('Contraseña incorrecta o archivo .p12/.pfx dañado.')
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ||
    []

  const cert = certBags.find((b) => Boolean(b.cert))?.cert
  const privateKey = keyBags.find((b) => Boolean(b.key))?.key as forge.pki.rsa.PrivateKey | undefined

  if (!cert || !privateKey) {
    throw new Error('El archivo .p12/.pfx no contiene un certificado y clave privada válidos.')
  }

  const identity = extractIdentityFromX509Cert(cert, params.now)
  const payloadSha256 = await computeSha256Hex(params.canonicalPayload)

  // Generar firma PKCS#7 / CMS detached con SHA-256
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(params.canonicalPayload, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data,
      },
      {
        type: forge.pki.oids.messageDigest,
      },
      {
        type: forge.pki.oids.signingTime,
        value: (params.now || new Date()).toISOString(),
      },
    ],
  })
  p7.sign({ detached: true })

  const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes()
  const signatureB64 = forge.util.encode64(derBytes)

  return {
    method: 'p12',
    identity,
    signatureB64,
    payloadSha256,
    signedAtIso: (params.now || new Date()).toISOString(),
  }
}

/**
 * Genera un identificador de sesión estrictamente alfanumérico de 16 caracteres (<= 20 exigido por @firma).
 */
export function generateAutoFirmaSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomBytes = new Uint8Array(14)
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(randomBytes)
  } else {
    for (let i = 0; i < randomBytes.length; i += 1) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let suffix = ''
  for (const b of randomBytes) {
    suffix += chars[b % chars.length]
  }
  return `MD${suffix}`
}

export function getAutoFirmaRelayUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env
      ? (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL
      : undefined
  const baseUrl = (envUrl || 'https://xmdghpyfrblmtjtevtru.supabase.co').replace(/\/+$/, '')
  return `${baseUrl}/functions/v1/autofirma-relay`
}

function toBase64UrlSafe(text: string): string {
  const stdB64 =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(text)))
      : Buffer.from(text, 'utf8').toString('base64')
  return stdB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64UrlSafeToStandard(b64: string): string {
  const cleaned = b64.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (cleaned.length % 4)) % 4
  return cleaned + '='.repeat(padLen)
}

/**
 * Construye la URI oficial afirma://sign conforme a UrlParametersToSign de AutoFirma (@firma).
 */
export function buildAutoFirmaSignUrl(params: {
  canonicalPayload: string
  opId: string
  relayUrl?: string
}): string {
  if (!ALPHANUMERIC_ID_REGEX.test(params.opId)) {
    throw new Error(
      'El identificador de sesión de AutoFirma debe ser estrictamente alfanumérico y tener como máximo 20 caracteres.'
    )
  }

  const relay = params.relayUrl || getAutoFirmaRelayUrl()
  const dat = toBase64UrlSafe(params.canonicalPayload)

  const query = new URLSearchParams({
    op: 'sign',
    id: params.opId,
    stservlet: relay,
    rtservlet: relay,
    format: 'CAdES',
    algorithm: 'SHA256withRSA',
    mode: 'explicit',
    dat,
  })

  return `afirma://sign?${query.toString()}`
}

function isCaCertificate(cert: forge.pki.Certificate): boolean {
  try {
    const ext = cert.getExtension('basicConstraints') as { cA?: boolean } | null
    return ext?.cA === true
  } catch {
    return false
  }
}

function toHexPreview(derBytes: string, maxBytes = 12): string {
  const limit = Math.min(derBytes.length, maxBytes)
  const parts: string[] = []
  for (let i = 0; i < limit; i += 1) {
    parts.push(derBytes.charCodeAt(i).toString(16).padStart(2, '0'))
  }
  return parts.join(' ')
}

/**
 * Decodifica la respuesta de AutoFirma (<cert_b64>|<cms_b64> o paquete CMS/X.509 único,
 * incluyendo cadenas DER concatenadas de Android KeyChain) y extrae el certificado X.509 del titular.
 */
export async function parseAutoFirmaSignature(
  rawDat: string,
  canonicalPayload: string,
  now: Date = new Date()
): Promise<DigitalSignatureResult> {
  const normalizedRaw = String(rawDat || '').trim().replace(/%7C/gi, '|')
  const segments = normalizedRaw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    throw new Error('AutoFirma devolvió una respuesta vacía sin certificado ni firma.')
  }

  let signerCert: forge.pki.Certificate | undefined
  let fallbackCert: forge.pki.Certificate | undefined
  let signatureB64 = ''
  const diagnostics: string[] = []

  for (const segment of segments) {
    const stdB64 = fromBase64UrlSafeToStandard(segment)
    let derBytes = ''
    try {
      derBytes = forge.util.decode64(stdB64)
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      diagnostics.push(`len=${segment.length} base64_err=${detail}`)
      continue
    }

    diagnostics.push(`len=${derBytes.length} hex=${toHexPreview(derBytes)}`)

    // 1. Intentar parsear como certificado X.509 (modo no estricto para tolerar cadenas DER concatenadas en Android)
    let parsedAsCert = false
    try {
      const certAsn1 = forge.asn1.fromDer(derBytes, false)
      const cert = forge.pki.certificateFromAsn1(certAsn1)
      parsedAsCert = true
      if (!isCaCertificate(cert)) {
        if (!signerCert) signerCert = cert
      } else if (!fallbackCert) {
        fallbackCert = cert
      }
    } catch {
      // No es un certificado X.509 en cabeza
    }

    // 2. Intentar parsear como paquete PKCS#7 / CMS (modo no estricto)
    let parsedAsPkcs7 = false
    try {
      const cmsAsn1 = forge.asn1.fromDer(derBytes, false)
      const p7 = forge.pkcs7.messageFromAsn1(cmsAsn1) as forge.pkcs7.PkcsSignedData
      parsedAsPkcs7 = true
      signatureB64 = stdB64
      const certs = (p7 as unknown as { certificates?: forge.pki.Certificate[] }).certificates || []
      for (const c of certs) {
        if (!isCaCertificate(c)) {
          if (!signerCert) signerCert = c
        } else if (!fallbackCert) {
          fallbackCert = c
        }
      }
    } catch {
      // No es un paquete PKCS#7 completo o es una firma raw/detached
    }

    // Si es el segmento de firma (no certificado) y aún no hay signatureB64, conservarlo
    if (!parsedAsCert && (parsedAsPkcs7 || !signatureB64)) {
      signatureB64 = stdB64
    }
  }

  const chosenCert = signerCert || fallbackCert
  if (!chosenCert) {
    throw new Error(
      `No se pudo extraer ningún certificado X.509 válido de AutoFirma (${diagnostics.join('; ')}).`
    )
  }

  if (!signatureB64) {
    signatureB64 = fromBase64UrlSafeToStandard(segments[segments.length - 1])
  }

  const identity = extractIdentityFromX509Cert(chosenCert, now)
  const payloadSha256 = await computeSha256Hex(canonicalPayload)

  return {
    method: 'autofirma',
    identity,
    signatureB64,
    payloadSha256,
    signedAtIso: now.toISOString(),
  }
}

export const decodeCmsSignatureAndExtractIdentity = parseAutoFirmaSignature

/**
 * Realiza polling contra autofirma-relay hasta recibir la firma CMS, un error SAF_... o agotar el timeout.
 */
export async function pollAutoFirmaRelay(params: {
  opId: string
  canonicalPayload: string
  relayUrl?: string
  timeoutMs?: number
  pollIntervalMs?: number
  signal?: AbortSignal
}): Promise<DigitalSignatureResult> {
  const relay = params.relayUrl || getAutoFirmaRelayUrl()
  const timeoutMs = params.timeoutMs ?? 90_000
  const pollIntervalMs = params.pollIntervalMs ?? 1500
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (params.signal?.aborted) {
      throw new Error('Espera de firma en AutoFirma cancelada por el usuario.')
    }

    try {
      const res = await fetch(`${relay}?op=get&id=${encodeURIComponent(params.opId)}`, {
        method: 'GET',
        signal: params.signal,
      })

      if (res.ok) {
        const text = (await res.text()).trim()
        if (text && text !== 'NO_DATA') {
          if (text.startsWith('SAF_04') || text.startsWith('SAF_09')) {
            throw new Error(`Operación cancelada en AutoFirma (${text}).`)
          }
          if (text.startsWith('SAF_') || text.startsWith('ERR_')) {
            throw new Error(`AutoFirma devolvió un error (${text}).`)
          }
          return await decodeCmsSignatureAndExtractIdentity(text, params.canonicalPayload)
        }
      }
    } catch (err: unknown) {
      if (params.signal?.aborted) {
        throw new Error('Espera de firma en AutoFirma cancelada por el usuario.')
      }
      if (err instanceof Error && (err.message.includes('AutoFirma') || err.message.includes('CMS'))) {
        throw err
      }
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        params.signal?.removeEventListener('abort', onAbort)
        resolve()
      }, pollIntervalMs)

      function onAbort() {
        clearTimeout(timer)
        reject(new Error('Espera de firma en AutoFirma cancelada por el usuario.'))
      }

      params.signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  throw new Error(
    'No se recibió respuesta de AutoFirma en 90 segundos. Verifica que tienes AutoFirma instalada o usa la pestaña "Archivo .p12 / .pfx".'
  )
}
