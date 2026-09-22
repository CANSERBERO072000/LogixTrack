'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PortalHeader from '@/components/PortalHeader'
import {
  Users, Building2, Gauge, ScrollText, Shield,
  Plus, Loader2, Check,
} from 'lucide-react'

type Tab = 'usuarios' | 'sucursales' | 'sla' | 'auditoria'

interface Perfil {
  id: string
  nombre_completo: string
  role: string
  zona_asignada: string | null
  activo: boolean
}

interface Sucursal {
  id: string
  nombre: string
  codigo: string
  zona: string | null
  activa: boolean
}

interface SlaConfig {
  id: string
  nombre: string
  zona: string | null
  umbral_amarillo_horas: number
  umbral_rojo_horas: number
  activo: boolean
}

interface LogAuditoria {
  id: string
  accion: string
  entidad: string | null
  created_at: string
  perfiles: { nombre_completo: string } | null
}

const ROLES = ['admin', 'driver', 'warehouse', 'executive']

export default function AdminPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('usuarios')

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader titulo="Panel de Administración" subtitulo="Usuarios, sucursales, reglas de SLA y auditoría" />

      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit mb-6">
          <TabButton icono={<Users className="w-4 h-4" />} label="Usuarios y roles" activo={tab === 'usuarios'} onClick={() => setTab('usuarios')} />
          <TabButton icono={<Building2 className="w-4 h-4" />} label="Sucursales" activo={tab === 'sucursales'} onClick={() => setTab('sucursales')} />
          <TabButton icono={<Gauge className="w-4 h-4" />} label="Reglas SLA" activo={tab === 'sla'} onClick={() => setTab('sla')} />
          <TabButton icono={<ScrollText className="w-4 h-4" />} label="Auditoría" activo={tab === 'auditoria'} onClick={() => setTab('auditoria')} />
        </div>
      </div>

      <main className="px-6 pb-10 max-w-6xl mx-auto">
        {tab === 'usuarios' && <PanelUsuarios supabase={supabase} />}
        {tab === 'sucursales' && <PanelSucursales supabase={supabase} />}
        {tab === 'sla' && <PanelSla supabase={supabase} />}
        {tab === 'auditoria' && <PanelAuditoria supabase={supabase} />}
      </main>
    </div>
  )
}

