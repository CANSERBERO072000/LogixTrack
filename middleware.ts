import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTAS_POR_ROL: Record<string, string[]> = {
  '/dashboard': ['admin', 'executive'],
  '/driver': ['driver', 'admin'],
  '/warehouse': ['warehouse', 'admin'],
  '/history': ['admin', 'executive', 'warehouse'],
  '/analytics': ['admin', 'executive'],
  '/admin': ['admin'],
}

const HOME_POR_ROL: Record<string, string> = {
  admin: '/dashboard',
  executive: '/analytics',
  driver: '/driver',
  warehouse: '/warehouse',
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const esRutaProtegida = Object.keys(RUTAS_POR_ROL).some((r) => path.startsWith(r))

  if (!user && esRutaProtegida) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  if (user && esRutaProtegida) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('role, activo')
      .eq('id', user.id)
      .single()

    if (!perfil || !perfil.activo) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'cuenta_inactiva')
      return NextResponse.redirect(url)
    }

    const seccion = Object.keys(RUTAS_POR_ROL)
      .sort((a, b) => b.length - a.length)
      .find((r) => path.startsWith(r))!
    const rolesPermitidos = RUTAS_POR_ROL[seccion]

    if (!rolesPermitidos.includes(perfil.role)) {
      const url = request.nextUrl.clone()
      url.pathname = HOME_POR_ROL[perfil.role] ?? '/login'
      return NextResponse.redirect(url)
    }
  }

  if (user && path === '/login') {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    url.pathname = HOME_POR_ROL[perfil?.role ?? ''] ?? '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/driver/:path*',
    '/warehouse/:path*',
    '/history/:path*',
    '/analytics/:path*',
    '/admin/:path*',
    '/login',
  ],
}
