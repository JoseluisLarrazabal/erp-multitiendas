-- Solo el dueño gestiona a los encargados (decisión del CTO, 2026-11-10). Asignar el rol encargado, cambiar el rol
-- de un encargado, quitarlo de un negocio, desactivarlo/reactivarlo y restablecer su clave exigen ser dueño de ESE
-- negocio. Antes solo se protegía al dueño y un encargado (permiso usuarios) podía bajarle el rol a otro encargado,
-- restablecerle la clave y devolvérselo. Se reutiliza el código ERP_DUENO_PROTEGIDO. Revertir: reaplicar las
-- definiciones de 20261101120500, 20261101120600 y 20261101120000.

create or replace function public.asignar_usuario(p_negocio_id uuid, p_usuario_id uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol_actual text;
begin
  if not public.tiene_permiso(p_negocio_id, 'usuarios') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_usuario_id is null or p_rol is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if p_usuario_id = (select auth.uid()) then
    raise exception 'ERP_AUTOGESTION';
  end if;
  if not exists (
    select 1
    from public.negocios n
    join public.rol_permisos rp on rp.tipo_negocio = n.tipo
    where n.id = p_negocio_id and rp.rol = p_rol
  ) or not exists (select 1 from public.perfiles where id = p_usuario_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  -- Bloqueo del negocio: 2 administradores concurrentes podrían pisar la regla del dueño.
  perform 1 from public.negocios where id = p_negocio_id for update;

  select rol into v_rol_actual
  from public.usuario_negocio
  where usuario_id = p_usuario_id and negocio_id = p_negocio_id;

  if (p_rol in ('dueno', 'encargado') or v_rol_actual in ('dueno', 'encargado'))
     and not public.es_dueno(p_negocio_id) then
    raise exception 'ERP_DUENO_PROTEGIDO';
  end if;

  insert into public.usuario_negocio (usuario_id, negocio_id, rol)
  values (p_usuario_id, p_negocio_id, p_rol)
  on conflict (usuario_id, negocio_id) do update set rol = excluded.rol;
end;
$$;

create or replace function public.quitar_usuario(p_negocio_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol_actual text;
begin
  if not public.tiene_permiso(p_negocio_id, 'usuarios') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_usuario_id is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  if p_usuario_id = (select auth.uid()) then
    raise exception 'ERP_AUTOGESTION';
  end if;

  -- Bloqueo del negocio: 2 administradores concurrentes podrían pisar la regla del dueño.
  perform 1 from public.negocios where id = p_negocio_id for update;

  select rol into v_rol_actual
  from public.usuario_negocio
  where usuario_id = p_usuario_id and negocio_id = p_negocio_id;
  if v_rol_actual is null then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if v_rol_actual in ('dueno', 'encargado') and not public.es_dueno(p_negocio_id) then
    raise exception 'ERP_DUENO_PROTEGIDO';
  end if;

  -- La cuenta conserva siempre un negocio: si es el último, se desactiva, no se deja huérfana.
  if (select count(*) from public.usuario_negocio where usuario_id = p_usuario_id) = 1 then
    raise exception 'ERP_ULTIMO_NEGOCIO';
  end if;

  delete from public.usuario_negocio
  where usuario_id = p_usuario_id and negocio_id = p_negocio_id;
end;
$$;

create or replace function public.puede_asignar_rol(p_negocio_id uuid, p_rol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.tiene_permiso(p_negocio_id, 'usuarios')
    and exists (
      select 1
      from public.negocios n
      join public.rol_permisos rp on rp.tipo_negocio = n.tipo
      where n.id = p_negocio_id and rp.rol = p_rol
    )
    and (p_rol not in ('dueno', 'encargado') or public.es_dueno(p_negocio_id)),
    false
  )
$$;


-- Dueño donde el objetivo es dueño o encargado; permiso usuarios en todos sus negocios; nunca sobre sí mismo.
create or replace function public.puede_administrar_cuenta(p_usuario_id uuid)
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
            objetivo.rol in ('dueno', 'encargado')
            and not public.es_dueno(objetivo.negocio_id)
          )
        )
    ),
    false
  )
$$;

comment on function public.puede_restablecer_clave(uuid) is
  'Restablecer la clave exige puede_administrar_cuenta y que el destino no sea encargado donde el llamador no es dueño. '
  'El rodeo por cambio de rol quedó cerrado: asignar_usuario y quitar_usuario exigen dueño para tocar a un encargado.';
