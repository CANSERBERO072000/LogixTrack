'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Loader2 } from 'lucide-react'

interface LogoutButtonProps {
  variant?: 'light' | 'dark' // 'light' para fondos oscuros (bodega/motorista), 'dark' para fondos claros
  compact?: boolean
}

export default function LogoutButton({ variant = 'dark', compact = false }: LogoutButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const estilos =
    variant === 'light'
      ? 'text-zinc-300 hover:text-white hover:bg-white/10'
      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      title="Cerrar sesión"
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${estilos}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      {!compact && <span>Cerrar sesión</span>}
    </button>
  )
}
