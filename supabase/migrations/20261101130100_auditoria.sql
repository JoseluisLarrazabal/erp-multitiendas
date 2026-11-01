-- Auditoría (RF-TR-09): append-only, con negocio_id nullable (rol_permisos no tiene negocio).
-- registro_id es texto: la clave de la fila; si es compuesta, sus columnas unidas con ':'
-- (producto_precios 'producto_id:lista'). Las columnas de clave se pasan como argumentos del trigger.
-- usuario_id es auth.uid(): null en el seed y en la API admin. Sin FK, para que la historia sobreviva a las cuentas.

create table public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id text not null,
  negocio_id uuid,
  accion text not null check (accion in ('insert', 'update', 'delete', 'desactivar', 'reactivar')),
  antes jsonb,
  despues jsonb,
  usuario_id uuid,
  created_at timestamptz not null default now()
);
create index auditoria_negocio_idx on public.auditoria (negocio_id, created_at desc);
create index auditoria_registro_idx on public.auditoria (tabla, registro_id);

create trigger auditoria_solo_agregar
  before update or delete on public.auditoria
  for each row execute function public.rechazar_modificacion();
create trigger auditoria_sin_truncate
  before truncate on public.auditoria
  for each statement execute function public.rechazar_modificacion();

alter table public.auditoria enable row level security;

-- Filas sin negocio (rol_permisos) no las lee nadie por la API: tiene_permiso(null, ...) es falso.
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (public.tiene_permiso(negocio_id, 'ver_reportes'));

revoke all on public.auditoria from anon, authenticated, public;
grant select on public.auditoria to authenticated;

create function public.auditar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_despues jsonb;
  v_fila jsonb;
begin
  if tg_op <> 'INSERT' then v_antes := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_despues := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and v_antes = v_despues then
    return null;
  end if;
  v_fila := coalesce(v_despues, v_antes);

  insert into public.auditoria (tabla, registro_id, negocio_id, accion, antes, despues, usuario_id)
  values (
    tg_table_name,
    (select string_agg(v_fila ->> c, ':' order by o)
       from unnest(case when tg_nargs = 0 then array['id'] else tg_argv end) with ordinality as a (c, o)),
    (v_fila ->> 'negocio_id')::uuid,
    lower(tg_op),
    v_antes,
    v_despues,
    (select auth.uid())
  );
  return null;
end;
$$;

revoke all on function public.auditar_cambio() from public, anon, authenticated;

create trigger productos_auditar
  after insert or update or delete on public.productos
  for each row execute function public.auditar_cambio('id');
create trigger producto_precios_auditar
  after insert or update or delete on public.producto_precios
  for each row execute function public.auditar_cambio('producto_id', 'lista');
create trigger tipos_cambio_auditar
  after insert or update or delete on public.tipos_cambio
  for each row execute function public.auditar_cambio('id');
create trigger usuario_negocio_auditar
  after insert or update or delete on public.usuario_negocio
  for each row execute function public.auditar_cambio('usuario_id', 'negocio_id');
create trigger rol_permisos_auditar
  after insert or update or delete on public.rol_permisos
  for each row execute function public.auditar_cambio('tipo_negocio', 'rol', 'permiso');

-- Desactivar o reactivar una cuenta es baneo en Auth (auth.uid() es null ahí): admin-usuarios lo registra
-- con el JWT del llamador, una fila por negocio de la cuenta. Mismo permiso que la acción misma.
create function public.auditar_cuenta(p_usuario_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.puede_administrar_cuenta(p_usuario_id) then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_activo is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.auditoria (tabla, registro_id, negocio_id, accion, antes, despues, usuario_id)
  select 'perfiles', p_usuario_id::text, un.negocio_id,
    case when p_activo then 'reactivar' else 'desactivar' end,
    jsonb_build_object('activo', not p_activo), jsonb_build_object('activo', p_activo), (select auth.uid())
  from public.usuario_negocio un
  where un.usuario_id = p_usuario_id;
end;
$$;

revoke all on function public.auditar_cuenta(uuid, boolean) from public, anon, authenticated;
grant execute on function public.auditar_cuenta(uuid, boolean) to authenticated;
