import React, { useState } from 'react'
import type { Database } from '../../types/database.types'
import { DecimoIcon } from '../icons/DecimoIcon'
import {
  RefreshCw,
  Clock,
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
    icon: DecimoIcon,
    colorClass: 'text-[#3A5245] dark:text-[#C5A880]',
    bgClass: 'bg-[#3A5245]/10 dark:bg-[#C5A880]/15',
    borderClass: 'border-[#3A5245]/20 dark:border-[#C5A880]/30',
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
  SIMULACION_PREMIO: {
    title: 'Simulación de premio activada',
    icon: Trophy,
    colorClass: 'text-[#1D1D1F]',
    bgClass: 'bg-[#C5A880]/25',
    borderClass: 'border-[#C5A880]/60',
  },
  SIMULACION_PREMIO_ACTIVADA: {
    title: 'Simulación de premio activada',
    icon: Trophy,
    colorClass: 'text-[#1D1D1F]',
    bgClass: 'bg-[#C5A880]/25',
    borderClass: 'border-[#C5A880]/60',
  },
  SIMULACION_PREMIO_RESTABLECIDA: {
    title: 'Simulación de premio restablecida',
    icon: RefreshCw,
    colorClass: 'text-[#1D1D1F]',
    bgClass: 'bg-[#F5F5F7]',
    borderClass: 'border-black/10',
  },
}

function formatFallbackActionTitle(action: string): string {
  const words = action
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\bsimulacion\b/g, 'simulación')
    .replace(/\bparticipacion\b/g, 'participación')
    .replace(/\bdecimo\b/g, 'décimo')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action
}

function formatCheckSource(source: unknown): string {
  const raw = String(source || '').trim()
  if (!raw) return ''
  if (raw.toUpperCase() === 'SIMULACION' || raw.toUpperCase() === 'SIMULACIÓN') {
    return 'Simulación'
  }
  return raw
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
          HISTORIAL DE EVENTOS ({events.length})
        </h3>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-xl border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition active:scale-95 cursor-pointer"
          title="Actualizar eventos"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#C5A880]' : ''}`} />
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] p-8 border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] text-center space-y-2">
          <Clock className="h-8 w-8 text-[#1D1D1F]/30 dark:text-[#F5F5F7]/30 mx-auto" />
          <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Sin eventos de auditoría</p>
          <p className="text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
            Todas las acciones críticas quedan registradas de forma inmutable.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1D1D1F] rounded-[22px] border border-[#1D1D1F]/[0.07] dark:border-[#F5F5F7]/[0.08] p-5 shadow-sm space-y-5 relative">
          {/* Línea vertical del timeline */}
          <div className="absolute left-[33px] top-7 bottom-7 w-0.5 bg-[#1D1D1F]/10 dark:bg-[#F5F5F7]/10 -z-0" />

          {events.map((evt) => {
            const config = ACTION_CONFIGS[evt.action] || {
              title: formatFallbackActionTitle(evt.action),
              icon: Clock,
              colorClass: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
              bgClass: 'bg-[#F5F5F7] dark:bg-[#2C2C2E]',
              borderClass: 'border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10',
            }

            const Icon = config.icon
            const meta =
              evt.metadata && typeof evt.metadata === 'object'
                ? (evt.metadata as Record<string, unknown>)
                : null
            const hasPrize = Boolean(meta && meta.prize_amount_cents !== undefined && meta.prize_amount_cents !== null)
            const checkSourceText = meta ? formatCheckSource(meta.check_source) : ''
            const hasShortCode = Boolean(meta?.short_code)
            const hasLabel = Boolean(meta?.label)
            const hasReason = Boolean(meta?.reason)
            const hasPartsCount = Boolean(meta?.parts_count)
            const hasVisibleMetadata =
              hasPrize || Boolean(checkSourceText) || hasShortCode || hasLabel || hasReason || hasPartsCount

            return (
              <div key={evt.id} className="flex items-start gap-3.5 relative z-10 text-xs">
                {/* Icono Badge */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${config.bgClass} ${config.borderClass} ${config.colorClass} shadow-2xs`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Contenido del Evento */}
                <div className="flex-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 rounded-2xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{config.title}</span>

                    {evt.percentage !== null && evt.percentage !== undefined && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white dark:bg-[#1D1D1F] border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 text-[#1D1D1F] dark:text-[#F5F5F7] shadow-2xs">
                        {evt.percentage}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60 pt-0.5">
                    <span className="font-medium truncate max-w-[180px]">
                      {evt.actor?.display_name || evt.actor?.email || 'Sistema / Usuario'}
                    </span>
                    <span className="tabular-nums text-[10px] shrink-0">
                      {formatTimestamp(evt.created_at)}
                    </span>
                  </div>

                  {/* Metadatos adicionales si existen detalles visibles */}
                  {meta && hasVisibleMetadata && (
                    <div className="text-[10px] text-[#1D1D1F]/70 dark:text-[#F5F5F7]/70 font-mono bg-white dark:bg-[#1D1D1F] p-2 rounded-xl mt-1.5 border border-[#1D1D1F]/10 dark:border-[#F5F5F7]/10 space-y-0.5">
                      {hasPrize && (
                        <p>
                          Premio total:{' '}
                          <strong className="text-[#3A5245] dark:text-[#C5A880] font-bold">
                            {(Number(meta.prize_amount_cents) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </strong>
                        </p>
                      )}
                      {Boolean(checkSourceText) && (
                        <p>Fuente: {checkSourceText}</p>
                      )}
                      {hasShortCode && (
                        <p>
                          Código:{' '}
                          <strong className="tracking-wider text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {String(meta.short_code)}
                          </strong>
                        </p>
                      )}
                      {hasLabel && (
                        <p>Etiqueta: {String(meta.label)}</p>
                      )}
                      {hasReason && (
                        <p>Motivo: {String(meta.reason)}</p>
                      )}
                      {hasPartsCount && (
                        <p>Partes: {String(meta.parts_count)}</p>
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
