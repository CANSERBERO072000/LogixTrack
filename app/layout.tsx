import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Control Logístico | Trazabilidad de Última Milla',
  description: 'Sistema de control logístico, trazabilidad y conciliación automática de paquetería por zonas',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
