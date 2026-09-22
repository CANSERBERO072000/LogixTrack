'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginScreen />
    </Suspense>
  )
}

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    </div>
  )
}

function LoginScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    params.get('error') === 'cuenta_inactiva'
      ? 'Tu cuenta está inactiva. Contacta al administrador.'
      : null
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.')
      setLoading(false)
      return
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const destinoPorRol: Record<string, string> = {
      admin: '/dashboard',
      executive: '/analytics',
      driver: '/driver',
      warehouse: '/warehouse',
    }

    const redirect = params.get('redirect')
    router.push(redirect || destinoPorRol[perfil?.role ?? ''] || '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950">
      {/* Panel izquierdo: imagen corporativa con overlay de marca */}
      <div className="hidden lg:block relative overflow-hidden">
        <Image
          src="/login-bg.jpg"
          alt="Operación logística"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/40 to-slate-950/80" />
        <div className="relative h-full flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Control Logístico" width={44} height={44} className="rounded-lg" />
            <span className="text-white font-semibold text-lg tracking-tight">Control Logístico</span>
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-white leading-tight max-w-md">
              Trazabilidad end-to-end de última milla, en tiempo real.
            </h2>
            <p className="text-slate-300 text-sm mt-3 max-w-sm">
              Manifiestos, escaneo en ruta, bodega y KPIs unificados en un solo sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden flex-col items-center mb-8">
            <Image src="/logo.png" alt="Control Logístico" width={56} height={56} className="rounded-xl mb-3" />
            <h1 className="text-xl font-semibold text-slate-900">Control Logístico</h1>
          </div>

          <div className="mb-8 hidden lg:block">
            <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h1>
            <p className="text-sm text-slate-500 mt-1">Accede con tu correo corporativo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="nombre@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            Acceso restringido según rol: Administrador · Coordinador · Motorista · Bodega · Gerencia
          </p>
        </div>
      </div>
    </div>
  )
}
