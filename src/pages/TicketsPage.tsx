import React from 'react'
import { Ticket, Plus, Sparkles } from 'lucide-react'

export const TicketsPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Banner de bienvenida y acción rápida */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Mis Billetes</h2>
          <p className="text-xs text-gray-500">
            Tus décimos custodiados y participaciones compartidas
          </p>
        </div>
        <button
          type="button"
          onClick={() => alert('La captura y escaneo de décimos se activará en la Fase 3.')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lottery text-white text-xs font-semibold shadow-sm shadow-lottery/30 hover:bg-lottery-600 active:scale-95 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Añadir Décimo</span>
        </button>
      </div>

      {/* Estado vacío elegante */}
      <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-lottery-50 text-lottery flex items-center justify-center">
          <Ticket className="w-7 h-7" />
        </div>
        <div className="max-w-xs mx-auto space-y-1">
          <h3 className="text-sm font-bold text-gray-900">Aún no tienes billetes registrados</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Escanea el código de barras GS1-128 de tu décimo o añade los números manualmente para comenzar a compartir participaciones.
          </p>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold-50 text-gold-700 text-[11px] font-medium border border-gold-200">
            <Sparkles className="w-3 h-3 text-gold-500" /> Próxima activación: Fase 3 (Escáner y Boletos Realistas)
          </span>
        </div>
      </div>
    </div>
  )
}
