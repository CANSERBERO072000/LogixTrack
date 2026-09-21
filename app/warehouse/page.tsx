'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, ScanBarcode, AlertOctagon, PackageCheck, Boxes } from 'lucide-react'

const ZONAS = [
  { id: 'A', nombre: 'Soporte', color: 'bg-blue-600' },
  { id: 'B', nombre: 'Re-despacho', color: 'bg-amber-600' },
  { id: 'C', nombre: 'Devoluciones', color: 'bg-rose-600' },
]

export default function WarehousePage() {
  const supabase = createClient()
  const [zonaActiva, setZonaActiva] = useState(ZONAS[0])
  const [unidadCheckIn, setUnidadCheckIn] = useState('')
  const [ultimoEscaneo, setUltimoEscaneo] = useState<string | null>(null)
  const [contadorRafaga, setContadorRafaga] = useState(0)
  const [mostrarActa, setMostrarActa] = useState(false)

  async function registrarEscaneoRafaga(guia: string) {
    setUltimoEscaneo(guia)
    setContadorRafaga((c) => c + 1)

    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('paquetes')
      .update({ estado: 'en_bodega', bodeguero_receptor_id: userData.user?.id, zona: zonaActiva.id })
      .eq('guia', guia)
  }

  async function crearActaInconsistencia(tipo: string, descripcion: string) {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('inconsistencias').insert({
      reportado_por: userData.user?.id,
      tipo,
      descripcion,
      zona: zonaActiva.id,
      severidad: 'media',
    })
    setMostrarActa(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Indicador gigante de zona */}
      <div className={`rounded-3xl ${zonaActiva.color} p-8 mb-6 flex items-center justify-between`}>
        <div>
          <p className="text-sm uppercase tracking-widest text-white/70">Zona activa</p>
          <h1 className="text-6xl font-black leading-none mt-1">Área {zonaActiva.id}</h1>
          <p className="text-xl font-medium mt-1">{zonaActiva.nombre}</p>
        </div>
        <Boxes className="w-24 h-24 text-white/30" />
      </div>

      {/* Selector de zona (botones táctiles enormes) */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {ZONAS.map((z) => (
          <button
            key={z.id}
            onClick={() => setZonaActiva(z)}
            className={`rounded-2xl py-6 text-2xl font-bold border-4 transition-colors
              ${zonaActiva.id === z.id ? 'border-white bg-zinc-800' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}
          >
            {z.id}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Check-in de unidad */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <Truck className="w-5 h-5" /> Check-In de Unidad
          </h2>
          <input
            value={unidadCheckIn}
            onChange={(e) => setUnidadCheckIn(e.target.value)}
            placeholder="Placa / ID de unidad"
            className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-4 text-xl mb-3"
          />
          <button className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl py-4 text-xl font-bold min-h-[56px]">
            Confirmar ingreso
          </button>
        </div>

        {/* Escaneo en ráfaga */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <ScanBarcode className="w-5 h-5" /> Escaneo en Ráfaga
          </h2>
          <div className="bg-black rounded-xl aspect-video flex items-center justify-center mb-3 border border-zinc-800">
            <ScanBarcode className="w-16 h-16 text-zinc-700" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Último: <span className="font-mono text-white">{ultimoEscaneo ?? '—'}</span></span>
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-semibold">
              {contadorRafaga} escaneados
            </span>
          </div>
          <button
            onClick={() => registrarEscaneoRafaga(`SIM-${Math.floor(Math.random() * 100000)}`)}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-500 rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <PackageCheck className="w-4 h-4" /> Simular escaneo (demo)
          </button>
        </div>
      </div>

      {/* Actas digitales de inconsistencias */}
      <div className="mt-6">
        <button
          onClick={() => setMostrarActa(true)}
          className="w-full flex items-center justify-center gap-2 bg-rose-600/20 border-2 border-rose-600 text-rose-300 rounded-2xl py-5 text-lg font-bold"
        >
          <AlertOctagon className="w-6 h-6" /> Generar Acta de Inconsistencia
        </button>
      </div>

      {mostrarActa && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-700">
            <h3 className="text-xl font-bold mb-4">Nueva Acta de Inconsistencia</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['faltante', 'sobrante', 'dañado'].map((t) => (
                <button
                  key={t}
                  onClick={() => crearActaInconsistencia(t, `Reportado en zona ${zonaActiva.id}`)}
                  className="bg-zinc-800 hover:bg-zinc-700 rounded-xl py-4 font-semibold capitalize"
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setMostrarActa(false)} className="w-full text-zinc-400 py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
