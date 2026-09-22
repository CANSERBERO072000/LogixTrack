'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import localforage from 'localforage'
import { createClient } from '@/lib/supabase/client'
import LogoutButton from '@/components/LogoutButton'
import {
  ScanLine, WifiOff, Wifi, Camera, CheckCircle2,
  PackagePlus, RefreshCw, MapPin, UserCircle2,
} from 'lucide-react'

const colaEscaneos = localforage.createInstance({ name: 'logistica-driver', storeName: 'cola_escaneos' })

interface EscaneoLocal {
  id: string
  guia: string
  tipo: 'entrega' | 'recoleccion_adhoc'
  timestamp: string
  lat: number | null
  lng: number | null
  sincronizado: boolean
}

export default function DriverPage() {
  const supabase = createClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [online, setOnline] = useState(true)
  const [escaneando, setEscaneando] = useState(false)
  const [pendientes, setPendientes] = useState(0)
  const [ultimoResultado, setUltimoResultado] = useState<'ok' | 'error' | null>(null)
  const [guiaManual, setGuiaManual] = useState('')

  // Módulo 1: jornada del motorista
  const [jornadaIniciada, setJornadaIniciada] = useState(false)
  const [placa, setPlaca] = useState('')
  const [nombreMotorista, setNombreMotorista] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setNombreMotorista(data.user?.email?.split('@')[0] ?? 'Motorista')
    })
  }, [supabase])

  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => { actualizarContadorPendientes() }, [])
  useEffect(() => { if (online) sincronizarCola() }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  async function actualizarContadorPendientes() {
    const claves = await colaEscaneos.keys()
    setPendientes(claves.length)
  }

  function reproducirBeep(exito: boolean) {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = exito ? 880 : 220
    gain.gain.value = 0.15
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    if (navigator.vibrate) navigator.vibrate(exito ? 80 : [80, 60, 80])
  }

  const obtenerGPS = () =>
    new Promise<{ lat: number | null; lng: number | null }>((resolve) => {
      if (!navigator.geolocation) return resolve({ lat: null, lng: null })
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 5000 }
      )
    })

  const registrarEscaneo = useCallback(async (guia: string, tipo: 'entrega' | 'recoleccion_adhoc') => {
    const { lat, lng } = await obtenerGPS()
    const registro: EscaneoLocal = { id: crypto.randomUUID(), guia, tipo, timestamp: new Date().toISOString(), lat, lng, sincronizado: false }
    await colaEscaneos.setItem(registro.id, registro)
    await actualizarContadorPendientes()
    reproducirBeep(true)
    setUltimoResultado('ok')
    setTimeout(() => setUltimoResultado(null), 1500)
    if (navigator.onLine) sincronizarCola()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function sincronizarCola() {
    const claves = await colaEscaneos.keys()
    for (const clave of claves) {
      const registro = await colaEscaneos.getItem<EscaneoLocal>(clave)
      if (!registro || registro.sincronizado) continue
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (registro.tipo === 'entrega') {
          await supabase.from('paquetes').update({ estado: 'entregado' }).eq('guia', registro.guia)
        } else {
          await supabase.from('paquetes').insert({ guia: registro.guia, zona: 'sin_asignar', driver_id: userData.user?.id, estado: 'en_ruta', es_imprevisto: true })
        }
        await supabase.from('evidencias_escaneo').insert({
          paquete_id: null,
          usuario_id: userData.user?.id,
          tipo: 'qr_scan',
          storage_path: `pendiente/${registro.guia}`,
          hash_sha256: registro.id,
          timestamp_captura: registro.timestamp,
          latitud: registro.lat,
          longitud: registro.lng,
        })
        await colaEscaneos.removeItem(clave)
      } catch {
        break
      }
    }
    await actualizarContadorPendientes()
  }

  async function iniciarCamara() {
    setEscaneando(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setEscaneando(false)
    }
  }

  function detenerCamara() {
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    setEscaneando(false)
  }

  async function iniciarJornada(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('perfiles').update({ placa_actual: placa }).eq('id', userData.user?.id)
    setJornadaIniciada(true)
  }

  // Módulo 1: pantalla de inicio de jornada
  if (!jornadaIniciada) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 bg-slate-950">
          <span className="text-sm font-medium text-zinc-300">Control Logístico</span>
          <LogoutButton variant="light" compact />
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <form onSubmit={iniciarJornada} className="w-full max-w-sm space-y-5">
            <div className="text-center mb-2">
              <UserCircle2 className="w-14 h-14 text-blue-400 mx-auto mb-3" />
              <h1 className="text-xl font-semibold">Inicio de jornada</h1>
              <p className="text-sm text-zinc-400 mt-1">Hola, {nombreMotorista}. Registra tu unidad para comenzar.</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Número de placa</label>
              <input
                required
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                placeholder="Ej. P123-456"
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3.5 text-base min-h-[52px] placeholder:text-slate-500"
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl py-4 text-base font-semibold min-h-[56px]">
              Iniciar ruta
            </button>
          </form>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-950">
        <div className="flex items-center gap-2">
          {online ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-rose-400" />}
          <span className="text-sm font-medium">{online ? 'En línea' : 'Sin conexión'}</span>
        </div>
        <div className="flex items-center gap-2">
          {pendientes > 0 && (
            <button onClick={sincronizarCola} className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full">
              <RefreshCw className="w-3.5 h-3.5" /> {pendientes} por sincronizar
            </button>
          )}
          <LogoutButton variant="light" compact />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        <div className="w-full max-w-sm aspect-square rounded-2xl bg-black border-2 border-slate-700 overflow-hidden relative flex items-center justify-center">
          {escaneando ? (
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <ScanLine className="w-16 h-16 text-slate-600" />
          )}
          {ultimoResultado === 'ok' && (
            <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-20 h-20 text-emerald-300" />
            </div>
          )}
        </div>

        <div className="w-full max-w-sm grid grid-cols-1 gap-3">
          <button onClick={escaneando ? detenerCamara : iniciarCamara} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-transform rounded-xl py-4 text-base font-semibold min-h-[56px]">
            <Camera className="w-5 h-5" /> {escaneando ? 'Detener escáner' : 'Escanear paquete'}
          </button>
          <button onClick={() => registrarEscaneo(`ADHOC-${Date.now()}`, 'recoleccion_adhoc')} className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 active:scale-[0.98] transition-transform rounded-xl py-4 text-base font-semibold min-h-[56px]">
            <PackagePlus className="w-5 h-5" /> Recolección imprevista
          </button>
        </div>

        <div className="w-full max-w-sm flex gap-2">
          <input value={guiaManual} onChange={(e) => setGuiaManual(e.target.value)} placeholder="Guía manual" className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-base min-h-[48px] placeholder:text-slate-500" />
          <button onClick={() => { if (guiaManual) { registrarEscaneo(guiaManual, 'entrega'); setGuiaManual('') } }} className="px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold min-h-[48px]">OK</button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5" /> Ubicación GPS se adjunta automáticamente a cada evidencia
        </div>
      </main>
    </div>
  )
}