function TabButton({ icono, label, activo, onClick }: { icono: React.ReactNode; label: string; activo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${activo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {icono} {label}
    </button>
  )
}

// ---------------------------------------------------------------------
// PANEL: USUARIOS Y ROLES (RBAC)
// ---------------------------------------------------------------------
function PanelUsuarios({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('perfiles').select('id, nombre_completo, role, zona_asignada, activo').order('nombre_completo')
    setPerfiles(data ?? [])
    setCargando(false)
  }

  async function actualizarCampo(id: string, campo: keyof Perfil, valor: string | boolean) {
    setGuardandoId(id)
    await supabase.from('perfiles').update({ [campo]: valor }).eq('id', id)
    await supabase.rpc('registrar_auditoria', { p_accion: 'edicion_perfil', p_entidad: 'perfiles', p_entidad_id: id, p_detalle: { campo, valor } })
    setPerfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)))
    setGuardandoId(null)
  }

  if (cargando) return <Cargando />

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Shield className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{perfiles.length} usuarios registrados</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">Nombre</th>
              <th className="px-5 py-2.5 font-medium">Rol</th>
              <th className="px-5 py-2.5 font-medium">Zona asignada</th>
              <th className="px-5 py-2.5 font-medium">Activo</th>
              <th className="px-5 py-2.5 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-2.5 text-slate-800 font-medium">{p.nombre_completo}</td>
                <td className="px-5 py-2.5">
                  <select value={p.role} onChange={(e) => actualizarCampo(p.id, 'role', e.target.value)} className="rounded-md border border-slate-300 text-xs px-2 py-1.5 bg-white">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-5 py-2.5">
                  <input
                    defaultValue={p.zona_asignada ?? ''}
                    onBlur={(e) => actualizarCampo(p.id, 'zona_asignada', e.target.value)}
                    placeholder="—"
                    className="rounded-md border border-slate-300 text-xs px-2 py-1.5 w-20"
                  />
                </td>
                <td className="px-5 py-2.5">
                  <button onClick={() => actualizarCampo(p.id, 'activo', !p.activo)} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${p.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-5 py-2.5">{guardandoId === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// PANEL: SUCURSALES
// ---------------------------------------------------------------------
function PanelSucursales({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ nombre: '', codigo: '', zona: '' })
  const [creando, setCreando] = useState(false)

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('sucursales').select('*').order('nombre')
    setSucursales(data ?? [])
    setCargando(false)
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevo.nombre || !nuevo.codigo) return
    setCreando(true)
    await supabase.from('sucursales').insert(nuevo)
    await supabase.rpc('registrar_auditoria', { p_accion: 'creacion_sucursal', p_entidad: 'sucursales', p_detalle: nuevo })
    setNuevo({ nombre: '', codigo: '', zona: '' })
    setCreando(false)
    cargar()
  }

  if (cargando) return <Cargando />

  return (
    <div className="space-y-6">
      <form onSubmit={crear} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
          <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Sucursal Tegucigalpa Centro" />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-slate-500 mb-1">Código</label>
          <input required value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="TGU-01" />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-slate-500 mb-1">Zona</label>
          <input value={nuevo.zona} onChange={(e) => setNuevo({ ...nuevo, zona: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="A" />
        </div>
        <button type="submit" disabled={creando} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
          {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{sucursales.length} sucursales</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">Nombre</th>
              <th className="px-5 py-2.5 font-medium">Código</th>
              <th className="px-5 py-2.5 font-medium">Zona</th>
              <th className="px-5 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sucursales.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="px-5 py-2.5 text-slate-800">{s.nombre}</td>
                <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{s.codigo}</td>
                <td className="px-5 py-2.5 text-slate-500">{s.zona ?? '—'}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.activa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {s.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// PANEL: REGLAS DE SLA
// ---------------------------------------------------------------------
function PanelSla({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [reglas, setReglas] = useState<SlaConfig[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ nombre: '', zona: '', umbral_amarillo_horas: 24, umbral_rojo_horas: 48 })
  const [guardado, setGuardado] = useState(false)

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('sla_config').select('*').order('nombre')
    setReglas(data ?? [])
    setCargando(false)
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevo.nombre) return
    await supabase.from('sla_config').insert(nuevo)
    await supabase.rpc('registrar_auditoria', { p_accion: 'creacion_sla', p_entidad: 'sla_config', p_detalle: nuevo })
    setNuevo({ nombre: '', zona: '', umbral_amarillo_horas: 24, umbral_rojo_horas: 48 })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1500)
    cargar()
  }

  if (cargando) return <Cargando />

  return (
    <div className="space-y-6">
      <form onSubmit={crear} className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-5 gap-3 items-end">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Nombre de la regla</label>
          <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="SLA estándar" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Zona (opcional)</label>
          <input value={nuevo.zona} onChange={(e) => setNuevo({ ...nuevo, zona: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Todas" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">🟡 Alerta (hrs)</label>
          <input type="number" value={nuevo.umbral_amarillo_horas} onChange={(e) => setNuevo({ ...nuevo, umbral_amarillo_horas: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">🔴 Crítico (hrs)</label>
          <input type="number" value={nuevo.umbral_rojo_horas} onChange={(e) => setNuevo({ ...nuevo, umbral_rojo_horas: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="col-span-5 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
          {guardado ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Guardar regla
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4">
        {reglas.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">{r.nombre}</h3>
              <span className="text-xs text-slate-400">{r.zona ?? 'Todas las zonas'}</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-amber-600">🟡 {r.umbral_amarillo_horas}h</span>
              <span className="flex items-center gap-1.5 text-rose-600">🔴 {r.umbral_rojo_horas}h</span>
            </div>
          </div>
        ))}
        {reglas.length === 0 && <p className="text-sm text-slate-400 col-span-2 text-center py-8">Aún no hay reglas de SLA configuradas.</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// PANEL: AUDITORÍA
// ---------------------------------------------------------------------
function PanelAuditoria({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('auditoria')
      .select('id, accion, entidad, created_at, perfiles(nombre_completo)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs((data as unknown as LogAuditoria[]) ?? [])
        setCargando(false)
      })
  }, [supabase])

  if (cargando) return <Cargando />

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">Últimas 50 acciones registradas</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
            <th className="px-5 py-2.5 font-medium">Fecha</th>
            <th className="px-5 py-2.5 font-medium">Usuario</th>
            <th className="px-5 py-2.5 font-medium">Acción</th>
            <th className="px-5 py-2.5 font-medium">Entidad</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-slate-50">
              <td className="px-5 py-2.5 text-xs text-slate-500">{new Date(l.created_at).toLocaleString('es-HN')}</td>
              <td className="px-5 py-2.5 text-slate-700">{l.perfiles?.nombre_completo ?? '—'}</td>
              <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{l.accion}</td>
              <td className="px-5 py-2.5 text-slate-500">{l.entidad ?? '—'}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Aún no hay actividad registrada.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Cargando() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  )
}
