# Control Logístico — Trazabilidad y Gestión de Última Milla

Sistema Web + PWA Móvil construido con **Next.js 14 (App Router)**, **Supabase** (PostgreSQL + Auth + Storage) y **Tailwind CSS**.

## 📁 Estructura del proyecto

```
proyecto-logistica/
├── app/
│   ├── login/page.tsx        Autenticación (con imagen de marca)
│   ├── admin/page.tsx        Panel de Administración: usuarios/RBAC, sucursales, SLA, auditoría
│   ├── dashboard/page.tsx    Portal Coordinador (Excel + semáforo)
│   ├── driver/page.tsx       PWA Motorista (inicio de jornada + offline-first)
│   ├── warehouse/page.tsx    Portal Bodega (kiosco)
│   ├── history/page.tsx      Histórico / cadena de custodia
│   ├── analytics/page.tsx    KPIs gerenciales
│   ├── icon.png               Favicon (tu logo)
│   ├── layout.tsx / page.tsx / globals.css
├── components/
│   ├── LogoutButton.tsx       Cierre de sesión reutilizable
│   └── PortalHeader.tsx       Header unificado con logo + logout
├── lib/
│   ├── excel.ts
│   └── supabase/client.ts, server.ts
├── middleware.ts              Protección de rutas por rol (incluye /admin)
├── schema.sql                 Script base de base de datos
├── schema_extension.sql       Extensión: sucursales, SLA, catálogos, auditoría
├── public/
│   ├── logo.png                Tu logo
│   ├── login-bg.jpg            Foto de fondo del login
│   ├── icon-192.png / icon-512.png
│   └── manifest.json
└── package.json
```

## 🚀 Despliegue Express

### 1. Base de datos en Supabase
1. **SQL Editor** → pega y ejecuta **`schema.sql`** completo → Run.
2. Luego pega y ejecuta **`schema_extension.sql`** completo → Run.
   - Esto agrega: `sucursales`, `sla_config`, `catalogos` (motivos de no entrega), `auditoria`, y la función `registrar_auditoria()` que usa el panel de administración.

### 2. Sube el código a GitHub y despliega en Vercel
Igual que antes — commit, push a `main`, importar en Vercel con las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3. Accede al Panel de Administración
Inicia sesión con un usuario `role = admin` y visita `/admin`. Desde ahí puedes:
- Cambiar el rol y la zona de cualquier usuario sin tocar la base de datos manualmente.
- Dar de alta sucursales/bases de operación.
- Configurar umbrales de alerta de SLA (🟡 alerta / 🔴 crítico) por zona.
- Ver la bitácora de auditoría (quién hizo qué y cuándo).

## 🎨 Identidad visual

- **Favicon**: se toma automáticamente de `app/icon.png` (tu logo).
- **Login**: panel dividido — tu foto de bodega/camión a la izquierda con overlay de marca, formulario a la derecha.
- **Logo**: usado en el header de cada portal (`components/PortalHeader.tsx`) y en el login.

## 🔓 Cierre de sesión

Todos los portales (`/dashboard`, `/driver`, `/warehouse`, `/history`, `/analytics`, `/admin`) tienen un botón de **Cerrar sesión** visible en el header. En `/driver` y `/warehouse` (fondo oscuro) se muestra en variante clara para mantener contraste.

## 🧩 Mapeo de tu especificación de 6 módulos

| Módulo solicitado | Dónde vive en el código |
|---|---|
| 1. Autenticación y perfil del motorista | `/app/driver` — pantalla de inicio de jornada (placa + confirmación) antes de habilitar el escáner |
| 2. Manifiesto y escaneo masivo | `/app/dashboard` (carga de Excel) + `/app/driver` (escaneo). El código QR maestro y el cierre de lote están como columnas listas en `manifiestos_aranda` (`codigo_qr_maestro`, `cerrado`) — falta la UI de "Generar Manifiesto" |
| 3. Ejecución en ruta / offline | `/app/driver` — cola IndexedDB con `localforage`, sincronización automática al recuperar señal, catálogo de motivos de no entrega ya cargado en `catalogos` |
| 4. Entrega y cierre en bodega | `/app/warehouse` — escaneo en ráfaga, check-in de unidad. Falta: lectura del QR maestro para cambio de estado masivo y firma digital en pantalla |
| 5. Panel de coordinadores | `/app/dashboard` + `/app/analytics` |
| 6. Panel de administración | `/app/admin` — usuarios/RBAC, sucursales, SLA, auditoría, catálogos dinámicos |

## 🧩 Piezas pendientes de integración real

- **Decodificación real de QR/código de barras** (`@zxing/browser` o `jsQR`).
- **OCR de respaldo** para tickets dañados (Módulo 2) — se integraría con una API de visión (ej. Google Vision o Tesseract.js en cliente).
- **QR Maestro por lote** — la estructura de datos ya existe (`codigo_qr_maestro` en `manifiestos_aranda`); falta la pantalla de "Generar Manifiesto" que agrupe los escaneos sueltos.
- **Firma digital en pantalla** (canvas táctil) para el POD en bodega.
- **Alertas de SLA en vivo** en el dashboard — la tabla `sla_config` ya tiene los umbrales; falta el cálculo en tiempo real comparando `paquetes.created_at` contra las reglas.
- **Compresión y marca de agua de fotos** antes de subir a Storage.
