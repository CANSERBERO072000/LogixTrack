# Control Logístico — Trazabilidad y Conciliación de Paquetería

Sistema Web + PWA Móvil construido con **Next.js 14 (App Router)**, **Supabase** (PostgreSQL + Auth + Storage) y **Tailwind CSS**. Cero servidores propios, cero descargas para el usuario final: se despliega directo a Vercel.

## 📁 Estructura del proyecto

```
proyecto-logistica/
├── app/
│   ├── login/page.tsx        Autenticación unificada
│   ├── dashboard/page.tsx    Portal Coordinador (Excel + semáforo)
│   ├── driver/page.tsx       PWA Motorista (offline-first)
│   ├── warehouse/page.tsx    Portal Bodega (kiosco)
│   ├── history/page.tsx      Histórico / cadena de custodia
│   ├── analytics/page.tsx    KPIs gerenciales
│   ├── layout.tsx / page.tsx / globals.css
├── lib/
│   ├── excel.ts               Parseo Aranda + exportador de cierre
│   └── supabase/client.ts, server.ts
├── middleware.ts              Protección de rutas por rol
├── schema.sql                 Script completo de base de datos
├── public/manifest.json       Manifest de la PWA
└── package.json
```

## 🚀 Despliegue Express (15 minutos)

### 1. Crear el proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) → **New Project**.
2. Copia la **Project URL** y la **anon public key** (Settings → API).
3. Abre el **SQL Editor** → pega el contenido completo de `schema.sql` → **Run**.
   - Esto crea los enums, tablas, triggers, vistas, políticas RLS y los buckets de Storage (`evidencias`, `firmas`).
4. Crea los primeros usuarios en **Authentication → Users → Add User** (o desde tu propia UI de registro), y asígnales el rol correcto actualizando la columna `role` en la tabla `perfiles` desde el **Table Editor**.

### 2. Subir el código a GitHub
```bash
cd proyecto-logistica
git init
git add .
git commit -m "Sistema de control logístico inicial"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### 3. Desplegar en Vercel
1. Ve a [vercel.com/new](https://vercel.com/new) e importa el repositorio de GitHub.
2. En **Environment Variables**, agrega:

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | La Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La anon public key de Supabase |

3. Click en **Deploy**. Vercel detecta Next.js automáticamente — no requiere configuración adicional.
4. Cuando termine, tendrás una URL pública (`https://tu-proyecto.vercel.app`) lista para compartir con coordinadores, motoristas y bodega.

### 4. Instalar la PWA en los teléfonos de los motoristas
1. Abre `https://tu-proyecto.vercel.app/driver` desde Chrome/Safari en el teléfono.
2. Toca **"Agregar a pantalla de inicio"** — no requiere App Store ni Play Store.
3. La app funciona sin señal gracias a IndexedDB (`localforage`); sincroniza automáticamente al recuperar conexión.

## 🔐 Notas de seguridad importantes

- Todas las tablas tienen **Row Level Security (RLS)** activado desde el primer `schema.sql` — nunca lo desactives en producción.
- Los buckets de Storage son **privados**; las evidencias solo son accesibles por usuarios autenticados con el rol correspondiente.
- El `middleware.ts` valida la sesión **en cada request** a rutas protegidas y redirige según el rol almacenado en `perfiles.role`.
- Cambia la anon key solo si sospechas que fue expuesta; nunca subas la `service_role key` al repositorio ni al frontend.

## 🧩 Piezas pendientes de integración real (marcadas en el código)

Para mantener el código legible y enfocado en la arquitectura, algunas piezas quedaron como puntos de extensión explícitos:
- **Decodificación real de QR/código de barras** en `/app/driver`: se recomienda `@zxing/browser` o `jsQR` leyendo frames de `<video>` a `<canvas>`.
- **Compresión y marca de agua de fotos** (timestamp/GPS/usuario) antes de subir a Storage: usar `canvas` en cliente antes de `supabase.storage.upload()`.
- **Resolución de `paquete_id` por guía** en la sincronización offline: se recomienda una función RPC de Postgres (`SECURITY DEFINER`) que reciba la guía y devuelva/cree el registro correspondiente de forma atómica.
- **Generación de PDF** para reportes semanales en `/analytics`: puede añadirse con `@react-pdf/renderer` o llamando a un endpoint serverless.

Estas piezas no afectan la arquitectura de datos, seguridad ni RBAC — son integraciones de librerías específicas que conviene ajustar según el hardware real de escaneo utilizado.
