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
 * Construye el enlace de invocación al protocolo AutoFirma (afirma://sign).
 */
export function buildAutoFirmaSignUrl(params: {
  canonicalPayload: string
  opId: string
}): string {
  const dataB64 =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(params.canonicalPayload)))
      : Buffer.from(params.canonicalPayload, 'utf8').toString('base64')

  const query = new URLSearchParams({
    op: 'sign',
    id: params.opId,
    format: 'CAdES',
    algorithm: 'SHA256withRSA',
    dat: dataB64,
  })

  return `afirma://sign?${query.toString()}`
}

/**
 * Lanza la invocación a AutoFirma mediante protocolo afirma:// con control de timeout
 * para detectar si la app no está instalada en el dispositivo.
 */
export function launchAutoFirmaWithTimeout(
  url: string,
  timeoutMs = 2500
): Promise<{ launched: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({ launched: false, timedOut: true })
      return
    }

    let settled = false
    const onVisibilityChange = () => {
      if (document.hidden && !settled) {
        settled = true
        cleanup()
        resolve({ launched: true, timedOut: false })
      }
    }

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true
        cleanup()
        resolve({ launched: false, timedOut: true })
      }
    }, timeoutMs)

    function cleanup() {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.location.href = url
  })
}
