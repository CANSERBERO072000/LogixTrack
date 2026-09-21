'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, MapPin, Camera, PenTool, ScanLine, Clock, PackageX } from 'lucide-react'

interface EventoCustodia {
  tipo: 'foto' | 'firma' | 'qr_scan'
  timestamp_captura: string
  latitud: number | null
  longitud: number | null
  usuario: string
  usuario_role: string
  storage_path: string
}

const ICONOS = { foto: Camera, firma: PenTool, qr_scan: ScanLine }

export default function HistoryPage() {
  const supabase = createClient()
  const [guia, setGuia] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [eventos, setEventos] = useState<EventoCustodia[]>([])
  const [noEncontrado, setNoEncontrado] = useState(false)

  async function buscarPaquete() {
    if (!guia.trim()) return
    setBuscando(true)
    setNoEncontrado(false)

    const { data: paquete } = await supabase
      .from('paquetes')
      .select('id')
      .eq('guia', guia.trim())
      .single()

    if (!paquete) {
      setEventos([])
      setNoEncontrado(true)
      setBuscando(false)
      return
    }

    const { data } = await supabase
      .from('vw_cadena_custodia')
      .select('*')
      .eq('paquete_id', paquete.id)
      .order('timestamp_captura', { ascending: true })

    setEventos(data ?? [])
    setBuscando(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Histórico Global</h1>
        <p className="text-sm text-slate-500">Cadena de custodia completa por número de guía</p>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        <div className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={guia}
              onChange={(e) => setGuia(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarPaquete()}
              placeholder="Ingresa el número de guía..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            onClick={buscarPaquete}
            disabled={buscando}
            className="px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium disabled:opacity-60"
          >
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {noEncontrado && (
          <div className="flex flex-col items-center text-slate-400 py-16">
            <PackageX className="w-10 h-10 mb-3" />
            <p className="text-sm">No se encontró ningún paquete con esa guía</p>
          </div>
        )}

        {eventos.length > 0 && (
          <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
            {eventos.map((ev, i) => {
              const Icono = ICONOS[ev.tipo]
              return (
                <div key={i} className="relative">
                  <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow" />
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 capitalize">
                        <Icono className="w-4 h-4 text-blue-600" /> {ev.tipo.replace('_', ' ')}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" /> {new Date(ev.timestamp_captura).toLocaleString('es-HN')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Registrado por <span className="font-medium">{ev.usuario}</span>{' '}
                      <span className="text-xs text-slate-400 capitalize">({ev.usuario_role})</span>
                    </p>
                    {ev.latitud && ev.longitud && (
                      <p className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <MapPin className="w-3 h-3" /> {ev.latitud.toFixed(5)}, {ev.longitud.toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
