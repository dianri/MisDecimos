import React from 'react'
import { supabase } from '../../lib/supabase'
import { sanitizeText } from '../../lib/sanitize'
import { useModalBackHandler } from '../../hooks/useModalBackHandler'
import {
  X,
  Sliders,
  PieChart,
  Minus,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
  Info,
} from 'lucide-react'

export interface CreateParticipationSheetProps {
  isOpen: boolean
  ticketId: string
  ticketNumber: string
  drawName: string
  availablePercentage: number
  onClose: () => void
  onInviteCreated: (invite: {
    id: string
    short_code: string
    invite_token: string
    percentage: number
    label?: string | null
    ticketNumber?: string
    drawName?: string
  }) => void
  onEqualSplitComplete: () => void
}

export const CreateParticipationSheet: React.FC<CreateParticipationSheetProps> = ({
  isOpen,
  ticketId,
  ticketNumber,
  drawName,
  availablePercentage,
  onClose,
  onInviteCreated,
  onEqualSplitComplete,
}) => {
  useModalBackHandler({ isOpen, onClose, modalKey: 'create_participation_sheet' })

  // Inicializa en 'equal' (Partes iguales) si el propietario conserva el 100%, o 'manual' si ya existen cuotas previas
  const [mode, setMode] = React.useState<'equal' | 'manual'>(() => {
    return availablePercentage >= 100 ? 'equal' : 'manual'
  })

  // Modo Manual: inicializa por defecto en 20% (o el disponible)
  const [label, setLabel] = React.useState('')
  const [manualPercentage, setManualPercentage] = React.useState<number>(() => {
    return Math.min(20, Math.max(1, Math.floor(availablePercentage)))
  })

  // Modo Partes Iguales
  const [partsCount, setPartsCount] = React.useState<number>(2)
  const [ownerParticipates, setOwnerParticipates] = React.useState<boolean>(true)

  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Sincronizar modo y porcentaje por defecto cada vez que se abra el sheet
  React.useEffect(() => {
    if (isOpen) {
      setMode(availablePercentage >= 100 ? 'equal' : 'manual')
      setManualPercentage(Math.min(20, Math.max(1, Math.floor(availablePercentage))))
      setErrorMsg(null)
    }
  }, [isOpen, availablePercentage])

  if (!isOpen) return null

  // 1. Manejador: Crear participación con porcentaje manual
  const handleCreateManual = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (manualPercentage <= 0 || manualPercentage > availablePercentage) {
      setErrorMsg(`El porcentaje debe ser entre 1% y ${availablePercentage}%.`)
      return
    }

    setIsLoading(true)
    setErrorMsg(null)

    const cleanLabel = sanitizeText(label, 30)

    try {
      const { data, error } = await supabase.rpc('create_manual_participation', {
        p_ticket_id: ticketId,
        p_percentage: manualPercentage,
        p_label: cleanLabel || undefined,
      })

      if (error) throw error

      const newInviteId = data as string

      // Recuperar el registro de la invitación creada para obtener el short_code y token
      const { data: inviteRow, error: fetchErr } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('id', newInviteId)
        .single()

      if (fetchErr || !inviteRow) throw fetchErr || new Error('Invitación no encontrada')

      onInviteCreated({
        id: inviteRow.id,
        short_code: inviteRow.short_code,
        invite_token: inviteRow.invite_token,
        percentage: Number(inviteRow.percentage),
        label: inviteRow.label,
        ticketNumber,
        drawName,
      })
      onClose()
    } catch (err: unknown) {
      console.error('Error creando participación manual:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al crear la participación manual.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Manejador: Crear reparto a partes iguales
  const handleCreateEqualSplit = async () => {
    if (partsCount < 2 || partsCount > 10) return

    setIsLoading(true)
    setErrorMsg(null)

    try {
      const { error } = await supabase.rpc('create_equal_split_participations', {
        p_ticket_id: ticketId,
        p_parts_count: partsCount,
        p_owner_participates: ownerParticipates,
      })

      if (error) throw error

      onEqualSplitComplete()
      onClose()
    } catch (err: unknown) {
      console.error('Error creando reparto a partes iguales:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al generar el reparto a partes iguales.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Cálculo matemático en tiempo real para Partes Iguales
  const Z = availablePercentage
  const N = partsCount
  const basePart = Math.round((Z / N) * 100) / 100
  const ownerPart = ownerParticipates
    ? Math.round((Z - basePart * (N - 1)) * 100) / 100
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white border border-gray-100 shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera Bottom Sheet (shrink-0 siempre visible arriba) */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Nueva Participación</h3>
            <p className="text-[11px] text-gray-500">
              Disponible para repartir:{' '}
              <strong className="text-lottery font-mono">{availablePercentage}%</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo central con scroll interno overscroll-contain */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {/* Selector de modo estilo píldora: 1. Partes iguales | 2. Porcentaje manual */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-gray-100 text-xs font-semibold">
            {/* 1. Primera pestaña (izquierda): Partes iguales */}
            <button
              type="button"
              onClick={() => setMode('equal')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition ${
                mode === 'equal'
                  ? 'bg-white text-lottery shadow-sm font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChart className="h-3.5 w-3.5" />
              <span>Partes iguales</span>
            </button>

            {/* 2. Segunda pestaña (derecha): Porcentaje manual */}
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition ${
                mode === 'manual'
                  ? 'bg-white text-lottery shadow-sm font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Porcentaje manual</span>
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* MODO A: Partes Iguales */}
          {mode === 'equal' ? (
            <div className="space-y-4">
              {/* Stepper de partes */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Número de partes (entre 2 y 10)
                </label>
                <div className="flex items-center justify-center gap-4 py-2 bg-gray-50 rounded-2xl border border-gray-200/80">
                  <button
                    type="button"
                    disabled={partsCount <= 2 || isLoading}
                    onClick={() => setPartsCount(Math.max(2, partsCount - 1))}
                    className="p-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-xs"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="text-2xl font-extrabold font-mono text-gray-900 w-12 text-center">
                    {partsCount}
                  </span>

                  <button
                    type="button"
                    disabled={partsCount >= 10 || isLoading}
                    onClick={() => setPartsCount(Math.min(10, partsCount + 1))}
                    className="p-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Toggle: Propietario no participa */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-gray-800">
                    El propietario no recibe parte del premio
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Cede todo el porcentaje disponible ({availablePercentage}%) a los invitados.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!ownerParticipates}
                  onClick={() => setOwnerParticipates(!ownerParticipates)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    !ownerParticipates ? 'bg-lottery' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      !ownerParticipates ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Previsualización matemática en tiempo real */}
              <div className="rounded-2xl border border-lottery/30 bg-lottery-50/50 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-lottery">
                  <Sparkles className="h-3.5 w-3.5 text-gold-600" />
                  <span>Desglose exacto del reparto</span>
                </div>

                <div className="space-y-1 font-mono text-[11px] text-gray-700 bg-white/80 p-2.5 rounded-xl border border-lottery/15">
                  {ownerParticipates ? (
                    <>
                      <p>
                        • Propietario (absorbe redondeo):{' '}
                        <strong className="text-lottery-800">{ownerPart}%</strong>
                      </p>
                      <p>
                        • {partsCount - 1} Invitación{partsCount - 1 > 1 ? 'es' : ''} de:{' '}
                        <strong className="text-gray-900">{basePart}%</strong> cada una
                      </p>
                    </>
                  ) : (
                    <>
                      <p>• Propietario: <strong className="text-gray-500">0.00%</strong></p>
                      <p>
                        • {partsCount} Invitaciones de:{' '}
                        <strong className="text-lottery-800">{basePart}%</strong> cada una
                      </p>
                    </>
                  )}
                </div>

                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Info className="h-3 w-3 text-gray-400 shrink-0" />
                  <span>
                    Las invitaciones pendientes previas se cancelarán para consolidar el reparto.
                  </span>
                </p>
              </div>
            </div>
          ) : (
            /* MODO B: Porcentaje Manual */
            <form id="manual-participation-form" onSubmit={handleCreateManual} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Nombre base <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  maxLength={30}
                  placeholder="Ej. Para papá / Primo Carlos"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery"
                />
              </div>

              {/* Slider de porcentaje con indicador visual */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-700">Porcentaje a ceder:</span>
                  <span className="text-base font-extrabold font-mono text-lottery bg-lottery-50 px-2.5 py-0.5 rounded-lg border border-lottery-200">
                    {manualPercentage}%
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max={Math.max(1, availablePercentage)}
                  step="1"
                  value={manualPercentage}
                  onChange={(e) => setManualPercentage(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-lottery"
                />

                {/* Botones rápidos */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[10, 20, 25, 50].map((preset) => {
                    const disabled = preset > availablePercentage
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={disabled}
                        onClick={() => setManualPercentage(preset)}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-mono font-semibold border transition ${
                          manualPercentage === preset
                            ? 'border-lottery bg-lottery text-white shadow-xs'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'
                        }`}
                      >
                        {preset}%
                      </button>
                    )
                  })}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Pie fijo con botón de acción (shrink-0 con env(safe-area-inset-bottom)) */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {mode === 'equal' ? (
            <button
              type="button"
              onClick={handleCreateEqualSplit}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-lottery text-white text-xs font-bold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generando {partsCount} partes...</span>
                </>
              ) : (
                <span>Crear participaciones a partes iguales</span>
              )}
            </button>
          ) : (
            <button
              type="submit"
              form="manual-participation-form"
              onClick={() => handleCreateManual()}
              disabled={isLoading || manualPercentage <= 0 || manualPercentage > availablePercentage}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-lottery text-white text-xs font-bold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generando invitación...</span>
                </>
              ) : (
                <span>Crear participación de {manualPercentage}%</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
