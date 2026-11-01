-- Pregunta previa a asignar_usuario: ¿puede el llamador asignar este rol en este negocio?
-- Existe para que admin-usuarios no cree una cuenta que luego asignar_usuario rechazaría.
-- No reemplaza a asignar_usuario, que sigue imponiendo sus reglas (autogestión, dueño protegido).
create function public.puede_asignar_rol(p_negocio_id uuid, p_rol text)
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
    and (p_rol <> 'dueno' or public.es_dueno(p_negocio_id)),
    false
  )
$$;

revoke all on function public.puede_asignar_rol(uuid, text) from public, anon, authenticated;
grant execute on function public.puede_asignar_rol(uuid, text) to authenticated;
