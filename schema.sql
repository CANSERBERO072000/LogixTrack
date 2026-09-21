-- =====================================================================
-- SISTEMA DE CONTROL LOGÍSTICO, TRAZABILIDAD Y CONCILIACIÓN AUTOMÁTICA
-- schema.sql — Ejecutar completo en Supabase SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'driver', 'warehouse', 'executive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_paquete as enum (
    'pendiente', 'en_ruta', 'entregado', 'fallido',
    'en_bodega', 'reasignado', 'conciliado', 'faltante', 'sobrante'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_evidencia as enum ('foto', 'firma', 'qr_scan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type severidad_inconsistencia as enum ('baja', 'media', 'alta', 'critica');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. TABLA DE PERFILES (extiende auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  role user_role not null default 'driver',
  zona_asignada text,                       -- zona por defecto para drivers/warehouse
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.perfiles is 'Extiende auth.users con rol y metadatos de negocio';

-- ---------------------------------------------------------------------
-- 3. RUTAS
-- ---------------------------------------------------------------------
create table if not exists public.rutas (
  id uuid primary key default uuid_generate_v4(),
  codigo_ruta text not null unique,
  zona text not null,
  driver_id uuid references public.perfiles(id),
  fecha date not null default current_date,
  estado text not null default 'planificada', -- planificada | activa | cerrada
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. MANIFIESTOS ARANDA (carga masiva de Excel)
-- ---------------------------------------------------------------------
create table if not exists public.manifiestos_aranda (
  id uuid primary key default uuid_generate_v4(),
  nombre_archivo text not null,
  cargado_por uuid references public.perfiles(id),
  total_filas int not null default 0,
  filas_validas int not null default 0,
  filas_error int not null default 0,
  hash_archivo text,                         -- para evitar cargas duplicadas
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. PAQUETES (entidad central)
-- ---------------------------------------------------------------------
create table if not exists public.paquetes (
  id uuid primary key default uuid_generate_v4(),
  guia text not null unique,                 -- número de guía Aranda
  manifiesto_id uuid references public.manifiestos_aranda(id) on delete set null,
  ruta_id uuid references public.rutas(id) on delete set null,
  driver_id uuid references public.perfiles(id),
  zona text not null,
  destinatario text,
  direccion text,
  telefono_destinatario text,
  estado estado_paquete not null default 'pendiente',
  es_imprevisto boolean not null default false, -- recolección Ad-Hoc
  peso_kg numeric(10,2),
  bodeguero_receptor_id uuid references public.perfiles(id),
  conciliado boolean not null default false,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_paquetes_zona on public.paquetes(zona);
create index if not exists idx_paquetes_estado on public.paquetes(estado);
create index if not exists idx_paquetes_driver on public.paquetes(driver_id);
create index if not exists idx_paquetes_guia on public.paquetes(guia);

-- ---------------------------------------------------------------------
-- 6. EVIDENCIAS DE ESCANEO (fotos, firmas, QR con metadatos criptográficos)
-- ---------------------------------------------------------------------
create table if not exists public.evidencias_escaneo (
  id uuid primary key default uuid_generate_v4(),
  paquete_id uuid not null references public.paquetes(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id),
  tipo tipo_evidencia not null,
  storage_path text not null,                -- ruta en Supabase Storage
  hash_sha256 text not null,                 -- huella del archivo original (integridad)
  timestamp_captura timestamptz not null default now(),
  latitud double precision,
  longitud double precision,
  precision_gps numeric(6,2),
  metadata_dispositivo jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidencias_paquete on public.evidencias_escaneo(paquete_id);

-- ---------------------------------------------------------------------
-- 7. INCONSISTENCIAS (actas digitales de bodega)
-- ---------------------------------------------------------------------
create table if not exists public.inconsistencias (
  id uuid primary key default uuid_generate_v4(),
  paquete_id uuid references public.paquetes(id) on delete cascade,
  reportado_por uuid references public.perfiles(id),
  tipo text not null,                         -- faltante | sobrante | dañado | mal_direccionado
  severidad severidad_inconsistencia not null default 'media',
  descripcion text,
  zona text,
  resuelta boolean not null default false,
  resuelta_por uuid references public.perfiles(id),
  resuelta_en timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. TRIGGERS: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_perfiles_updated_at on public.perfiles;
create trigger trg_perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_paquetes_updated_at on public.paquetes;
create trigger trg_paquetes_updated_at
  before update on public.paquetes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. TRIGGER: auto-crear perfil al registrarse en auth.users
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, nombre_completo, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'driver')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 10. TRIGGER: al insertar inconsistencia, marcar estado del paquete
-- ---------------------------------------------------------------------
create or replace function public.marcar_estado_por_inconsistencia()
returns trigger as $$
begin
  if new.tipo = 'faltante' then
    update public.paquetes set estado = 'faltante' where id = new.paquete_id;
  elsif new.tipo = 'sobrante' then
    update public.paquetes set estado = 'sobrante' where id = new.paquete_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_inconsistencia_estado on public.inconsistencias;
create trigger trg_inconsistencia_estado
  after insert on public.inconsistencias
  for each row execute function public.marcar_estado_por_inconsistencia();

-- ---------------------------------------------------------------------
-- 11. VISTAS DE REPORTES
-- ---------------------------------------------------------------------

-- Reporte semanal de volumen y tonelaje por zona
create or replace view public.vw_reporte_semanal_volumen as
select
  date_trunc('week', p.created_at)::date as semana,
  p.zona,
  count(*) as total_paquetes,
  count(*) filter (where p.estado = 'entregado') as entregados,
  count(*) filter (where p.estado in ('faltante','sobrante')) as inconsistentes,
  round(sum(coalesce(p.peso_kg,0)),2) as tonelaje_kg,
  round(
    100.0 * count(*) filter (where p.estado = 'entregado') / nullif(count(*),0), 2
  ) as porcentaje_otif
from public.paquetes p
group by 1,2
order by 1 desc, 2;

-- Vista de conciliación (semáforo) por manifiesto
create or replace view public.vw_conciliacion_manifiesto as
select
  m.id as manifiesto_id,
  m.nombre_archivo,
  count(p.id) as total_paquetes,
  count(*) filter (where p.estado = 'conciliado') as conciliados,
  count(*) filter (where p.estado = 'faltante') as faltantes,
  count(*) filter (where p.estado = 'sobrante') as sobrantes,
  count(*) filter (where p.es_imprevisto) as imprevistos
from public.manifiestos_aranda m
left join public.paquetes p on p.manifiesto_id = m.id
group by m.id, m.nombre_archivo;

-- Cadena de custodia por paquete (para /history)
create or replace view public.vw_cadena_custodia as
select
  p.id as paquete_id,
  p.guia,
  e.tipo,
  e.timestamp_captura,
  e.latitud,
  e.longitud,
  e.storage_path,
  pf.nombre_completo as usuario,
  pf.role as usuario_role
from public.paquetes p
join public.evidencias_escaneo e on e.paquete_id = p.id
join public.perfiles pf on pf.id = e.usuario_id
order by e.timestamp_captura asc;

-- ---------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.rutas enable row level security;
alter table public.manifiestos_aranda enable row level security;
alter table public.paquetes enable row level security;
alter table public.evidencias_escaneo enable row level security;
alter table public.inconsistencias enable row level security;

-- Helper: obtener rol del usuario actual sin recursión de RLS
create or replace function public.current_role_name()
returns user_role
language sql
security definer
stable
as $$
  select role from public.perfiles where id = auth.uid();
$$;

-- --- PERFILES ---
drop policy if exists "perfiles_select_propio_o_admin" on public.perfiles;
create policy "perfiles_select_propio_o_admin" on public.perfiles
  for select using (
    id = auth.uid() or public.current_role_name() in ('admin','executive')
  );

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update using (id = auth.uid() or public.current_role_name() = 'admin');

-- --- RUTAS ---
drop policy if exists "rutas_admin_full" on public.rutas;
create policy "rutas_admin_full" on public.rutas
  for all using (public.current_role_name() in ('admin','executive'))
  with check (public.current_role_name() in ('admin','executive'));

drop policy if exists "rutas_driver_propias" on public.rutas;
create policy "rutas_driver_propias" on public.rutas
  for select using (driver_id = auth.uid());

drop policy if exists "rutas_warehouse_lectura" on public.rutas;
create policy "rutas_warehouse_lectura" on public.rutas
  for select using (public.current_role_name() = 'warehouse');

-- --- MANIFIESTOS ---
drop policy if exists "manifiestos_admin_full" on public.manifiestos_aranda;
create policy "manifiestos_admin_full" on public.manifiestos_aranda
  for all using (public.current_role_name() in ('admin','executive'))
  with check (public.current_role_name() in ('admin','executive'));

-- --- PAQUETES ---
drop policy if exists "paquetes_admin_full" on public.paquetes;
create policy "paquetes_admin_full" on public.paquetes
  for all using (public.current_role_name() in ('admin','executive'))
  with check (public.current_role_name() in ('admin','executive'));

drop policy if exists "paquetes_driver_asignados" on public.paquetes;
create policy "paquetes_driver_asignados" on public.paquetes
  for select using (driver_id = auth.uid());

drop policy if exists "paquetes_driver_update_propios" on public.paquetes;
create policy "paquetes_driver_update_propios" on public.paquetes
  for update using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists "paquetes_driver_insert_adhoc" on public.paquetes;
create policy "paquetes_driver_insert_adhoc" on public.paquetes
  for insert with check (driver_id = auth.uid() and es_imprevisto = true);

drop policy if exists "paquetes_warehouse_por_zona" on public.paquetes;
create policy "paquetes_warehouse_por_zona" on public.paquetes
  for select using (
    public.current_role_name() = 'warehouse'
    and zona = (select zona_asignada from public.perfiles where id = auth.uid())
  );

drop policy if exists "paquetes_warehouse_update_zona" on public.paquetes;
create policy "paquetes_warehouse_update_zona" on public.paquetes
  for update using (
    public.current_role_name() = 'warehouse'
    and zona = (select zona_asignada from public.perfiles where id = auth.uid())
  );

-- --- EVIDENCIAS ---
drop policy if exists "evidencias_insert_propio" on public.evidencias_escaneo;
create policy "evidencias_insert_propio" on public.evidencias_escaneo
  for insert with check (usuario_id = auth.uid());

drop policy if exists "evidencias_select_admin_o_dueno" on public.evidencias_escaneo;
create policy "evidencias_select_admin_o_dueno" on public.evidencias_escaneo
  for select using (
    usuario_id = auth.uid() or public.current_role_name() in ('admin','executive','warehouse')
  );

-- --- INCONSISTENCIAS ---
drop policy if exists "inconsistencias_insert_warehouse_admin" on public.inconsistencias;
create policy "inconsistencias_insert_warehouse_admin" on public.inconsistencias
  for insert with check (public.current_role_name() in ('warehouse','admin'));

drop policy if exists "inconsistencias_select_admin_exec_warehouse" on public.inconsistencias;
create policy "inconsistencias_select_admin_exec_warehouse" on public.inconsistencias
  for select using (public.current_role_name() in ('admin','executive','warehouse'));

drop policy if exists "inconsistencias_update_admin" on public.inconsistencias;
create policy "inconsistencias_update_admin" on public.inconsistencias
  for update using (public.current_role_name() in ('admin','warehouse'));

-- ---------------------------------------------------------------------
-- 13. STORAGE BUCKETS PRIVADOS
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', false)
on conflict (id) do nothing;

-- Políticas de Storage: solo usuarios autenticados pueden subir a su propia carpeta {uid}/...
drop policy if exists "evidencias_insert_auth" on storage.objects;
create policy "evidencias_insert_auth" on storage.objects
  for insert with check (
    bucket_id = 'evidencias'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "evidencias_select_auth" on storage.objects;
create policy "evidencias_select_auth" on storage.objects
  for select using (
    bucket_id in ('evidencias','firmas')
    and auth.role() = 'authenticated'
  );

drop policy if exists "firmas_insert_auth" on storage.objects;
create policy "firmas_insert_auth" on storage.objects
  for insert with check (
    bucket_id = 'firmas'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- FIN DEL SCRIPT — Ejecutar en un solo bloque en el SQL Editor de Supabase
-- =====================================================================
