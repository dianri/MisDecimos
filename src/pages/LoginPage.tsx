import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { VersionBadge } from '../components/common/VersionBadge'
import { Mail, ArrowRight, KeyRound, Loader2, RefreshCw, AlertCircle } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Temporizador de reenvío de 60 segundos
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [countdown])

  // Manejador: Enviar código OTP por correo
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Por favor, introduce un correo electrónico válido.')
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        throw error
      }

      setStep('otp')
      setCountdown(60)
      setSuccessMsg(`Hemos enviado un código de 6 dígitos a ${cleanEmail}`)
      // Auto-focus en el primer input de código
      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    } catch (err: unknown) {
      console.error('Error al solicitar OTP:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al enviar el código de verificación.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Manejador: Verificar código OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMsg(null)
    const code = otp.join('').trim()

    if (code.length !== 6) {
      setErrorMsg('Debes introducir el código completo de 6 dígitos.')
      return
    }

    try {
      setIsLoading(true)
      const cleanEmail = email.trim().toLowerCase()
      const { error: emailError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: code,
        type: 'email',
      })

      if (emailError) {
        // Si type: 'email' devuelve error (habitual en usuario recién creado sin confirmar),
        // reintentamos automáticamente con type: 'signup'
        console.warn('verifyOtp con type: email falló, reintentando con type: signup...', emailError.message)
        const { error: signupError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: code,
          type: 'signup',
        })

        if (signupError) {
          throw signupError
        }
      }

      // La sesión se actualiza automáticamente y AuthContext detectará el cambio
    } catch (err: unknown) {
      console.error('Error al verificar OTP:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Código incorrecto o expirado. Inténtalo de nuevo.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Soporte para edición y pegado en los 6 campos
  const handleOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '')

    // Caso pegado de código completo (ej: "123456")
    if (cleanVal.length > 1) {
      const pasted = cleanVal.slice(0, 6).split('')
      const nextOtp = [...otp]
      pasted.forEach((char, i) => {
        nextOtp[i] = char
      })
      setOtp(nextOtp)
      const nextFocus = Math.min(pasted.length, 5)
      otpInputsRef.current[nextFocus]?.focus()
      return
    }

    const nextOtp = [...otp]
    nextOtp[index] = cleanVal ? cleanVal[0] : ''
    setOtp(nextOtp)

    if (cleanVal && index < 5) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#1D1D1F] rounded-[22px] shadow-xl shadow-black/5 dark:shadow-black/40 border border-black/[0.06] dark:border-white/[0.08] p-8 space-y-6">
        {/* Cabecera / Identidad */}
        <div className="text-center space-y-2">
          <img
            src="/logo-4mills.png"
            alt="MisDecimos"
            className="w-20 h-20 rounded-2xl object-contain shadow-md mb-2 mx-auto"
            width={80}
            height={80}
          />
          <h1 className="text-2xl font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            MisDecimos
          </h1>
          <p className="text-xs font-medium text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
            Custodia compartida y reparto de décimos de Lotería
          </p>
        </div>

        {/* Notificaciones de error o éxito */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#D04848]/10 border border-[#D04848]/30 text-[#D04848] text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#D04848]" />
            <p className="leading-snug">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-[#3A5245] text-white text-xs text-center font-medium">
            {successMsg}
          </div>
        )}

        {/* Paso 1: Introducir Email */}
        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#1D1D1F]/40 dark:text-[#F5F5F7]/40">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-[#F5F5F7] dark:bg-[#000000] text-sm text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#1D1D1F]/40 dark:placeholder-[#F5F5F7]/40 focus:outline-none focus:ring-2 focus:ring-[#C5A880]/60 focus:border-[#C5A880] transition"
                />
              </div>
              <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 pt-0.5">
                Te enviaremos un código temporal de 6 dígitos sin necesidad de contraseña.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C5A880] hover:bg-[#B8996E] text-[#1D1D1F] text-sm font-semibold shadow-sm active:scale-98 transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando código...</span>
                </>
              ) : (
                <>
                  <span>Enviar código</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Paso 2: Código OTP de 6 dígitos */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                <KeyRound className="h-3.5 w-3.5" /> Código de verificación
              </div>
              <p className="text-xs text-gray-500">
                Introduce el código de 6 dígitos enviado a <strong className="text-gray-800">{email}</strong>
              </p>
            </div>

            {/* Inputs de 6 dígitos */}
            <div className="flex justify-center gap-2 sm:gap-2.5">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery focus:border-lottery transition shadow-sm"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.join('').length !== 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-lottery text-white text-sm font-semibold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Verificar y entrar</span>
              )}
            </button>

            {/* Acciones secundarias: reenviar y cambiar email */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="hover:text-lottery font-medium transition"
              >
                Cambiar correo
              </button>

              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={countdown > 0 || isLoading}
                className="flex items-center gap-1 font-medium text-lottery hover:text-lottery-600 transition disabled:text-gray-400 disabled:pointer-events-none"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                {countdown > 0 ? `Reenviar (${countdown}s)` : 'Reenviar código'}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-6 text-[11px] text-gray-400 text-center max-w-xs">
        MisDecimos v{__APP_VERSION__} · Plataforma segura PWA de reparto de Lotería
      </p>

      {/* Control visual de versión anti-caché */}
      <VersionBadge className="bottom-3 right-3" />
    </div>
  )
}
