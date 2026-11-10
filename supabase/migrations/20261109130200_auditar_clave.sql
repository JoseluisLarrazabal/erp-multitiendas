-- Restablecer la contraseña de otra cuenta (B-5). Misma vía que auditar_cuenta: solo service_role, porque
-- admin-usuarios ya comprobó el permiso del llamador y pasa su id verificado. La contraseña nunca llega aquí.
alter table public.auditoria drop constraint auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check
  check (accion in ('insert', 'update', 'delete', 'desactivar', 'reactivar', 'restablecer_clave'));

-- Una fila por negocio de la cuenta, con antes y despues nulos.
create function public.auditar_clave(p_actor_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or p_usuario_id is null
     or not exists (select 1 from public.perfiles where id = p_usuario_id) then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  insert into public.auditoria (tabla, registro_id, negocio_id, accion, antes, despues, usuario_id)
  select 'perfiles', p_usuario_id::text, un.negocio_id, 'restablecer_clave', null, null, p_actor_id
  from public.usuario_negocio un
  where un.usuario_id = p_usuario_id;
end;
$$;

revoke all on function public.auditar_clave(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auditar_clave(uuid, uuid) to service_role;

-- Restablecer la clave equivale a entrar como esa persona: ademas de puede_administrar_cuenta, el destino no puede ser
-- encargado en un negocio donde el llamador no es dueño (un encargado solo restablece a roles inferiores).
-- NO es una barrera completa: asignar_usuario deja a quien tiene el permiso usuarios cambiar el rol de un encargado (solo
-- protege al dueño), asi que la regla se rodea cambiando el rol, restableciendo y devolviendo el rol; cada paso queda en
-- auditoria. Cerrarlo exige decidir si un encargado puede gestionar a otro encargado (decision pendiente).
create function public.puede_restablecer_clave(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.puede_administrar_cuenta(p_usuario_id)
    and not exists (
      select 1
      from public.usuario_negocio o
      where o.usuario_id = p_usuario_id
        and o.rol = 'encargado'
        and not public.es_dueno(o.negocio_id)
    ),
    false
  )
$$;

revoke all on function public.puede_restablecer_clave(uuid) from public, anon, authenticated;
grant execute on function public.puede_restablecer_clave(uuid) to authenticated;
