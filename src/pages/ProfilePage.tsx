import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sanitizeText, safeImageUrl } from '../lib/sanitize'
import {
  buildArchivedTicketsList,
  canDeleteArchivedTicket,
  RESTORE_SUCCESS_TOAST,
} from '../lib/archivedTickets'
import type { TicketItemWithMeta } from '../lib/ticketMetrics'
import {
  subscribeUserToPush,
  unsubscribeUserFromPush,
  getNotificationPermissionState,
  syncPushSubscription,
  isPushSupported,
} from '../services/push/pushSubscription'
import { resetPushPromptDismissals } from '../hooks/usePushPermissionPrompt'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useModalBackHandler } from '../hooks/useModalBackHandler'
import { VersionBadge } from '../components/common/VersionBadge'
import {
  Camera,
  User,
  Mail,
  Phone,
  Bell,
  BellOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Smartphone,
  Send,
  Image as ImageIcon,
  Trash2,
  X,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Archive,
  ArchiveRestore,
} from 'lucide-react'

export interface ProfilePageProps {
  onNavigateToAudit?: () => void
  onSelectTicket?: (ticketId: string) => void
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigateToAudit,
  onSelectTicket,
}) => {
  const { user, profile, signOut, refreshProfile } = useAuth()

  // Formulario
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [isSaving, setIsSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Subida de avatar y selector de origen
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isAvatarSheetOpen, setIsAvatarSheetOpen] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Cierre de sesión
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Décimos archivados
  const [archivedTickets, setArchivedTickets] = useState<TicketItemWithMeta[]>([])
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false)
  const [isLoadingArchived, setIsLoadingArchived] = useState(false)
  const [archivedActionId, setArchivedActionId] = useState<string | null>(null)

  const loadArchivedTickets = useCallback(async () => {
    if (!user?.id) return
    try {
      setIsLoadingArchived(true)
      const [
        { data: ticketsData, error: ticketsErr },
        { data: sharesData, error: sharesErr },
        { data: hidesData },
      ] = await Promise.all([
        supabase.from('tickets').select('*').order('draw_date', { ascending: false }),
        supabase.from('ownership_shares').select('*'),
        supabase
          .from('ticket_archive_hides')
          .select('ticket_id')
          .eq('user_id', user.id),
      ])

      if (ticketsErr) throw ticketsErr
      if (sharesErr) throw sharesErr

      const archivedIds = new Set((hidesData || []).map((h) => h.ticket_id))
      setArchivedTickets(
        buildArchivedTicketsList(ticketsData || [], sharesData || [], archivedIds, user.id)
      )
    } catch (err) {
      console.error('Error cargando décimos archivados:', err)
    } finally {
      setIsLoadingArchived(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadArchivedTickets()
  }, [loadArchivedTickets])

  const handleRestoreArchived = async (ticketId: string) => {
    try {
      setArchivedActionId(ticketId)
      const { error } = await supabase.rpc('toggle_archive_ticket', {
        p_ticket_id: ticketId,
        p_archive: false,
      })
      if (error) throw error

      setStatusMsg({ type: 'success', text: RESTORE_SUCCESS_TOAST })
      await loadArchivedTickets()
    } catch (err: unknown) {
      console.error('Error restaurando décimo:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo restaurar el décimo.',
      })
    } finally {
      setArchivedActionId(null)
    }
  }

  const handleDeleteArchived = async (ticketId: string) => {
    if (
      !confirm(
        '¿Estás seguro de que deseas eliminar este décimo definitivamente? Esta acción no se puede deshacer.'
      )
    ) {
      return
    }

    try {
      setArchivedActionId(ticketId)
      const { error } = await supabase.from('tickets').delete().eq('id', ticketId)
      if (error) throw error

      setStatusMsg({ type: 'success', text: 'Décimo eliminado definitivamente.' })
      await loadArchivedTickets()
    } catch (err: unknown) {
      console.error('Error eliminando décimo archivado:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo eliminar el décimo.',
      })
    } finally {
      setArchivedActionId(null)
    }
  }

  const handleSignOut = async () => {
    if (isLoggingOut) return
    if (!confirm('¿Deseas cerrar la sesión en este dispositivo?')) return
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (err: unknown) {
      console.error('Error al cerrar sesión:', err)
      setIsLoggingOut(false)
    }
  }

  useModalBackHandler({
    isOpen: isAvatarSheetOpen,
    onClose: () => setIsAvatarSheetOpen(false),
    modalKey: 'avatar_picker_sheet',
  })

  // Notificaciones Push
  const [pushEnabled, setPushEnabled] = useState(profile?.push_enabled || false)
  const [isTogglingPush, setIsTogglingPush] = useState(false)
  const [isSendingTestPush, setIsSendingTestPush] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')

  // Plataforma y PWA (gestión integral y captura fiable de beforeinstallprompt)
  const {
    isStandalone,
    platform: pwaPlatform,
    installApp,
    isInstructionModalOpen,
    closeInstructionsModal,
  } = usePwaInstall()

  // Integración con botón Atrás de Android para el modal de instrucciones
  useModalBackHandler({
    isOpen: isInstructionModalOpen,
    onClose: closeInstructionsModal,
    modalKey: 'pwa_instructions_modal',
  })

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setPhone(profile.phone || '')
      setPushEnabled(profile.push_enabled || false)
    }
    setPermissionState(getNotificationPermissionState())
  }, [profile])

  // Detectar si hay cambios sin guardar
  const hasChanges =
    (displayName.trim() !== (profile?.display_name || '').trim()) ||
    (phone.trim() !== (profile?.phone || '').trim())

  // 1. Guardar cambios en el perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !hasChanges) return

    setStatusMsg(null)
    setIsSaving(true)

    const cleanName = sanitizeText(displayName, 50)
    const cleanPhone = sanitizeText(phone, 20)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: cleanName,
          phone: cleanPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setStatusMsg({ type: 'success', text: 'Perfil actualizado correctamente.' })
    } catch (err: unknown) {
      console.error('Error guardando perfil:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar los cambios.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 2. Compresión de imagen en Canvas y subida a avatars/{user.id}/avatar.webp
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setIsUploadingAvatar(true)
    setStatusMsg(null)

    try {
      // Cargar archivo en un elemento Image
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'))
        img.src = objectUrl
      })

      // Redimensionar a máximo 512x512 en Canvas
      const maxDim = 512
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo inicializar el contexto de imagen.')

      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      // Convertir a WebP blob (calidad 0.85)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.85)
      })

      if (!blob) throw new Error('Error al comprimir la imagen en WebP.')

      // Subir a Supabase Storage: avatars/{userId}/avatar.webp
      const filePath = `${user.id}/avatar.webp`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Obtener URL pública con parámetro de cache-busting
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const avatarUrlWithTime = `${publicUrlData.publicUrl}?t=${Date.now()}`

      // Actualizar en public.profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrlWithTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      await refreshProfile()
      setStatusMsg({ type: 'success', text: 'Foto de perfil actualizada correctamente.' })
    } catch (err: unknown) {
      console.error('Error al subir avatar:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al procesar la foto de perfil.',
      })
    } finally {
      setIsUploadingAvatar(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  // 2B. Eliminar foto de perfil actual
  const handleRemoveAvatar = async () => {
    if (!user?.id) return
    setIsAvatarSheetOpen(false)
    setIsUploadingAvatar(true)
    setStatusMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setStatusMsg({ type: 'success', text: 'Foto de perfil eliminada correctamente.' })
    } catch (err: unknown) {
      console.error('Error eliminando avatar:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al eliminar la foto de perfil.',
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  // 3. Conmutar suscripción a Notificaciones Push
  const handleTogglePush = async () => {
    if (!user?.id || isTogglingPush) return

    setIsTogglingPush(true)
    setStatusMsg(null)

    try {
      if (!pushEnabled) {
        const success = await subscribeUserToPush(user.id)
        if (success) {
          setPushEnabled(true)
          resetPushPromptDismissals(user.id)
          setStatusMsg({ type: 'success', text: 'Notificaciones push activadas correctamente.' })
        } else {
          setStatusMsg({
            type: 'error',
            text: 'No se pudieron activar las notificaciones. Verifica los permisos de tu navegador.',
          })
        }
      } else {
        const success = await unsubscribeUserFromPush(user.id)
        if (success) {
          setPushEnabled(false)
          setStatusMsg({ type: 'success', text: 'Notificaciones push desactivadas.' })
        }
      }
      setPermissionState(getNotificationPermissionState())
      await refreshProfile()
    } catch (err: unknown) {
      console.error('Error conmutando push:', err)
      setStatusMsg({
        type: 'error',
        text: 'Error al actualizar las preferencias de notificaciones.',
      })
    } finally {
      setIsTogglingPush(false)
    }
  }

  // Enviar notificación Web Push de prueba
  const handleSendTestPush = async () => {
    if (!user?.id) return
    setIsSendingTestPush(true)
    setStatusMsg(null)

    // 1. Verificar soporte y permisos
    if (!isPushSupported()) {
      setStatusMsg({
        type: 'error',
        text: 'Este navegador o dispositivo no soporta notificaciones Web Push nativas.',
      })
      setIsSendingTestPush(false)
      return
    }

    if (Notification.permission !== 'granted') {
      setStatusMsg({
        type: 'error',
        text: 'El permiso de notificaciones no está concedido en el navegador o sistema operativo.',
      })
      setIsSendingTestPush(false)
      return
    }

    try {
      // 2. Resincronizar la suscripción push antes de enviar la prueba
      const syncResult = await syncPushSubscription(user.id)
      if (!syncResult.success) {
        setStatusMsg({
          type: 'error',
          text: `No se pudo sincronizar la suscripción push: ${syncResult.error || 'Sin suscripción activa'}.`,
        })
        return
      }

      // 3. Invocar la Edge Function send-push
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { testPush: true },
      })
      if (error) throw error

      const sent = data?.sent ?? data?.sentCount ?? 0
      const errors = data?.errors || []

      // 4. Mostrar feedback real sin falsos positivos
      if (sent > 0) {
        setStatusMsg({
          type: 'success',
          text: `¡Notificación push enviada a ${sent} dispositivo(s)! Comprueba la barra del sistema.`,
        })
      } else {
        const errorDetail =
          errors.length > 0
            ? errors.join('; ')
            : data?.message || 'Sin suscripción push activa en este navegador'
        setStatusMsg({
          type: 'error',
          text: `No se pudo enviar la notificación push (${errorDetail}).`,
        })
      }
    } catch (err: unknown) {
      console.error('Error enviando notificación de prueba:', err)
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al enviar la notificación de prueba.',
      })
    } finally {
      setIsSendingTestPush(false)
    }
  }

  const avatarDisplay = safeImageUrl(profile?.avatar_url)

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      {/* Cabecera */}
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Mi Perfil</h2>
        <p className="text-xs text-gray-500">
          Visible para tus amigos y familiares al compartir décimos y participaciones.
        </p>
      </div>

      {/* Avisos de estado */}
      {statusMsg && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-2xl text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Tarjeta de Avatar y Datos */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Avatar Circular con Botón de Cámara y Menú de Selección */}
        <div className="flex flex-col items-center">
          <div
            className="relative cursor-pointer group"
            onClick={() => setIsAvatarSheetOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsAvatarSheetOpen(true)
              }
            }}
            aria-label="Cambiar foto de perfil"
            title="Cambiar foto de perfil"
          >
            <div className="w-28 h-28 rounded-full border-4 border-lottery shadow-md overflow-hidden bg-gray-50 flex items-center justify-center transition group-hover:opacity-95">
              {avatarDisplay ? (
                <img
                  src={avatarDisplay}
                  alt={profile?.display_name || 'Avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-14 h-14 text-gray-300" />
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsAvatarSheetOpen(true)
              }}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-lottery text-white flex items-center justify-center shadow-md shadow-lottery/30 hover:bg-lottery-600 active:scale-95 transition disabled:opacity-50"
              title="Cambiar foto de perfil"
              aria-label="Abrir selector de foto de perfil"
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>

            {/* Inputs ocultos para cámara y galería */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleAvatarSelect}
            />

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {isUploadingAvatar
              ? 'Comprimiendo y subiendo...'
              : 'Toca para hacerte una foto o elegir de la galería'}
          </p>
        </div>

        {/* Formulario de Datos Personales */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Campo Nombre */}
          <div className="space-y-1 text-left">
            <label className="block text-xs font-semibold text-gray-700">Nombre completo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                maxLength={50}
                placeholder="Ej. María Gómez"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery transition"
              />
            </div>
          </div>

          {/* Campo Email (Solo lectura) */}
          <div className="space-y-1 text-left">
            <label className="block text-xs font-semibold text-gray-700">Correo electrónico</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                readOnly
                disabled
                value={profile?.email || user?.email || ''}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-500 cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[10px] text-gray-400">El correo está vinculado a tu cuenta y no puede cambiarse.</p>
          </div>

          {/* Campo Teléfono */}
          <div className="space-y-1 text-left">
            <label className="block text-xs font-semibold text-gray-700">
              Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Phone className="h-4 w-4" />
              </div>
              <input
                type="tel"
                maxLength={20}
                placeholder="Ej. +34 600 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery transition"
              />
            </div>
          </div>

          {/* Botón Guardar Cambios */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !hasChanges}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold shadow-sm transition ${
                hasChanges && !isSaving
                  ? 'bg-lottery text-white hover:bg-lottery-600 active:scale-98 shadow-lottery/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando cambios...</span>
                </>
              ) : (
                <span>Guardar cambios</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Sección Dispositivo y Notificaciones */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
          <div className="h-8 w-8 rounded-xl bg-lottery-50 text-lottery flex items-center justify-center">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Dispositivo y Notificaciones</h3>
            <p className="text-[11px] text-gray-500">Alertas de sorteos, premios y confirmaciones</p>
          </div>
        </div>

        {/* Switch Notificaciones Push */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {pushEnabled ? (
                <Bell className="h-4 w-4 text-emerald-600" />
              ) : (
                <BellOff className="h-4 w-4 text-gray-400" />
              )}
              <h4 className="text-xs font-semibold text-gray-900">
                Notificaciones Push de Sorteos y Participaciones
              </h4>
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              Recibe avisos cuando tus amigos compartan décimos o si tu boleto resulta premiado.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[10px]">
              <span className="text-gray-400">Permiso del navegador:</span>
              <span
                className={`font-semibold ${
                  permissionState === 'granted'
                    ? 'text-emerald-700'
                    : permissionState === 'denied'
                    ? 'text-rose-700'
                    : 'text-amber-700'
                }`}
              >
                {permissionState === 'granted'
                  ? 'Concedido'
                  : permissionState === 'denied'
                  ? 'Bloqueado en ajustes del navegador'
                  : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Switch Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            disabled={isTogglingPush}
            onClick={handleTogglePush}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-lottery focus:ring-offset-2 ${
              pushEnabled ? 'bg-lottery' : 'bg-gray-300'
            } ${isTogglingPush ? 'opacity-50 cursor-wait' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                pushEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Botón de prueba de notificación push si está activado */}
        {pushEnabled && (
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={isSendingTestPush}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-lottery/30 bg-lottery-50 text-lottery text-xs font-bold hover:bg-lottery-100 transition active:scale-98"
            >
              {isSendingTestPush ? (
                <Loader2 className="h-4 w-4 animate-spin text-lottery" />
              ) : (
                <Send className="h-4 w-4 text-lottery" />
              )}
              <span>Enviar notificación de prueba</span>
            </button>
          </div>
        )}

        {/* Aviso especial para iOS si no está instalada */}
        {pwaPlatform === 'ios' && !isStandalone && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" /> Web Push en dispositivos iPhone / iPad
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Apple requiere que agregues MisDecimos a tu pantalla de inicio para poder activar las alertas en segundo plano.
            </p>
          </div>
        )}

        {/* Indicador o botón de instalación según modo standalone */}
        {isStandalone ? (
          <div className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Aplicación instalada en este dispositivo</span>
          </div>
        ) : (
          <div className="pt-1">
            <button
              type="button"
              onClick={async () => {
                await installApp()
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs font-semibold hover:bg-gray-100 transition active:scale-98 cursor-pointer"
            >
              <Download className="h-4 w-4 text-lottery" />
              <span>Instalar aplicación en tu dispositivo</span>
            </button>
          </div>
        )}
      </div>

      {/* 2.5 Acceso al Centro de Auditoría */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <button
          type="button"
          onClick={() => {
            if (onNavigateToAudit) {
              onNavigateToAudit()
            } else {
              window.location.pathname = '/auditoria'
            }
          }}
          className="w-full flex items-center justify-between gap-3 text-left p-1 rounded-2xl hover:bg-gray-50 transition active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E6146]/10 text-[#2E6146] shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <h3 className="text-sm font-bold text-gray-900 leading-tight">
                Centro de Auditoría
              </h3>
              <p className="text-[11px] text-gray-400 font-medium truncate mt-0.5">
                Historial inmutable de movimientos, participaciones y premios
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
        </button>
      </div>

      {/* 3. Tarjeta de Cierre de Sesión */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-rose-200 bg-rose-50/80 text-rose-700 text-xs font-bold hover:bg-rose-100 hover:border-rose-300 transition active:scale-98 disabled:opacity-50 shadow-xs cursor-pointer"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
          ) : (
            <LogOut className="h-4 w-4 text-rose-600" />
          )}
          <span>{isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
        </button>
      </div>

      {/* Sección Desplegable: Décimos archivados */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsArchivedExpanded((prev) => !prev)}
          aria-expanded={isArchivedExpanded}
          className="w-full min-h-[56px] p-5 flex items-center justify-between text-left hover:bg-gray-50/70 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
              <Archive className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Décimos archivados ({archivedTickets.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                Consulta, restaura o elimina décimos ocultos
              </p>
            </div>
          </div>

          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isArchivedExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isArchivedExpanded && (
          <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-3">
            {isLoadingArchived ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-lottery" />
              </div>
            ) : archivedTickets.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No tienes ningún décimo archivado.
              </p>
            ) : (
              <div className="space-y-2.5 pt-2">
                {archivedTickets.map((item) => {
                  const isBusy = archivedActionId === item.ticket.id
                  const canDelete = canDeleteArchivedTicket(
                    item.ticket.owner_id,
                    user?.id || ''
                  )
                  return (
                    <div
                      key={item.ticket.id}
                      onClick={() => onSelectTicket?.(item.ticket.id)}
                      className="rounded-2xl border border-gray-200/80 bg-gray-50/60 p-3.5 space-y-3 hover:border-lottery/30 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-extrabold font-mono text-gray-900 tracking-wider">
                              {item.ticket.number}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-wide ${
                                item.isOwner
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-orange-100 text-orange-800 border-orange-200'
                              }`}
                            >
                              {item.isOwner ? 'Décimo' : 'Participación'}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-lottery">
                              {item.isOwner && item.userPercentage === 100
                                ? '100% tuyo'
                                : `${item.userPercentage}%`}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {item.ticket.draw_name} · {item.ticket.draw_date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-gray-200/60">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestoreArchived(item.ticket.id)
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ArchiveRestore className="w-4 h-4 text-emerald-700" />
                          )}
                          <span>Restaurar</span>
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteArchived(item.ticket.id)
                            }}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Información de versión integrada al pie de Mi Perfil */}
      <div className="pt-2 flex justify-center">
        <VersionBadge variant="inline" />
      </div>

      {/* Menú de Selección de Foto de Perfil (Action Sheet / Bottom Sheet) */}
      {isAvatarSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs p-4 sm:items-center animate-in fade-in duration-150">
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setIsAvatarSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl border border-gray-100 flex flex-col gap-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Cambiar foto de perfil"
          >
            <div className="flex items-center justify-between pb-2 px-1 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Foto de perfil
              </span>
              <button
                type="button"
                onClick={() => setIsAvatarSheetOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsAvatarSheetOpen(false)
                cameraInputRef.current?.click()
              }}
              className="flex items-center gap-3 w-full p-3 rounded-2xl text-left font-semibold text-xs text-gray-800 hover:bg-lottery-50 hover:text-lottery transition active:scale-[0.98]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lottery-50 text-lottery shrink-0">
                <Camera className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900">Hacer foto con la cámara</span>
                <span className="text-[10px] text-gray-400 font-normal">Abrir cámara del dispositivo</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAvatarSheetOpen(false)
                galleryInputRef.current?.click()
              }}
              className="flex items-center gap-3 w-full p-3 rounded-2xl text-left font-semibold text-xs text-gray-800 hover:bg-lottery-50 hover:text-lottery transition active:scale-[0.98]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lottery-50 text-lottery shrink-0">
                <ImageIcon className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900">Elegir de la galería o archivos</span>
                <span className="text-[10px] text-gray-400 font-normal">Seleccionar una imagen guardada</span>
              </div>
            </button>

            {profile?.avatar_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="flex items-center gap-3 w-full p-3 rounded-2xl text-left font-semibold text-xs text-rose-600 hover:bg-rose-50 transition active:scale-[0.98]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                  <Trash2 className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-rose-600">Eliminar foto actual</span>
                  <span className="text-[10px] text-rose-400 font-normal">Restablecer avatar por defecto</span>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAvatarSheetOpen(false)}
              className="mt-1 w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 transition active:scale-[0.98]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Instrucciones de Instalación PWA (Fallback cuando deferredPrompt es null) */}
      {isInstructionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-instructions-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 animate-in slide-in-from-bottom-6 duration-200">
            {/* Pestaña táctil móvil */}
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-2.5 sm:hidden" />

            {/* Cabecera */}
            <div className="p-5 pb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2E6146]/10 text-[#2E6146] shadow-xs">
                  <Download className="h-5 w-5 text-[#2E6146]" />
                </div>
                <div>
                  <h3 id="pwa-instructions-title" className="text-base font-bold text-gray-900 leading-tight">
                    Cómo instalar MisDecimos
                  </h3>
                  <p className="text-xs text-gray-500">
                    {pwaPlatform === 'android'
                      ? 'Navegador Chrome en Android'
                      : pwaPlatform === 'ios'
                      ? 'Navegador Safari en iPhone / iPad'
                      : 'Navegador de Escritorio'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeInstructionsModal}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar instrucciones"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Pasos de instalación según plataforma */}
            <div className="p-5 pt-2 space-y-3">
              {pwaPlatform === 'android' ? (
                <div className="space-y-2.5 text-xs text-gray-700">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      1
                    </span>
                    <p className="leading-snug pt-0.5">
                      Pulsa el <strong>menú de opciones (⋮)</strong> arriba a la derecha en Chrome.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      2
                    </span>
                    <p className="leading-snug pt-0.5">
                      Selecciona <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      3
                    </span>
                    <p className="leading-snug pt-0.5">
                      Confirma en <strong>«Instalar»</strong> para tener MisDecimos como aplicación nativa en tu móvil.
                    </p>
                  </div>
                </div>
              ) : pwaPlatform === 'ios' ? (
                <div className="space-y-2.5 text-xs text-gray-700">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      1
                    </span>
                    <p className="leading-snug pt-0.5">
                      Pulsa el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en la barra inferior de Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      2
                    </span>
                    <p className="leading-snug pt-0.5">
                      Desplaza hacia abajo y selecciona <strong>«Añadir a pantalla de inicio»</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      3
                    </span>
                    <p className="leading-snug pt-0.5">
                      Pulsa <strong>«Añadir»</strong> arriba a la derecha para completar la instalación.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs text-gray-700">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      1
                    </span>
                    <p className="leading-snug pt-0.5">
                      En la barra de direcciones de Chrome o Edge, pulsa el icono de instalación <strong>⊕</strong> a la derecha.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2E6146] text-white font-bold text-xs">
                      2
                    </span>
                    <p className="leading-snug pt-0.5">
                      O abre el menú (<strong>⋮</strong> / <strong>…</strong>) y selecciona <strong>«Instalar MisDecimos»</strong>.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={closeInstructionsModal}
                className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[#2E6146] text-white font-bold text-xs hover:bg-[#25503a] transition active:scale-[0.98] cursor-pointer shadow-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
