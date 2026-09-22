-- =====================================================================
-- EXTENSIÓN DEL SCHEMA — Módulo de Administración (Backoffice)
-- Ejecutar DESPUÉS del schema.sql original, en el SQL Editor de Supabase
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SUCURSALES / BASES DE OPERACIÓN
-- ---------------------------------------------------------------------
create table if not exists public.sucursales (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  codigo text not null unique,
  direccion text,
  zona text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sucursales enable row level security;

drop policy if exists "sucursales_admin_full" on public.sucursales;
create policy "sucursales_admin_full" on public.sucursales
  for all using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

drop policy if exists "sucursales_lectura_autenticados" on public.sucursales;
create policy "sucursales_lectura_autenticados" on public.sucursales
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- 2. CONFIGURACIÓN DE REGLAS DE SLA
-- ---------------------------------------------------------------------
create table if not exists public.sla_config (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  zona text,                                  -- null = aplica a todas las zonas
  umbral_amarillo_horas numeric(5,2) not null default 24,
  umbral_rojo_horas numeric(5,2) not null default 48,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sla_config enable row level security;

drop policy if exists "sla_config_admin_full" on public.sla_config;
create policy "sla_config_admin_full" on public.sla_config
  for all using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

drop policy if exists "sla_config_lectura_autenticados" on public.sla_config;
create policy "sla_config_lectura_autenticados" on public.sla_config
  for select using (auth.role() = 'authenticated');

drop trigger if exists trg_sla_config_updated_at on public.sla_config;
create trigger trg_sla_config_updated_at
  before update on public.sla_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. CAMPOS DINÁMICOS (catálogos configurables sin tocar código)
-- ---------------------------------------------------------------------
create table if not exists public.catalogos (
  id uuid primary key default uuid_generate_v4(),
  categoria text not null,                    -- ej: 'motivo_no_entrega', 'tipo_incidencia'
  valor text not null,
  etiqueta text not null,
  orden int not null default 0,
  activo boolean not null default true,
  unique (categoria, valor)
);

alter table public.catalogos enable row level security;

drop policy if exists "catalogos_admin_full" on public.catalogos;
create policy "catalogos_admin_full" on public.catalogos
  for all using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

drop policy if exists "catalogos_lectura_autenticados" on public.catalogos;
create policy "catalogos_lectura_autenticados" on public.catalogos
  for select using (auth.role() = 'authenticated');

-- Catálogo inicial de motivos de no entrega (Módulo 3)
insert into public.catalogos (categoria, valor, etiqueta, orden) values
  ('motivo_no_entrega', 'rechazado_dano', 'Rechazado por daño', 1),
  ('motivo_no_entrega', 'tienda_cerrada', 'Tienda cerrada', 2),
  ('motivo_no_entrega', 'destinatario_ausente', 'Destinatario ausente', 3),
  ('motivo_no_entrega', 'direccion_incorrecta', 'Dirección incorrecta', 4)
on conflict (categoria, valor) do nothing;

-- ---------------------------------------------------------------------
-- 4. AUDITORÍA Y BITÁCORAS
-- ---------------------------------------------------------------------
create table if not exists public.auditoria (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid references public.perfiles(id),
  accion text not null,                       -- ej: 'cierre_manifiesto', 'cambio_rol', 'edicion_sla'
  entidad text,                                -- tabla o módulo afectado
  entidad_id uuid,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_auditoria_usuario on public.auditoria(usuario_id);
create index if not exists idx_auditoria_created on public.auditoria(created_at desc);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_admin_lectura" on public.auditoria;
create policy "auditoria_admin_lectura" on public.auditoria
  for select using (public.current_role_name() = 'admin');

drop policy if exists "auditoria_insert_autenticados" on public.auditoria;
create policy "auditoria_insert_autenticados" on public.auditoria
  for insert with check (auth.role() = 'authenticated');

-- Helper para registrar auditoría desde el frontend con una sola llamada RPC
create or replace function public.registrar_auditoria(
  p_accion text,
  p_entidad text default null,
  p_entidad_id uuid default null,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditoria (usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), p_accion, p_entidad, p_entidad_id, p_detalle);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. MANIFIESTOS QR MAESTRO (Módulo 2 y 4)
-- ---------------------------------------------------------------------
alter table public.manifiestos_aranda
  add column if not exists codigo_qr_maestro text unique,
  add column if not exists sucursal_id uuid references public.sucursales(id),
  add column if not exists cerrado boolean not null default false,
  add column if not exists cerrado_en timestamptz;

-- ---------------------------------------------------------------------
-- 6. DATOS DE JORNADA DEL MOTORISTA (Módulo 1)
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists dni text,
  add column if not exists placa_actual text;

-- =====================================================================
-- FIN DE LA EXTENSIÓN
-- =====================================================================
