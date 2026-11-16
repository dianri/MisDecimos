import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { parseSelaeBarcode } from '../../lib/selaeBarcodeParser'
import { BarcodeScannerModal } from './BarcodeScannerModal'
import type { Database } from '../../types/database.types'
import {
  X,
  Ticket,
  Camera,
  Edit3,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'

type DrawTemplate = Database['public']['Tables']['draw_templates']['Row']

export interface TicketFormModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (ticketId: string) => void
}

export const TicketFormModal: React.FC<TicketFormModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [tab, setTab] = useState<'scan' | 'manual'>('manual')
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  // Campos del décimo
  const [number, setNumber] = useState('')
  const [serie, setSerie] = useState('001')
  const [fraccion, setFraccion] = useState('01')
  const [drawType, setDrawType] = useState<'NAVIDAD' | 'EL_NINO'>('NAVIDAD')
  const [drawName, setDrawName] = useState('Sorteo Extraordinario de Navidad')
  const [drawDate, setDrawDate] = useState('2026-12-22')
  const [ticketPrice, setTicketPrice] = useState('20.00')
  const [barcodeRaw, setBarcodeRaw] = useState<string | null>(null)
  const [origin, setOrigin] = useState<'BARCODE_GS1' | 'MANUAL'>('MANUAL')

  // Plantillas disponibles
  const [templates, setTemplates] = useState<DrawTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Cargar plantillas de draw_templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const { data, error } = await supabase
          .from('draw_templates')
          .select('*')
          .eq('is_active', true)
          .order('year', { ascending: false })

        if (!error && data) {
          setTemplates(data)
          // Seleccionar plantilla por defecto
          const defaultTpl = data.find((t) => t.draw_type === 'NAVIDAD') || data[0]
          if (defaultTpl) {
            setSelectedTemplateId(defaultTpl.id)
          }
        }
      } catch (err) {
        console.warn('Error cargando plantillas:', err)
      }
    }
    loadTemplates()
  }, [])

  // Al cambiar drawType, actualizar valores por defecto
  const handleDrawTypeChange = (type: 'NAVIDAD' | 'EL_NINO') => {
    setDrawType(type)
    const now = new Date()
    const currentYear = now.getFullYear()

    if (type === 'NAVIDAD') {
      const year = now > new Date(currentYear, 11, 22) ? currentYear + 1 : currentYear
      setDrawName('Sorteo Extraordinario de Navidad')
      setDrawDate(`${year}-12-22`)
      setTicketPrice('20.00')
    } else {
      // El Niño es el 6 de enero
      const year = (now.getMonth() > 0 || now.getDate() > 6) ? currentYear + 1 : currentYear
      setDrawName('Sorteo Extraordinario de El Niño')
      setDrawDate(`${year}-01-06`)
      setTicketPrice('20.00')
    }

    // Vincular plantilla correspondiente si existe
    const matched = templates.find((t) => t.draw_type === type)
    if (matched) {
      setSelectedTemplateId(matched.id)
    }
  }

  // Manejar lectura desde el escáner de código de barras
  const handleBarcodeScanned = (scannedCode: string) => {
    setIsScannerOpen(false)
    const parsed = parseSelaeBarcode(scannedCode)

    setBarcodeRaw(scannedCode)
    setOrigin('BARCODE_GS1')
    setTab('manual') // Pasar a formulario para confirmación visual

    if (parsed.number) setNumber(parsed.number)
    if (parsed.serie) setSerie(parsed.serie)
    if (parsed.fraccion) setFraccion(parsed.fraccion)
    if (parsed.drawType) handleDrawTypeChange(parsed.drawType)
    if (parsed.drawDate) setDrawDate(parsed.drawDate)
    if (parsed.ticketPrice) setTicketPrice(parsed.ticketPrice.toFixed(2))
  }

  // Guardar décimo invocando create_ticket RPC
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanNumber = number.replace(/\D/g, '')
    if (cleanNumber.length !== 5) {
      setErrorMsg('El número del décimo debe tener exactamente 5 dígitos (00000 al 99999).')
      return
    }

    try {
      setIsLoading(true)

      const { data, error } = await supabase.rpc('create_ticket', {
        p_number: cleanNumber,
        p_serie: serie.trim() || '001',
        p_fraccion: fraccion.trim() || '01',
        p_draw_type: drawType,
        p_draw_name: drawName,
        p_draw_date: drawDate,
        p_ticket_price: parseFloat(ticketPrice) || 20.0,
        p_barcode_raw: barcodeRaw || undefined,
        p_template_id: selectedTemplateId || undefined,
        p_origin: origin,
      })

      if (error) throw error

      // Extraer UUID con máxima robustez (manejar string UUID directo, u objeto { id, ticket_id, ... })
      let createdTicketId: string | null = null
      if (typeof data === 'string' && data.trim().length > 0) {
        createdTicketId = data.trim()
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>
        const val = obj.id || obj.ticket_id || obj.ticketId
        if (typeof val === 'string' && val.trim().length > 0) {
          createdTicketId = val.trim()
        }
      }

      if (createdTicketId) {
        onCreated(createdTicketId)
        onClose()
      } else {
        throw new Error('No se recibió el identificador único del décimo creado en el sistema.')
      }
    } catch (err: unknown) {
      console.error('Error al registrar décimo:', err)
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al registrar el décimo en el sistema.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
        <div
          className="w-full max-w-md rounded-3xl bg-white border border-gray-100 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Cabecera del modal */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lottery text-white shadow-sm shadow-lottery/20">
                <Ticket className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Registrar Décimo</h3>
                <p className="text-[11px] text-gray-500">Añade tu boleto para compartir cuotas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Selector de modo: Escáner vs Manual */}
          <div className="p-4 pb-2">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-gray-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setTab('scan')
                  setIsScannerOpen(true)
                }}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition ${
                  tab === 'scan'
                    ? 'bg-white text-lottery shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Escanear Código</span>
              </button>

              <button
                type="button"
                onClick={() => setTab('manual')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl transition ${
                  tab === 'manual'
                    ? 'bg-white text-lottery shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Datos Manuales</span>
              </button>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-5 pt-3 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Número del Décimo (5 cifras) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Número del décimo <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={5}
                  placeholder="49307"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full text-center tracking-widest text-2xl font-bold font-mono py-2.5 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery text-gray-900 shadow-sm transition"
                />
              </div>
              <p className="text-[10px] text-gray-400 text-center">
                Debe contener exactamente 5 dígitos (ej. 05234)
              </p>
            </div>

            {/* Selector de Sorteo (Exclusivo Navidad y El Niño) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">Tipo de Sorteo</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'NAVIDAD', label: 'Navidad', icon: Sparkles },
                  { id: 'EL_NINO', label: 'El Niño', icon: Sparkles },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleDrawTypeChange(item.id as 'NAVIDAD' | 'EL_NINO')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-semibold transition text-center ${
                      drawType === item.id
                        ? 'border-lottery bg-lottery-50/70 text-lottery font-bold shadow-xs ring-1 ring-lottery/30'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Serie y Fracción */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">Serie</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="115"
                    value={serie}
                    onChange={(e) => setSerie(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">Fracción</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="03"
                  value={fraccion}
                  onChange={(e) => setFraccion(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery"
                />
              </div>
            </div>

            {/* Fecha e Importe */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">Fecha del Sorteo</label>
                <input
                  type="date"
                  required
                  value={drawDate}
                  onChange={(e) => setDrawDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">Precio (€)</label>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  max="100"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-lottery/20 focus:border-lottery"
                />
              </div>
            </div>

            {/* Botón de acción */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || number.length !== 5}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-lottery text-white text-xs font-semibold shadow-md shadow-lottery/20 hover:bg-lottery-600 active:scale-98 transition disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Registrando décimo...</span>
                  </>
                ) : (
                  <span>Guardar y Custodiar Décimo</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal del escáner activo */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        mode="TICKET_BARCODE"
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </>
  )
}
