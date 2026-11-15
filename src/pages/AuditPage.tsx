import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import {
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  Ticket,
  Lock,
  PieChart,
  Trophy,
  UserPlus,
  AlertTriangle,
  BadgeCheck,
  Clock,
  Loader2,
  RefreshCw,
  X,
  ExternalLink,
  ShieldAlert,
  Send,
  CheckCheck,
  Trash2,
} from 'lucide-react'

type AuditEventRow = Database['public']['Tables']['audit_events']['Row'] & {
  actor?: {
    display_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  target?: {
    display_name: string | null
    email: string | null
  } | null
  ticket?: {
    id: string
    number: string
    draw_name: string
    draw_date: string
    status: string
    prize_amount_cents: number
  } | null
}

export interface AuditPageProps {
  onSelectTicket?: (ticketId: string) => void
}

type FilterCategory = 'ALL' | 'TICKETS' | 'SHARES' | 'WAIVERS' | 'PRIZES'

const ACTION_CONFIGS: Record<
  string,
  {
    title: string
    category: FilterCategory
    icon: React.ElementType
    colorClass: string
    bgClass: string
    borderClass: string
  }
> = {
  DECIMO_CREADO: {
    title: 'Décimo registrado',
    category: 'TICKETS',
    icon: Ticket,
    colorClass: 'text-lottery',
    bgClass: 'bg-lottery-50',
    borderClass: 'border-lottery-200',
  },
  ESCANEO_CODIGO_BARRAS: {
    title: 'Escaneo GS1-128',
    category: 'TICKETS',
    icon: Ticket,
    colorClass: 'text-lottery',
    bgClass: 'bg-lottery-50',
    borderClass: 'border-lottery-200',
  },
  PARTICIPACION_CREADA: {
    title: 'Invitación creada',
    category: 'SHARES',
    icon: UserPlus,
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  REPARTO_IGUALITARIO: {
    title: 'Reparto a partes iguales',
    category: 'SHARES',
    icon: PieChart,
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  INVITACION_ENVIADA: {
    title: 'Invitación generada',
    category: 'SHARES',
    icon: Send,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  PARTICIPACION_ACEPTADA: {
    title: 'Participación aceptada',
    category: 'SHARES',
    icon: BadgeCheck,
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  PARTICIPACION_RECHAZADA: {
    title: 'Participación rechazada',
    category: 'SHARES',
    icon: X,
    colorClass: 'text-rose-700',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
  },
  PARTICIPACION_CANCELADA: {
    title: 'Invitación cancelada',
    category: 'SHARES',
    icon: Trash2,
    colorClass: 'text-gray-700',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-300',
  },
  SOLICITUD_RENUNCIA_ENVIADA: {
    title: 'Solicitud de renuncia',
    category: 'WAIVERS',
    icon: AlertTriangle,
    colorClass: 'text-amber-800',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-300',
  },
  SOLICITUD_RENUNCIA_ACEPTADA: {
    title: 'Renuncia aceptada',
    category: 'WAIVERS',
    icon: CheckCheck,
    colorClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  SOLICITUD_RENUNCIA_RECHAZADA: {
    title: 'Renuncia rechazada',
    category: 'WAIVERS',
    icon: ShieldAlert,
    colorClass: 'text-rose-800',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
  },
  PREMIO_COMPROBADO: {
    title: 'Sorteo comprobado',
    category: 'PRIZES',
    icon: Trophy,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  SOLICITUD_VALIDAR_COBRO: {
    title: 'Recordatorio de cobro',
    category: 'PRIZES',
    icon: Clock,
    colorClass: 'text-amber-800',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  COBRO_PREMIO_CONFIRMADO: {
    title: 'Cobro de premio confirmado',
    category: 'PRIZES',
    icon: BadgeCheck,
    colorClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  DECIMO_LIQUIDADO: {
    title: 'Décimo liquidado',
    category: 'PRIZES',
    icon: ShieldCheck,
    colorClass: 'text-emerald-900',
    bgClass: 'bg-emerald-100',
    borderClass: 'border-emerald-300',
  },
}

export const AuditPage: React.FC<AuditPageProps> = ({ onSelectTicket }) => {
  const [events, setEvents] = useState<AuditEventRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('ALL')
  const [showGuarantees, setShowGuarantees] = useState(false)

  const loadAuditEvents = async () => {
    try {
      setIsRefreshing(true)
      const { data, error } = await supabase
        .from('audit_events')
        .select(`
          *,
          actor:profiles!audit_events_actor_id_fkey(display_name, email, avatar_url),
          target:profiles!audit_events_target_user_id_fkey(display_name, email),
          ticket:tickets!audit_events_ticket_id_fkey(id, number, draw_name, draw_date, status, prize_amount_cents)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setEvents((data as unknown as AuditEventRow[]) || [])
    } catch (err) {
      console.error('Error cargando eventos de auditoría global:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadAuditEvents()

    const channel = supabase
      .channel('global-audit-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_events' }, () => {
        loadAuditEvents()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Filtrado reactivo en memoria
  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return events.filter((evt) => {
      const config = ACTION_CONFIGS[evt.action]
      const categoryMatch =
        selectedCategory === 'ALL' || (config && config.category === selectedCategory)

      if (!categoryMatch) return false
      if (!q) return true

      const ticketNum = evt.ticket?.number?.toLowerCase() || ''
      const drawName = evt.ticket?.draw_name?.toLowerCase() || ''
      const actorName = evt.actor?.display_name?.toLowerCase() || ''
      const actorEmail = evt.actor?.email?.toLowerCase() || ''
      const meta = evt.metadata as Record<string, unknown> | null
      const shortCode = String(meta?.short_code || '').toLowerCase()
      const label = String(meta?.label || '').toLowerCase()

      return (
        ticketNum.includes(q) ||
        drawName.includes(q) ||
        actorName.includes(q) ||
        actorEmail.includes(q) ||
        shortCode.includes(q) ||
        label.includes(q)
      )
    })
  }, [events, searchQuery, selectedCategory])

  const formatFullDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="space-y-5 pb-16 max-w-xl mx-auto">
      {/* 1. Cabecera y Sello de Garantía */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
            Centro de Auditoría y Trazabilidad
          </h2>
          <p className="text-[11px] text-gray-500">
            Registro inmutable de operaciones y custodia compartida
          </p>
        </div>

        <button
          type="button"
          onClick={loadAuditEvents}
          disabled={isRefreshing}
          className="p-2 rounded-2xl bg-white border border-gray-200/80 text-gray-700 hover:bg-gray-50 active:scale-95 transition shadow-xs"
          title="Actualizar registro"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-lottery' : ''}`} />
        </button>
      </div>

      {/* Sello de Garantía Criptográfica */}
      <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-emerald-950">
              Garantía de Integridad en PostgreSQL
            </h3>
            <p className="text-[11px] text-emerald-800">
              Cada acción queda sellada con hora, autor y trazabilidad inmutable.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGuarantees(!showGuarantees)}
          className="p-1.5 rounded-xl bg-white/80 border border-emerald-200 text-emerald-900 text-xs font-bold hover:bg-white transition flex items-center gap-1 shrink-0"
        >
          <span>{showGuarantees ? 'Ocultar' : '¿Cómo funciona?'}</span>
          {showGuarantees ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* 2. Bloque Desplegable de Garantías del Motor Transaccional */}
      {showGuarantees && (
        <div className="bg-white rounded-3xl border border-gray-200/80 p-5 shadow-xs space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-2">
            Las 4 Reglas de Seguridad de MisDecimos
          </h4>

          <div className="grid grid-cols-1 gap-3 text-xs">
            {/* Regla 1 */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/60 space-y-1">
              <div className="flex items-center gap-2 text-lottery font-bold">
                <Lock className="h-4 w-4 shrink-0" />
                <span>1. Custodia Bloqueada ante Terceros</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed pl-6">
                En cuanto un participante acepta su cuota, el número, fecha y datos del décimo quedan bloqueados de forma permanente y no pueden modificarse ni eliminarse.
              </p>
            </div>

            {/* Regla 2 */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/60 space-y-1">
              <div className="flex items-center gap-2 text-blue-700 font-bold">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>2. Inmutabilidad Bilateral (Cero revocaciones unilaterales)</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed pl-6">
                Ninguna participación puede eliminarse arbitrariamente por el propietario. Para recuperar una cuota aceptada se exige una solicitud de renuncia formal que el cotitular debe aceptar.
              </p>
            </div>

            {/* Regla 3 */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/60 space-y-1">
              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <PieChart className="h-4 w-4 shrink-0" />
                <span>3. Integridad Matemática del 100%</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed pl-6">
                El algoritmo de reparto absorbe los redondeos en el custodio para garantizar cero porcentajes huérfanos. Las invitaciones canceladas o rechazadas retornan íntegramente al propietario.
              </p>
            </div>

            {/* Regla 4 */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/60 space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <Trophy className="h-4 w-4 shrink-0" />
                <span>4. Liquidación Verificada de Premios</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed pl-6">
                Un décimo premiado solo transita al estado final LIQUIDADO cuando cada uno de los cotitulares confirma individualmente que ha recibido su parte del premio.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Buscador y Filtros Rápidos */}
      <div className="space-y-2.5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por Nº de décimo, sorteo, usuario o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-gray-200 bg-white text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery transition shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Chips de Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px] font-semibold">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'TICKETS', label: 'Décimos' },
            { id: 'SHARES', label: 'Participaciones' },
            { id: 'WAIVERS', label: 'Renuncias' },
            { id: 'PRIZES', label: 'Premios y Cobros' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as FilterCategory)}
              className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition active:scale-95 ${
                selectedCategory === cat.id
                  ? 'bg-lottery text-white border-lottery shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200/80 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Feed Cronológico Global de Auditoría */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-lottery" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Sin registros coincidentes</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Prueba a cambiar los filtros o el término de búsqueda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((evt) => {
            const config = ACTION_CONFIGS[evt.action] || {
              title: evt.action.replace(/_/g, ' '),
              category: 'ALL',
              icon: Clock,
              colorClass: 'text-gray-700',
              bgClass: 'bg-gray-100',
              borderClass: 'border-gray-200',
            }

            const Icon = config.icon
            const meta = evt.metadata as Record<string, unknown> | null

            return (
              <div
                key={evt.id}
                className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-2.5 transition hover:border-gray-300"
              >
                {/* Cabecera de la tarjeta: Píldora del décimo + Fecha */}
                <div className="flex items-center justify-between gap-2">
                  {evt.ticket ? (
                    <button
                      type="button"
                      onClick={() => onSelectTicket && onSelectTicket(evt.ticket!.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-50 hover:bg-lottery-50 hover:text-lottery text-gray-700 border border-gray-200 text-[10px] font-bold font-mono transition active:scale-95"
                      title="Ver detalles del décimo"
                    >
                      <Ticket className="h-3 w-3 text-lottery" />
                      <span>
                        Nº {evt.ticket.number} · {evt.ticket.draw_name}
                      </span>
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-mono">Boleto general</span>
                  )}

                  <span className="text-[10px] text-gray-400 font-mono">
                    {formatFullDate(evt.created_at)}
                  </span>
                </div>

                {/* Fila del Evento */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${config.bgClass} ${config.borderClass} ${config.colorClass} shadow-2xs`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-900">{config.title}</span>

                      {evt.percentage !== null && evt.percentage !== undefined && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-gray-100 text-gray-800 border border-gray-200">
                          {evt.percentage}%
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-500">
                      Ejecutado por:{' '}
                      <strong className="text-gray-800">
                        {evt.actor?.display_name || evt.actor?.email || 'Sistema'}
                      </strong>
                    </p>

                    {/* Metadatos adicionales formateados */}
                    {meta && Object.keys(meta).length > 0 && (
                      <div className="text-[10px] text-gray-500 font-mono bg-gray-50/80 p-2 rounded-xl mt-1 border border-gray-100 space-y-0.5">
                        {Boolean(meta.prize_amount_cents !== undefined) && (
                          <p>
                            Premio total:{' '}
                            <strong className="text-lottery font-bold">
                              {(Number(meta.prize_amount_cents) / 100).toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                              })}{' '}
                              €
                            </strong>
                          </p>
                        )}
                        {Boolean(meta.short_code) && (
                          <p>
                            Código:{' '}
                            <strong className="tracking-widest text-gray-800">
                              {String(meta.short_code)}
                            </strong>
                          </p>
                        )}
                        {Boolean(meta.label) && <p>Etiqueta: {String(meta.label)}</p>}
                        {Boolean(meta.check_source) && (
                          <p>Fuente oficial: {String(meta.check_source)}</p>
                        )}
                        {Boolean(meta.parts_count) && (
                          <p>Partes de reparto: {String(meta.parts_count)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
