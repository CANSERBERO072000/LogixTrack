import Image from 'next/image'
import LogoutButton from './LogoutButton'

interface PortalHeaderProps {
  titulo: string
  subtitulo: string
  variant?: 'light' | 'dark'
  acciones?: React.ReactNode
}

export default function PortalHeader({ titulo, subtitulo, variant = 'dark', acciones }: PortalHeaderProps) {
  const esOscuro = variant === 'light'
  return (
    <header
      className={`px-6 py-4 flex items-center justify-between border-b ${
        esOscuro ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="Control Logístico" width={36} height={36} className="rounded-md" />
        <div>
          <h1 className={`text-xl font-semibold ${esOscuro ? 'text-white' : 'text-slate-900'}`}>{titulo}</h1>
          <p className={`text-sm ${esOscuro ? 'text-zinc-400' : 'text-slate-500'}`}>{subtitulo}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {acciones}
        <LogoutButton variant={variant} />
      </div>
    </header>
  )
}
