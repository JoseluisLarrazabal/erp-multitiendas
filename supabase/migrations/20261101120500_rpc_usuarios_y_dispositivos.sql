-- RPC de usuarios y dispositivos. Errores con código estable que la app traduce:
-- ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_DUENO_PROTEGIDO, ERP_AUTOGESTION, ERP_ULTIMO_NEGOCIO,
-- ERP_PREFIJO_DUPLICADO. Activar o desactivar una cuenta no es RPC: es el baneo en Auth (ver perfil_de_cuenta).

-- Regla 1: solo un dueño del negocio asigna `dueno` o toca a un dueño. Regla 2: nadie se gestiona a sí mismo.
create function public.asignar_usuario(p_negocio_id uuid, p_usuario_id uuid, p_rol text)
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

  if (p_rol = 'dueno' or v_rol_actual = 'dueno') and not public.es_dueno(p_negocio_id) then
    raise exception 'ERP_DUENO_PROTEGIDO';
  end if;

  insert into public.usuario_negocio (usuario_id, negocio_id, rol)
  values (p_usuario_id, p_negocio_id, p_rol)
  on conflict (usuario_id, negocio_id) do update set rol = excluded.rol;
end;
$$;

create function public.quitar_usuario(p_negocio_id uuid, p_usuario_id uuid)
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

  if v_rol_actual = 'dueno' and not public.es_dueno(p_negocio_id) then
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

create function public.registrar_dispositivo(
  p_negocio_id uuid, p_ubicacion_id uuid, p_nombre text, p_prefijo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.tiene_permiso(p_negocio_id, 'usuarios') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if p_ubicacion_id is null
     or p_nombre is null or btrim(p_nombre) = ''
     or p_prefijo is null or p_prefijo !~ '^[A-Z][0-9]{1,2}$'
     or not exists (
       select 1 from public.ubicaciones where id = p_ubicacion_id and negocio_id = p_negocio_id
     ) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.dispositivos (negocio_id, ubicacion_id, nombre, prefijo)
  values (p_negocio_id, p_ubicacion_id, btrim(p_nombre), p_prefijo)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'ERP_PREFIJO_DUPLICADO';
end;
$$;

revoke all on function public.asignar_usuario(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.quitar_usuario(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registrar_dispositivo(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.asignar_usuario(uuid, uuid, text) to authenticated;
grant execute on function public.quitar_usuario(uuid, uuid) to authenticated;
grant execute on function public.registrar_dispositivo(uuid, uuid, text, text) to authenticated;
