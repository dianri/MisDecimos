import React, { useState, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Database } from '../../types/database.types'
import type { OwnershipShare } from './OwnershipBreakdownCard'
import type { TicketCertificationRow, TicketLegalEventRow } from './LegalCertificationTab'
import { SignaturePadCanvas } from './SignaturePadCanvas'
import { TicketPhotoCaptureModal } from './TicketPhotoCaptureModal'
import { computeSha256Hex, generateVerificationCode } from '../../lib/legalCustody'
import { validateHandwrittenForm } from '../../lib/handwrittenCustody'
import { generateHandwrittenAgreementPdf } from '../../lib/legalPdfGenerator'
import { extractSupabaseErrorMessage } from '../../lib/legalAuditHelper'
import {
  AlertTriangle,
  ShieldCheck,
  PenLine,
  Camera,
  FolderOpen,
  RefreshCw,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react'

type TicketRow = Database['public']['Tables']['tickets']['Row']
export type TicketHandwrittenSignatureRow =
  Database['public']['Tables']['ticket_handwritten_signatures']['Row']

export interface HandwrittenSignatureTabProps {
  ticket: TicketRow
  shares: OwnershipShare[]
  isOwner: boolean
  userShare?: OwnershipShare
  certification: TicketCertificationRow | null
  handwrittenSignatures: TicketHandwrittenSignatureRow[]
  legalEvents: TicketLegalEventRow[]
  onRefresh: () => Promise<void>
  onRenounced?: (percentage: number) => void
}

export const HandwrittenSignatureTab: React.FC<HandwrittenSignatureTabProps> = ({
  ticket,
  shares,
  isOwner,
  userShare,
  certification,
  handwrittenSignatures,
  legalEvents,
  onRefresh,
  onRenounced,
}) => {
  const { user, profile } = useAuth()

  const [fullName, setFullName] = useState(profile?.display_name || '')
  const [nif, setNif] = useState('')
  const [phone, setPhone] = useState('')
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [signaturePng, setSignaturePng] = useState<string | null>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoSha256, setPhotoSha256] = useState<string | null>(null)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  const custodianHw = useMemo(
    () => handwrittenSignatures.find((s) => s.signer_role === 'custodian') || null,
    [handwrittenSignatures]
  )

  const currentUserHw = useMemo(() => {
    if (!user?.id) return null
    if (isOwner) {
      return (
        handwrittenSignatures.find(
          (s) => s.signer_user_id === user.id && s.signer_role === 'custodian'
        ) || null
      )
    }
    if (!userShare?.id) return null
    return (
      handwrittenSignatures.find(
        (s) => s.participation_id === userShare.id && s.signer_role === 'participant'
      ) || null
    )
  }, [handwrittenSignatures, user?.id, isOwner, userShare?.id])

  const reusablePhotoPath = certification?.photo_path || custodianHw?.photo_path || null
  const reusablePhotoSha = certification?.photo_sha256 || custodianHw?.photo_sha256 || null

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

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setFeedback(null)

    const validation = validateHandwrittenForm({
      fullName,
      nif,
      phone,
      hasPhoto: Boolean(photoFile || reusablePhotoPath),
      requirePhoto: isOwner,
      declarationAccepted,
      hasSignatureStroke: Boolean(signaturePng),
    })

    if (!validation.valid) {
      setFeedback({ type: 'error', text: validation.errors[0] })
      return
    }

    setIsSubmitting(true)
    try {
      let finalPhotoPath = reusablePhotoPath
      let finalPhotoSha = reusablePhotoSha

      if (isOwner && photoFile && photoSha256) {
        const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
        const storagePath = `${user.id}/${ticket.id}/hw-anverso-${Date.now()}.${safeExt}`

        const { error: uploadErr } = await supabase.storage
          .from('ticket-certifications')
          .upload(storagePath, photoFile, {
            contentType: photoFile.type || 'image/jpeg',
            upsert: false,
          })

        if (uploadErr) {
          throw new Error(`No se pudo subir la imagen del anverso: ${uploadErr.message}`)
        }
        finalPhotoPath = storagePath
        finalPhotoSha = photoSha256
      }

      const sigSha = await computeSha256Hex(signaturePng!)
      const code = generateVerificationCode().replace(/^MD-/, 'MDF-')
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null
      const pct = isOwner ? 100 : Number(userShare?.percentage || 0)
      const amount = (Number(ticket.ticket_price || 20) * pct) / 100

      const { error: insertErr } = await supabase.from('ticket_handwritten_signatures').insert({
        ticket_id: ticket.id,
        participation_id: !isOwner && userShare ? userShare.id : null,
        signer_user_id: user.id,
        signer_role: isOwner ? 'custodian' : 'participant',
        full_name: fullName.trim(),
        nif: validation.normalizedNif,
        phone: validation.normalizedPhone,
        photo_path: finalPhotoPath,
        photo_sha256: finalPhotoSha,
        signature_image_b64: signaturePng!,
        signature_sha256: sigSha,
        user_agent: ua,
        verification_code: code,
      })

      if (insertErr) throw new Error(insertErr.message)

      await supabase.from('ticket_legal_events').insert({
        ticket_id: ticket.id,
        participation_id: !isOwner && userShare ? userShare.id : null,
        actor_user_id: user.id,
        event_type: isOwner ? 'HANDWRITTEN_CUSTODY_SIGNED' : 'HANDWRITTEN_PARTICIPATION_SIGNED',
        actor_name: fullName.trim(),
        actor_nif: validation.normalizedNif,
        cert_method: 'handwritten',
        payload_sha256: sigSha,
        share_percentage: pct,
        share_amount: amount,
        metadata: {
          phone: validation.normalizedPhone,
          verification_code: code,
          photo_sha256: finalPhotoSha,
        },
      })

      setFeedback({
        type: 'success',
        text: `Firma manuscrita registrada correctamente (${code}).`,
      })
      await onRefresh()
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar la firma manuscrita.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleParticipantRenounce = async () => {
    if (!user?.id || !userShare) return
    const pct = Number(userShare.percentage)
    if (
      !confirm(
        `¿Seguro que quieres renunciar a tu participación del ${pct}% en el décimo #${ticket.number}? Tu porcentaje volverá al depositario.`
      )
    ) {
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    try {
      const { error: rpcErr } = await supabase.rpc('renounce_own_participation', {
        p_share_id: userShare.id,
      })
      if (rpcErr) throw rpcErr

      const payloadHash = await computeSha256Hex(
        JSON.stringify({ ticketId: ticket.id, userId: user.id, pct, at: new Date().toISOString() })
      )

      await supabase.from('ticket_legal_events').insert({
        ticket_id: ticket.id,
        participation_id: userShare.id,
        actor_user_id: user.id,
        event_type: 'HANDWRITTEN_PARTICIPATION_RENOUNCED',
        actor_name:
          currentUserHw?.full_name ||
          profile?.display_name ||
          user.email?.split('@')[0] ||
          'Partícipe',
        actor_nif: currentUserHw?.nif || null,
        cert_method: 'handwritten',
        payload_sha256: payloadHash,
        share_percentage: pct,
        share_amount: (Number(ticket.ticket_price || 20) * pct) / 100,
      })

      onRenounced?.(pct)
      await onRefresh()
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: extractSupabaseErrorMessage(err, 'No se pudo registrar la renuncia.'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadPrivatePdf = async () => {
    if (handwrittenSignatures.length === 0) return
    setIsDownloadingPdf(true)
    setFeedback(null)
    try {
      const photoPath = custodianHw?.photo_path || certification?.photo_path || null
      const photoSha = custodianHw?.photo_sha256 || certification?.photo_sha256 || null
      let photoBytes: Uint8Array | null = null
      let photoMimeType: string | null = null

      if (photoPath) {
        const { data: blobData } = await supabase.storage
          .from('ticket-certifications')
          .download(photoPath)
        if (blobData) {
          photoMimeType = blobData.type
          photoBytes = new Uint8Array(await blobData.arrayBuffer())
        }
      }

      const signers = handwrittenSignatures.map((hw) => {
        const share =
          hw.signer_role === 'custodian'
            ? shares.find((s) => s.role === 'PROPIETARIO')
            : shares.find((s) => s.user_id === hw.signer_user_id && s.role === 'PARTICIPANTE')
        const pct = Number(share?.percentage ?? (hw.signer_role === 'custodian' ? 100 : 0))
        return {
          role: hw.signer_role as 'custodian' | 'participant',
          fullName: hw.full_name,
          nif: hw.nif,
          phone: hw.phone,
          percentage: pct,
          amountEuros: (Number(ticket.ticket_price || 20) * pct) / 100,
          status: share?.status || 'ACEPTADA',
          signaturePngBase64: hw.signature_image_b64,
          signatureSha256: hw.signature_sha256,
          signedAt: hw.signed_at,
          userAgent: hw.user_agent,
        }
      })

      const code = custodianHw?.verification_code || handwrittenSignatures[0].verification_code
      const pdfBytes = await generateHandwrittenAgreementPdf({
        ticket: {
          id: ticket.id,
          number: ticket.number,
          serie: ticket.serie,
          fraccion: ticket.fraccion,
          draw_name: ticket.draw_name,
          draw_date: ticket.draw_date,
          ticket_price: ticket.ticket_price,
        },
        verificationCode: code,
        photoSha256: photoSha,
        photoBytes,
        photoMimeType,
        signers,
        events: legalEvents,
      })

      const pdfBuffer = new Uint8Array(pdfBytes.byteLength)
      pdfBuffer.set(pdfBytes)
      const blob = new Blob([pdfBuffer.buffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MisDecimos_AcuerdoPrivado_${ticket.number}_${code}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo generar el Documento Privado PDF.',
      })
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Aviso legal destacado */}
      <div className="p-4 rounded-[22px] bg-amber-500/10 border border-amber-500/35 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Acuerdo privado simple (sin certificado digital)</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#1D1D1F]/80 dark:text-[#F5F5F7]/80">
          La firma manuscrita en pantalla es un acuerdo privado simple y{' '}
          <strong>no tiene la misma fuerza probatoria ni vinculación jurídica</strong> que la firma
          con Certificado Digital (FNMT / DNIe). Si buscas máxima garantía legal, utiliza la
          sección superior <strong>Certificado Digital</strong>.
        </p>
      </div>

      {certification && (
        <div className="p-3.5 rounded-2xl bg-[#3A5245] text-white text-xs flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#C5A880] shrink-0" />
          <span>
            Este décimo ya dispone de <strong>Certificación Digital</strong> ({certification.verification_code}), el nivel máximo de protección legal.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2 ${
            feedback.type === 'success' ? 'bg-[#3A5245] text-white' : 'bg-[#D04848] text-white'
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

      {/* Listado de firmas manuscritas registradas y descarga de PDF */}
      {handwrittenSignatures.length > 0 && (
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-5 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Firmas Manuscritas Registradas ({handwrittenSignatures.length})
          </h3>

          <div className="space-y-2.5">
            {handwrittenSignatures.map((hw) => (
              <div
                key={hw.id}
                className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                    {hw.full_name} · {hw.nif}
                  </p>
                  <p className="text-[11px] text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
                    {hw.signer_role === 'custodian' ? 'Depositario' : 'Partícipe'} · Tel. {hw.phone}
                  </p>
                </div>
                <img
                  src={hw.signature_image_b64}
                  alt={`Firma de ${hw.full_name}`}
                  className="h-10 w-24 object-contain rounded-lg bg-white border border-black/10 shrink-0"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownloadPrivatePdf}
            disabled={isDownloadingPdf}
            className="w-full py-3 px-4 rounded-2xl bg-[#3A5245] hover:bg-[#2F4338] text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 text-[#C5A880]" />
            )}
            <span>
              {isDownloadingPdf
                ? 'Generando Documento Privado...'
                : 'Descargar Documento Privado (PDF)'}
            </span>
          </button>
        </div>
      )}

      {/* Formulario del depositario o partícipe activo si aún no ha firmado manuscrito */}
      {!currentUserHw && (isOwner || (userShare && userShare.status === 'ACEPTADA')) && (
        <form
          onSubmit={handleSubmitSignature}
          className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-5 space-y-3.5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-[#C5A880]" />
            <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {isOwner
                ? 'Firma Manuscrita del Depositario'
                : `Firmar participación (${userShare?.percentage}%)`}
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                Nombre y apellidos completos *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Carlos Ruiz Martín"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-sm text-[#1D1D1F] dark:text-[#F5F5F7]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  DNI / NIE *
                </label>
                <input
                  type="text"
                  required
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  placeholder="12345678Z"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-sm uppercase text-[#1D1D1F] dark:text-[#F5F5F7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                  Teléfono móvil *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="600 123 456"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-sm text-[#1D1D1F] dark:text-[#F5F5F7]"
                />
              </div>
            </div>

            {isOwner && !reusablePhotoPath && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Fotografía del anverso del décimo (obligatoria) *
                </label>
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

                {!photoPreviewUrl ? (
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-dashed border-[#C5A880]/70 bg-[#FCF9F3] dark:bg-[#262017] hover:bg-[#C5A880]/15 transition cursor-pointer text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]"
                  >
                    <Camera className="w-4 h-4 text-[#C5A880] shrink-0" />
                    <span>Adjuntar o capturar foto del anverso</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <img
                      src={photoPreviewUrl}
                      alt="Vista previa del anverso"
                      className="w-full max-h-40 object-contain rounded-2xl border border-black/10 dark:border-white/10"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCameraModalOpen(true)}
                        className="py-2 px-3 rounded-xl bg-[#1D1D1F]/[0.06] dark:bg-[#F5F5F7]/[0.08] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Repetir foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="py-2 px-3 rounded-xl bg-[#FCF9F3] dark:bg-[#262017] border border-[#C5A880]/50 text-xs font-semibold text-[#73562E] dark:text-[#E5CFA9] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Elegir otro archivo</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs text-[#1D1D1F]/80 dark:text-[#F5F5F7]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationAccepted}
                onChange={(e) => setDeclarationAccepted(e.target.checked)}
                className="mt-0.5 rounded border-black/20 accent-[#3A5245]"
              />
              <span className="leading-relaxed">
                {isOwner
                  ? `Declaro bajo mi responsabilidad poseer físicamente el décimo #${ticket.number} y custodiar las participaciones asignadas.`
                  : `Acepto mi participación del ${userShare?.percentage || 0}% sobre el décimo #${ticket.number} bajo las condiciones del acuerdo privado.`}
              </span>
            </label>

            <SignaturePadCanvas onSignatureChange={setSignaturePng} disabled={isSubmitting} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-2xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PenLine className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'Guardando firma...' : 'Guardar firma manuscrita'}</span>
          </button>
        </form>
      )}

      {/* Botón de renuncia para partícipe activo */}
      {!isOwner && userShare && userShare.status === 'ACEPTADA' && (
        <button
          type="button"
          onClick={handleParticipantRenounce}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-2xl bg-[#D04848]/10 hover:bg-[#D04848]/20 text-[#D04848] border border-[#D04848]/25 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Renunciar a participación</span>
        </button>
      )}

      <TicketPhotoCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={(file) => handlePhotoSelected(file)}
        onPickFromGallery={() => galleryInputRef.current?.click()}
      />
    </div>
  )
}
