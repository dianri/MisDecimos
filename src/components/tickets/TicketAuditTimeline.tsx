import React, { useState } from 'react'
import type { Database } from '../../types/database.types'
import {
  RefreshCw,
  Clock,
  Ticket,
  Barcode,
  UserPlus,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Send,
  CheckCheck,
  BadgeAlert,
  Trophy,
  Bell,
  BadgeCheck,
  LogOut,
} from 'lucide-react'

export type AuditEvent = Database['public']['Tables']['audit_events']['Row'] & {
  actor?: {
    display_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  target?: {
    display_name: string | null
    email: string | null
  } | null
}

interface TicketAuditTimelineProps {
  events: AuditEvent[]
  onRefresh: () => Promise<void>
}

interface ActionConfig {
  title: string
  icon: React.ElementType
  colorClass: string
  bgClass: string
  borderClass: string
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
  DECIMO_CREADO: {
    title: 'Décimo registrado',
    icon: Ticket,
    colorClass: 'text-lottery',
    bgClass: 'bg-lottery-50',
    borderClass: 'border-lottery-200',
  },
  ESCANEO_CODIGO_BARRAS: {
    title: 'Escaneo GS1-128',
    icon: Barcode,
    colorClass: 'text-lottery',
    bgClass: 'bg-lottery-50',
    borderClass: 'border-lottery-200',
  },
  PARTICIPACION_CREADA: {
    title: 'Invitación creada',
    icon: UserPlus,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  REPARTO_IGUALITARIO: {
    title: 'Reparto igualitario',
    icon: Users,
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  INVITACION_ENVIADA: {
    title: 'Invitación generada',
    icon: Send,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  PARTICIPACION_ACEPTADA: {
    title: 'Participación aceptada',
    icon: CheckCircle2,
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  PARTICIPACION_RECHAZADA: {
    title: 'Participación rechazada',
    icon: XCircle,
    colorClass: 'text-rose-700',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
  },
  SOLICITUD_RENUNCIA_ENVIADA: {
    title: 'Solicitud de renuncia',
    icon: AlertTriangle,
    colorClass: 'text-amber-800',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-300',
  },
  SOLICITUD_RENUNCIA_ACEPTADA: {
    title: 'Renuncia aceptada',
    icon: CheckCheck,
    colorClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  SOLICITUD_RENUNCIA_RECHAZADA: {
    title: 'Renuncia rechazada',
    icon: BadgeAlert,
    colorClass: 'text-rose-800',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
  },
  RENUNCIA_VOLUNTARIA_PARTICIPANTE: {
    title: 'Renuncia voluntaria de cuota',
    icon: LogOut,
    colorClass: 'text-amber-800',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-300',
  },
  PARTICIPACION_CANCELADA: {
    title: 'Invitación cancelada',
    icon: Trash2,
    colorClass: 'text-gray-700',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-300',
  },
  PREMIO_COMPROBADO: {
    title: 'Sorteo comprobado',
    icon: Trophy,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  SOLICITUD_VALIDAR_COBRO: {
    title: 'Recordatorio de cobro',
    icon: Bell,
    colorClass: 'text-amber-800',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  COBRO_PREMIO_CONFIRMADO: {
    title: 'Cobro de premio confirmado',
    icon: BadgeCheck,
    colorClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  DECIMO_LIQUIDADO: {
    title: 'Décimo liquidado',
    icon: ShieldCheck,
    colorClass: 'text-emerald-900',
    bgClass: 'bg-emerald-100',
    borderClass: 'border-emerald-300',
  },
}

export const TicketAuditTimeline: React.FC<TicketAuditTimelineProps> = ({
  events,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  const formatTimestamp = (isoDate: string) => {
    const d = new Date(isoDate)
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
          HISTORIAL DE EVENTOS ({events.length})
        </h3>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition active:scale-95"
          title="Actualizar eventos"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-lottery' : ''}`} />
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center space-y-2">
          <Clock className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="text-xs font-semibold text-gray-600">Sin eventos de auditoría</p>
          <p className="text-[11px] text-gray-400">
            Todas las acciones críticas quedan registradas de forma inmutable.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-5 relative">
          {/* Línea vertical del timeline */}
          <div className="absolute left-[33px] top-7 bottom-7 w-0.5 bg-gray-200/80 -z-0" />

          {events.map((evt) => {
            const config = ACTION_CONFIGS[evt.action] || {
              title: evt.action.replace(/_/g, ' '),
              icon: Clock,
              colorClass: 'text-gray-700',
              bgClass: 'bg-gray-100',
              borderClass: 'border-gray-200',
            }

            const Icon = config.icon

            return (
              <div key={evt.id} className="flex items-start gap-3.5 relative z-10 text-xs">
                {/* Icono Badge */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${config.bgClass} ${config.borderClass} ${config.colorClass} shadow-2xs`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Contenido del Evento */}
                <div className="flex-1 bg-gray-50/70 border border-gray-200/60 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-900">{config.title}</span>

                    {evt.percentage !== null && evt.percentage !== undefined && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white border border-gray-200 text-gray-800 shadow-2xs">
                        {evt.percentage}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                    <span className="font-medium text-gray-600 truncate max-w-[180px]">
                      {evt.actor?.display_name || evt.actor?.email || 'Sistema / Usuario'}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 shrink-0">
                      {formatTimestamp(evt.created_at)}
                    </span>
                  </div>

                  {/* Metadatos adicionales si existen */}
                  {evt.metadata && typeof evt.metadata === 'object' && Object.keys(evt.metadata).length > 0 && (
                    <div className="text-[10px] text-gray-500 font-mono bg-white/70 p-2 rounded-xl mt-1.5 border border-gray-100 space-y-0.5">
                      {Boolean((evt.metadata as Record<string, unknown>).prize_amount_cents !== undefined) && (
                        <p>
                          Premio total:{' '}
                          <strong className="text-lottery font-bold">
                            {(Number((evt.metadata as Record<string, unknown>).prize_amount_cents) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                          </strong>
                        </p>
                      )}
                      {Boolean((evt.metadata as Record<string, unknown>).check_source) && (
                        <p>Fuente: {String((evt.metadata as Record<string, unknown>).check_source)}</p>
                      )}
                      {Boolean((evt.metadata as Record<string, unknown>).short_code) && (
                        <p>
                          Código:{' '}
                          <strong className="tracking-wider text-gray-800">
                            {String((evt.metadata as Record<string, unknown>).short_code)}
                          </strong>
                        </p>
                      )}
                      {Boolean((evt.metadata as Record<string, unknown>).label) && (
                        <p>Etiqueta: {String((evt.metadata as Record<string, unknown>).label)}</p>
                      )}
                      {Boolean((evt.metadata as Record<string, unknown>).reason) && (
                        <p>Motivo: {String((evt.metadata as Record<string, unknown>).reason)}</p>
                      )}
                      {Boolean((evt.metadata as Record<string, unknown>).parts_count) && (
                        <p>Partes: {String((evt.metadata as Record<string, unknown>).parts_count)}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
