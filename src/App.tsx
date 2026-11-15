import React, { useEffect, useState } from 'react'
import { VersionBadge } from './components/common/VersionBadge'
import { supabase } from './lib/supabase'
import { ShieldCheck, Ticket, Users, Award, Database, CheckCircle2 } from 'lucide-react'

export const App: React.FC = () => {
  const [dbConnected, setDbConnected] = useState<boolean | null>(null)
  const [templateCount, setTemplateCount] = useState<number>(0)

  useEffect(() => {
    async function checkHealth() {
      try {
        const { data, error } = await supabase
          .from('draw_templates')
          .select('id, name')
        if (error) {
          console.error('Error conectando a Supabase:', error)
          setDbConnected(false)
        } else {
          setDbConnected(true)
          setTemplateCount(data?.length || 0)
        }
      } catch (err) {
        console.error('Error comprobando conexión:', err)
        setDbConnected(false)
      }
    }
    checkHealth()
  }, [])

  return (
    <div className="min-h-screen bg-cream text-gray-900 flex flex-col justify-between selection:bg-lottery selection:text-white">
      {/* Barra de navegación superior */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-lottery flex items-center justify-center text-white shadow-md shadow-lottery/20">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">MisDecimos</h1>
              <p className="text-[11px] text-gray-500 font-medium">Trazabilidad Asegurada · PWA</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-700">
              <span
                className={`h-2 w-2 rounded-full ${
                  dbConnected === true
                    ? 'bg-emerald-500'
                    : dbConnected === false
                    ? 'bg-rose-500'
                    : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span>
                {dbConnected === true
                  ? 'Supabase Conectado'
                  : dbConnected === false
                  ? 'Error Conexión'
                  : 'Verificando...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-lottery-700 via-lottery to-lottery-800 p-8 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-gold-100 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-gold-400" /> Fase 1 (v0.1.0) · Cimientos & Arquitectura
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Custodia y reparto de décimos de Lotería con seguridad criptográfica
            </h2>
            <p className="text-sm text-lottery-100 leading-relaxed">
              Sistema Single Source of Truth basado en funciones RPC transaccionales y auditoría inmutable en PostgreSQL.
              Sin pérdida de porcentajes, con códigos cortos de 6 dígitos y confirmación atómica de cobro de premios.
            </p>
          </div>
          <div className="absolute -right-12 -bottom-12 opacity-10 text-white pointer-events-none">
            <Ticket className="w-80 h-80" />
          </div>
        </section>

        {/* Pilares Técnicos */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-lottery-50 text-lottery flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Single Source of Truth</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Mutaciones críticas delegadas a RPCs con <code className="text-[11px] font-mono bg-gray-100 px-1 py-0.5 rounded">SECURITY DEFINER</code>.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Reparto Sin Huérfanos</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Absorción del redondeo por el propietario y reintegro automático en rechazos o cancelaciones.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Liquidación de Premios</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Confirmación participante a participante con transición automática a estado <span className="font-semibold text-emerald-700">LIQUIDADO</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Plantillas Oficiales</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Superposición SVG sobre {templateCount} plantillas maestras (Navidad y El Niño 2025/2026).
            </p>
          </div>
        </section>

        {/* Estado del despliegue */}
        <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-gray-900">Estado de Infraestructura · Fase 1 Completada</h3>
            </div>
            <span className="text-xs font-mono font-medium text-gray-500">xmdghpyfrblmtjtevtru</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-gray-50 p-3 space-y-1">
              <p className="font-semibold text-gray-700">Base de Datos PostgreSQL</p>
              <p className="text-gray-500">9 tablas con RLS estricto y triggers de perfil automático.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 space-y-1">
              <p className="font-semibold text-gray-700">Funciones RPC Transaccionales</p>
              <p className="text-gray-500">10 funciones PL/pgSQL desplegadas y validadas.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 space-y-1">
              <p className="font-semibold text-gray-700">Control Anti-Caché & PWA</p>
              <p className="text-gray-500">Badge con hash corto de git y purga de Service Worker en 1 clic.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 bg-white py-4 text-center text-xs text-gray-400">
        MisDecimos · Plataforma de custodia y reparto de décimos de Lotería · {new Date().getFullYear()}
      </footer>

      {/* Componente flotante de versión anti-caché */}
      <VersionBadge />
    </div>
  )
}
