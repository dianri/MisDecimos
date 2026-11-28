import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Database } from '../../types/database.types'
import type { OwnershipShare } from './OwnershipBreakdownCard'
import { CertificateSignModal } from './CertificateSignModal'
import { TicketPhotoCaptureModal } from './TicketPhotoCaptureModal'
import type { DigitalSignatureResult } from '../../lib/digitalSignature'
import {
  evaluateCertifiedTicketLock,
  requiresDigitalSignatureForRenounce,
  generateVerificationCode,
  computeSha256Hex,
  buildCanonicalLegalPayload,
} from '../../lib/legalCustody'
import { generateLegalCustodyPdf } from '../../lib/legalPdfGenerator'
import {
  ShieldCheck,
  Lock,
  Unlock,
  Camera,
  FolderOpen,
  RefreshCw,
  FileDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  FileSignature,
  LogOut,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']
export type TicketCertificationRow = Database['public']['Tables']['ticket_certifications']['Row']
export type TicketLegalEventRow = Database['public']['Tables']['ticket_legal_events']['Row']

export interface LegalCertificationTabProps {
  ticket: TicketRow
  shares: OwnershipShare[]
  isOwner: boolean
  userShare?: OwnershipShare
  certification: TicketCertificationRow | null
  legalEvents: TicketLegalEventRow[]
  onRefresh: () => Promise<void>
  onRenounced?: (percentage: number) => void
}

export const LegalCertificationTab: React.FC<LegalCertificationTabProps> = ({
  ticket,
  shares,
  isOwner,
  userShare,
  certification,
  legalEvents,
  onRefresh,
  onRenounced,
}) => {
  const { user, profile } = useAuth()

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoSha256, setPhotoSha256] = useState<string | null>(null)
  const [certPhotoSignedUrl, setCertPhotoSignedUrl] = useState<string | null>(null)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null)

  const [signModalMode, setSignModalMode] = useState<
    'custody' | 'participant_sign' | 'participant_renounce' | null
  >(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const acceptedThirdPartyCount = useMemo(
    () => shares.filter((s) => s.role === 'PARTICIPANTE' && s.status === 'ACEPTADA').length,
    [shares]
  )

  const lockState = useMemo(
    () =>
      evaluateCertifiedTicketLock({
        isCertified: Boolean(certification),
        acceptedThirdPartyCount,
      }),
    [certification, acceptedThirdPartyCount]
  )

  // Cargar URL firmada de la foto del anverso si ya está certificado
  useEffect(() => {
    let active = true
    if (!certification?.photo_path) {
      setCertPhotoSignedUrl(null)
      return
    }

    supabase.storage
      .from('ticket-certifications')
      .createSignedUrl(certification.photo_path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) {
          setCertPhotoSignedUrl(data.signedUrl)
        }
      })
      .catch(() => {
        if (active) setCertPhotoSignedUrl(null)
      })

    return () => {
      active = false
    }
  }, [certification?.photo_path])

  // Limpiar ObjectURL local
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  const handlePhotoSelected = async (file: File | null) => {
    if (!file) return
    setFeedback(null)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
    const buf = await file.arrayBuffer()
    const hash = await computeSha256Hex(buf)
    setPhotoSha256(hash)
  }

  // Mapa de firmas digitales activas por partícipe
  const participantSignatureByUser = useMemo(() => {
    const map = new Map<string, TicketLegalEventRow>()
    for (const ev of legalEvents) {
      if (ev.event_type === 'PARTICIPATION_SIGNED') {
        map.set(ev.actor_user_id, ev)
      } else if (ev.event_type === 'PARTICIPATION_RENOUNCED') {
        map.delete(ev.actor_user_id)
      }
    }
    return map
  }, [legalEvents])

  const hasCurrentUserSigned = Boolean(user?.id && participantSignatureByUser.has(user.id))

  const participantShares = useMemo(
    () => shares.filter((s) => s.role === 'PARTICIPANTE'),
    [shares]
  )

  const canonicalPayload = useMemo(() => {
    const nowIso = new Date().toISOString()
    if (signModalMode === 'custody') {
      return buildCanonicalLegalPayload({
        eventType: 'CUSTODY_CERTIFIED',
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        drawDate: ticket.draw_date,
        drawName: ticket.draw_name,
        serie: ticket.serie,
        fraccion: ticket.fraccion,
        ticketPrice: ticket.ticket_price,
        photoSha256,
        actorUserId: user?.id || '',
        sharePercentage: 100,
        timestampIso: nowIso,
      })
    }
    if (signModalMode === 'participant_renounce') {
      return buildCanonicalLegalPayload({
        eventType: 'PARTICIPATION_RENOUNCED',
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        drawDate: ticket.draw_date,
        drawName: ticket.draw_name,
        serie: ticket.serie,
        fraccion: ticket.fraccion,
        ticketPrice: ticket.ticket_price,
        photoSha256: certification?.photo_sha256 || null,
        actorUserId: user?.id || '',
        sharePercentage: userShare ? Number(userShare.percentage) : null,
        timestampIso: nowIso,
      })
    }
    return buildCanonicalLegalPayload({
      eventType: 'PARTICIPATION_SIGNED',
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      drawDate: ticket.draw_date,
      drawName: ticket.draw_name,
      serie: ticket.serie,
      fraccion: ticket.fraccion,
      ticketPrice: ticket.ticket_price,
      photoSha256: certification?.photo_sha256 || null,
      actorUserId: user?.id || '',
      sharePercentage: userShare ? Number(userShare.percentage) : null,
      timestampIso: nowIso,
    })
  }, [signModalMode, ticket, photoSha256, certification?.photo_sha256, user?.id, userShare])

  const handleCertifyCustody = async (sig: DigitalSignatureResult) => {
    if (!user?.id || !photoFile || !photoSha256) {
      throw new Error('Debes adjuntar la fotografía del anverso del décimo antes de certificar.')
    }

    const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
    const storagePath = `${user.id}/${ticket.id}/anverso-${Date.now()}.${safeExt}`

    const { error: uploadErr } = await supabase.storage
      .from('ticket-certifications')
      .upload(storagePath, photoFile, {
        contentType: photoFile.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadErr) {
      throw new Error(`No se pudo subir la imagen del anverso: ${uploadErr.message}`)
    }

    const verificationCode = generateVerificationCode()

    const { error: certErr } = await supabase.from('ticket_certifications').insert({
      ticket_id: ticket.id,
      custodian_user_id: user.id,
      status: 'certified',
      photo_path: storagePath,
      photo_sha256: photoSha256,
      custodian_name: sig.identity.fullName,
      custodian_nif: sig.identity.nif,
      cert_issuer: sig.identity.issuer,
      cert_serial: sig.identity.serialNumber,
      cert_method: sig.method,
      signature_b64: sig.signatureB64,
      payload_sha256: sig.payloadSha256,
      verification_code: verificationCode,
      signed_at: sig.signedAtIso,
    })

    if (certErr) {
      await supabase.storage.from('ticket-certifications').remove([storagePath])
      throw new Error(certErr.message)
    }

    await supabase.from('ticket_legal_events').insert({
      ticket_id: ticket.id,
      actor_user_id: user.id,
      event_type: 'CUSTODY_CERTIFIED',
      actor_name: sig.identity.fullName,
      actor_nif: sig.identity.nif,
      cert_issuer: sig.identity.issuer,
      cert_serial: sig.identity.serialNumber,
      cert_method: sig.method,
      signature_b64: sig.signatureB64,
      payload_sha256: sig.payloadSha256,
      share_percentage: 100,
      share_amount: Number(ticket.ticket_price || 20),
      metadata: { verification_code: verificationCode, photo_sha256: photoSha256 },
    })

    setFeedback({
      type: 'success',
      text: `Custodia certificada correctamente (${verificationCode}).`,
    })
    await onRefresh()
  }

  const handleParticipantSign = async (sig: DigitalSignatureResult) => {
    if (!user?.id || !userShare) return
    const pct = Number(userShare.percentage)
    const amount = (Number(ticket.ticket_price || 20) * pct) / 100

    const { error } = await supabase.from('ticket_legal_events').insert({
      ticket_id: ticket.id,
      participation_id: userShare.id,
      actor_user_id: user.id,
      event_type: 'PARTICIPATION_SIGNED',
      actor_name: sig.identity.fullName,
      actor_nif: sig.identity.nif,
      cert_issuer: sig.identity.issuer,
      cert_serial: sig.identity.serialNumber,
      cert_method: sig.method,
      signature_b64: sig.signatureB64,
      payload_sha256: sig.payloadSha256,
      share_percentage: pct,
      share_amount: amount,
    })

    if (error) throw new Error(error.message)

    setFeedback({
      type: 'success',
      text: `Participación firmada digitalmente (${sig.identity.nif}).`,
    })
    await onRefresh()
  }

  const executeRenounce = async (sig?: DigitalSignatureResult) => {
    if (!user?.id || !userShare) return
    const pct = Number(userShare.percentage)
    const amount = (Number(ticket.ticket_price || 20) * pct) / 100

    setIsProcessing(true)
    setFeedback(null)
    try {
      const { error: rpcErr } = await supabase.rpc('renounce_own_participation', {
        p_share_id: userShare.id,
      })
      if (rpcErr) throw rpcErr

      const payloadHash =
        sig?.payloadSha256 ||
        (await computeSha256Hex(
          buildCanonicalLegalPayload({
            eventType: 'PARTICIPATION_RENOUNCED',
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            drawDate: ticket.draw_date,
            drawName: ticket.draw_name,
            serie: ticket.serie,
            fraccion: ticket.fraccion,
            ticketPrice: ticket.ticket_price,
            photoSha256: certification?.photo_sha256 || null,
            actorUserId: user.id,
            sharePercentage: pct,
            timestampIso: new Date().toISOString(),
          })
        ))

      await supabase.from('ticket_legal_events').insert({
        ticket_id: ticket.id,
        participation_id: userShare.id,
        actor_user_id: user.id,
        event_type: 'PARTICIPATION_RENOUNCED',
        actor_name:
          sig?.identity.fullName ||
          profile?.display_name ||
          user.email?.split('@')[0] ||
          'Partícipe',
        actor_nif: sig?.identity.nif || null,
        cert_issuer: sig?.identity.issuer || null,
        cert_serial: sig?.identity.serialNumber || null,
        cert_method: sig?.method || null,
        signature_b64: sig?.signatureB64 || null,
        payload_sha256: payloadHash,
        share_percentage: pct,
        share_amount: amount,
      })

      onRenounced?.(pct)
      await onRefresh()
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo completar la renuncia.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRenounceClick = async () => {
    if (!userShare) return
    if (requiresDigitalSignatureForRenounce(hasCurrentUserSigned)) {
      setSignModalMode('participant_renounce')
      return
    }
    if (
      !confirm(
        `¿Seguro que quieres renunciar a tu participación del ${userShare.percentage}% en el décimo #${ticket.number}? Tu porcentaje volverá al depositario.`
      )
    ) {
      return
    }
    await executeRenounce()
  }

  const handleDownloadPdf = async () => {
    if (!certification) return
    setIsDownloadingPdf(true)
    setFeedback(null)
    try {
      let photoBytes: Uint8Array | null = null
      let photoMimeType: string | null = null

      if (certification.photo_path) {
        const { data: blobData } = await supabase.storage
          .from('ticket-certifications')
          .download(certification.photo_path)
        if (blobData) {
          photoMimeType = blobData.type
          photoBytes = new Uint8Array(await blobData.arrayBuffer())
        }
      }

      const pdfBytes = await generateLegalCustodyPdf({
        ticket: {
          id: ticket.id,
          number: ticket.number,
          serie: ticket.serie,
          fraccion: ticket.fraccion,
          draw_name: ticket.draw_name,
          draw_date: ticket.draw_date,
          ticket_price: ticket.ticket_price,
        },
        certification,
        photoBytes,
        photoMimeType,
        participants: shares.map((s) => {
          const pct = Number(s.percentage)
          const amountEuros = (Number(ticket.ticket_price || 20) * pct) / 100
          const sigEv = participantSignatureByUser.get(s.user_id)
          return {
            name:
              s.profiles?.display_name ||
              s.profiles?.email?.split('@')[0] ||
              (s.role === 'PROPIETARIO' ? certification.custodian_name : 'Partícipe'),
            percentage: pct,
            amountEuros,
            status: s.status,
            isOwner: s.role === 'PROPIETARIO',
            signedNif: sigEv?.actor_nif || null,
            certIssuer: sigEv?.cert_issuer || null,
            certSerial: sigEv?.cert_serial || null,
            signedAt: sigEv?.created_at || null,
          }
        }),
        events: legalEvents,
      })

      const pdfBuffer = new Uint8Array(pdfBytes.byteLength)
      pdfBuffer.set(pdfBytes)
      const blob = new Blob([pdfBuffer.buffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MisDecimos_Certificado_${ticket.number}_${certification.verification_code}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo generar el documento PDF.',
      })
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2 ${
            feedback.type === 'success'
              ? 'bg-[#3A5245] text-white'
              : 'bg-[#D04848] text-white'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#C5A880] mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. Bloque de Custodia del Depositario */}
      <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-5 space-y-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#3A5245] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#C5A880]" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Custodia Legal del Décimo
              </h3>
              <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
                {certification
                  ? `Verificación: ${certification.verification_code}`
                  : 'Acredita la posesión física mediante firma electrónica'}
              </p>
            </div>
          </div>

          {certification && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                lockState.isLocked
                  ? 'bg-[#3A5245] text-white'
                  : 'bg-[#C5A880]/20 text-[#73562E] dark:text-[#E5CFA9]'
              }`}
            >
              {lockState.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{lockState.isLocked ? 'Bloqueado · Custodia protegida' : 'Editable'}</span>
            </span>
          )}
        </div>

        {certification ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#FCF9F3] dark:bg-[#262017] border border-[#C5A880]/45 space-y-1.5 text-xs">
              <p className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {certification.custodian_name} · NIF {certification.custodian_nif}
              </p>
              <p className="text-[11px] text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70">
                Emisor: {certification.cert_issuer} · Serie: {certification.cert_serial}
              </p>
              <p className="text-[11px] font-mono text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65 break-all">
                SHA-256 anverso: {certification.photo_sha256}
              </p>
            </div>

            {certPhotoSignedUrl && (
              <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/[0.02]">
                <img
                  src={certPhotoSignedUrl}
                  alt="Anverso certificado del décimo"
                  className="w-full max-h-56 object-contain"
                />
              </div>
            )}

            <p className="text-[11px] text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 leading-relaxed">
              <strong>{lockState.statusLabel}:</strong> {lockState.statusDescription}
            </p>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="w-full py-3 px-4 rounded-2xl bg-[#3A5245] hover:bg-[#2F4338] text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-[#C5A880]" />
              )}
              <span>
                {isDownloadingPdf ? 'Generando PDF legal...' : 'Descargar Documento Legal (PDF)'}
              </span>
            </button>
          </div>
        ) : isOwner ? (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[11px] text-[#1D1D1F]/75 dark:text-[#F5F5F7]/75 leading-relaxed">
              Al certificar la custodia declaras bajo tu responsabilidad que posees físicamente el
              décimo <strong>#{ticket.number}</strong> y custodias las participaciones asignadas.
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Fotografía del anverso del décimo (obligatoria)
              </label>

              {/* Inputs ocultos: galería/carpeta (sin capture) y respaldo cámara nativa */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  e.target.value = ''
                  handlePhotoSelected(file)
                }}
                className="hidden"
              />
              <input
                ref={nativeCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  e.target.value = ''
                  handlePhotoSelected(file)
                }}
                className="hidden"
              />

              {!photoPreviewUrl ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        typeof navigator !== 'undefined' &&
                        navigator.mediaDevices &&
                        typeof navigator.mediaDevices.getUserMedia === 'function'
                      ) {
                        setIsCameraModalOpen(true)
                      } else {
                        nativeCameraInputRef.current?.click()
                      }
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-[#3A5245] hover:bg-[#2F4338] text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer shadow-xs"
                  >
                    <Camera className="w-4 h-4 text-[#C5A880] shrink-0" />
                    <span>Hacer foto del décimo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-2.5 px-4 rounded-2xl bg-[#FCF9F3] dark:bg-[#262017] hover:bg-[#C5A880]/15 border border-[#C5A880]/55 text-[#73562E] dark:text-[#E5CFA9] text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-[#C5A880] shrink-0" />
                    <span>Elegir de galería / carpeta</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <img
                    src={photoPreviewUrl}
                    alt="Vista previa del anverso"
                    className="w-full max-h-48 object-contain rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02]"
                  />
                  {photoSha256 && (
                    <p className="text-[10px] font-mono text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 break-all">
                      SHA-256 calculado: {photoSha256}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          typeof navigator !== 'undefined' &&
                          navigator.mediaDevices &&
                          typeof navigator.mediaDevices.getUserMedia === 'function'
                        ) {
                          setIsCameraModalOpen(true)
                        } else {
                          nativeCameraInputRef.current?.click()
                        }
                      }}
                      className="py-2 px-3 rounded-xl bg-[#1D1D1F]/[0.06] dark:bg-[#F5F5F7]/[0.08] hover:bg-[#1D1D1F]/[0.10] text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>Repetir foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-2 px-3 rounded-xl bg-[#FCF9F3] dark:bg-[#262017] hover:bg-[#C5A880]/15 border border-[#C5A880]/50 text-xs font-semibold text-[#73562E] dark:text-[#E5CFA9] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>Elegir otro archivo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!photoFile || !photoSha256}
              onClick={() => setSignModalMode('custody')}
              className="w-full py-3 px-4 rounded-2xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-45 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Certificar custodia con certificado digital</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
            El depositario aún no ha certificado digitalmente la custodia de este décimo.
          </p>
        )}
      </div>

      {/* 2. Bloque de Partícipes (Firma opcional y Renuncia) */}
      <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#C5A880]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70">
            Partícipes y Firmas ({participantShares.length})
          </h4>
        </div>

        {participantShares.length === 0 ? (
          <p className="text-xs text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
            Aún no hay participaciones registradas en este décimo.
          </p>
        ) : (
          <div className="space-y-2">
            {participantShares.map((s) => {
              const sig = participantSignatureByUser.get(s.user_id)
              const name =
                s.profiles?.display_name || s.profiles?.email?.split('@')[0] || 'Partícipe'
              return (
                <div
                  key={s.id}
                  className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                      {name} ({s.percentage}%)
                    </p>
                    <p className="text-[11px] text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
                      {s.status === 'RENUNCIADA'
                        ? 'Participación renunciada'
                        : sig
                        ? `Firmada con certificado · ${sig.actor_nif || ''}`
                        : s.status === 'ACEPTADA'
                        ? 'Aceptación estándar'
                        : 'Pendiente de aceptar'}
                    </p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      s.status === 'RENUNCIADA'
                        ? 'bg-black/10 dark:bg-white/10 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60'
                        : sig
                        ? 'bg-[#3A5245] text-white'
                        : 'bg-[#C5A880]/20 text-[#73562E] dark:text-[#E5CFA9]'
                    }`}
                  >
                    {s.status === 'RENUNCIADA' ? 'Renunciada' : sig ? 'Firmada' : s.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Acciones del partícipe actual */}
        {!isOwner && userShare && userShare.status === 'ACEPTADA' && (
          <div className="pt-2 space-y-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            {!hasCurrentUserSigned && certification && (
              <button
                type="button"
                onClick={() => setSignModalMode('participant_sign')}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#3A5245]/12 hover:bg-[#3A5245]/20 text-[#2B3F34] dark:text-[#A8CEB9] border border-[#3A5245]/25 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <FileSignature className="w-4 h-4" />
                <span>Firmar mi participación con certificado digital</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRenounceClick}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#D04848]/10 hover:bg-[#D04848]/20 text-[#D04848] border border-[#D04848]/25 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>
                {hasCurrentUserSigned
                  ? 'Renunciar a participación (requiere firma)'
                  : 'Renunciar a participación'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Visor de cámara en vivo para fotografiar el anverso del décimo */}
      <TicketPhotoCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={(file) => handlePhotoSelected(file)}
        onPickFromGallery={() => galleryInputRef.current?.click()}
      />

      {/* Modal unificado de firma digital */}
      <CertificateSignModal
        isOpen={signModalMode !== null}
        onClose={() => setSignModalMode(null)}
        title={
          signModalMode === 'custody'
            ? 'Certificar custodia del décimo'
            : signModalMode === 'participant_renounce'
            ? 'Firmar renuncia de participación'
            : 'Firmar participación con certificado'
        }
        legalStatement={
          signModalMode === 'custody'
            ? `Declaro bajo mi responsabilidad ser depositario físico del décimo nº ${ticket.number} (${ticket.draw_name}, ${ticket.draw_date}) y custodiar las participaciones registradas en Mis Décimos.`
            : signModalMode === 'participant_renounce'
            ? `Declaro mi renuncia voluntaria e irrevocable a la participación del ${userShare?.percentage || 0}% sobre el décimo nº ${ticket.number}, reintegrando dicha cuota al depositario.`
            : `Confirmo digitalmente mi participación del ${userShare?.percentage || 0}% sobre el décimo nº ${ticket.number} (${ticket.draw_name}, ${ticket.draw_date}) custodiado por el depositario.`
        }
        canonicalPayload={canonicalPayload}
        onSigned={async (sig) => {
          if (signModalMode === 'custody') {
            await handleCertifyCustody(sig)
          } else if (signModalMode === 'participant_renounce') {
            await executeRenounce(sig)
          } else {
            await handleParticipantSign(sig)
          }
        }}
      />
    </div>
  )
}
