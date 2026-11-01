-- Tenencia: negocios, ubicaciones, perfiles, usuarios por negocio, permisos por rol y dispositivos,
-- con sus helpers de RLS, policies y privilegios. Orden: tablas, helpers, policies, privilegios.
-- Los helpers son security definer para no recursar con las policies de usuario_negocio.
-- Una cuenta con perfiles.activo = false queda fuera aunque su JWT siga vivo.

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  tipo text not null check (tipo in ('tienda', 'lavanderia', 'frial')),
  nit text,
  datos_nota text,
  tope_descuento numeric(5,2) not null default 0 check (tope_descuento between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  nombre text not null check (btrim(nombre) <> ''),
  tipo text not null check (tipo in ('local', 'deposito')),
  created_at timestamptz not null default now(),
  -- Destino de la FK compuesta de dispositivos: impide ubicaciones de otro negocio.
  unique (negocio_id, id)
);

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.usuario_negocio (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  negocio_id uuid not null references public.negocios (id),
  rol text not null check (rol in ('dueno', 'encargado', 'contador', 'vendedor', 'empleado')),
  created_at timestamptz not null default now(),
  primary key (usuario_id, negocio_id)
);
create index usuario_negocio_negocio_id_idx on public.usuario_negocio (negocio_id);

create table public.rol_permisos (
  tipo_negocio text not null check (tipo_negocio in ('tienda', 'lavanderia', 'frial')),
  rol text not null check (rol in ('dueno', 'encargado', 'contador', 'vendedor', 'empleado')),
  permiso text not null check (permiso in (
    'vender', 'ver_costos', 'descontar', 'anular', 'devolver_fuera_plazo', 'ajustar_inventario',
    'editar_productos', 'ver_reportes', 'caja', 'usuarios', 'cambiar_estado_orden',
    'gestionar_credito', 'gestionar_reservas', 'gestionar_compras'
  )),
  primary key (tipo_negocio, rol, permiso)
);

create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null,
  ubicacion_id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  prefijo text not null check (prefijo ~ '^[A-Z][0-9]{1,2}$'),
  created_at timestamptz not null default now(),
  foreign key (negocio_id, ubicacion_id) references public.ubicaciones (negocio_id, id),
  unique (negocio_id, prefijo)
);
create index dispositivos_ubicacion_idx on public.dispositivos (negocio_id, ubicacion_id);

alter table public.negocios enable row level security;
alter table public.ubicaciones enable row level security;
alter table public.perfiles enable row level security;
alter table public.usuario_negocio enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.dispositivos enable row level security;

-- Helpers de RLS y RPC. security definer para no recursar con las policies de usuario_negocio.
-- Una cuenta con perfiles.activo = false queda fuera aunque su JWT siga vivo.

create function public.mis_negocios()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select un.negocio_id
  from public.usuario_negocio un
  join public.perfiles p on p.id = un.usuario_id
  where un.usuario_id = (select auth.uid()) and p.activo
$$;

create function public.tiene_permiso(p_negocio_id uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuario_negocio un
    join public.perfiles p on p.id = un.usuario_id
    join public.negocios n on n.id = un.negocio_id
    join public.rol_permisos rp
      on rp.tipo_negocio = n.tipo and rp.rol = un.rol and rp.permiso = p_permiso
    where un.usuario_id = (select auth.uid())
      and un.negocio_id = p_negocio_id
      and p.activo
  )
$$;

-- Para la policy de perfiles: ve a quien comparte al menos un negocio con el llamador.
create function public.comparte_negocio(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuario_negocio un
    where un.usuario_id = p_usuario_id
      and un.negocio_id in (select public.mis_negocios())
  )
$$;

-- Privado: lo llaman las funciones security definer (que corren como su dueño), nadie por RPC.
create function public.es_dueno(p_negocio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuario_negocio un
    join public.perfiles p on p.id = un.usuario_id
    where un.usuario_id = (select auth.uid())
      and un.negocio_id = p_negocio_id
      and un.rol = 'dueno'
      and p.activo
  )
$$;

-- Regla 3: desactivar o reactivar exige `usuarios` en todos los negocios de la cuenta objetivo,
-- y ser dueño donde el objetivo es dueño. Nunca sobre sí mismo.
create function public.puede_administrar_cuenta(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and p_usuario_id <> (select auth.uid())
    and exists (select 1 from public.usuario_negocio where usuario_id = p_usuario_id)
    and not exists (
      select 1
      from public.usuario_negocio objetivo
      where objetivo.usuario_id = p_usuario_id
        and (
          not public.tiene_permiso(objetivo.negocio_id, 'usuarios')
          or (
            objetivo.rol = 'dueno'
            and not public.es_dueno(objetivo.negocio_id)
          )
        )
    ),
    false
  )
$$;

-- Policies: solo lectura. Sin policies de escritura: toda escritura pasa por RPC.

create policy negocios_select on public.negocios
  for select to authenticated
  using (id in (select public.mis_negocios()));

create policy ubicaciones_select on public.ubicaciones
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

create policy dispositivos_select on public.dispositivos
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));

create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.comparte_negocio(id));

create policy usuario_negocio_select on public.usuario_negocio
  for select to authenticated
  using (usuario_id = (select auth.uid()) or public.tiene_permiso(negocio_id, 'usuarios'));

-- La UI lee la matriz para ocultar lo que no se puede hacer; no contiene datos de ningún negocio.
create policy rol_permisos_select on public.rol_permisos
  for select to authenticated
  using (true);

revoke all on public.negocios from anon, authenticated, public;
revoke all on public.ubicaciones from anon, authenticated, public;
revoke all on public.perfiles from anon, authenticated, public;
revoke all on public.usuario_negocio from anon, authenticated, public;
revoke all on public.rol_permisos from anon, authenticated, public;
revoke all on public.dispositivos from anon, authenticated, public;

grant select on public.negocios to authenticated;
grant select on public.ubicaciones to authenticated;
grant select on public.perfiles to authenticated;
grant select on public.usuario_negocio to authenticated;
grant select on public.rol_permisos to authenticated;
grant select on public.dispositivos to authenticated;

revoke all on function public.es_dueno(uuid) from public, anon, authenticated;
revoke all on function public.mis_negocios() from public, anon, authenticated;
revoke all on function public.tiene_permiso(uuid, text) from public, anon, authenticated;
revoke all on function public.comparte_negocio(uuid) from public, anon, authenticated;
revoke all on function public.puede_administrar_cuenta(uuid) from public, anon, authenticated;

grant execute on function public.mis_negocios() to authenticated;
grant execute on function public.tiene_permiso(uuid, text) to authenticated;
grant execute on function public.comparte_negocio(uuid) to authenticated;
grant execute on function public.puede_administrar_cuenta(uuid) to authenticated;
