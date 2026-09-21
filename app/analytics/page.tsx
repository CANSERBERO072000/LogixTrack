'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Package, AlertTriangle, Scale, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface FilaReporte {
  semana: string
  zona: string
  total_paquetes: number
  entregados: number
  inconsistentes: number
  tonelaje_kg: number
  porcentaje_otif: number
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [reporte, setReporte] = useState<FilaReporte[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarReporte()
  }, [])

  async function cargarReporte() {
    setCargando(true)
    const { data } = await supabase
      .from('vw_reporte_semanal_volumen')
      .select('*')
      .order('semana', { ascending: true })
    setReporte(data ?? [])
    setCargando(false)
  }

  const totalPaquetes = reporte.reduce((acc, r) => acc + r.total_paquetes, 0)
  const totalTonelaje = reporte.reduce((acc, r) => acc + r.tonelaje_kg, 0)
  const otifPromedio = reporte.length
    ? Math.round(reporte.reduce((acc, r) => acc + r.porcentaje_otif, 0) / reporte.length)
    : 0
  const totalInconsistencias = reporte.reduce((acc, r) => acc + r.inconsistentes, 0)

  function exportarExcel() {
    const hoja = XLSX.utils.json_to_sheet(reporte)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte Semanal')
    XLSX.writeFile(libro, `reporte_kpis_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Portal Gerencial & KPIs</h1>
          <p className="text-sm text-slate-500">Efectividad OTIF, mermas y volumen por zona</p>
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2"
        >
          <Download className="w-4 h-4" /> Exportar Excel
        </button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Tarjetas KPI */}
        <div className="grid grid-cols-4 gap-4">
          <TarjetaKPI icono={<Package className="w-5 h-5" />} label="Total paquetes" valor={totalPaquetes.toLocaleString()} />
          <TarjetaKPI icono={<TrendingUp className="w-5 h-5" />} label="OTIF promedio" valor={`${otifPromedio}%`} color="emerald" />
          <TarjetaKPI icono={<Scale className="w-5 h-5" />} label="Tonelaje total" valor={`${totalTonelaje.toFixed(1)} kg`} />
          <TarjetaKPI icono={<AlertTriangle className="w-5 h-5" />} label="Inconsistencias" valor={totalInconsistencias.toLocaleString()} color="rose" />
        </div>

        {cargando ? (
          <div className="text-center text-slate-400 py-16 text-sm">Cargando métricas...</div>
        ) : reporte.length === 0 ? (
          <div className="text-center text-slate-400 py-16 text-sm">
            Aún no hay datos suficientes. Los reportes aparecerán cuando existan paquetes procesados.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-medium text-slate-700 mb-4">Efectividad OTIF por semana</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={reporte}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
                  <Tooltip />
                  <Line type="monotone" dataKey="porcentaje_otif" stroke="#2563eb" strokeWidth={2} dot={false} name="OTIF %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-medium text-slate-700 mb-4">Volumen por zona</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reporte}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="zona" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="entregados" fill="#10b981" name="Entregados" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inconsistentes" fill="#f43f5e" name="Inconsistentes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function TarjetaKPI({ icono, label, valor, color = 'slate' }: {
  icono: React.ReactNode; label: string; valor: string; color?: 'slate' | 'emerald' | 'rose'
}) {
  const colores = {
    slate: 'text-slate-600 bg-slate-100',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colores[color]}`}>
        {icono}
      </div>
      <p className="text-2xl font-semibold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
