import React, { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Database } from '../../types/database.types'
import type { OwnershipShare } from './OwnershipBreakdownCard'
import type { TicketCertificationRow, TicketLegalEventRow } from './LegalCertificationTab'
import { SignaturePadCanvas } from './SignaturePadCanvas'
import { TicketPhotoCaptureModal } from './TicketPhotoCaptureModal'
import { computeSha256Hex, generateVerificationCode } from '../../lib/legalCustody'
import {
  validateHandwrittenForm,
  resolveLockedCertificateIdentity,
  resolveEffectiveSignerIdentity,
} from '../../lib/handwrittenCustody'
import {
  AlertTriangle,
  ShieldCheck,
  PenLine,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
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
  sharedPhotoFile?: File | null
  sharedPhotoSha256?: string | null
  hasSharedPhoto?: boolean
  onSharedPhotoSelected?: (file: File | null) => Promise<void> | void
  onRefresh: () => Promise<void>
  onRenounced?: (percentage: number) => void
}

export const HandwrittenSignatureTab: React.FC<HandwrittenSignatureTabProps> = ({
  ticket,
  shares: _shares,
  isOwner,
  userShare,
  certification,
  handwrittenSignatures,
  legalEvents,
  sharedPhotoFile,
  sharedPhotoSha256,
  hasSharedPhoto,
  onSharedPhotoSelected,
  onRefresh,
  onRenounced: _onRenounced,
}) => {
  const { user, profile } = useAuth()

  const [fullName, setFullName] = useState(profile?.display_name || '')
  const [nif, setNif] = useState('')
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [signaturePng, setSignaturePng] = useState<string | null>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoSha256, setPhotoSha256] = useState<string | null>(null)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const lockedIdentity = useMemo(
    () =>
      resolveLockedCertificateIdentity({
        isOwner,
        certification,
        activeUserShareId: userShare?.id,
        legalEvents,
      }),
    [isOwner, certification, userShare?.id, legalEvents]
  )

  useEffect(() => {
    if (lockedIdentity.isLocked && lockedIdentity.fullName && lockedIdentity.nif) {
      setFullName(lockedIdentity.fullName)
      setNif(lockedIdentity.nif)
    }
  }, [lockedIdentity.isLocked, lockedIdentity.fullName, lockedIdentity.nif])

  const reusablePhotoPath = certification?.photo_path || custodianHw?.photo_path || null
  const reusablePhotoSha = certification?.photo_sha256 || custodianHw?.photo_sha256 || null
  const effectivePhotoFile = sharedPhotoFile ?? photoFile
  const effectivePhotoSha = sharedPhotoSha256 ?? photoSha256
  const hasAnyCapturedPhoto = Boolean(
    hasSharedPhoto || photoPreviewUrl || reusablePhotoPath
  )

  const handlePhotoSelected = async (file: File | null) => {
    if (!file) return
    setFeedback(null)
    if (onSharedPhotoSelected) {
      await onSharedPhotoSelected(file)
      return
    }
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

    const effectiveFullName =
      lockedIdentity.isLocked && lockedIdentity.fullName
        ? lockedIdentity.fullName
        : fullName
    const effectiveNif =
      lockedIdentity.isLocked && lockedIdentity.nif ? lockedIdentity.nif : nif

    const validation = validateHandwrittenForm({
      fullName: effectiveFullName,
      nif: effectiveNif,
      hasPhoto: Boolean(effectivePhotoFile || reusablePhotoPath),
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

      if (isOwner && effectivePhotoFile && effectivePhotoSha) {
        const ext = effectivePhotoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
        const storagePath = `${user.id}/${ticket.id}/hw-anverso-${Date.now()}.${safeExt}`

        const { error: uploadErr } = await supabase.storage
          .from('ticket-certifications')
          .upload(storagePath, effectivePhotoFile, {
            contentType: effectivePhotoFile.type || 'image/jpeg',
            upsert: false,
          })

        if (uploadErr) {
          throw new Error(`No se pudo subir la imagen del anverso: ${uploadErr.message}`)
        }
        finalPhotoPath = storagePath
        finalPhotoSha = effectivePhotoSha
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
        full_name: effectiveFullName.trim(),
        nif: validation.normalizedNif,
        phone: '',
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
        actor_name: effectiveFullName.trim(),
        actor_nif: validation.normalizedNif,
        cert_method: 'handwritten',
        payload_sha256: sigSha,
        share_percentage: pct,
        share_amount: amount,
        metadata: {
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

      {/* Listado de firmas manuscritas registradas */}
      {handwrittenSignatures.length > 0 && (
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-5 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Firmas Manuscritas Registradas ({handwrittenSignatures.length})
          </h3>

          <div className="space-y-2.5">
            {handwrittenSignatures.map((hw) => {
              const effective = resolveEffectiveSignerIdentity({
                signerRole: hw.signer_role,
                participationId: hw.participation_id,
                handwrittenFullName: hw.full_name,
                handwrittenNif: hw.nif,
                certification,
                legalEvents,
              })
              return (
                <div
                  key={hw.id}
                  className="p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                      {effective.fullName} · {effective.nif}
                    </p>
                    <p className="text-[11px] text-[#1D1D1F]/65 dark:text-[#F5F5F7]/65">
                      {hw.signer_role === 'custodian' ? 'Depositario' : 'Partícipe'}
                    </p>
                    {effective.verifiedWithCert && (
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3A5245] dark:text-[#A8CEB9]">
                        <ShieldCheck className="w-3 h-3 shrink-0" />
                        <span>Identidad verificada con Certificado Digital</span>
                      </p>
                    )}
                  </div>
                  <img
                    src={hw.signature_image_b64}
                    alt={`Firma de ${effective.fullName}`}
                    className="h-10 w-24 object-contain rounded-lg bg-white border border-black/10 shrink-0"
                  />
                </div>
              )
            })}
          </div>
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
            {lockedIdentity.isLocked && (
              <div className="p-2.5 rounded-xl bg-[#3A5245]/10 dark:bg-[#3A5245]/25 border border-[#3A5245]/25 text-[11px] font-medium text-[#2B3F34] dark:text-[#A8CEB9] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#3A5245] dark:text-[#C5A880]" />
                <span>Datos verificados mediante Certificado Digital</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                Nombre y apellidos completos *
              </label>
              <input
                type="text"
                required
                readOnly={lockedIdentity.isLocked}
                disabled={lockedIdentity.isLocked}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Carlos Ruiz Martín"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
                DNI / NIE *
              </label>
              <input
                type="text"
                required
                readOnly={lockedIdentity.isLocked}
                disabled={lockedIdentity.isLocked}
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder="12345678Z"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-sm uppercase text-[#1D1D1F] dark:text-[#F5F5F7] disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>

            {isOwner && !hasAnyCapturedPhoto && (
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
                <button
                  type="button"
                  onClick={() => setIsCameraModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-dashed border-[#C5A880]/70 bg-[#FCF9F3] dark:bg-[#262017] hover:bg-[#C5A880]/15 transition cursor-pointer text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]"
                >
                  <Camera className="w-4 h-4 text-[#C5A880] shrink-0" />
                  <span>Adjuntar o capturar foto del anverso</span>
                </button>
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

      <TicketPhotoCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={(file) => handlePhotoSelected(file)}
        onPickFromGallery={() => galleryInputRef.current?.click()}
      />
    </div>
  )
}
