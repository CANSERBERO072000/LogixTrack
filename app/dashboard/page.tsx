'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parsearManifiestoAranda, exportarCierreAranda, calcularHashArchivo, type FilaConciliacion } from '@/lib/excel'
import PortalHeader from '@/components/PortalHeader'
import {
  UploadCloud, CheckCircle2, XCircle, AlertTriangle,
  FileSpreadsheet, Download, Loader2, PackageSearch,
} from 'lucide-react'

type Filtro = 'todos' | 'conciliado' | 'faltante' | 'sobrante'

export default function DashboardPage() {
  const supabase = createClient()
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [filas, setFilas] = useState<FilaConciliacion[]>([])
  const [erroresParseo, setErroresParseo] = useState<{ fila: number; motivo: string }[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const procesarArchivo = useCallback(async (file: File) => {
    setProcesando(true)
    setErroresParseo([])

    const hash = await calcularHashArchivo(file)
    const { filasValidas, filasError } = await parsearManifiestoAranda(file)
    setErroresParseo(filasError.map(({ fila, motivo }) => ({ fila, motivo })))

    const guias = filasValidas.map((f) => f.guia)
    const { data: paquetesExistentes } = await supabase
      .from('paquetes')
      .select('guia, id, estado')
      .in('guia', guias.length > 0 ? guias : [''])

    const mapaExistentes = new Map((paquetesExistentes ?? []).map((p) => [p.guia, p]))

    const filasConciliadas: FilaConciliacion[] = filasValidas.map((f) => {
      const existente = mapaExistentes.get(f.guia)
      if (!existente) return { ...f, estado: 'faltante' as const }
      if (existente.estado === 'entregado' || existente.estado === 'en_bodega') {
        return { ...f, estado: 'conciliado' as const, paquete_id: existente.id }
      }
      return { ...f, estado: 'faltante' as const, paquete_id: existente.id }
    })

    setFilas(filasConciliadas)

    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('manifiestos_aranda').insert({
      nombre_archivo: file.name,
      cargado_por: userData.user?.id,
      total_filas: filasValidas.length + filasError.length,
      filas_validas: filasValidas.length,
      filas_error: filasError.length,
      hash_archivo: hash,
    })

    await supabase.rpc('registrar_auditoria', {
      p_accion: 'carga_manifiesto',
      p_entidad: 'manifiestos_aranda',
      p_detalle: { archivo: file.name, filas: filasValidas.length },
    })

    setProcesando(false)
  }, [supabase])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) procesarArchivo(file)
  }, [procesarArchivo])

  const filasFiltradas = filas.filter((f) => filtro === 'todos' || f.estado === filtro)
  const conteos = {
    conciliado: filas.filter((f) => f.estado === 'conciliado').length,
    faltante: filas.filter((f) => f.estado === 'faltante').length,
    sobrante: filas.filter((f) => f.estado === 'sobrante').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader titulo="Portal Coordinador" subtitulo="Conciliación automática de manifiestos Aranda" />

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-colors bg-white ${arrastrando ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}
        >
          {procesando ? (
            <>
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
              <p className="text-sm text-slate-600">Procesando manifiesto y contra-validando...</p>
            </>
          ) : (
            <>
              <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">Arrastra el Excel de Aranda aquí, o</p>
              <label className="mt-2 text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                selecciona un archivo
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && procesarArchivo(e.target.files[0])} />
              </label>
              <p className="text-xs text-slate-400 mt-3">Formatos soportados: .xlsx, .xls, .csv</p>
            </>
          )}
        </div>

        {erroresParseo.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {erroresParseo.length} filas con errores de formato
            </p>
            <ul className="text-xs text-amber-700 space-y-1 max-h-32 overflow-y-auto">
              {erroresParseo.slice(0, 10).map((e, i) => <li key={i}>Fila {e.fila}: {e.motivo}</li>)}
            </ul>
          </div>
        )}

        {filas.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <TarjetaSemaforo label="Conciliado" valor={conteos.conciliado} color="emerald" icon={<CheckCircle2 className="w-5 h-5" />} activo={filtro === 'conciliado'} onClick={() => setFiltro(filtro === 'conciliado' ? 'todos' : 'conciliado')} />
              <TarjetaSemaforo label="Faltante" valor={conteos.faltante} color="rose" icon={<XCircle className="w-5 h-5" />} activo={filtro === 'faltante'} onClick={() => setFiltro(filtro === 'faltante' ? 'todos' : 'faltante')} />
              <TarjetaSemaforo label="Sobrante/Imprevisto" valor={conteos.sobrante} color="amber" icon={<AlertTriangle className="w-5 h-5" />} activo={filtro === 'sobrante'} onClick={() => setFiltro(filtro === 'sobrante' ? 'todos' : 'sobrante')} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{filasFiltradas.length} paquetes {filtro !== 'todos' ? `(${filtro})` : ''}</span>
                </div>
                <button onClick={() => exportarCierreAranda(filas)} className="flex items-center gap-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3.5 py-2 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Exportar cierre
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-5 py-2.5 font-medium">Guía</th>
                      <th className="px-5 py-2.5 font-medium">Destinatario</th>
                      <th className="px-5 py-2.5 font-medium">Zona</th>
                      <th className="px-5 py-2.5 font-medium">Peso (kg)</th>
                      <th className="px-5 py-2.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((f, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{f.guia}</td>
                        <td className="px-5 py-2.5 text-slate-700">{f.destinatario || '—'}</td>
                        <td className="px-5 py-2.5 text-slate-500">{f.zona}</td>
                        <td className="px-5 py-2.5 text-slate-500">{f.peso_kg ?? '—'}</td>
                        <td className="px-5 py-2.5"><Badge estado={f.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {filas.length === 0 && !procesando && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <PackageSearch className="w-10 h-10 mb-3" />
            <p className="text-sm">Sube un manifiesto para ver el estado de conciliación</p>
          </div>
        )}
      </main>
    </div>
  )
}

function TarjetaSemaforo({ label, valor, color, icon, activo, onClick }: {
  label: string; valor: number; color: 'emerald' | 'rose' | 'amber'; icon: React.ReactNode; activo: boolean; onClick: () => void
}) {
  const colores = { emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200', rose: 'text-rose-600 bg-rose-50 border-rose-200', amber: 'text-amber-600 bg-amber-50 border-amber-200' }
  return (
    <button onClick={onClick} className={`text-left rounded-2xl border p-5 bg-white transition-shadow hover:shadow-sm ${activo ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border mb-3 ${colores[color]}`}>{icon}</div>
      <p className="text-2xl font-semibold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </button>
  )
}

function Badge({ estado }: { estado: 'conciliado' | 'faltante' | 'sobrante' }) {
  const estilos = { conciliado: 'bg-emerald-50 text-emerald-700 border-emerald-200', faltante: 'bg-rose-50 text-rose-700 border-rose-200', sobrante: 'bg-amber-50 text-amber-700 border-amber-200' }
  const etiquetas = { conciliado: '🟢 Conciliado', faltante: '🔴 Faltante', sobrante: '🟡 Sobrante' }
  return <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-md border ${estilos[estado]}`}>{etiquetas[estado]}</span>
}
