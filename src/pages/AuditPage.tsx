import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { Shield, Loader2, Clock } from 'lucide-react'

type AuditEvent = Database['public']['Tables']['audit_events']['Row']

export const AuditPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAudit() {
      try {
        const { data, error } = await supabase
          .from('audit_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        setEvents(data || [])
      } catch (err) {
        console.error('Error cargando eventos de auditoría:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadAudit()
  }, [])

  return (
    <div className="space-y-6 pb-12 max-w-xl mx-auto">
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Auditoría Inmutable</h2>
        <p className="text-xs text-gray-500">
          Registro criptográfico de creación, cesiones, renuncias y cobro de premios
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-lottery" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Sin registros de auditoría aún</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Cada vez que registres un décimo o repartas participaciones, quedará constancia inmutable en la base de datos PostgreSQL.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 divide-y divide-gray-100">
          {events.map((evt) => (
            <div key={evt.id} className="py-3 px-2 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-mono font-bold text-lottery bg-lottery-50 px-2 py-0.5 rounded text-[11px]">
                  {evt.action}
                </span>
                {evt.percentage !== null && (
                  <p className="text-[11px] text-gray-600 font-medium pt-1">
                    Porcentaje: {evt.percentage}%
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(evt.created_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
