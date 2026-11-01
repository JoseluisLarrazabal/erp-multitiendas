-- Catálogo: categorías, productos, precios por lista y tipos de cambio. Toda escritura pasa por RPC
-- (20261101130300): authenticated solo lee. La FK compuesta (negocio_id, ...) impide referencias a otro negocio.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  nombre text not null check (btrim(nombre) <> ''),
  created_at timestamptz not null default now(),
  -- Destino de la FK compuesta de productos.
  unique (negocio_id, id)
);
create unique index categorias_nombre_uq on public.categorias (negocio_id, lower(nombre));

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  codigo text not null check (btrim(codigo) <> ''),
  codigo_barras text check (codigo_barras is null or btrim(codigo_barras) <> ''),
  nombre text not null check (btrim(nombre) <> ''),
  marca text,
  modelo text,
  categoria_id uuid,
  tipo text not null check (tipo in ('producto', 'servicio', 'insumo')),
  unidad text not null default 'unidad' check (unidad in ('unidad', 'kg')),
  controla_serie boolean not null default false,
  garantia_meses integer check (garantia_meses is null or garantia_meses >= 0),
  stock_minimo numeric(12,3) check (stock_minimo is null or stock_minimo >= 0),
  foto_path text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Con categoria_id nulo la FK no aplica (MATCH SIMPLE).
  foreign key (negocio_id, categoria_id) references public.categorias (negocio_id, id),
  -- Destino de las FK compuestas de precios, kardex y series.
  unique (negocio_id, id),
  constraint productos_codigo_uq unique (negocio_id, codigo)
);
create unique index productos_codigo_barras_uq on public.productos (negocio_id, codigo_barras)
  where codigo_barras is not null;
create index productos_categoria_idx on public.productos (negocio_id, categoria_id);

create table public.producto_precios (
  negocio_id uuid not null,
  producto_id uuid not null,
  lista text not null check (lista in ('contado', 'credito', 'mayorista', 'minimo', 'normal', 'express')),
  monto numeric(12,2) not null check (monto >= 0),
  moneda text not null check (moneda in ('BOB', 'USD')),
  updated_at timestamptz not null default now(),
  primary key (producto_id, lista),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id)
);
create index producto_precios_negocio_producto_idx on public.producto_precios (negocio_id, producto_id);

-- Rige el más reciente. clock_timestamp: dos registros en una misma transacción no empatan.
create table public.tipos_cambio (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  valor numeric(10,4) not null check (valor > 0),
  vigente_desde timestamptz not null default clock_timestamp(),
  usuario_id uuid references public.perfiles (id)
);
create index tipos_cambio_vigente_idx on public.tipos_cambio (negocio_id, vigente_desde desc);

-- Triggers

create function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tablas append-only (tipos_cambio, auditoria): UPDATE, DELETE y TRUNCATE rechazados, también al dueño.
create function public.rechazar_modificacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ERP_SOLO_AGREGAR';
end;
$$;

revoke all on function public.tocar_updated_at() from public, anon, authenticated;
revoke all on function public.rechazar_modificacion() from public, anon, authenticated;

create trigger productos_updated_at
  before update on public.productos
  for each row execute function public.tocar_updated_at();

create trigger tipos_cambio_solo_agregar
  before update or delete on public.tipos_cambio
  for each row execute function public.rechazar_modificacion();
create trigger tipos_cambio_sin_truncate
  before truncate on public.tipos_cambio
  for each statement execute function public.rechazar_modificacion();

-- RLS: solo lectura. Sin policies de escritura.

alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.producto_precios enable row level security;
alter table public.tipos_cambio enable row level security;

create policy categorias_select on public.categorias
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

create policy productos_select on public.productos
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

create policy producto_precios_select on public.producto_precios
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

create policy tipos_cambio_select on public.tipos_cambio
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

revoke all on public.categorias from anon, authenticated, public;
revoke all on public.productos from anon, authenticated, public;
revoke all on public.producto_precios from anon, authenticated, public;
revoke all on public.tipos_cambio from anon, authenticated, public;

grant select on public.categorias to authenticated;
grant select on public.productos to authenticated;
grant select on public.producto_precios to authenticated;
grant select on public.tipos_cambio to authenticated;
