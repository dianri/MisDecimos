import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { sanitizeText, safeImageUrl } from '../lib/sanitize'
import {
  subscribeUserToPush,
  unsubscribeUserFromPush,
  getNotificationPermissionState,
  isStandaloneMode,
  detectPlatform,
} from '../services/push/pushSubscription'
import { resetPushPromptDismissals } from '../hooks/usePushPermissionPrompt'
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
} from 'lucide-react'

export const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()

  // Formulario
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [isSaving, setIsSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Subida de avatar
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Notificaciones Push
  const [pushEnabled, setPushEnabled] = useState(profile?.push_enabled || false)
  const [isTogglingPush, setIsTogglingPush] = useState(false)
  const [isSendingTestPush, setIsSendingTestPush] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')

  // Plataforma y PWA
  const platform = detectPlatform()
  const isStandalone = isStandaloneMode()

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
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    setIsSendingTestPush(true)
    setStatusMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { testPush: true },
      })
      if (error) throw error
      setStatusMsg({
        type: 'success',
        text:
          data?.sentCount > 0
            ? '¡Notificación de prueba enviada con éxito! Comprueba la barra del sistema.'
            : 'Prueba registrada. Comprueba que el permiso esté concedido y el navegador activo.',
      })
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
        {/* Avatar Circular con Botón de Cámara */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-lottery shadow-md overflow-hidden bg-gray-50 flex items-center justify-center">
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-lottery text-white flex items-center justify-center shadow-md shadow-lottery/30 hover:bg-lottery-600 active:scale-95 transition disabled:opacity-50"
              title="Cambiar foto de perfil"
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {isUploadingAvatar ? 'Comprimiendo y subiendo...' : 'Toca la cámara para subir tu foto'}
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
        {platform === 'ios' && !isStandalone && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" /> Web Push en dispositivos iPhone / iPad
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Apple requiere que agregues MisDecimos a tu pantalla de inicio para poder activar las alertas en segundo plano.
            </p>
          </div>
        )}

        {/* Botón de instalación accesible desde el perfil */}
        {!isStandalone && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('trigger-pwa-install'))
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-xs font-semibold hover:bg-gray-100 transition active:scale-98"
            >
              <Download className="h-4 w-4 text-lottery" />
              <span>Instalar aplicación en tu dispositivo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
